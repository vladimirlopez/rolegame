
export interface ParsedResponse {
    cleanText: string;
    commands: {
        type: 'ADD_ITEM' | 'REMOVE_ITEM' | 'SET_LOCATION' | 'ADD_JOURNAL';
        payload: any;
    }[];
}

export const parseGameResponse = (text: string): ParsedResponse => {
    const commands: ParsedResponse['commands'] = [];

    // Syntax: [ITEM_ADD: Name|Description|Qty] or [ADD_ITEM: Name|Description|Qty]
    // Case-insensitive, flexible spacing, optional quotes around values
    // Syntax: [LOCATION: Name|Description]
    // Syntax: [JOURNAL: Title|Content]

    let cleanText = text;

    // ITEM_ADD / ADD_ITEM regex - more flexible pattern
    // Matches: [ITEM_ADD: name|desc|qty], [ADD_ITEM: name], [item_add: "name"|"desc"|1], etc.
    const itemAddRegex = /\[(?:ITEM_ADD|ADD_ITEM)\s*:\s*"?([^|"\]]+)"?(?:\s*\|\s*"?([^|"\]]+)"?)?(?:\s*\|\s*"?(\d+)"?)?\s*\]/gi;
    cleanText = cleanText.replace(itemAddRegex, (match, name, desc, qty) => {
        if (!name || !name.trim()) return match; // Skip if no valid name
        commands.push({
            type: 'ADD_ITEM',
            payload: {
                id: name.trim().toLowerCase().replace(/\s+/g, '-'),
                name: name.trim(),
                description: desc ? desc.trim() : 'No description',
                quantity: qty ? parseInt(qty) : 1
            }
        });
        return ''; // Remove tag from text
    });

    // LOCATION regex - also more flexible
    const locRegex = /\[LOCATION\s*:\s*"?([^|"\]]+)"?(?:\s*\|\s*"?([^|"\]]+)"?)?\s*\]/gi;
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

    // Debug log for development
    if (commands.length > 0) {
        console.log('Parsed commands:', commands);
    }

    return { cleanText: cleanText.trim(), commands };
};

export const SYSTEM_INSTRUCTION_SUFFIX = `

=== GAME SYSTEM INSTRUCTIONS ===
You MUST use these EXACT tags when game events occur. Do not modify the format.

WHEN THE PLAYER RECEIVES AN ITEM, output this tag on its own line:
[ITEM_ADD: ItemName|Description|Quantity]
Example: [ITEM_ADD: Rusty Key|An old key covered in rust|1]

WHEN THE PLAYER ENTERS A NEW LOCATION, output this tag on its own line:
[LOCATION: LocationName|Description]
Example: [LOCATION: Dark Forest|A dense forest with twisted trees]

These tags will be parsed by the game system. Always include them when relevant.
=== END SYSTEM INSTRUCTIONS ===
`;
