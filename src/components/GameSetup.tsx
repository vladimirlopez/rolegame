import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { OllamaService } from '../services/ollamaService';
import type { OllamaModel } from '../services/ollamaService';
import { motion, AnimatePresence } from 'framer-motion';

const GENRES = [
    { id: 'fantasy', name: '⚔️ Fantasy', desc: 'Magic, dragons, and medieval adventures' },
    { id: 'scifi', name: '🚀 Sci-Fi', desc: 'Space exploration and futuristic technology' },
    { id: 'noir', name: '🔍 Noir/Mystery', desc: 'Hard-boiled detective stories' },
    { id: 'horror', name: '👻 Horror', desc: 'Survival and supernatural terror' },
    { id: 'historical', name: '📜 Historical', desc: 'Adventures in real historical periods' },
    { id: 'modern', name: '🌆 Modern', desc: 'Contemporary urban adventures' },
    { id: 'custom', name: '✨ Custom', desc: 'Define your own setting' },
];

const STARTING_OPTIONS = [
    { id: 'ask', name: 'Ask me first', desc: 'The GM will ask what I want to do' },
    { id: 'tavern', name: 'Classic start', desc: 'Begin at a tavern/hub location' },
    { id: 'action', name: 'In the action', desc: 'Start in an exciting situation' },
    { id: 'custom', name: 'My own intro', desc: 'I\'ll write my opening scene' },
];

interface StoryConfig {
    genre: string;
    characterConcept: string;
    startingOption: string;
    customIntro: string;
}

export const GameSetup: React.FC<{ onStart: (config: StoryConfig) => void }> = ({ onStart }) => {
    const { setModel, selectedModel, setSystemPrompt, systemPrompt } = useGameStore();
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Story configuration
    const [genre, setGenre] = useState('fantasy');
    const [characterConcept, setCharacterConcept] = useState('');
    const [startingOption, setStartingOption] = useState('ask');
    const [customIntro, setCustomIntro] = useState('');

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const list = await OllamaService.listModels();
                setModels(list);
                if (list.length > 0 && !selectedModel) {
                    setModel(list[0].name);
                }
            } catch (err) {
                setError('Could not connect to Ollama. Make sure it is running.');
            } finally {
                setLoading(false);
            }
        };
        fetchModels();
    }, [selectedModel, setModel]);

    const handleStart = () => {
        if (!selectedModel) return;
        onStart({ genre, characterConcept, startingOption, customIntro });
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            height: '100%',
            overflowY: 'auto',
            padding: '2rem 0'
        }}>
            <motion.div
                className="glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ padding: '2rem', width: '100%', maxWidth: '700px' }}
            >
                <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem', textAlign: 'center' }}>
                    Create Your Story
                </h1>
                <p style={{ textAlign: 'center', color: 'gray', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Customize your adventure before you begin
                </p>

                {error && (
                    <div style={{
                        color: '#ff6b6b',
                        background: 'rgba(255, 107, 107, 0.1)',
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem'
                    }}>
                        {error}
                        <br />
                        <button
                            onClick={() => window.location.reload()}
                            style={{ marginTop: '0.5rem', background: 'transparent', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Model Selection */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>AI Model</label>
                    {loading ? (
                        <div className="glass-input">Loading models...</div>
                    ) : (
                        <select
                            className="glass-input"
                            style={{ width: '100%', background: 'rgba(0,0,0,0.5)' }}
                            value={selectedModel}
                            onChange={(e) => setModel(e.target.value)}
                            disabled={models.length === 0}
                        >
                            {models.map(m => (
                                <option key={m.digest} value={m.name}>{m.name} ({Math.round(m.size / 1024 / 1024 / 1024)}GB)</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Genre Selection */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Genre / Setting</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                        {GENRES.map(g => (
                            <button
                                key={g.id}
                                onClick={() => setGenre(g.id)}
                                style={{
                                    padding: '0.75rem',
                                    background: genre === g.id ? 'rgba(100,255,218,0.2)' : 'rgba(255,255,255,0.05)',
                                    border: genre === g.id ? '2px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    color: 'inherit'
                                }}
                            >
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{g.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'gray', marginTop: '0.25rem' }}>{g.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Character Concept */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Your Character (optional)
                    </label>
                    <input
                        className="glass-input"
                        style={{ width: '100%' }}
                        value={characterConcept}
                        onChange={(e) => setCharacterConcept(e.target.value)}
                        placeholder="e.g., A disgraced knight seeking redemption, A curious inventor, A street-smart thief..."
                    />
                    <p style={{ fontSize: '0.75rem', color: 'gray', marginTop: '0.25rem' }}>
                        Leave blank to let the GM suggest character options
                    </p>
                </div>

                {/* Starting Scenario */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>How should the story begin?</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {STARTING_OPTIONS.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setStartingOption(opt.id)}
                                style={{
                                    padding: '0.75rem 1rem',
                                    background: startingOption === opt.id ? 'rgba(100,255,218,0.2)' : 'rgba(255,255,255,0.05)',
                                    border: startingOption === opt.id ? '2px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    color: 'inherit'
                                }}
                            >
                                <span style={{ fontWeight: startingOption === opt.id ? 'bold' : 'normal' }}>{opt.name}</span>
                                <span style={{ fontSize: '0.8rem', color: 'gray' }}>{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Intro */}
                <AnimatePresence>
                    {startingOption === 'custom' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ marginBottom: '1.5rem', overflow: 'hidden' }}
                        >
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                Your Opening Scene
                            </label>
                            <textarea
                                className="glass-input"
                                rows={4}
                                style={{ width: '100%', resize: 'none' }}
                                value={customIntro}
                                onChange={(e) => setCustomIntro(e.target.value)}
                                placeholder="Describe how you want the story to begin. The GM will continue from here..."
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Advanced Settings Toggle */}
                <div style={{ marginBottom: '1rem' }}>
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'gray',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {showAdvanced ? '▼' : '▶'} Advanced: System Prompt
                    </button>
                </div>

                <AnimatePresence>
                    {showAdvanced && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ marginBottom: '1.5rem', overflow: 'hidden' }}
                        >
                            <textarea
                                className="glass-input"
                                rows={6}
                                style={{ width: '100%', resize: 'none', fontSize: '0.85rem' }}
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'gray', marginTop: '0.25rem' }}>
                                The system prompt defines the GM's behavior. Modify with care.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    className="glass-btn"
                    style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }}
                    onClick={handleStart}
                    disabled={!selectedModel}
                >
                    Begin Adventure
                </button>
            </motion.div>
        </div>
    );
};
