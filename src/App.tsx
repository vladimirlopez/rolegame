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

  if (!isHydrated) return null;

  return (
    <Layout>
      {!isPlaying ? (
        <GameSetup onStart={() => setIsPlaying(true)} />
      ) : (
        <GameInterface onBackToSetup={() => setIsPlaying(false)} />
      )}
    </Layout>
  );
}

export default App;
