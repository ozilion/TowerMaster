
"use client";

import type React from 'react';
import type { GameState, TowerCategory, PlacedTower } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import gameConfig, { TOWER_TYPES } from '@/config/gameConfig';
import { Coins, Heart, Layers, ShieldAlert, HelpCircle, Move } from 'lucide-react';

interface GameControlsProps {
  gameState: GameState;
  onStartWave: () => void;
  onSelectTowerType: (type: TowerCategory | null) => void;
  onResetGame: () => void;
  selectedPlacedTower: PlacedTower | null;
  selectedTowerForMovingId: string | null; // Added prop
  onShowInstructions: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  gameState,
  onStartWave,
  onSelectTowerType,
  onResetGame,
  selectedPlacedTower,
  selectedTowerForMovingId, // Use prop
  onShowInstructions,
}) => {
  const { playerHealth, money, currentWaveNumber, score, gameStatus, selectedTowerType } = gameState;
  const isTowerActiveForInteraction = selectedPlacedTower && selectedTowerForMovingId === selectedPlacedTower.id;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-center">Kule Savunma</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-3 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1 p-2 bg-secondary/50 rounded">
            <Heart className="w-4 h-4 text-red-500" />
            <span>Can: {playerHealth}</span>
          </div>
          <div className="flex items-center gap-1 p-2 bg-secondary/50 rounded">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span>Para: {money}</span>
          </div>
          <div className="flex items-center gap-1 p-2 bg-secondary/50 rounded">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Dalga: {currentWaveNumber}</span>
          </div>
          <div className="flex items-center gap-1 p-2 bg-secondary/50 rounded">
            <ShieldAlert className="w-4 h-4 text-green-500" />
            <span>Skor: {score}</span>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-md font-semibold mb-2 text-center">Kuleler</h3>
          <div className="grid grid-cols-1 gap-2">
            {Object.values(TOWER_TYPES).map((towerDef) => {
              const Icon = towerDef.icon;
              const canAfford = money >= towerDef.baseCost;
              const isSelectedForPlacement = selectedTowerType === towerDef.id;
              return (
                <Button
                  key={towerDef.id}
                  variant={isSelectedForPlacement ? 'default' : 'outline'}
                  onClick={() => onSelectTowerType(isSelectedForPlacement ? null : towerDef.id)}
                  disabled={!canAfford && !isSelectedForPlacement || !!selectedTowerForMovingId} // Disable if moving a tower
                  className="w-full justify-start h-auto p-2 shadow-sm hover:shadow-md transition-shadow"
                  aria-pressed={isSelectedForPlacement}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className={`w-8 h-8 p-1 rounded bg-primary/20 ${isSelectedForPlacement ? 'text-primary-foreground' : 'text-primary'}`} />
                    <div className="flex-grow text-left">
                      <p className="font-semibold text-sm">{towerDef.name}</p>
                      <p className="text-xs text-muted-foreground">Bedel: {towerDef.baseCost}</p>
                    </div>
                    {!canAfford && <Coins className="w-4 h-4 text-destructive" />}
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
        
        {selectedTowerType && !selectedPlacedTower && (
            <p className="text-xs text-center text-accent-foreground bg-accent/20 p-1 rounded">
                Yerleştirmek için haritada boş bir alana tıklayın.
            </p>
        )}

        {selectedPlacedTower && (
          <>
            <Separator />
            <div>
              <h3 className="text-md font-semibold mb-1 text-center">Seçili Kule Bilgileri</h3>
              <Card className="bg-secondary/30 p-2 text-xs">
                <p><strong>Tip:</strong> {TOWER_TYPES[selectedPlacedTower.type].name}</p>
                <p><strong>Seviye:</strong> {selectedPlacedTower.level}</p>
                <p><strong>Hasar:</strong> {selectedPlacedTower.stats.damage}</p>
                <p><strong>Menzil:</strong> {selectedPlacedTower.stats.range.toFixed(0)}</p>
                <p><strong>Atış Hızı:</strong> {selectedPlacedTower.stats.fireRate.toFixed(1)}/s</p>
                {selectedPlacedTower.level < 3 && (
                  <p><strong>Birleştirme Bedeli:</strong> {TOWER_TYPES[selectedPlacedTower.type].levels[(selectedPlacedTower.level + 1) as 2 | 3].mergeCost || 'N/A'}</p>
                )}
              </Card>
              <p className="text-xs text-center text-muted-foreground mt-1 px-1">
                {isTowerActiveForInteraction
                  ? "Taşımak için boş bir alana, birleştirmek için aynı tip ve seviyedeki başka bir kuleye tıklayın. İptal etmek için bu kuleye tekrar tıklayın."
                  : "Aynı tip ve seviyedeki başka bir kuleye tıklayarak birleştirin. Veya taşımak için bu kuleye tekrar tıklayın."
                }
              </p>
            </div>
          </>
        )}


        <div className="mt-auto flex flex-col gap-2 pt-3">
          <Button
            onClick={onStartWave}
            disabled={gameStatus === 'waveInProgress' || gameState.isGameOver || !!selectedTowerForMovingId}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-base py-3 shadow-lg hover:shadow-xl transition-shadow"
          >
            {currentWaveNumber === 0 ? 'İlk Dalga Başlat' : `Dalga ${currentWaveNumber + 1} Başlat`}
          </Button>
          <Button variant="outline" onClick={onShowInstructions} className="w-full">
            <HelpCircle className="mr-2 h-4 w-4" /> Nasıl Oynanır?
          </Button>
          {gameState.isGameOver && (
            <Button onClick={onResetGame} variant="destructive" className="w-full">
              Yeniden Başlat
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GameControls;
