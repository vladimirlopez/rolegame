# Dealing with Location Hallucination Issues

## The Problem

AI keeps placing characters at wrong locations. Example:
- ❌ "You're at Diogenes Club but see Mrs. Hudson (who is at Baker Street) by the fire"
- ❌ Characters "teleporting" between scenes
- ❌ Mixing up locations

## The Solution (v2 - Fixed Movement)

### Core Principles:
1. ✅ **Player movement is ALWAYS allowed** - "I go to X" should work instantly
2. ✅ **Location consistency AFTER arrival** - Only describe what's at current location
3. ✅ **No character hallucinations** - Don't invent NPC presence

### What Was Changed

**System Prompt Priority Order:**
```
1. PLAYER MOVEMENT: When player says "I go to [Location]", ALWAYS allow it
2. LOCATION CONSISTENCY: Once at a location, only describe what's there
3. NO HALLUCINATIONS: Don't invent NPCs that aren't present
```

**Movement Examples Built-In:**
- ✅ Player: "I go to Baker Street" → GM describes arrival immediately
- ❌ Player: "I go to Baker Street" → GM says "You cannot go there" (NEVER)

**Context Reminder:**
```
[SYSTEM: Player is at "Diogenes Club". While at this location, ONLY describe 
characters/objects present here. However, if player says "I go to [place]", 
immediately allow the movement and describe arrival.]
```

## If AI Still Hallucinates

### Short-term Fix: Correct It Immediately
If the AI says something wrong like "You see Mrs. Hudson":

**Type:**
```
"Mrs. Hudson is not here - she's at Baker Street. I'm at the Diogenes Club. 
Describe what's actually present at this location."
```

The context reminder will help the AI snap back to reality.

### Model-Specific Issues

Some models are worse at following location rules:

**Better at Location Tracking:**
- ✅ `mistral` - Good spatial awareness
- ✅ `llama3:8b` or larger - Better instruction following
- ✅ `nous-hermes2` - Designed for RP, better consistency

**Worse at Location Tracking:**
- ⚠️ `gemma` - Often ignores location constraints
- ⚠️ Small models (<7B) - Limited context understanding
- ⚠️ `phi3:mini` - Fast but forgets details

### Increase Context Window (Advanced)

If you have a powerful computer, you can manually increase the context:

1. Open browser DevTools (F12)
2. In Console, type:
```javascript
localStorage.setItem('ollama-context-size', '8192')
```
3. Reload the page

This gives the AI 2x more memory but will be slower.

## Using Location Tags Properly

Make sure the AI outputs location tags when you move:

**When entering a new location, the AI should output:**
```
[LOCATION: Diogenes Club|A prestigious gentleman's club in London]
```

If it doesn't, you can manually prompt it:
```
"I arrive at the Diogenes Club. [Tag this location]"
```

## Check Your Current Location

Always verify in the sidebar:
1. Click **Locations** tab
2. Look for "📍 Current: [Location Name]"
3. That's where the AI thinks you are

If it's wrong, you can correct it by explicitly stating:
```
"I am at [Correct Location]. Update the location tag."
```

## Best Practices

### ✅ DO:
- Explicitly state when you move: "I go to the British Museum"
- Check the Locations tab regularly
- Correct the AI immediately when it hallucinates
- Use location tags: Ask AI to output `[LOCATION: Name|Description]`

### ❌ DON'T:
- Assume the AI remembers where you are after 5+ exchanges
- Mix scenes (talk about multiple locations in one prompt)
- Use vague movements like "I go elsewhere" without specifying

## Emergency Reset

If the AI completely loses track and won't recover:

1. Open Settings (⚙️)
2. Click "Optimize Memory"
3. In your next message, explicitly state:
   ```
   "[SYSTEM RESET] I am currently at [Location]. All previous location confusion is ignored. 
   Describe only what exists at [Location]."
   ```

## The Nuclear Option: Manual Location Injection

If nothing works, you can force-set the location by typing commands like:

```
[LOCATION: Diogenes Club|A prestigious gentleman's club]

I look around the Diogenes Club where I currently am with Mycroft.
```

This explicitly tags the location AND reminds the AI in the same message.

## Summary

✅ Stronger system prompt with spatial logic rules  
✅ Explicit context reminders on every action  
✅ Visual current location indicator  
✅ Improved LOCATION tag instructions  
⚠️ Some models still struggle - try mistral or nous-hermes2  
⚠️ Correct hallucinations immediately to prevent cascading errors
