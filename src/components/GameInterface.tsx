import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { ChatMessage } from '../store/useGameStore';
import { OllamaService } from '../services/ollamaService';
import type { OllamaModel } from '../services/ollamaService';
import { parseGameResponse, SYSTEM_INSTRUCTION_SUFFIX } from '../utils/responseParser';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

interface GameInterfaceProps {
    onBackToSetup: () => void;
}

export const GameInterface: React.FC<GameInterfaceProps> = ({ onBackToSetup }) => {
    const {
        selectedModel,
        systemPrompt,
        chatHistory,
        addMessage,
        contextVector,
        setContextVector,
        clearGame,
        inventory,
        addItem,
        locations,
        addLocation,
        journal,
        addJournalEntry,
        updateLastMessage,
        setModel
    } = useGameStore();

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'inventory' | 'locations' | 'journal'>('inventory');
    const [journalInput, setJournalInput] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);

    const chatBottomRef = useRef<HTMLDivElement>(null);

    // Fetch available models for the settings menu
    useEffect(() => {
        const fetchModels = async () => {
            try {
                const models = await OllamaService.listModels();
                setAvailableModels(models);
            } catch (error) {
                console.error('Failed to fetch models:', error);
            }
        };
        fetchModels();
    }, []);

    useEffect(() => {
        if (chatBottomRef.current) {
            chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, loading]);

    // Initial story start
    useEffect(() => {
        const initStory = async () => {
            if (chatHistory.length === 0 && selectedModel && !loading) {
                setLoading(true);
                try {
                    // Placeholder for streaming
                    const streamMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
                    addMessage(streamMsg);

                    const stream = await OllamaService.generateResponseStream(
                        selectedModel,
                        "Begin the story. Describe the starting location and situation.",
                        undefined,
                        systemPrompt + SYSTEM_INSTRUCTION_SUFFIX
                    );

                    let fullText = '';
                    let finalContext: number[] | undefined;

                    for await (const part of stream) {
                        if (part.done) {
                            finalContext = part.context;
                            continue;
                        }

                        fullText += part.response;
                        updateLastMessage(fullText);

                        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }

                    // Final parsing - only update if we have text
                    if (fullText.trim()) {
                        const { cleanText, commands } = parseGameResponse(fullText);

                        // Only update if cleanText is not empty
                        if (cleanText.trim()) {
                            updateLastMessage(cleanText);
                        }

                        commands.forEach(cmd => {
                            if (cmd.type === 'ADD_ITEM') addItem(cmd.payload);
                            if (cmd.type === 'SET_LOCATION') addLocation(cmd.payload);
                        });

                        if (finalContext) {
                            setContextVector(finalContext);
                        }
                    }
                } catch (error) {
                    console.error("Failed to start story:", error);
                    // Don't clear game - just add error message
                    addMessage({
                        role: 'system',
                        content: error instanceof Error ? `Error: ${error.message}` : "Error starting story. Please check Ollama connection.",
                        timestamp: Date.now()
                    });
                } finally {
                    setLoading(false);
                }
            }
        };
        initStory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSend = async () => {
        if (!input.trim() || !selectedModel || loading) return;

        const userMsg: ChatMessage = {
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        addMessage(userMsg);
        setInput('');
        setLoading(true);

        try {
            const streamMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
            addMessage(streamMsg);

            const stream = await OllamaService.generateResponseStream(
                selectedModel,
                input,
                contextVector,
                systemPrompt + SYSTEM_INSTRUCTION_SUFFIX
            );

            let fullText = '';
            let finalContext: number[] | undefined;

            for await (const part of stream) {
                if (part.done) {
                    finalContext = part.context;
                    continue;
                }
                fullText += part.response;
                updateLastMessage(fullText);

                chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }

            if (fullText.trim()) {
                const { cleanText, commands } = parseGameResponse(fullText);

                if (cleanText.trim()) {
                    updateLastMessage(cleanText);
                }

                commands.forEach(cmd => {
                    if (cmd.type === 'ADD_ITEM') addItem(cmd.payload);
                    if (cmd.type === 'SET_LOCATION') addLocation(cmd.payload);
                });

                if (finalContext) {
                    setContextVector(finalContext);
                }
            }

        } catch (error) {
            console.error("Error generating response:", error);
            addMessage({
                role: 'system',
                content: error instanceof Error ? `Error: ${error.message}` : "An unknown error occurred.",
                timestamp: Date.now()
            });
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewGame = () => {
        clearGame();
        onBackToSetup();
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: '1rem', overflow: 'hidden' }}>
            {/* Main Chat Area */}
            <motion.div
                className="glass-panel"
                style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
            >
                {/* Top Bar with Settings */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            onClick={handleNewGame}
                            className="glass-btn"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        >
                            ← New Story
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                            Model: {selectedModel}
                        </span>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="glass-btn"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                        >
                            ⚙️ Settings
                        </button>
                    </div>
                </div>

                {/* Settings Panel */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{
                                background: 'rgba(0,0,0,0.3)',
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.9rem' }}>Change Model:</label>
                                    <select
                                        className="glass-input"
                                        style={{ background: 'rgba(0,0,0,0.5)', padding: '0.5rem' }}
                                        value={selectedModel}
                                        onChange={(e) => setModel(e.target.value)}
                                    >
                                        {availableModels.map(m => (
                                            <option key={m.digest} value={m.name}>
                                                {m.name} ({Math.round(m.size / 1024 / 1024 / 1024)}GB)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'gray', margin: 0 }}>
                                    Note: Changing model mid-story may affect coherence.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Chat Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {chatHistory.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                background: msg.role === 'user' ? 'rgba(100, 255, 218, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                padding: '1rem',
                                borderRadius: '12px',
                                maxWidth: '80%',
                                border: msg.role === 'user' ? '1px solid rgba(100,255,218,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                color: msg.role === 'system' ? '#ff6b6b' : 'inherit'
                            }}
                        >
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </motion.div>
                    ))}
                    {loading && (
                        <div style={{ alignSelf: 'flex-start', padding: '1rem', color: 'gray', fontStyle: 'italic' }}>
                            The storyteller is writing...
                        </div>
                    )}
                    <div ref={chatBottomRef} />
                </div>

                {/* Input Area */}
                <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ position: 'relative' }}>
                        <textarea
                            className="glass-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Wander deeper into the unknown..."
                            style={{ width: '100%', paddingRight: '4rem', resize: 'none', height: '60px' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                bottom: '10px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-color)',
                                cursor: 'pointer',
                                padding: '5px'
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Side Panel (HUD) */}
            <motion.div
                className="glass-panel"
                style={{ width: '300px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
            >
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {(['inventory', 'journal', 'locations'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1,
                                background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none',
                                padding: '1rem',
                                color: activeTab === tab ? 'var(--accent-color)' : 'gray',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                fontWeight: activeTab === tab ? 'bold' : 'normal',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                    <AnimatePresence mode='wait'>
                        {activeTab === 'inventory' && (
                            <motion.div
                                key="inventory"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            >
                                <h3>Inventory</h3>
                                {inventory.length === 0 ? <p style={{ color: 'gray', fontSize: '0.9rem', marginTop: '0.5rem' }}>Empty</p> : (
                                    <ul style={{ listStyle: 'none', marginTop: '0.5rem' }}>
                                        {inventory.map(item => (
                                            <li key={item.id} style={{ marginBottom: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                                                <div style={{ fontWeight: 'bold' }}>{item.name} (x{item.quantity})</div>
                                                <div style={{ fontSize: '0.8rem', color: 'gray' }}>{item.description}</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'locations' && (
                            <motion.div
                                key="locations"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            >
                                <h3>Known Places</h3>
                                {locations.length === 0 ? <p style={{ color: 'gray', fontSize: '0.9rem', marginTop: '0.5rem' }}>None visited</p> : (
                                    <ul style={{ listStyle: 'none', marginTop: '0.5rem' }}>
                                        {locations.map(loc => (
                                            <li key={loc.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', borderLeft: '2px solid var(--accent-color)' }}>
                                                <div style={{ fontWeight: 'bold' }}>{loc.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'gray' }}>{loc.description}</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'journal' && (
                            <motion.div
                                key="journal"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                            >
                                <h3 style={{ marginBottom: '0.5rem' }}>Journal</h3>
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {journal.length === 0 ? <p style={{ color: 'gray', fontSize: '0.9rem' }}>No entries</p> : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                            {[...journal].reverse().map(entry => (
                                                <div key={entry.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '4px' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'gray' }}>{new Date(entry.timestamp).toLocaleTimeString()}</div>
                                                    <div style={{ fontWeight: 'bold', marginBottom: '0.2rem' }}>{entry.title}</div>
                                                    <div style={{ fontSize: '0.9rem' }}>{entry.content}</div>
                                                    {entry.aiSummary && (
                                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(100,255,218,0.05)', borderRadius: '4px', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                                            AI: {entry.aiSummary}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                                    <input
                                        className="glass-input"
                                        style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.9rem' }}
                                        placeholder="Add a note..."
                                        value={journalInput}
                                        onChange={e => setJournalInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && journalInput.trim()) {
                                                addJournalEntry({
                                                    id: crypto.randomUUID(),
                                                    title: 'Player Note',
                                                    content: journalInput,
                                                    timestamp: Date.now()
                                                });
                                                setJournalInput('');
                                            }
                                        }}
                                    />
                                    <button
                                        className="glass-btn"
                                        style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}
                                        onClick={() => {
                                            if (journalInput.trim()) {
                                                addJournalEntry({
                                                    id: crypto.randomUUID(),
                                                    title: 'Player Note',
                                                    content: journalInput,
                                                    timestamp: Date.now()
                                                });
                                                setJournalInput('');
                                            }
                                        }}
                                    >
                                        Add Note
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                        className="glass-btn"
                        style={{ width: '100%', fontSize: '0.8rem', borderColor: '#ff6b6b', color: '#ff6b6b' }}
                        onClick={() => {
                            if (confirm("Are you sure? This will delete your save.")) {
                                clearGame();
                                window.location.reload();
                            }
                        }}
                    >
                        Reset Game
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
