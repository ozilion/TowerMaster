
import React from 'react';
import { cn } from "@/lib/utils";
import { Coins, Heart, Layers, Award } from 'lucide-react'; // Gem and other specific icons removed as they are in gameConfig
import type { PlacedTower, Enemy, Projectile, PlacementSpot, TowerCategory, GridPosition, PixelPosition, GameState as GameStateType, TowerDefinition } from '@/types/game';
import gameConfig from '@/config/gameConfig';

interface ImprovedGameBoardProps {
  towers: PlacedTower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  placementSpots: PlacementSpot[];
  selectedTowerType: TowerCategory | null; 
  selectedTowerForMovingId: string | null; 
  firstSelectedTowerForMerge: string | null; // To indicate which tower is selected for merging
  onPlaceTower: (spot: PlacementSpot, towerType: TowerCategory) => void; 
  onTowerClick: (towerId: string) => void; 
  onSelectTowerType: (type: TowerCategory | null) => void; 
  onMoveTowerRequest: (towerId: string, spot: PlacementSpot) => void; 
  gridToPixel: (gridPos: GridPosition) => PixelPosition;
  showRangeIndicatorForTower: PlacedTower | null;
  gameState: GameStateType & { setGameState?: React.Dispatch<React.SetStateAction<GameStateType>> };
}

const TowerIconDisplay: React.FC<{ type: TowerCategory, sizeClass?: string, className?: string }> = ({ type, sizeClass="w-5 h-5", className }) => {
  const towerDef = gameConfig.towerTypes[type];
  const IconComponent = towerDef?.icon; // Icon is now directly in towerDef
  if (!IconComponent) {
    return <div className={cn(`${sizeClass} bg-primary/30 rounded-sm flex items-center justify-center text-xs text-primary-foreground`, className)}>{type ? type.substring(0,1).toUpperCase() : '?'}</div>;
  }
  // Ensure IconComponent is a valid React component
  if (typeof IconComponent !== 'function') {
    return <div className={cn(`${sizeClass} bg-destructive/50 rounded-sm flex items-center justify-center text-xs text-destructive-foreground`, className)}>Err</div>;
  }
  return <IconComponent className={cn(sizeClass, className)} />; // Removed default text-primary-foreground
};


