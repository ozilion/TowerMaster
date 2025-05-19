
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarInset } from '@/components/ui/sidebar';
import GameBoard from '@/components/game/GameBoard';
import GameControls from '@/components/game/GameControls';
import GameOverScreen from '@/components/game/GameOverScreen';
import InstructionsModal from '@/components/game/InstructionsModal';
import { useGameLogic } from '@/hooks/useGameLogic';
import type { PlacedTower, TowerCategory } from '@/types/game';
import { Heart, Coins, Layers, Award } from 'lucide-react'; // Using Award for Score

export default function KuleSavunmaPage() {
  const {
    gameState,
    towers,
    enemies,
    projectiles,
    currentPlacementSpots,
    placeTower,
    attemptMergeTowers,
    startNextWave,
    setSelectedTowerType,
    resetGame,
    gridToPixel,
    setGameState // To control game speed for example
  } = useGameLogic();

  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [firstSelectedTowerForMerge, setFirstSelectedTowerForMerge] = useState<string | null>(null);
  const [showRangeIndicatorForTower, setShowRangeIndicatorForTower] = useState<PlacedTower | null>(null);


  const handleTowerSelectionForPlacement = (type: TowerCategory | null) => {
    setSelectedTowerType(type);
    setFirstSelectedTowerForMerge(null); // Clear merge selection when selecting new tower type
    setShowRangeIndicatorForTower(null);
  };
  
  const handleTowerClickOnBoard = (towerId: string) => {
    const clickedTower = towers.find(t => t.id === towerId);
    if (!clickedTower) return;

    setShowRangeIndicatorForTower(clickedTower); // Show range of any clicked tower
    setSelectedTowerType(null); // Clear placement selection

    if (!firstSelectedTowerForMerge) {
      setFirstSelectedTowerForMerge(towerId);
      // Potentially show a visual cue that this tower is selected for merging
    } else {
      if (firstSelectedTowerForMerge !== towerId) {
        attemptMergeTowers(firstSelectedTowerForMerge, towerId);
      }
      setFirstSelectedTowerForMerge(null); // Reset after attempting merge or clicking same tower
      // Clear visual cue
    }
  };

  // Reset merge selection if player clicks elsewhere or selects a new tower type
  useEffect(() => {
    if (gameState.selectedTowerType) {
      setFirstSelectedTowerForMerge(null);
    }
  }, [gameState.selectedTowerType]);


  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
        {/* Top Info Bar */}
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
            <span className="text-lg font-semibold">{gameState.currentWaveNumber} / {gameState.isGameOver ? gameState.currentWaveNumber : gameState.currentWaveNumber}</span>
          </div>
           <div className="flex items-center gap-2" title="Skor">
            <Award className="w-6 h-6 text-green-300" />
            <span className="text-lg font-semibold">{gameState.score}</span>
          </div>
          {/* Game Speed Control - Example
          <select 
            value={gameState.gameSpeed} 
            onChange={(e) => setGameState(prev => ({...prev, gameSpeed: Number(e.target.value)}))}
            className="bg-primary-foreground text-primary p-1 rounded text-sm"
          >
            <option value="1">1x</option>
            <option value="2">2x</option>
          </select>
          */}
        </header>

        <div className="flex flex-1 overflow-hidden"> {/* This div takes remaining height and enables scrolling for its children if they overflow */}
          <Sidebar side="right" variant="sidebar" collapsible="none" className="w-72 border-l border-sidebar-border shadow-lg z-10">
            <SidebarContent className="p-0"> {/* Remove padding from SidebarContent if GameControls handles its own */}
              <GameControls
                gameState={gameState}
                onStartWave={startNextWave}
                onSelectTowerType={handleTowerSelectionForPlacement}
                onResetGame={resetGame}
                selectedPlacedTower={showRangeIndicatorForTower}
                onShowInstructions={() => setIsInstructionsOpen(true)}
              />
            </SidebarContent>
          </Sidebar>
          
          <SidebarInset className="flex-1 bg-background p-2 sm:p-4 flex items-center justify-center overflow-auto"> {/* Added flex items-center justify-center */}
             <div className="shadow-2xl rounded-lg overflow-hidden border-2 border-primary/30">
                <GameBoard
                    towers={towers}
                    enemies={enemies}
                    projectiles={projectiles}
                    placementSpots={currentPlacementSpots}
                    selectedTowerType={gameState.selectedTowerType}
                    onPlaceTower={placeTower}
                    onTowerClick={handleTowerClickOnBoard}
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
