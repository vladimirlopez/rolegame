
export interface ParsedResponse {
    cleanText: string;
    commands: {
        type: 'ADD_ITEM' | 'REMOVE_ITEM' | 'SET_LOCATION' | 'ADD_NPC' | 'STORY_EVENT' | 'STORY_FACT';
        payload: any;
    }[];
}

export const parseGameResponse = (text: string): ParsedResponse => {
    const commands: ParsedResponse['commands'] = [];

    let cleanText = text;

    // ITEM_ADD / ADD_ITEM regex - flexible pattern
    // Uses [^|\]] to allow quotes inside values, stopping only at | or ]
    const itemAddRegex = /\[(?:ITEM_ADD|ADD_ITEM)\s*:\s*([^|\]]+?)(?:\s*\|\s*([^|\]]+?))?(?:\s*\|\s*(\d+))?\s*\]/gi;
    cleanText = cleanText.replace(itemAddRegex, (match, name, desc, qty) => {
        if (!name || !name.trim()) return match;
        commands.push({
            type: 'ADD_ITEM',
            payload: {
                id: name.trim().toLowerCase().replace(/\s+/g, '-'),
                name: name.trim(),
                description: desc ? desc.trim() : 'No description',
                quantity: qty ? parseInt(qty) : 1
            }
        });
        return '';
    });

    // LOCATION regex - allows any characters except | and ] in descriptions
    // This handles quotes, colons, and other special characters in location descriptions
    const locRegex = /\[LOCATION\s*:\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\s*\]/gi;
    cleanText = cleanText.replace(locRegex, (match, name, desc) => {
        if (!name || !name.trim()) return match;
        commands.push({
            type: 'SET_LOCATION',
            payload: {
                id: name.trim().toLowerCase().replace(/\s+/g, '-'),
                name: name.trim(),
                description: desc ? desc.trim() : 'Unknown location',
                visitedAt: Date.now()
            }
        });
        return '';
    });

    // NPC regex - allows any characters except | and ] in each field
    // This properly handles quotes inside NPC dialogue/descriptions
    const npcRegex = /\[NPC\s*:\s*([^|\]]+?)(?:\s*\|\s*([^|\]]+?))?(?:\s*\|\s*([^\]]+?))?\s*\]/gi;
    cleanText = cleanText.replace(npcRegex, (match, name, location, desc) => {
        if (!name || !name.trim()) return match;
        commands.push({
            type: 'ADD_NPC',
            payload: {
                id: name.trim().toLowerCase().replace(/\s+/g, '-'),
                name: name.trim(),
                currentLocationId: location ? location.trim().toLowerCase().replace(/\s+/g, '-') : null,
                description: desc ? desc.trim() : 'A mysterious figure',
                firstMetAt: Date.now()
            }
        });
        return '';
    });

    // EVENT regex - allows any characters except ] in description
    const eventRegex = /\[EVENT\s*:\s*([^\]]+?)\s*\]/gi;
    cleanText = cleanText.replace(eventRegex, (match, description) => {
        if (!description || !description.trim()) return match;
        commands.push({
            type: 'STORY_EVENT',
            payload: {
                id: crypto.randomUUID(),
                description: description.trim(),
                timestamp: Date.now()
            }
        });
        return '';
    });

    // === FALLBACK PARSING ===
    // If the AI doesn't use proper tags, try to detect items/locations from natural language

    // Fallback item detection - catches "you pick up", "you take", "you pocket", etc.
    if (!commands.some(c => c.type === 'ADD_ITEM')) {
        const itemPatterns = [
            /you\s+(?:pick up|take|grab|pocket|secure|tuck|slip|obtain|acquire|receive)\s+(?:the\s+|a\s+|an\s+)?([a-zA-Z][a-zA-Z\s-]{2,30}?)(?:\s+(?:and|from|into|,|\.|$))/gi,
            /(?:hands? you|gives? you|offers? you)\s+(?:the\s+|a\s+|an\s+)?([a-zA-Z][a-zA-Z\s-]{2,30}?)(?:\s+(?:and|,|\.|$))/gi,
            /(?:you now (?:have|hold|carry))\s+(?:the\s+|a\s+|an\s+)?([a-zA-Z][a-zA-Z\s-]{2,30}?)(?:\s|,|\.|$)/gi,
        ];

        const foundItems = new Set<string>();
        for (const pattern of itemPatterns) {
            let match;
            while ((match = pattern.exec(cleanText)) !== null) {
                const itemName = match[1].trim();
                // Filter out common non-items
                const excludeWords = ['moment', 'breath', 'step', 'steps', 'look', 'hand', 'hands', 'air', 'door', 'room', 'shadow', 'shadows', 'fog', 'mist', 'time', 'place', 'way'];
                if (itemName.length > 2 && !excludeWords.includes(itemName.toLowerCase()) && !foundItems.has(itemName.toLowerCase())) {
                    foundItems.add(itemName.toLowerCase());
                    commands.push({
                        type: 'ADD_ITEM',
                        payload: {
                            id: itemName.toLowerCase().replace(/\s+/g, '-'),
                            name: itemName,
                            description: 'Acquired during adventure',
                            quantity: 1
                        }
                    });
                }
            }
        }
    }

    // Fallback location detection - catches "you arrive at", "you enter", "you step into", etc.
    if (!commands.some(c => c.type === 'SET_LOCATION')) {
        const locationPatterns = [
            /you\s+(?:arrive at|enter|reach|step into|step inside|find yourself (?:in|at))\s+(?:the\s+|a\s+|an\s+)?([A-Z][a-zA-Z\s'-]{2,40}?)(?:\.|,|—|$)/g,
            /(?:standing|sitting|waiting)\s+(?:in|at|inside)\s+(?:the\s+|a\s+|an\s+)?([A-Z][a-zA-Z\s'-]{2,40}?)(?:\.|,|—|$)/g,
            /the\s+(?:doors?|gates?|entrance)\s+(?:of|to)\s+(?:the\s+)?([A-Z][a-zA-Z\s'-]{2,40}?)\s+(?:open|close|swing)/gi,
        ];

        for (const pattern of locationPatterns) {
            const match = pattern.exec(cleanText);
            if (match) {
                const locName = match[1].trim();
                // Filter out non-location phrases
                const excludeWords = ['moment', 'darkness', 'void', 'nothing', 'something', 'everything'];
                if (locName.length > 2 && !excludeWords.includes(locName.toLowerCase())) {
                    commands.push({
                        type: 'SET_LOCATION',
                        payload: {
                            id: locName.toLowerCase().replace(/\s+/g, '-'),
                            name: locName,
                            description: 'Discovered location',
                            visitedAt: Date.now()
                        }
                    });
                    break; // Only take first location match
                }
            }
        }
    }

    // === AUTO-EXTRACT STORY FACTS ===
    // Detect important discoveries from the narrative
    const factPatterns = [
        /(?:you\s+(?:discover|learn|realize|find out|uncover)|reveals?|it\s+(?:says|reads|mentions)|the\s+(?:note|letter|message|book|tome)\s+(?:says|reads|mentions|reveals))\s+(?:that\s+)?["']?([^"'.!?]{15,100})/gi,
        /["']([^"']{20,80})["']\s*(?:is|was)\s+written/gi,
        /(?:secret|hidden|ancient|mysterious)\s+(?:passage|chamber|room|artifact|relic)\s+(?:is|was|has been|contains?)\s+([^.!?]{10,60})/gi,
    ];

    for (const pattern of factPatterns) {
        let match;
        while ((match = pattern.exec(cleanText)) !== null) {
            const fact = match[1].trim();
            if (fact.length > 15 && fact.length < 100) {
                commands.push({
                    type: 'STORY_FACT',
                    payload: {
                        fact: fact,
                        importance: 'major' as const
                    }
                });
            }
        }
    }

    // Debug log for development
    if (commands.length > 0) {
        console.log('Parsed commands:', commands);
    }

    return { cleanText: cleanText.trim(), commands };
};

/**
 * Builds a context summary for the AI to maintain story consistency
 */
export const buildContextSummary = (
    currentLocation: { name: string } | null,
    inventory: { name: string }[],
    npcsAtLocation: { name: string; description: string }[],
    recentEvents: { description: string }[],
    storyFacts?: { fact: string; importance: 'critical' | 'major' | 'minor' }[]
): string => {
    const parts: string[] = [];

    // CRITICAL story facts first - these are most important
    if (storyFacts && storyFacts.length > 0) {
        const criticalFacts = storyFacts.filter(f => f.importance === 'critical').map(f => f.fact);
        const majorFacts = storyFacts.filter(f => f.importance === 'major').map(f => f.fact);

        if (criticalFacts.length > 0) {
            parts.push(`CRITICAL FACTS (never forget): ${criticalFacts.join('; ')}.`);
        }
        if (majorFacts.length > 0) {
            parts.push(`Important facts: ${majorFacts.join('; ')}.`);
        }
    }

    // Current location
    if (currentLocation) {
        parts.push(`Current location: "${currentLocation.name}".`);
    }

    // NPCs present
    if (npcsAtLocation.length > 0) {
        const npcNames = npcsAtLocation.map(n => n.name).join(', ');
        parts.push(`NPCs present: ${npcNames}.`);
    }

    // Inventory
    if (inventory.length > 0) {
        const itemNames = inventory.map(i => i.name).join(', ');
        parts.push(`Player's inventory: ${itemNames}.`);
    }

    // Recent events
    if (recentEvents.length > 0) {
        const eventDescs = recentEvents.map(e => e.description).join('; ');
        parts.push(`Recent events: ${eventDescs}.`);
    }

    if (parts.length === 0) return '';

    return `\n\n[STORY CONTEXT - YOU MUST REMEMBER THIS:
${parts.join('\n')}
Stay consistent with these facts. NPCs should remember past events. Do not contradict established facts.]`;
};

export const SYSTEM_INSTRUCTION_SUFFIX = `

=== GAME SYSTEM TAGS ===
Use these tags to track game state. Tags are HIDDEN from the player, so:
- Put tags on their OWN LINE at the START of your response
- Keep tag content BRIEF (just identifiers/short descriptions)
- Write your FULL narrative AFTER the tags - this is what the player sees!

FORMAT - Tags first, then narrative:
[LOCATION: Name|Brief description]
[NPC: Name|LocationName|Brief character trait]
[EVENT: What happened]

Then write your actual story response that the player will read.

EXAMPLES OF CORRECT FORMAT:

Example 1 (entering a location):
[LOCATION: Dark Forest|A twisted woodland]
You step into the Dark Forest. Ancient trees loom overhead, their gnarled branches blocking out the moonlight. The air is thick with the scent of decay and something watches from the shadows...

Example 2 (meeting an NPC):
[NPC: Old Wizard|Dark Forest|Elderly sage]
An old man emerges from behind a massive oak tree. His long white beard nearly touches the ground, and his eyes gleam with ancient knowledge. "Traveler," he speaks, his voice like rustling leaves, "you seek the forbidden tome, do you not?"

Example 3 (receiving an item):
[ITEM_ADD: Ancient Map|Yellowed parchment showing hidden paths|1]
The wizard presses a rolled parchment into your hands. "This map will guide you through the Thornwood Maze. Guard it well."

WRONG FORMAT (don't do this - narrative gets hidden!):
[LOCATION: Dark Forest|You step into the Dark Forest. Ancient trees loom overhead, their gnarled branches blocking out the moonlight. The air is thick with the scent of decay.]
What do you do?

WRONG - all that description is inside the tag and gets hidden! Only "What do you do?" would be visible.

CONSISTENCY RULES:
1. Only describe what exists at the CURRENT location
2. NPCs stay at their established locations
3. Reference recent events naturally
4. If asked about someone elsewhere, say they are not here

=== END SYSTEM TAGS ===
`;

