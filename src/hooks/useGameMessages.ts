import { useRef, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { ChatMessage } from '../types';
import { OllamaService } from '../services/ollamaService';
import { parseGameResponse, buildContextSummary, SYSTEM_INSTRUCTION_SUFFIX } from '../utils/responseParser';

export interface StoryConfig {
    genre: string;
    characterConcept: string;
    startingOption: string;
    customIntro: string;
}

interface UseGameMessagesOptions {
    onStreamUpdate?: () => void;
    storyConfig?: StoryConfig | null;
}

const GENRE_DESCRIPTIONS: Record<string, string> = {
    fantasy: 'a high fantasy world with magic, mythical creatures, and medieval settings',
    scifi: 'a science fiction universe with advanced technology, space travel, and futuristic societies',
    noir: 'a noir mystery setting with crime, intrigue, and morally ambiguous characters',
    horror: 'a horror setting with supernatural elements, tension, and survival themes',
    historical: 'a historically-inspired setting with period-accurate details and atmosphere',
    modern: 'a modern contemporary setting in the present day',
    custom: 'a unique setting based on the player\'s preferences'
};

/**
 * Detects if the player is attempting to move/travel to a new location
 * Returns a prompt suffix to FORCE the AI to complete the movement
 */
const detectMovementIntent = (input: string): string => {
    const lowerInput = input.toLowerCase().trim();

    // Extract destination from player input
    const destinationMatch = lowerInput.match(/(?:go|head|travel|walk|run|return|arrive|visit|get)\s+(?:to|at|back to)?\s*(?:the\s+)?(.+?)(?:\s+to\s+see|\s+to\s+meet|\s+to\s+find|$)/i);
    const destination = destinationMatch ? destinationMatch[1].trim() : 'their destination';

    // Arrival commands - player explicitly says they arrive
    const arrivalPatterns = [
        /^i\s+arrive/i,
        /^i\s+enter/i,
        /^i\s+reach/i,
        /^i\s+get\s+to/i,
        /^i('m| am)\s+(at|inside|there)/i,
        /^i\s+step\s+(into|inside)/i,
    ];

    for (const pattern of arrivalPatterns) {
        if (pattern.test(lowerInput)) {
            return `\n\n[ARRIVAL COMMAND - The player has ARRIVED. You MUST describe them being INSIDE ${destination} NOW. Start your response with them already at the new location. Use [LOCATION: ${destination}|Description]. Do NOT describe traveling or leaving - they are ALREADY THERE.]`;
        }
    }

    // Movement/travel commands
    const movementPatterns = [
        /^i\s+(go|head|travel|walk|run|return|leave|exit|depart|move)\s+(to|towards?|back|home|for)/i,
        /^i\s+(go|head|walk|run)\s+\w+/i,
        /^(let'?s?|we)\s+(go|head|travel|leave|return)/i,
        /^(going|heading|leaving|returning)\s+(to|home|back)/i,
        /^take me to/i,
        /^bring me to/i,
        /^i want to (go|leave|return|head|visit)/i,
        /^i('d| would) like to (go|leave|return|visit)/i,
        /^(off to|back to|home to)/i,
        /^go to/i,  // Catches "Go to the Diogenes club"
        /need to (visit|go|see|meet)/i,  // Catches "I need to visit Mycroft"
        /^i\s+(need|must|have)\s+to\s+(go|visit|see|get)/i,
    ];

    for (const pattern of movementPatterns) {
        if (pattern.test(lowerInput)) {
            return `\n\n[MOVEMENT COMMAND - COMPLETE THE JOURNEY IN THIS RESPONSE!
You MUST:
1. One brief travel sentence (MAXIMUM)
2. Describe player ARRIVING and being INSIDE ${destination}
3. Use [LOCATION: ${destination}|Description] tag
4. Describe the NEW location's interior/details
5. DO NOT end with fog, traveling, or suspense - they ARRIVE NOW!
FORBIDDEN: Ending response with player still outside or traveling.]`;
        }
    }

    // Home-specific patterns
    if (/(go|head|travel|return|leave|visit)\s+(to\s+)?my\s+(home|apartment|house|room|place)/i.test(lowerInput)) {
        return `\n\n[MOVEMENT TO HOME - Describe arrival at their home. Use [LOCATION: Player's Home|Description]. They ARRIVE in this response.]`;
    }

    return '';
};

export const useGameMessages = (options: UseGameMessagesOptions = {}) => {
    const {
        selectedModel,
        systemPrompt,
        chatHistory,
        addMessage,
        contextVector,
        setContextVector,
        inventory,
        addItem,
        addLocation,
        addNpc,
        addStoryEvent,
        updateLastMessage,
        getCurrentLocation,
        getNpcsAtCurrentLocation,
        getRecentEvents,
    } = useGameStore();

    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Aborts any in-progress AI generation
     */
    const abortGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    // Get story facts from the store
    const getStoryFacts = useGameStore(state => state.getStoryFacts);
    const addStoryFact = useGameStore(state => state.addStoryFact);

    /**
     * Processes parsed commands from AI response
     */
    const processCommands = useCallback((commands: ReturnType<typeof parseGameResponse>['commands']) => {
        commands.forEach(cmd => {
            switch (cmd.type) {
                case 'ADD_ITEM':
                    addItem(cmd.payload);
                    break;
                case 'SET_LOCATION':
                    addLocation(cmd.payload);
                    break;
                case 'ADD_NPC':
                    addNpc(cmd.payload);
                    break;
                case 'STORY_EVENT':
                    addStoryEvent(cmd.payload);
                    break;
                case 'STORY_FACT':
                    addStoryFact(cmd.payload.fact, cmd.payload.importance);
                    break;
            }
        });
    }, [addItem, addLocation, addNpc, addStoryEvent, addStoryFact]);


    /**
     * Builds context reminder for the AI
     */
    const buildContextReminder = useCallback((): string => {
        const currentLocation = getCurrentLocation();
        const npcsHere = getNpcsAtCurrentLocation();
        const recentEvents = getRecentEvents(3);
        const storyFacts = getStoryFacts();

        return buildContextSummary(
            currentLocation,
            inventory,
            npcsHere,
            recentEvents,
            storyFacts
        );
    }, [getCurrentLocation, getNpcsAtCurrentLocation, getRecentEvents, getStoryFacts, inventory]);

    /**
     * Builds the initialization prompt based on story config
     */
    const buildInitPrompt = useCallback((): string => {
        const config = options.storyConfig;

        if (!config) {
            return "Greet the player and ask them how they would like to begin their adventure. What kind of character will they be? What is their goal? Set the scene with an initial location using the [LOCATION:...] tag.";
        }

        const genreDesc = GENRE_DESCRIPTIONS[config.genre] || GENRE_DESCRIPTIONS.custom;
        let prompt = `The setting is ${genreDesc}.\n\n`;

        // Handle character concept
        if (config.characterConcept) {
            prompt += `The player's character concept is: "${config.characterConcept}".\n\n`;
        }

        // Handle starting option
        switch (config.startingOption) {
            case 'ask':
                prompt += `Begin by briefly setting the scene with a [LOCATION:...] tag, then ASK the player what they would like to do first. Give them 2-3 specific options to choose from, or let them suggest their own idea. Don't assume what they want to do - let them decide.`;
                break;
            case 'tavern':
                prompt += `Begin the story at a classic hub location appropriate for the genre (a tavern, cantina, office, safe house, etc.). Describe the atmosphere and a few interesting NPCs using [NPC:...] tags. Then ask the player what catches their attention.`;
                break;
            case 'action':
                prompt += `Begin the story in the middle of an exciting moment - perhaps a chase, discovery, or confrontation. Set the scene dramatically with a [LOCATION:...] tag and present the player with an immediate choice or action to take.`;
                break;
            case 'custom':
                if (config.customIntro) {
                    prompt += `The player has provided this opening scenario: "${config.customIntro}"\n\nContinue from this point, establishing the scene with appropriate tags and responding to their setup.`;
                } else {
                    prompt += `Begin by asking the player to describe how they'd like the story to start.`;
                }
                break;
            default:
                prompt += `Greet the player and ask them how they would like to begin.`;
        }

        prompt += `\n\nRemember to use [LOCATION:...] tags to establish the setting. Keep the initial response concise and engaging.`;

        return prompt;
    }, [options.storyConfig]);

    /**
     * Sends a message and streams the AI response
     */
    const sendMessage = useCallback(async (input: string): Promise<boolean> => {
        if (!input.trim() || !selectedModel) return false;

        // Abort any existing generation
        abortGeneration();
        abortControllerRef.current = new AbortController();

        // Add user message
        const userMsg: ChatMessage = {
            role: 'user',
            content: input,
            timestamp: Date.now()
        };
        addMessage(userMsg);

        // Add placeholder for assistant response
        const streamMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
        addMessage(streamMsg);

        try {
            // Build context reminder
            const contextReminder = buildContextReminder();

            // Detect if player is trying to move - add extra reinforcement
            const movementHint = detectMovementIntent(input);

            const stream = OllamaService.generateResponseStream(
                selectedModel,
                input + contextReminder + movementHint,
                contextVector,
                systemPrompt + SYSTEM_INSTRUCTION_SUFFIX,
                abortControllerRef.current.signal,
                { num_ctx: 4096 }
            );

            let fullText = '';
            let finalContext: number[] | undefined;

            for await (const part of stream) {
                if (part.done) {
                    finalContext = part.context;
                    continue;
                }
                fullText += part.response;

                // Clean text during stream to hide tags
                const { cleanText } = parseGameResponse(fullText);
                updateLastMessage(cleanText);
                options.onStreamUpdate?.();
            }

            // Final parsing
            if (fullText.trim()) {
                const { cleanText, commands } = parseGameResponse(fullText);

                if (cleanText.trim()) {
                    updateLastMessage(cleanText);
                }

                processCommands(commands);

                // Only keep context if reasonable size
                if (finalContext && finalContext.length < 20000) {
                    setContextVector(finalContext);
                } else if (finalContext && finalContext.length >= 20000) {
                    console.warn('Context vector too large, resetting for memory efficiency');
                    setContextVector(undefined);
                }
            }

            return true;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return false;
            }
            console.error('Error generating response:', error);
            addMessage({
                role: 'system',
                content: error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred.',
                timestamp: Date.now()
            });
            return false;
        }
    }, [
        selectedModel,
        abortGeneration,
        addMessage,
        buildContextReminder,
        contextVector,
        systemPrompt,
        updateLastMessage,
        processCommands,
        setContextVector,
        options
    ]);

    /**
     * Initializes the story with an opening prompt
     */
    const initializeStory = useCallback(async (): Promise<boolean> => {
        if (!selectedModel || chatHistory.length > 0) return false;

        // Abort any existing generation
        abortGeneration();
        abortControllerRef.current = new AbortController();

        // Add placeholder for assistant response
        const streamMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
        addMessage(streamMsg);

        try {
            const initPrompt = buildInitPrompt();

            const stream = OllamaService.generateResponseStream(
                selectedModel,
                initPrompt,
                undefined,
                systemPrompt + SYSTEM_INSTRUCTION_SUFFIX,
                abortControllerRef.current.signal,
                { num_ctx: 4096 }
            );

            let fullText = '';
            let finalContext: number[] | undefined;

            for await (const part of stream) {
                if (part.done) {
                    finalContext = part.context;
                    continue;
                }
                fullText += part.response;

                const { cleanText } = parseGameResponse(fullText);
                updateLastMessage(cleanText);
                options.onStreamUpdate?.();
            }

            if (fullText.trim()) {
                const { cleanText, commands } = parseGameResponse(fullText);

                if (cleanText.trim()) {
                    updateLastMessage(cleanText);
                }

                processCommands(commands);

                if (finalContext && finalContext.length < 20000) {
                    setContextVector(finalContext);
                }
            }

            return true;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return false;
            }
            console.error('Failed to start story:', error);
            addMessage({
                role: 'system',
                content: error instanceof Error ? `Error: ${error.message}` : 'Error starting story. Please check Ollama connection.',
                timestamp: Date.now()
            });
            return false;
        }
    }, [
        selectedModel,
        chatHistory.length,
        abortGeneration,
        addMessage,
        buildInitPrompt,
        systemPrompt,
        updateLastMessage,
        processCommands,
        setContextVector,
        options
    ]);

    return {
        sendMessage,
        initializeStory,
        abortGeneration,
        isReady: !!selectedModel,
    };
};

