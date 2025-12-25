# Memory Optimization Changes

## Issues Fixed

### 1. **Context Vector Memory Bloat** 🔴 CRITICAL
- **Problem**: The Ollama context vector (array of numbers) was being stored in Zustand and persisted to IndexedDB. This grows exponentially with each conversation turn (typically 2000-8000 numbers per turn).
- **Solution**: 
  - Excluded `contextVector` from persistence using `partialize` in Zustand config
  - Added size check to prevent storing contexts larger than 20,000 elements
  - Context now resets on page reload (acceptable trade-off for memory)

### 2. **Unlimited Chat History** 🟡 MAJOR
- **Problem**: All messages were kept forever, causing memory issues in long sessions
- **Solution**: 
  - Added `MAX_CHAT_HISTORY = 50` constant to auto-trim messages
  - Added `trimChatHistory()` function for manual cleanup
  - Added UI button to manually optimize memory

### 3. **Context Window Balance** 🟡 MAJOR
- **Problem**: Need balance between performance and story continuity
- **Solution**: 
  - Set `num_ctx: 4096` as default (was 2048, too small for continuity)
  - 4096 provides ~15-20 exchanges of context for coherent storytelling
  - Added context reminders that inject current location/inventory into prompts
  - This helps AI stay on track even when context vector is lost

### 4. **No Memory Visibility** 🟢 MINOR
- **Problem**: Users couldn't see memory usage or optimize it
- **Solution**: 
  - Added memory stats display in settings (message count, context size)
  - Added "Optimize Memory" button to manually trim history
  - Added helpful tip about performance

## Performance Improvements

### Before:
- Context vector could grow to 50,000+ elements
- All conversations persisted indefinitely
- No context window specified (model default, often 4096+)
- Slow response times after ~20 messages
- **Lost story continuity due to insufficient context**

### After:
- Context limited to 20,000 elements max
- Auto-trim at 50 messages
- 4096 token context window (optimal balance)
- Consistent performance throughout long sessions
- **Context reminders help AI track location and inventory**

## Context Continuity Features

### Automatic Context Reminders
Every prompt now includes:
- Current location name
- Inventory items
- Reminder to stay consistent with the scene

Example: `[CURRENT CONTEXT: Player is at British Museum. Inventory: Stone, Letter. Stay consistent with this location.]`

This helps prevent the AI from "teleporting" you to different locations mid-scene.

## Usage Tips

1. **If responses feel slow**: Click "Optimize Memory" in settings
2. **For longer conversations**: The app auto-trims at 50 messages now
3. **Context resets on reload**: This is intentional - it prevents memory bloat
4. **Use location tags**: The [LOCATION: Name|Description] tags help the AI remember where you are
5. **If AI forgets location**: The context reminder system will help keep it on track

## Technical Details

### Context Vector
- Ollama returns a "context" array with each response
- This is used to maintain conversation continuity
- Size: ~4000-8000 numbers per response depending on `num_ctx`
- Memory: ~16-32KB per response (small), but grows indefinitely

### Why 4096 tokens?
- Good balance for narrative continuity and performance
- Handles ~15-20 back-and-forth exchanges
- Enough context for complex multi-turn scenarios
- Still performant on CPU/GPU

### Context Reminders
- Automatically inject current game state into prompts
- Helps AI remember location even without context vector
- Includes inventory for additional grounding
- Transparent to the player (added behind the scenes)

### Files Modified
1. `src/store/useGameStore.ts` - Added partialize, trimming, auto-limit
2. `src/services/ollamaService.ts` - Updated to `num_ctx: 4096` default
3. `src/components/GameInterface.tsx` - Added memory UI, size checks, context reminders

## Future Improvements

- [ ] Add setting to choose context window size (2048/4096/8192)
- [ ] Implement smart context summarization (compress old messages)
- [ ] Add model recommendation based on system RAM
- [ ] Memory usage graph/monitor
- [ ] Enhanced location tracking system
