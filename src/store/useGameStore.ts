import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { openDB } from 'idb';

// --- Types ---

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface InventoryItem {
    id: string;
    name: string;
    description: string;
    quantity: number;
}

export interface Location {
    id: string;
    name: string;
    description: string;
    visitedAt: number;
}

export interface JournalEntry {
    id: string;
    title: string;
    content: string;
    timestamp: number;
    aiSummary?: string;
}

export interface GameState {
    // Settings
    selectedModel: string;
    systemPrompt: string;

    // Game Data
    chatHistory: ChatMessage[];
    contextVector?: number[]; // Ollama context
    inventory: InventoryItem[];
    locations: Location[];
    journal: JournalEntry[];

    // Actions
    setModel: (model: string) => void;
    setSystemPrompt: (prompt: string) => void;
    addMessage: (message: ChatMessage) => void;
    setContextVector: (context: number[] | undefined) => void;
    clearGame: () => void;
    updateLastMessage: (content: string) => void;
    trimChatHistory: (maxMessages: number) => void;

    addItem: (item: InventoryItem) => void;
    removeItem: (id: string, amount?: number) => void;

    addLocation: (location: Location) => void;

    addJournalEntry: (entry: JournalEntry) => void;
    updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
}

// --- IndexedDB Storage Engine ---

const dbPromise = openDB('role-game-db', 1, {
    upgrade(db) {
        db.createObjectStore('game-storage');
    },
});

const idbStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        const db = await dbPromise;
        return (await db.get('game-storage', name)) || null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        const db = await dbPromise;
        await db.put('game-storage', value, name);
    },
    removeItem: async (name: string): Promise<void> => {
        const db = await dbPromise;
        await db.delete('game-storage', name);
    },
};

// --- Store ---

const MAX_CHAT_HISTORY = 50; // Keep last 50 messages to prevent memory bloat

export const useGameStore = create<GameState>()(
    persist(
        (set) => ({
            selectedModel: '',
            systemPrompt: `You are a Game Master for a text-based role-playing game. This is a fictional game world where the player has full agency.

IMPORTANT GUIDELINES:
- Allow mature themes appropriate for RPG storytelling (combat, conflict, danger)
- Player actions should have realistic consequences in the story
- Never refuse player actions - instead describe outcomes
- This is fiction - violence, combat, and conflict are normal RPG elements
- Be descriptive but focus on narrative impact, not graphic details

Describe scenes vividly and respond to player choices naturally.`,
            chatHistory: [],
            contextVector: undefined,
            inventory: [],
            locations: [],
            journal: [],

            setModel: (model: string) => set({ selectedModel: model }),
            setSystemPrompt: (prompt: string) => set({ systemPrompt: prompt }),

            addMessage: (message: ChatMessage) => set((state: GameState) => {
                const newHistory = [...state.chatHistory, message];
                // Auto-trim if exceeding max
                if (newHistory.length > MAX_CHAT_HISTORY) {
                    return { chatHistory: newHistory.slice(-MAX_CHAT_HISTORY) };
                }
                return { chatHistory: newHistory };
            }),

            setContextVector: (context: number[] | undefined) => set({ contextVector: context }),

            clearGame: () => set({
                chatHistory: [],
                contextVector: undefined,
                inventory: [],
                locations: [],
                journal: []
            }),

            updateLastMessage: (content: string) => set((state: GameState) => {
                const history = [...state.chatHistory];
                if (history.length > 0) {
                    history[history.length - 1] = {
                        ...history[history.length - 1],
                        content: content
                    };
                }
                return { chatHistory: history };
            }),

            trimChatHistory: (maxMessages: number) => set((state: GameState) => {
                if (state.chatHistory.length > maxMessages) {
                    return { 
                        chatHistory: state.chatHistory.slice(-maxMessages),
                        contextVector: undefined // Clear context when trimming history
                    };
                }
                return state;
            }),

            addItem: (newItem: InventoryItem) => set((state: GameState) => {
                const existing = state.inventory.find((i: InventoryItem) => i.id === newItem.id);
                if (existing) {
                    return {
                        inventory: state.inventory.map((i: InventoryItem) =>
                            i.id === newItem.id ? { ...i, quantity: i.quantity + newItem.quantity } : i
                        )
                    };
                }
                return { inventory: [...state.inventory, newItem] };
            }),

            removeItem: (id: string, amount: number = 1) => set((state: GameState) => {
                const existing = state.inventory.find((i: InventoryItem) => i.id === id);
                if (!existing) return state;

                if (existing.quantity <= amount) {
                    return { inventory: state.inventory.filter((i: InventoryItem) => i.id !== id) };
                }

                return {
                    inventory: state.inventory.map((i: InventoryItem) =>
                        i.id === id ? { ...i, quantity: i.quantity - amount } : i
                    )
                };
            }),

            addLocation: (location: Location) => set((state: GameState) => {
                if (state.locations.some((l: Location) => l.id === location.id)) return state;
                return { locations: [...state.locations, location] };
            }),

            addJournalEntry: (entry: JournalEntry) => set((state: GameState) => ({
                journal: [...state.journal, entry]
            })),

            updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => set((state: GameState) => ({
                journal: state.journal.map((j: JournalEntry) => j.id === id ? { ...j, ...updates } : j)
            })),
        }),
        {
            name: 'role-game-storage',
            storage: createJSONStorage(() => idbStorage),
            // Exclude context vector from persistence - it's too large!
            partialize: (state) => ({
                selectedModel: state.selectedModel,
                systemPrompt: state.systemPrompt,
                chatHistory: state.chatHistory,
                // contextVector is intentionally excluded
                inventory: state.inventory,
                locations: state.locations,
                journal: state.journal,
            }),
        }
    )
);
