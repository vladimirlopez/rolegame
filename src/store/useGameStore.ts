import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { openDB } from 'idb';
import type { ChatMessage, InventoryItem, Location, JournalEntry, NPC, StoryEvent, StoryFact } from '../types';

// Re-export types for backward compatibility
export type { ChatMessage, InventoryItem, Location, JournalEntry, NPC, StoryEvent, StoryFact };

export interface GameState {
    // Settings
    selectedModel: string;
    systemPrompt: string;

    // Game Data
    chatHistory: ChatMessage[];
    contextVector?: number[]; // Ollama context
    inventory: InventoryItem[];
    locations: Location[];
    currentLocationId: string | null; // Explicit current location tracking
    npcs: NPC[]; // NPC tracking to prevent hallucination
    storyEvents: StoryEvent[]; // Recent story events for context
    storyFacts: StoryFact[]; // Critical facts AI must remember
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
    setCurrentLocation: (locationId: string) => void;

    addNpc: (npc: NPC) => void;
    updateNpcLocation: (npcId: string, locationId: string | null) => void;

    addStoryEvent: (event: StoryEvent) => void;
    getRecentEvents: (count?: number) => StoryEvent[];

    addJournalEntry: (entry: JournalEntry) => void;
    updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;

    addStoryFact: (fact: string, importance?: 'critical' | 'major' | 'minor') => void;
    getStoryFacts: () => StoryFact[];

    // Helper getters
    getCurrentLocation: () => Location | null;
    getNpcsAtCurrentLocation: () => NPC[];
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
        (set, get) => ({
            selectedModel: '',
            systemPrompt: `You are a Game Master for a text-based RPG. The player has FULL AGENCY over their character.

=== STORYTELLING RULES ===
1. BE CONCRETE, NOT VAGUE: Describe specific places, people, and objects. Avoid endless atmosphere.
2. PROGRESS THE STORY: Each response should move the story forward. Don't repeat the same descriptions.
3. ANSWER QUESTIONS: When the player asks "what is happening?" - explain clearly, don't add more mystery.
4. STAY GROUNDED: Even in horror/fantasy, keep descriptions understandable and actionable.

=== MOVEMENT RULES (HIGHEST PRIORITY) ===
When player says "I go to...", "I head to...", "I leave", "I return to...":
• IMMEDIATELY describe arrival at the destination
• Use [LOCATION: Name|Brief description] tag
• NEVER keep them traveling endlessly or stuck in fog/suspense
• Example: "I go to the pub" → Describe them INSIDE the pub, not walking there

=== REQUIRED TAGS (YOU MUST USE THESE) ===
[LOCATION: Name|Description] - EVERY time player enters a new place
[ITEM_ADD: Name|Description|1] - When player receives/picks up an item  
[NPC: Name|LocationName|Description] - When introducing a character
[EVENT: What happened] - When something important occurs

EXAMPLE RESPONSE WITH TAGS:
Player: "I pick up the ancient scroll and head to the library"
GM Response:
[ITEM_ADD: Ancient Scroll|A yellowed parchment with strange symbols|1]
[LOCATION: City Library|A grand hall filled with towering bookshelves]
You tuck the scroll into your coat and make your way to the library. The massive oak doors creak as you enter. Dust motes dance in shafts of light from high windows. A stern librarian peers at you over spectacles. "Can I help you find something?"

=== FORBIDDEN BEHAVIORS ===
❌ Endless fog, shadows, or atmospheric descriptions that go nowhere
❌ Ignoring player movement commands
❌ Making the story so abstract the player doesn't know what's happening
❌ Repeating the same scene when player tries to leave
❌ Forgetting to use tags for items, locations, and NPCs`,
            chatHistory: [],
            contextVector: undefined,
            inventory: [],
            locations: [],
            currentLocationId: null,
            npcs: [],
            storyEvents: [],
            storyFacts: [],
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
                currentLocationId: null,
                npcs: [],
                storyEvents: [],
                storyFacts: [],
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
                const exists = state.locations.some((l: Location) => l.id === location.id);
                return {
                    locations: exists ? state.locations : [...state.locations, location],
                    currentLocationId: location.id // Auto-set as current when added
                };
            }),

            setCurrentLocation: (locationId: string) => set({ currentLocationId: locationId }),

            addNpc: (npc: NPC) => set((state: GameState) => {
                const existing = state.npcs.find((n: NPC) => n.id === npc.id);
                if (existing) {
                    // Update existing NPC's location
                    return {
                        npcs: state.npcs.map((n: NPC) =>
                            n.id === npc.id ? { ...n, currentLocationId: npc.currentLocationId } : n
                        )
                    };
                }
                return { npcs: [...state.npcs, npc] };
            }),

            updateNpcLocation: (npcId: string, locationId: string | null) => set((state: GameState) => ({
                npcs: state.npcs.map((n: NPC) =>
                    n.id === npcId ? { ...n, currentLocationId: locationId } : n
                )
            })),

            addStoryEvent: (event: StoryEvent) => set((state: GameState) => {
                // Keep only last 10 events to prevent memory bloat
                const newEvents = [...state.storyEvents, event];
                return { storyEvents: newEvents.slice(-10) };
            }),

            getRecentEvents: (count: number = 5) => {
                const state = get();
                return state.storyEvents.slice(-count);
            },

            addJournalEntry: (entry: JournalEntry) => set((state: GameState) => ({
                journal: [...state.journal, entry]
            })),

            updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => set((state: GameState) => ({
                journal: state.journal.map((j: JournalEntry) => j.id === id ? { ...j, ...updates } : j)
            })),

            getCurrentLocation: () => {
                const state = get();
                if (!state.currentLocationId) return null;
                return state.locations.find(l => l.id === state.currentLocationId) || null;
            },

            getNpcsAtCurrentLocation: () => {
                const state = get();
                if (!state.currentLocationId) return [];
                return state.npcs.filter(n => n.currentLocationId === state.currentLocationId);
            },

            addStoryFact: (fact: string, importance: 'critical' | 'major' | 'minor' = 'major') => set((state: GameState) => {
                // Don't add duplicate facts
                if (state.storyFacts.some(f => f.fact.toLowerCase() === fact.toLowerCase())) {
                    return state;
                }
                const newFact: StoryFact = {
                    id: crypto.randomUUID(),
                    fact,
                    importance,
                    timestamp: Date.now()
                };
                // Keep max 20 facts, prioritizing critical ones
                const newFacts = [...state.storyFacts, newFact];
                if (newFacts.length > 20) {
                    // Remove oldest minor facts first
                    const sorted = newFacts.sort((a, b) => {
                        const importanceOrder = { critical: 0, major: 1, minor: 2 };
                        return importanceOrder[a.importance] - importanceOrder[b.importance] || a.timestamp - b.timestamp;
                    });
                    return { storyFacts: sorted.slice(0, 20) };
                }
                return { storyFacts: newFacts };
            }),

            getStoryFacts: () => {
                const state = get();
                return state.storyFacts;
            },
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
                currentLocationId: state.currentLocationId,
                npcs: state.npcs,
                storyEvents: state.storyEvents,
                storyFacts: state.storyFacts,
                journal: state.journal,
            }),
        }
    )
);

