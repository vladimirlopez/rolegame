import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { OllamaService } from '../services/ollamaService';
import type { OllamaModel } from '../services/ollamaService';
import { useGameMessages } from '../hooks/useGameMessages';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import type { StoryConfig } from '../App';

interface GameInterfaceProps {
    onBackToSetup: () => void;
    storyConfig?: StoryConfig | null;
}

export const GameInterface: React.FC<GameInterfaceProps> = ({ onBackToSetup, storyConfig }) => {
    const {
        selectedModel,
        chatHistory,
        contextVector,
        setContextVector,
        clearGame,
        inventory,
        locations,
        currentLocationId,
        npcs,
        storyEvents,
        journal,
        addJournalEntry,
        setModel,
        trimChatHistory,
        getCurrentLocation,
        getNpcsAtCurrentLocation,
    } = useGameStore();

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [activeTab, setActiveTab] = useState<'inventory' | 'locations' | 'journal' | 'npcs'>('inventory');
    const [journalInput, setJournalInput] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);

    const chatBottomRef = useRef<HTMLDivElement>(null);
    const hasInitialized = useRef(false);

    // Use the game messages hook for AI interactions
    const { sendMessage, initializeStory, abortGeneration } = useGameMessages({
        onStreamUpdate: () => {
            chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        },
        storyConfig
    });

    // Get current location info for display
    const currentLocation = getCurrentLocation();
    const npcsHere = getNpcsAtCurrentLocation();

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

    // Track elapsed time while loading
    useEffect(() => {
        if (loading) {
            setElapsedSeconds(0);
            const interval = setInterval(() => {
                setElapsedSeconds(s => s + 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [loading]);

    useEffect(() => {
        if (chatBottomRef.current) {
            chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, loading]);

    // Initial story start
    useEffect(() => {
        const startStory = async () => {
            if (chatHistory.length === 0 && selectedModel && !loading && !hasInitialized.current) {
                hasInitialized.current = true;
                setLoading(true);
                await initializeStory();
                setLoading(false);
            }
        };
        startStory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSend = async () => {
        if (!input.trim() || !selectedModel || loading) return;

        const userInput = input;
        setInput('');
        setLoading(true);

        await sendMessage(userInput);
        setLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewGame = () => {
        abortGeneration();
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
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <label style={{ fontSize: '0.9rem' }}>Change Model:</label>
                                    <select
                                        className="glass-input"
                                        style={{ background: 'rgba(0,0,0,0.5)', padding: '0.5rem' }}
                                        value={selectedModel}
                                        onChange={async (e) => {
                                            const newModel = e.target.value;
                                            if (selectedModel && selectedModel !== newModel) {
                                                // Abort current generation
                                                abortGeneration();
                                                // Unload the old model to free VRAM
                                                await OllamaService.unloadModel(selectedModel);
                                            }
                                            setModel(newModel);
                                        }}
                                    >
                                        {availableModels.map(m => (
                                            <option key={m.digest} value={m.name}>
                                                {m.name} ({Math.round(m.size / 1024 / 1024 / 1024)}GB)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button
                                        className="glass-btn"
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                        onClick={() => {
                                            trimChatHistory(20);
                                            setContextVector(undefined);
                                            alert('Memory optimized! Trimmed to last 20 messages and cleared context.');
                                        }}
                                    >
                                        🧹 Optimize Memory
                                    </button>
                                    <span style={{ fontSize: '0.8rem', color: 'gray' }}>
                                        {chatHistory.length} messages | Context: {contextVector ? `${(contextVector.length / 1000).toFixed(1)}k` : 'None'}
                                    </span>
                                </div>

                                <p style={{ fontSize: '0.8rem', color: 'gray', margin: 0 }}>
                                    💡 Tip: If responses are slow, try optimizing memory or using a smaller model.
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
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{
                                alignSelf: 'flex-start',
                                padding: '1rem 1.5rem',
                                background: 'rgba(100,255,218,0.05)',
                                border: '1px solid rgba(100,255,218,0.2)',
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <motion.span
                                    animate={{ opacity: [1, 0.3, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    style={{ color: 'var(--accent-color)', fontSize: '1.2rem' }}
                                >
                                    ●
                                </motion.span>
                                <span style={{ color: 'var(--accent-color)' }}>
                                    The storyteller is writing
                                    <motion.span
                                        animate={{ opacity: [0, 1, 0] }}
                                        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                                    >.</motion.span>
                                    <motion.span
                                        animate={{ opacity: [0, 1, 0] }}
                                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                                    >.</motion.span>
                                    <motion.span
                                        animate={{ opacity: [0, 1, 0] }}
                                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                                    >.</motion.span>
                                </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'gray' }}>
                                {elapsedSeconds < 5 ? (
                                    'Preparing response...'
                                ) : elapsedSeconds < 15 ? (
                                    `Working... (${elapsedSeconds}s)`
                                ) : elapsedSeconds < 30 ? (
                                    `Still working, model may be loading... (${elapsedSeconds}s)`
                                ) : (
                                    `This is taking a while - large models need time to load (${elapsedSeconds}s)`
                                )}
                            </div>
                        </motion.div>
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
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
                    {(['inventory', 'locations', 'npcs', 'journal'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1,
                                minWidth: '70px',
                                background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none',
                                padding: '0.75rem 0.5rem',
                                color: activeTab === tab ? 'var(--accent-color)' : 'gray',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                fontWeight: activeTab === tab ? 'bold' : 'normal',
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab === 'npcs' ? 'NPCs' : tab}
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
                                    <>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--accent-color)', marginBottom: '0.5rem' }}>
                                            📍 Current: {currentLocation?.name || 'Unknown'}
                                        </p>
                                        {npcsHere.length > 0 && (
                                            <p style={{ fontSize: '0.75rem', color: 'gray', marginBottom: '0.5rem' }}>
                                                👥 Here: {npcsHere.map(n => n.name).join(', ')}
                                            </p>
                                        )}
                                        <ul style={{ listStyle: 'none', marginTop: '0.5rem' }}>
                                            {locations.map(loc => (
                                                <li key={loc.id} style={{
                                                    marginBottom: '0.5rem',
                                                    padding: '0.5rem',
                                                    borderLeft: loc.id === currentLocationId ? '3px solid var(--accent-color)' : '2px solid rgba(255,255,255,0.2)',
                                                    background: loc.id === currentLocationId ? 'rgba(100,255,218,0.05)' : 'transparent'
                                                }}>
                                                    <div style={{ fontWeight: 'bold' }}>{loc.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'gray' }}>{loc.description}</div>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
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

                        {activeTab === 'npcs' && (
                            <motion.div
                                key="npcs"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            >
                                <h3>Known Characters</h3>
                                {npcs.length === 0 ? <p style={{ color: 'gray', fontSize: '0.9rem', marginTop: '0.5rem' }}>None met yet</p> : (
                                    <ul style={{ listStyle: 'none', marginTop: '0.5rem' }}>
                                        {npcs.map(npc => {
                                            const npcLocation = locations.find(l => l.id === npc.currentLocationId);
                                            const isHere = npc.currentLocationId === currentLocationId;
                                            return (
                                                <li key={npc.id} style={{
                                                    marginBottom: '0.5rem',
                                                    background: isHere ? 'rgba(100,255,218,0.1)' : 'rgba(255,255,255,0.05)',
                                                    padding: '0.5rem',
                                                    borderRadius: '4px',
                                                    borderLeft: isHere ? '3px solid var(--accent-color)' : 'none'
                                                }}>
                                                    <div style={{ fontWeight: 'bold' }}>
                                                        {npc.name} {isHere && <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>(here)</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'gray' }}>
                                                        📍 {npcLocation?.name || 'Unknown location'}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.25rem' }}>{npc.description}</div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                {storyEvents.length > 0 && (
                                    <>
                                        <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Recent Events</h4>
                                        <ul style={{ listStyle: 'none' }}>
                                            {[...storyEvents].reverse().slice(0, 5).map(event => (
                                                <li key={event.id} style={{ fontSize: '0.8rem', color: 'gray', marginBottom: '0.25rem', paddingLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                                                    {event.description}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
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
