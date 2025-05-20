
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useGameLogic } from '@/hooks/useGameLogic';
import gameConfig from '@/config/gameConfig';
import type { PlacedTower, TowerCategory, PlacementSpot, GameState as GameStateType, GameEndScreenProps, InstructionsModalProps } from '@/types/game';
import ImprovedGameBoard from '@/components/game/ImprovedGameBoard';

// GameWon ekranı
const GameWonScreen: React.FC<GameEndScreenProps> = ({ isOpen, score, onRestart }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground p-8 rounded-lg shadow-2xl text-center">
        <h2 className="text-3xl font-bold text-green-500 mb-4">Tebrikler, Oyunu Kazandın!</h2>
        <p className="text-xl mb-6">Skorun: <span className="font-semibold text-amber-500">{score}</span></p>
        <Button onClick={onRestart} className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-3 px-6">
          Yeniden Başlat
        </Button>
      </div>
    </div>
  );
};

// GameOver ekranı
const GameOverScreen: React.FC<GameEndScreenProps> = ({ isOpen, score, onRestart }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground p-8 rounded-lg shadow-2xl text-center">
        <h2 className="text-3xl font-bold text-destructive mb-4">Oyun Bitti!</h2>
        <p className="text-xl mb-6">Skorun: <span className="font-semibold text-accent">{score}</span></p>
        <Button onClick={onRestart} className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-3 px-6">
          Yeniden Başlat
        </Button>
      </div>
    </div>
  );
};

