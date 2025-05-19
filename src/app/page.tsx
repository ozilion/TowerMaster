
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarInset } from '@/components/ui/sidebar';
import GameBoard from '@/components/game/GameBoard';
import GameControls from '@/components/game/GameControls';
import GameOverScreen from '@/components/game/GameOverScreen';
import InstructionsModal from '@/components/game/InstructionsModal';
import { useGameLogic } from '@/hooks/useGameLogic';
import type { PlacedTower, TowerCategory, PlacementSpot } from '@/types/game';
import { Heart, Coins, Layers, Award } from 'lucide-react'; 
import gameConfig from '@/config/gameConfig';
import { useToast } from '@/hooks/use-toast';

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


  const handleTowerSelectionForPlacement = (type: TowerCategory | null) => {
    setSelectedTowerType(type);
    setFirstSelectedTowerForMerge(null); 
    setSelectedTowerForMovingId(null);
    setShowRangeIndicatorForTower(null);
  };
  
  const handleTowerClickOnBoard = (towerId: string) => {
    const clickedTower = towers.find(t => t.id === towerId);
    if (!clickedTower) return;

    // Always show range for the clicked tower first
    setShowRangeIndicatorForTower(clickedTower);
    setSelectedTowerType(null); // Clear new tower placement selection

    if (firstSelectedTowerForMerge === towerId) { // Clicked the same tower again (already selected for merge/move)
        setFirstSelectedTowerForMerge(null);
        setSelectedTowerForMovingId(null);
        // setShowRangeIndicatorForTower(null); // Deselect, clear range
    } else if (firstSelectedTowerForMerge) { // A different tower was selected (T1), now clicking T2 (towerId)
        const firstTowerOriginal = towers.find(t => t.id === firstSelectedTowerForMerge); // For reverting range indicator on fail
        const mergeResult = attemptMergeTowers(firstSelectedTowerForMerge, towerId);
        
        if (mergeResult.success && mergeResult.resultingTower) {
            setShowRangeIndicatorForTower(mergeResult.resultingTower); 
            toast({
                title: "Kule Birleştirildi!",
                description: mergeResult.message,
            });
        } else {
            toast({
                title: "Birleştirme Başarısız",
                description: mergeResult.message,
                variant: "destructive",
            });
            // On failure, revert range indicator to the first selected tower.
            setShowRangeIndicatorForTower(firstTowerOriginal || null);
        }
        setFirstSelectedTowerForMerge(null); 
        setSelectedTowerForMovingId(null);
    } else { // No tower was previously selected for merge/move. This is the first click.
        setFirstSelectedTowerForMerge(towerId); 
        setSelectedTowerForMovingId(towerId); 
        // Range indicator already set for clickedTower at the start of the function
    }
  };

  const handleMoveTowerRequest = (towerId: string, spot: PlacementSpot) => {
    const success = moveTower(towerId, spot.id);
    if (success) {
      // After successful move, find the tower in the new 'towers' array to get its updated state
      // This might require a brief delay or a way to get the tower's new state directly from moveTower if it were to return it
      const movedTower = towers.find(t => t.id === towerId); // This will be from the current render cycle, might not be updated yet
      // To be safe, it's better to find it after next render or if moveTower returns the updated tower
      // For now, we optimistically assume it's found or null.
      setShowRangeIndicatorForTower(movedTower || null);
      toast({
        title: "Kule Taşındı!",
        description: `${movedTower?.type || 'Kule'} yeni yerine taşındı.`,
      });
    } else {
      toast({
        title: "Taşıma Başarısız",
        description: "Kule bu noktaya taşınamadı.",
        variant: "destructive",
      });
    }
    setSelectedTowerForMovingId(null);
    setFirstSelectedTowerForMerge(null);
  };

  // Reset selections if player selects a new tower type for placement
  useEffect(() => {
    if (gameState.selectedTowerType) {
      setFirstSelectedTowerForMerge(null);
      setSelectedTowerForMovingId(null);
    }
  }, [gameState.selectedTowerType]);

  // Reset selections if game over
  useEffect(() => {
    if (gameState.isGameOver) {
      setFirstSelectedTowerForMerge(null);
      setSelectedTowerForMovingId(null);
      setShowRangeIndicatorForTower(null);
    }
  }, [gameState.isGameOver]);


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
            <span className="text-lg font-semibold">{gameState.currentWaveNumber} / {gameConfig.waves.length}</span>
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
                onResetGame={() => {
                  resetGame();
                  setFirstSelectedTowerForMerge(null);
                  setSelectedTowerForMovingId(null);
                  setShowRangeIndicatorForTower(null);
                }}
                selectedPlacedTower={showRangeIndicatorForTower}
                selectedTowerForMovingId={selectedTowerForMovingId}
                onShowInstructions={() => setIsInstructionsOpen(true)}
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
                    onPlaceTower={placeTower}
                    onTowerClick={handleTowerClickOnBoard}
                    onMoveTowerRequest={handleMoveTowerRequest}
                    gridToPixel={gridToPixel}
                    showRangeIndicatorForTower={showRangeIndicatorForTower}
                />
             </div>
          </SidebarInset>
        </div>

        <GameOverScreen
          isOpen={gameState.isGameOver}
          score={gameState.score}
          onRestart={() => {
            resetGame();
            setFirstSelectedTowerForMerge(null);
            setSelectedTowerForMovingId(null);
            setShowRangeIndicatorForTower(null);
          }}
        />
        <InstructionsModal
          isOpen={isInstructionsOpen}
          onClose={() => setIsInstructionsOpen(false)}
        />
      </div>
    </SidebarProvider>
  );
}

