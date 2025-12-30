// Shared type definitions for RoleGame

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

export interface NPC {
    id: string;
    name: string;
    description: string;
    currentLocationId: string | null;
    firstMetAt: number;
}

export interface StoryEvent {
    id: string;
    description: string;
    timestamp: number;
    locationId?: string;
}

export interface JournalEntry {
    id: string;
    title: string;
    content: string;
    timestamp: number;
    aiSummary?: string;
}

// Story facts that the AI must remember - prevents context amnesia
export interface StoryFact {
    id: string;
    fact: string;           // e.g., "Found ancient tome with caduceus symbol"
    importance: 'critical' | 'major' | 'minor';
    timestamp: number;
}
