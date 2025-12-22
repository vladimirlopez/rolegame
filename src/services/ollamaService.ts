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

const OLLAMA_BASE_URL = 'http://localhost:11434';

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

  async generateResponse(
    model: string,
    prompt: string,
    context?: number[],
    system?: string,
    stream: boolean = false
  ): Promise<OllamaResponse> {
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
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate response');
      }

      // For non-streaming response
      if (!stream) {
        return await response.json();
      }
      
      // TODO: Handle streaming if needed, currently returning final JSON for simplicity in non-stream
      return await response.json();
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  },

  // Streaming helper
  async *generateResponseStream(
    model: string,
    prompt: string,
    context?: number[],
    system?: string
  ): AsyncGenerator<OllamaResponse, void, unknown> {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, context, system, stream: true }),
        });

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            // Ollama can send multiple JSON objects in one chunk
            const lines = chunk.split('\n').filter(Boolean);
            
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    yield json;
                } catch (e) {
                    console.error('Error parsing stream chunk', e);
                }
            }
        }
    } catch (error) {
        console.error('Error in stream generation:', error);
        throw error;
    }
  }
};