const ImprovedGameBoard: React.FC<ImprovedGameBoardProps> = ({
  towers,
  enemies,
  projectiles,
  placementSpots,
  selectedTowerType, 
  selectedTowerForMovingId,
  firstSelectedTowerForMerge,
  onPlaceTower,
  onTowerClick, 
  onSelectTowerType, 
  onMoveTowerRequest,
  gridToPixel,
  showRangeIndicatorForTower,
  gameState
}) => {
  const boardWidth = gameConfig.gridCols * gameConfig.cellSize;
  const boardHeight = gameConfig.gridRows * gameConfig.cellSize;

  const handleSpotClick = (spot: PlacementSpot) => {
    if (selectedTowerForMovingId && !spot.isOccupied) {
      onMoveTowerRequest(selectedTowerForMovingId, spot);
    } else if (selectedTowerType && !spot.isOccupied) { 
      onPlaceTower(spot, selectedTowerType);
    } else if (spot.isOccupied) {
      const towerOnSpot = towers.find(t => {
        const spotPx = gridToPixel(spot);
        return Math.abs(t.x - spotPx.x) < gameConfig.cellSize / 2 && Math.abs(t.y - spotPx.y) < gameConfig.cellSize / 2;
      });
      if (towerOnSpot) {
        onTowerClick(towerOnSpot.id); 
      }
    }
  };

  return (
    <div className="flex flex-row bg-card rounded-lg shadow-xl border-2 border-primary/30 overflow-hidden">
      {/* Left Tower Controls */}
      <div className="flex flex-col items-center gap-2 p-3 bg-primary/10 border-r border-primary/20 w-24 shrink-0">
        <h3 className="text-xs font-semibold text-primary-foreground/70 mt-1 mb-2 tracking-wider">KULELER</h3>
        {gameState.availableTowerTypes.length > 0 ? (
          gameState.availableTowerTypes.map((towerId) => {
            const towerDef = gameConfig.towerTypes[towerId];
            if (!towerDef) {
              console.warn(`Tower definition not found for ${towerId}`);
              return <div key={`error-${towerId}`} className="text-destructive text-xs w-16 h-16 flex items-center justify-center bg-destructive/10 rounded-md">!</div>;
            }
            
            const isCurrentlySelectedForPlacement = selectedTowerType === towerId;
            const canAfford = gameState.money >= towerDef.baseCost;

            return (
              <button
                key={towerId}
                onClick={() => onSelectTowerType(isCurrentlySelectedForPlacement ? null : towerId)}
                disabled={(!canAfford && !isCurrentlySelectedForPlacement) || !!selectedTowerForMovingId}
                className={cn(
                  "flex flex-col items-center justify-center p-1.5 rounded-md transition-all transform active:scale-95 aspect-square w-16 h-16 focus:outline-none focus:ring-2 focus:ring-accent",
                  isCurrentlySelectedForPlacement ? "bg-accent text-accent-foreground ring-2 ring-accent-foreground shadow-lg scale-105" :
                    canAfford ? "bg-primary/60 hover:bg-primary/80 text-primary-foreground shadow-md hover:shadow-lg" : "bg-muted/40 text-muted-foreground/70 opacity-70 cursor-not-allowed",
                )}
                title={`${towerDef.name} - Bedel: ${towerDef.baseCost} ${!canAfford ? '(Yetersiz Bakiye)' : ''}`}
              >
                <TowerIconDisplay type={towerId} sizeClass="w-7 h-7" className={isCurrentlySelectedForPlacement ? "text-accent-foreground" : "text-primary-foreground/90"}/>
                <span className={cn("text-[10px] font-medium mt-0.5", isCurrentlySelectedForPlacement ? "text-accent-foreground" : "text-primary-foreground/80")}>{towerDef.baseCost}</span>
              </button>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground text-center px-2 py-4">Kule Yok</p>
        )}
        {/* Placeholder for up to 5 towers */}
        {Array.from({ length: Math.max(0, 5 - gameState.availableTowerTypes.length) }).map((_, index) => (
            <div key={`placeholder-slot-${index}`} className="w-16 h-16 bg-muted/10 rounded-md flex items-center justify-center opacity-50 shadow-inner my-1">
              <span className="text-muted-foreground/50 text-2xl">-</span>
            </div>
        ))}
      </div>

      {/* Main Game Area (Stats Header + Board) */}
      <div className="flex flex-col flex-grow">
        {/* Stats Header */}
        <div className="bg-primary/90 text-primary-foreground py-1.5 px-4 flex justify-between items-center shadow-sm text-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" title="Can">
              <Heart className="w-4 h-4 text-red-300" />
              <span className="font-semibold">{gameState.playerHealth}</span>
            </div>
            <div className="flex items-center gap-1" title="Para">
              <Coins className="w-4 h-4 text-yellow-300" />
              <span className="font-semibold">{gameState.money}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center">
              <Layers className="w-3 h-3 text-blue-200" />
              <span className="text-xs">
                Dalga: {gameState.currentMainWaveDisplay > 0 ? gameState.currentMainWaveDisplay : '0'}-{gameState.currentSubWaveInMainDisplay > 0 ? gameState.currentSubWaveInMainDisplay : '0'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" title="Skor">
              <Award className="w-4 h-4 text-amber-300" />
              <span className="font-semibold">{gameState.score}</span>
            </div>
            {gameState.setGameState && ( // Ensure setGameState exists before rendering select
              <select
                  value={gameState.gameSpeed}
                  onChange={(e) => gameState.setGameState!(prev => ({...prev, gameSpeed: Number(e.target.value)}))}
                  className="bg-primary/70 text-primary-foreground p-0.5 rounded text-xs border border-primary/50 focus:ring-accent focus:border-accent appearance-none text-center"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', paddingRight: '1.25rem', paddingLeft: '0.5rem' }}
              >
                  <option value="0.5">0.5x</option>
                  <option value="1">1x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
              </select>
            )}
          </div>
        </div>

        {/* Game Board itself */}
        <div
          className="relative bg-background flex-grow shadow-inner overflow-hidden"
          style={{ width: boardWidth, height: boardHeight }}
          aria-label="Game Board"
        >
          {/* Path */}
          {gameConfig.enemyPath.map((segment, index) => (
            <div
              key={`path-${index}`}
              className="absolute bg-secondary/30 border border-secondary/40"
              style={{
                left: segment.col * gameConfig.cellSize,
                top: segment.row * gameConfig.cellSize,
                width: gameConfig.cellSize,
                height: gameConfig.cellSize,
              }}
            />
          ))}

          {/* Placement Spots */}
          {placementSpots.map((spot) => {
            let spotColor = 'bg-muted/20 hover:bg-muted/30';
            let cursorStyle = 'cursor-default';
            const canPlace = selectedTowerType && !spot.isOccupied;
            const canMoveTo = selectedTowerForMovingId && !spot.isOccupied;

            if (spot.isOccupied) {
              spotColor = 'bg-muted/30';
              cursorStyle = 'cursor-pointer';
            } else if (canMoveTo) {
              spotColor = 'bg-green-500/20 hover:bg-green-500/30';
              cursorStyle = 'cursor-pointer';
            } else if (canPlace) {
              spotColor = 'bg-blue-500/20 hover:bg-blue-500/30';
              cursorStyle = 'cursor-pointer';
            }
            return (
              <div
                key={spot.id}
                className={cn(`absolute border border-dashed border-border/50 transition-colors ${cursorStyle}`, spotColor)}
                style={{
                  left: spot.col * gameConfig.cellSize,
                  top: spot.row * gameConfig.cellSize,
                  width: gameConfig.cellSize,
                  height: gameConfig.cellSize,
                }}
                onClick={() => handleSpotClick(spot)}
                role="button"
                aria-label={`Placement spot ${spot.row}, ${spot.col}${spot.isOccupied ? ', occupied' : ''}`}
              />
            );
          })}

          {/* Towers */}
          {towers.map((tower) => {
            const towerDef = gameConfig.towerTypes[tower.type];
            if (!towerDef) return null;
            const levelColor = towerDef.levels[tower.level]?.color || 'hsl(var(--muted-foreground))';
            const isSelectedForMovingVisual = tower.id === selectedTowerForMovingId;
            const isSelectedForMergingVisual = tower.id === firstSelectedTowerForMerge;

            return (
              <div
                key={tower.id}
                className={cn(
                  `absolute rounded-full flex items-center justify-center shadow-lg transition-all duration-150 ease-in-out`,
                  isSelectedForMovingVisual ? 'ring-4 ring-accent ring-offset-1 ring-offset-background scale-110 z-10' :
                  isSelectedForMergingVisual ? 'ring-4 ring-blue-500 ring-offset-1 ring-offset-background z-10' : 'ring-1 ring-black/30'
                )}
                style={{
                  left: tower.x - gameConfig.cellSize / 2,
                  top: tower.y - gameConfig.cellSize / 2,
                  width: gameConfig.cellSize * 0.8,
                  height: gameConfig.cellSize * 0.8,
                  backgroundColor: levelColor,
                  border: `2px solid ${levelColor.replace('0.8', '1').replace('0.9','1')}`, // Darken border
                  transform: `rotate(${tower.rotation || 0}deg)`,
                  transformOrigin: 'center center',
                  cursor: 'pointer',
                }}
                onClick={() => onTowerClick(tower.id)}
                role="button"
                aria-label={`${towerDef.name} level ${tower.level}${isSelectedForMovingVisual ? ', selected for moving' : ''}`}
              >
                <TowerIconDisplay type={tower.type} sizeClass="w-3/5 h-3/5" className="text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 text-[9px] bg-black/60 text-white rounded-full px-1 leading-tight">
                  {tower.level}
                </span>
                {showRangeIndicatorForTower?.id === tower.id && (
                  <div
                    className="absolute rounded-full bg-blue-500/10 border border-blue-500/30 pointer-events-none"
                    style={{
                      width: tower.stats.range * 2,
                      height: tower.stats.range * 2,
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: -1, // Behind the tower
                    }}
                  />
                )}
              </div>
            );
          })}

          {/* Enemies */}
          {enemies.map((enemy) => (
            <div
              key={enemy.id}
              className="absolute rounded-md flex items-center justify-center"
              style={{
                left: enemy.x - enemy.size / 2,
                top: enemy.y - enemy.size / 2,
                width: enemy.size,
                height: enemy.size,
                backgroundColor: gameConfig.enemyTypes[enemy.type as keyof typeof gameConfig.enemyTypes]?.color || 'purple',
                zIndex: 20,
              }}
              aria-label={`Enemy ${enemy.type}`}
            >
              <div className="absolute -top-1.5 w-full h-1 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-destructive transition-all duration-100"
                  style={{ width: `${(enemy.health / enemy.maxHealth) * 100}%` }}
                />
              </div>
            </div>
          ))}

          {/* Projectiles */}
          {projectiles.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: p.x - 3,
                top: p.y - 3,
                width: 6,
                height: 6,
                backgroundColor: p.color,
                zIndex: 15,
              }}
              aria-hidden="true"
            />
          ))}
          
          {/* Range indicator for new tower placement */}
          {selectedTowerType && !selectedTowerForMovingId && placementSpots.some(spot => !spot.isOccupied) && (
            placementSpots.map(spot => {
              if (!spot.isOccupied) {
                const towerDef = gameConfig.towerTypes[selectedTowerType!];
                if (!towerDef) return null;
                const tempTowerStats = towerDef.levels[1];
                const spotPx = gridToPixel(spot);
                return (
                  <div
                    key={`range-indicator-new-${spot.id}`}
                    className="absolute rounded-full bg-blue-500/5 border border-dashed border-blue-500/30 pointer-events-none"
                    style={{
                      width: tempTowerStats.range * 2,
                      height: tempTowerStats.range * 2,
                      left: spotPx.x,
                      top: spotPx.y,
                      transform: 'translate(-50%, -50%)',
                      zIndex: -1, // Behind placement spots
                    }}
                    aria-hidden="true"
                  />
                );
              }
              return null;
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ImprovedGameBoard;

    