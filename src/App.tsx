import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { GameSetup } from './components/GameSetup';
import { GameInterface } from './components/GameInterface';
import { useGameStore } from './store/useGameStore';

export interface StoryConfig {
  genre: string;
  characterConcept: string;
  startingOption: string;
  customIntro: string;
}

function App() {
  const { selectedModel, chatHistory } = useGameStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [storyConfig, setStoryConfig] = useState<StoryConfig | null>(null);

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

  const handleStart = (config: StoryConfig) => {
    setStoryConfig(config);
    setIsPlaying(true);
  };

  return (
    <Layout>
      {!isPlaying ? (
        <GameSetup onStart={handleStart} />
      ) : (
        <GameInterface
          onBackToSetup={() => setIsPlaying(false)}
          storyConfig={storyConfig}
        />
      )}
    </Layout>
  );
}

export default App;
