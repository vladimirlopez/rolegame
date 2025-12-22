import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { OllamaService } from '../services/ollamaService';
import type { OllamaModel } from '../services/ollamaService';
import { motion } from 'framer-motion';

export const GameSetup: React.FC<{ onStart: () => void }> = ({ onStart }) => {
    const { setModel, setSystemPrompt, selectedModel, systemPrompt } = useGameStore();
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
        onStart();
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%'
        }}>
            <motion.div
                className="glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ padding: '2rem', width: '100%', maxWidth: '600px' }}
            >
                <h1 style={{ marginBottom: '1.5rem', fontSize: '2rem', textAlign: 'center' }}>
                    Start Your Adventure
                </h1>

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

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select Model</label>
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

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Story Concept / System Prompt</label>
                    <textarea
                        className="glass-input"
                        rows={5}
                        style={{ width: '100%', resize: 'none' }}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="e.g., You are a master storyteller managing a sci-fi mystery RPG..."
                    />
                </div>

                <button
                    className="glass-btn"
                    style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }}
                    onClick={handleStart}
                    disabled={!selectedModel}
                >
                    Enter World
                </button>
            </motion.div>
        </div>
    );
};
