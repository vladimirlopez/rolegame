import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { GameSetup } from './components/GameSetup';
import { GameInterface } from './components/GameInterface';
import { useGameStore } from './store/useGameStore';

function App() {
  const { selectedModel, chatHistory } = useGameStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Check if store is rehydrated from IDB
    // useGameStore.persist.onFinishHydration(() => setIsHydrated(true)); // Generic check
    // Zustand persist doesn't always expose onFinishHydration easily depending on version
    // Simple timeout for now or check if values exist.
    // Actually, createJSONStorage + idb is async.
    // We can assume hydrated when useEffect runs? 
    // Let's use hasHydrated() from persist options if available, or just checks.

    const checkHydration = async () => {
      // Wait a tick for hydration
      await new Promise(r => setTimeout(r, 100));
      setIsHydrated(true);
      if (selectedModel && chatHistory.length > 0) {
        setIsPlaying(true);
      }
    };
    checkHydration();
  }, [selectedModel, chatHistory.length]);

  if (!isHydrated) return null; // Or loading spinner

  return (
    <Layout>
      {!isPlaying ? (
        <GameSetup onStart={() => setIsPlaying(true)} />
      ) : (
        <GameInterface />
      )}
    </Layout>
  );
}

export default App;
