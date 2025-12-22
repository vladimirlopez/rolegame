
export interface ParsedResponse {
    cleanText: string;
    commands: {
        type: 'ADD_ITEM' | 'REMOVE_ITEM' | 'SET_LOCATION' | 'ADD_JOURNAL';
        payload: any;
    }[];
}

export const parseGameResponse = (text: string): ParsedResponse => {
    const commands: ParsedResponse['commands'] = [];

    // Syntax: [ITEM_ADD: Name|Description|Qty]
    // Syntax: [LOCATION: Name|Description]
    // Syntax: [JOURNAL: Title|Content]

    let cleanText = text;

    // ITEM_ADD regex
    const itemAddRegex = /\[ITEM_ADD:\s*([^|\]]+)(?:\|([^|\]]+))?(?:\|(\d+))?\]/g;
    cleanText = cleanText.replace(itemAddRegex, (_, name, desc, qty) => {
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

    // LOCATION regex
    const locRegex = /\[LOCATION:\s*([^|\]]+)(?:\|([^|\]]+))?\]/g;
    cleanText = cleanText.replace(locRegex, (_, name, desc) => {
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

    return { cleanText: cleanText.trim(), commands };
};

export const SYSTEM_INSTRUCTION_SUFFIX = `
IMPORTANT GAME RULES:
- When the player gains an item, output exactly: [ITEM_ADD: Name|Description|Quantity]
- When the player enters a new named location, output exactly: [LOCATION: Name|Description]
- Keep these tags on separate lines if possible.
`;
