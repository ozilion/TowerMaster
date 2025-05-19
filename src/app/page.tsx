
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarInset } from '@/components/ui/sidebar';
import GameBoard from '@/components/game/GameBoard';
import GameControls from '@/components/game/GameControls';
import GameOverScreen from '@/components/game/GameOverScreen';
import InstructionsModal from '@/components/game/InstructionsModal';
import { useGameLogic } from '@/hooks/useGameLogic';
import type { PlacedTower, TowerCategory, PlacementSpot, GameState } from '@/types/game';
import { Heart, Coins, Layers, Award } from 'lucide-react';
import gameConfig from '@/config/gameConfig';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

// Game Won Screen Component
const GameWonScreen: React.FC<{ isOpen: boolean; score: number; onRestart: () => void }> = ({ isOpen, score, onRestart }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground p-8 rounded-lg shadow-2xl text-center">
        <h2 className="text-3xl font-bold text-primary mb-4">Tebrikler, Oyunu Kazandın!</h2>
        <p className="text-xl mb-6">Skorun: <span className="font-semibold text-accent">{score}</span></p>
        <Button onClick={onRestart} className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-3 px-6">
          Yeniden Başlat
        </Button>
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
    setGameState // For game speed control
  } = useGameLogic();

  const { toast } = useToast();
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [firstSelectedTowerForMerge, setFirstSelectedTowerForMerge] = useState<string | null>(null);
  const [selectedTowerForMovingId, setSelectedTowerForMovingId] = useState<string | null>(null);
  const [showRangeIndicatorForTower, setShowRangeIndicatorForTower] = useState<PlacedTower | null>(null);

  const handleTowerSelectionForPlacement = (type: TowerCategory | null) => {
    setSelectedTowerType(type);
    setFirstSelectedTowerForMerge(null);
    setSelectedTowerForMovingId(null); 
    setShowRangeIndicatorForTower(null);
  };

  const handleTowerClickOnBoard = (towerId: string) => {
    const clickedTower = towers.find(t => t.id === towerId);
    if (!clickedTower) return;

    setShowRangeIndicatorForTower(clickedTower); // Show range for any clicked tower
    setSelectedTowerType(null); // Cancel any new tower placement

    if (firstSelectedTowerForMerge === towerId) { // Clicked same tower again (deselect for merge, keep for move)
        setFirstSelectedTowerForMerge(null);
        // Keep selectedTowerForMovingId if it was already this tower
    } else if (firstSelectedTowerForMerge) { // A tower was already selected for merge
        const firstTowerOriginal = towers.find(t => t.id === firstSelectedTowerForMerge);
        const mergeResult = attemptMergeTowers(firstSelectedTowerForMerge, towerId);

        if (mergeResult.success && mergeResult.resultingTower) {
            setShowRangeIndicatorForTower(mergeResult.resultingTower); // Show range of new merged tower
            toast({ title: "Kule Birleştirildi!", description: mergeResult.message });
        } else {
            toast({ title: "Birleştirme Başarısız", description: mergeResult.message, variant: "destructive" });
            setShowRangeIndicatorForTower(firstTowerOriginal || null); // Revert to first tower's range
        }
        setFirstSelectedTowerForMerge(null);
        setSelectedTowerForMovingId(null); // Clear move selection after merge attempt
    } else { // No tower selected for merge yet, select this one for both merge and move
        setFirstSelectedTowerForMerge(towerId);
        setSelectedTowerForMovingId(towerId);
    }
  };

  const handleMoveTowerRequest = (towerId: string, spot: PlacementSpot) => {
    const success = moveTower(towerId, spot.id);
    const movedTower = towers.find(t => t.id === towerId); // Get updated tower info
    if (success && movedTower) {
      setShowRangeIndicatorForTower(movedTower); // Update range indicator to new position
      toast({ title: "Kule Taşındı!", description: `${gameConfig.towerTypes[movedTower.type]?.name || 'Kule'} yeni yerine taşındı.` });
    } else {
      toast({ title: "Taşıma Başarısız", description: "Kule bu noktaya taşınamadı.", variant: "destructive" });
    }
    setSelectedTowerForMovingId(null); // Clear move selection
    setFirstSelectedTowerForMerge(null); // Clear merge selection
  };
  
  const handlePlaceNewTower = (spot: PlacementSpot, towerType: TowerCategory) => {
    const result = placeTower(spot, towerType);
    if (result.success) {
        toast({ title: "Kule Yerleştirildi", description: result.message });
        const newPlacedTower = towers.find(t => t.x === gridToPixel(spot).x && t.y === gridToPixel(spot).y && t.type === towerType);
        if (newPlacedTower) setShowRangeIndicatorForTower(newPlacedTower);
    } else {
        toast({ title: "Yerleştirme Başarısız", description: result.message, variant: "destructive" });
    }
    // setSelectedTowerType(null) is handled by placeTower internally through setGameState
    setFirstSelectedTowerForMerge(null);
    setSelectedTowerForMovingId(null);
  };


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
    }
  }, [gameState.isGameOver, gameState.gameStatus]);

  const getWaveButtonText = () => {
    if (gameState.gameStatus === 'initial') return 'Oyunu Başlat';
    if (gameState.gameStatus === 'betweenMainWaves') {
        if (gameState.currentMainWaveDisplay >= gameConfig.totalMainWaves ) return 'Oyun Bitti'; // Should be gameWon
        return `Ana Dalga ${gameState.currentMainWaveDisplay + 1} Başlat`;
    }
    if (gameState.gameStatus === 'subWaveInProgress' || gameState.gameStatus === 'waitingForNextSubWave') {
        return `Dalga ${gameState.currentMainWaveDisplay} - ${gameState.currentSubWaveInMainDisplay} / ${gameConfig.subWavesPerMain}`;
    }
    return 'Dalga Başlat';
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
        <header className="h-16 bg-primary text-primary-foreground p-3 flex justify-around items-center shadow-lg z-20 shrink-0">
          <div className="flex items-center gap-2" title="Can">
            <Heart className="w-6 h-6 text-red-300" />
            <span className="text-lg font-semibold">{gameState.playerHealth}</span>
          </div>
          <div className="flex items-center gap-2" title="Para">
            <Coins className="w-6 h-6 text-yellow-300" />
            <span className="text-lg font-semibold">{gameState.money}</span>
          </div>
          <div className="flex items-center gap-2" title="Dalga">
            <Layers className="w-6 h-6 text-blue-300" />
            <span className="text-sm font-semibold">
                Ana: {gameState.currentMainWaveDisplay} / {gameConfig.totalMainWaves} | Alt: {gameState.currentSubWaveInMainDisplay} / {gameConfig.subWavesPerMain}
            </span>
          </div>
           <div className="flex items-center gap-2" title="Skor">
            <Award className="w-6 h-6 text-green-300" />
            <span className="text-lg font-semibold">{gameState.score}</span>
          </div>
          <select
            value={gameState.gameSpeed}
            onChange={(e) => setGameState(prev => ({...prev, gameSpeed: Number(e.target.value)}))}
            className="bg-primary-foreground text-primary p-1 rounded text-sm"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <Sidebar side="right" variant="sidebar" collapsible="none" className="w-72 border-l border-sidebar-border shadow-lg z-10">
            <SidebarContent className="p-0">
              <GameControls
                gameState={gameState}
                onStartWave={startNextWave}
                onSelectTowerType={handleTowerSelectionForPlacement}
                onResetGame={() => { resetGame(); }}
                selectedPlacedTower={showRangeIndicatorForTower}
                selectedTowerForMovingId={selectedTowerForMovingId}
                onShowInstructions={() => setIsInstructionsOpen(true)}
                waveButtonText={getWaveButtonText()}
                availableTowerTypes={gameState.availableTowerTypes}
              />
            </SidebarContent>
          </Sidebar>

          <SidebarInset className="flex-1 bg-background p-2 sm:p-4 flex items-center justify-center overflow-auto">
             <div className="shadow-2xl rounded-lg overflow-hidden border-2 border-primary/30">
                <GameBoard
                    towers={towers}
                    enemies={enemies}
                    projectiles={projectiles}
                    placementSpots={currentPlacementSpots}
                    selectedTowerType={gameState.selectedTowerType}
                    selectedTowerForMovingId={selectedTowerForMovingId}
                    onPlaceTower={handlePlaceNewTower}
                    onTowerClick={handleTowerClickOnBoard}
                    onMoveTowerRequest={handleMoveTowerRequest}
                    gridToPixel={gridToPixel}
                    showRangeIndicatorForTower={showRangeIndicatorForTower}
                />
             </div>
          </SidebarInset>
        </div>

        <GameOverScreen
          isOpen={gameState.isGameOver && gameState.gameStatus === 'gameOver'}
          score={gameState.score}
          onRestart={() => { resetGame(); }}
        />
        <GameWonScreen
          isOpen={gameState.gameStatus === 'gameWon'}
          score={gameState.score}
          onRestart={() => { resetGame(); }}
        />
        <InstructionsModal
          isOpen={isInstructionsOpen}
          onClose={() => setIsInstructionsOpen(false)}
        />
      </div>
    </SidebarProvider>
  );
}
