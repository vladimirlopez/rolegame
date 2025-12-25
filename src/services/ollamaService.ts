export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

const OLLAMA_BASE_URL = '/api/ollama';

export const OllamaService = {
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Error listing models:', error);
      throw error;
    }
  },

  /**
   * Unloads a model from Ollama's memory by sending a request with keep_alive: 0.
   * This frees up VRAM so another model can use the GPU.
   */
  async unloadModel(model: string): Promise<void> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: '',
          keep_alive: 0, // Immediately unload the model
        }),
      });

      if (!response.ok) {
        console.warn(`Failed to unload model ${model}:`, await response.text());
      } else {
        console.log(`Model ${model} unloaded from memory.`);
      }
    } catch (error) {
      console.warn('Error unloading model:', error);
      // Non-critical error - don't throw
    }
  },

  async generateResponse(
    model: string,
    prompt: string,
    context?: number[],
    system?: string,
    stream: boolean = false,
    options?: { num_ctx?: number; num_predict?: number }
  ): Promise<OllamaResponse> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 180000); // 180s timeout for model loading

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          context,
          system,
          stream,
          options: options || { num_ctx: 4096 }, // Default to 4096 for better story continuity
        }),
        signal: controller.signal
      });
      clearTimeout(id);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama API Error (${response.status}): ${errText}`);
      }

      // For non-streaming response
      if (!stream) {
        return await response.json();
      }

      return await response.json();
    } catch (error: unknown) {
      clearTimeout(id);
      console.error('Error generating response:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Connection timed out. The model might be taking too long to load.');
      }
      throw error;
    }
  },

  // Streaming helper
  async *generateResponseStream(
    model: string,
    prompt: string,
    context?: number[],
    system?: string,
    signal?: AbortSignal,
    options?: { num_ctx?: number; num_predict?: number }
  ): AsyncGenerator<OllamaResponse, void, unknown> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model, 
          prompt, 
          context, 
          system, 
          stream: true,
          options: options || { num_ctx: 4096 } // Default to 4096 for better story continuity
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama API Error (${response.status}): ${errText}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let brackets = 0;
      let inString = false;
      let escaped = false;
      let startIdx = -1;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer.trim()) {
            try { yield JSON.parse(buffer); } catch (e) { /* ignore */ }
          }
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        let i = 0;
        while (i < buffer.length) {
          const char = buffer[i];

          if (escaped) {
            escaped = false;
            i++;
            continue;
          }
          if (char === '\\') {
            escaped = true;
            i++;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            i++;
            continue;
          }

          if (!inString) {
            if (char === '{') {
              if (brackets === 0) startIdx = i;
              brackets++;
            } else if (char === '}') {
              brackets--;
              if (brackets === 0 && startIdx !== -1) {
                const jsonStr = buffer.substring(startIdx, i + 1);
                try {
                  yield JSON.parse(jsonStr);
                } catch (e) {
                  console.error("Stream parse error:", e);
                }
                buffer = buffer.substring(i + 1);
                i = -1;
                startIdx = -1;
              }
            }
          }
          i++;
        }
      }
    } catch (error) {
      console.error('Error in stream generation:', error);
      throw error;
    }
  }
};