// InstructionsModal bileşeni
const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card text-card-foreground p-6 rounded-lg shadow-2xl max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-primary mb-4 text-center">Nasıl Oynanır?</h2>
        
        <div className="space-y-3 text-sm">
          <p><strong>Amaç:</strong> Düşmanların yolun sonuna ulaşmasını engellemek.</p>
          
          <h3 className="font-semibold mt-2 text-primary">Temel Mekanikler:</h3>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Düşmanlar belirli bir yolda dalga şeklinde ilerler.</li>
            <li>Kuleleri sadece haritadaki işaretli taş bloklara yerleştirebilirsin.</li>
            <li>Her öldürülen düşman için para kazanırsın.</li>
            <li>Kazandığın parayla yeni kuleler alabilir veya mevcut kuleleri birleştirebilirsin.</li>
            <li>Aynı tipte ve aynı seviyedeki iki kuleyi birleştirerek daha güçlü bir kule (maksimum 3. seviye) elde edebilirsin.</li>
            <li>Düşmanlar yolun sonuna ulaştığında canın azalır. Canın biterse oyun sona erer.</li>
          </ul>
          
          <div className="flex justify-end mt-4">
            <Button onClick={onClose} className="bg-primary text-primary-foreground">Anladım</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function KuleSavunmaPage() {
  const {
    gameState,
    towers,
    enemies,
    projectiles,
    currentPlacementSpots,
    placeTower,
    attemptMergeTowers,
    moveTower,
    startNextWave,
    setSelectedTowerType,
    resetGame,
    gridToPixel,
    setGameState 
  } = useGameLogic();

  const { toast } = useToast();
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [firstSelectedTowerForMerge, setFirstSelectedTowerForMerge] = useState<string | null>(null);
  const [selectedTowerForMovingId, setSelectedTowerForMovingId] = useState<string | null>(null);
  const [showRangeIndicatorForTower, setShowRangeIndicatorForTower] = useState<PlacedTower | null>(null);

  const resetGameAndSelections = useCallback(() => {
    resetGame();
    setFirstSelectedTowerForMerge(null);
    setSelectedTowerForMovingId(null);
    setShowRangeIndicatorForTower(null);
    setSelectedTowerType(null); 
  }, [resetGame, setSelectedTowerType]);

  // Kule seçim işlemleri (ImprovedGameBoard içindeki UI için)
  const handleTowerSelectionForPlacement = useCallback((type: TowerCategory | null) => {
    setSelectedTowerType(type); 
    setFirstSelectedTowerForMerge(null);
    setSelectedTowerForMovingId(null);
  }, [setSelectedTowerType]);

  const handleTowerClickOnBoard = useCallback((towerId: string) => {
    const clickedTower = towers.find(t => t.id === towerId);
    if (!clickedTower) return;

    setShowRangeIndicatorForTower(clickedTower);
    setSelectedTowerType(null); 

    if (selectedTowerForMovingId === towerId) { 
        setSelectedTowerForMovingId(null); 
        setFirstSelectedTowerForMerge(null); 
    } else if (firstSelectedTowerForMerge === towerId) {
        setFirstSelectedTowerForMerge(null); 
        setSelectedTowerForMovingId(null); 
    } else if (firstSelectedTowerForMerge) {
        const firstTowerOriginal = towers.find(t => t.id === firstSelectedTowerForMerge);
        const mergeResult = attemptMergeTowers(firstSelectedTowerForMerge, towerId);

        if (mergeResult.success && mergeResult.resultingTower) {
            setShowRangeIndicatorForTower(mergeResult.resultingTower);
            toast({ title: "Kule Birleştirildi!", description: mergeResult.message });
        } else {
            toast({ title: "Birleştirme Başarısız", description: mergeResult.message, variant: "destructive" });
            setShowRangeIndicatorForTower(firstTowerOriginal || null);
        }
        setFirstSelectedTowerForMerge(null);
        setSelectedTowerForMovingId(null);
    } else { 
        setFirstSelectedTowerForMerge(towerId);
        setSelectedTowerForMovingId(towerId);
    }
  }, [towers, selectedTowerForMovingId, firstSelectedTowerForMerge, attemptMergeTowers, toast, setSelectedTowerType]);

  const handleMoveTowerRequest = useCallback((towerId: string, spot: PlacementSpot) => {
    const success = moveTower(towerId, spot.id);
    const movedTower = towers.find(t => t.id === towerId);
    if (success && movedTower) {
      setShowRangeIndicatorForTower(movedTower);
      toast({ title: "Kule Taşındı!", description: `${gameConfig.towerTypes[movedTower.type]?.name || 'Kule'} yeni yerine taşındı.` });
    } else {
      toast({ title: "Taşıma Başarısız", description: "Kule bu noktaya taşınamadı.", variant: "destructive" });
      const originalTower = towers.find(t => t.id === towerId);
      setShowRangeIndicatorForTower(originalTower || null);
    }
    setSelectedTowerForMovingId(null);
    setFirstSelectedTowerForMerge(null);
  }, [moveTower, towers, toast]);

  const handlePlaceNewTower = useCallback((spot: PlacementSpot, towerType: TowerCategory) => {
    const result = placeTower(spot, towerType);
    if (result.success) {
        toast({ title: "Kule Yerleştirildi", description: result.message });
        const spotPx = gridToPixel(spot);
        // Robustly find the newly placed tower by checking spot AND type, and perhaps timestamp if available
        // For now, this simplified find might work if placeTower updates towers state synchronously
        const newPlacedTower = towers.find(t =>
            t.type === towerType &&
            Math.abs(t.x - spotPx.x) < gameConfig.cellSize / 4 &&
            Math.abs(t.y - spotPx.y) < gameConfig.cellSize / 4
        );
        if (newPlacedTower) setShowRangeIndicatorForTower(newPlacedTower);
    } else {
        toast({ title: "Yerleştirme Başarısız", description: result.message, variant: "destructive" });
    }
    setSelectedTowerType(null);
    setFirstSelectedTowerForMerge(null);
    setSelectedTowerForMovingId(null);
  }, [placeTower, toast, gridToPixel, towers, setSelectedTowerType]);

  useEffect(() => {
    if (gameState.selectedTowerType) {
      setFirstSelectedTowerForMerge(null);
      setSelectedTowerForMovingId(null);
    }
  }, [gameState.selectedTowerType]);

  useEffect(() => {
    if (gameState.isGameOver || gameState.gameStatus === 'gameWon') {
      setFirstSelectedTowerForMerge(null);
      setSelectedTowerForMovingId(null);
      setShowRangeIndicatorForTower(null);
      setSelectedTowerType(null);
    }
  }, [gameState.isGameOver, gameState.gameStatus, setSelectedTowerType]);

  const getWaveButtonText = useCallback(() => {
    if (gameState.gameStatus === 'initial') return 'Oyunu Başlat';
    if (gameState.gameStatus === 'betweenMainWaves') {
        if (gameState.currentMainWaveDisplay >= gameConfig.totalMainWaves) return 'Oyun Bitti';
        return `Ana Dalga ${gameState.currentMainWaveDisplay + 1} Başlat`;
    }
    if (gameState.gameStatus === 'subWaveInProgress' || gameState.gameStatus === 'waitingForNextSubWave') {
        return `Dalga ${gameState.currentMainWaveDisplay}-${gameState.currentSubWaveInMainDisplay} / ${gameConfig.subWavesPerMain}`;
    }
    return 'Dalga Başlat';
  }, [gameState.gameStatus, gameState.currentMainWaveDisplay, gameState.currentSubWaveInMainDisplay]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <header className="h-12 bg-primary text-primary-foreground p-2 flex justify-center items-center shadow-lg z-20 shrink-0">
        <h1 className="text-xl font-bold">Kule Savunma Ustası</h1>
      </header>

      <div className="flex-1 flex flex-row justify-center items-start p-4 gap-6 mt-4">
        {/* Game Board Area (ImprovedGameBoard now contains its own left tower controls) */}
        <div className="flex-shrink-0"> 
          <ImprovedGameBoard
            towers={towers}
            enemies={enemies}
            projectiles={projectiles}
            placementSpots={currentPlacementSpots}
            selectedTowerType={gameState.selectedTowerType}
            selectedTowerForMovingId={selectedTowerForMovingId}
            onPlaceTower={handlePlaceNewTower}
            onTowerClick={handleTowerClickOnBoard}
            onSelectTowerType={handleTowerSelectionForPlacement}
            onMoveTowerRequest={handleMoveTowerRequest}
            gridToPixel={gridToPixel}
            showRangeIndicatorForTower={showRangeIndicatorForTower}
            gameState={{...gameState, setGameState}}
            firstSelectedTowerForMerge={firstSelectedTowerForMerge} // Pass this for visual feedback on merge selection
          />
        </div>

        {/* Right Controls Panel */}
        <div className="flex flex-col gap-4 p-4 bg-card text-card-foreground rounded-lg shadow-xl w-64 sticky top-[calc(3rem+2rem)]"> {/* Adjust top for header + mt-4 */}
          <Button
            onClick={startNextWave}
            disabled={
                !(gameState.gameStatus === 'initial' || gameState.gameStatus === 'betweenMainWaves') ||
                gameState.isGameOver ||
                gameState.gameStatus === 'gameWon' ||
                !!selectedTowerForMovingId 
            }
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold py-3 px-6 rounded-lg shadow-lg text-base"
          >
            {getWaveButtonText()}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsInstructionsOpen(true)}
            className="bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          >
            Nasıl Oynanır?
          </Button>
          <Button
            variant="destructive"
            onClick={resetGameAndSelections}
          >
            Yeniden Başlat
          </Button>
        </div>
      </div>

      {/* Modals */}
      <GameOverScreen isOpen={gameState.isGameOver && gameState.gameStatus === 'gameOver'} score={gameState.score} onRestart={resetGameAndSelections} />
      <GameWonScreen isOpen={gameState.gameStatus === 'gameWon'} score={gameState.score} onRestart={resetGameAndSelections} />
      <InstructionsModal isOpen={isInstructionsOpen} onClose={() => setIsInstructionsOpen(false)} />
    </div>
  );
}

    