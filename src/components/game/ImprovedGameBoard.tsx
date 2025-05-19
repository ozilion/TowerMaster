
import React from 'react';
import { cn } from "@/lib/utils";
import { Coins, Heart, Layers, Award } from 'lucide-react';
import type { PlacedTower, Enemy, Projectile, PlacementSpot, TowerCategory, GridPosition, PixelPosition, GameState as GameStateType, TowerDefinition } from '@/types/game';
import gameConfig from '@/config/gameConfig';

interface GameBoardProps {
  towers: PlacedTower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  placementSpots: PlacementSpot[];
  selectedTowerType: TowerCategory | null;
  selectedTowerForMovingId: string | null;
  onPlaceTower: (spot: PlacementSpot, towerType: TowerCategory) => void;
  onTowerClick: (towerId: string) => void;
  onSelectTowerType: (type: TowerCategory | null) => void;
  onMoveTowerRequest: (towerId: string, spot: PlacementSpot) => void;
  gridToPixel: (gridPos: GridPosition) => PixelPosition;
  showRangeIndicatorForTower: PlacedTower | null;
  gameState: GameStateType & { setGameState?: React.Dispatch<React.SetStateAction<GameStateType>> };
}

const TowerIconDisplay: React.FC<{ type: TowerCategory, sizeClass?: string }> = ({ type, sizeClass="w-5 h-5" }) => {
  const towerDef = gameConfig.towerTypes[type];
  const IconComponent = towerDef?.icon;
  if (!IconComponent) {
    return <div className={`${sizeClass} bg-primary/50 rounded-sm flex items-center justify-center text-xs text-primary-foreground`}>{type ? type.substring(0,1).toUpperCase() : '?'}</div>;
  }
  return <IconComponent className={`${sizeClass} text-primary-foreground`} />;
};

const ImprovedGameBoard: React.FC<GameBoardProps> = ({
  towers,
  enemies,
  projectiles,
  placementSpots,
  selectedTowerForMovingId,
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
    } else if (gameState.selectedTowerType && !spot.isOccupied) {
      onPlaceTower(spot, gameState.selectedTowerType);
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
    <div className="flex flex-col h-full w-full bg-green-700/30 rounded-lg">
      {/* Header */}
      <div className="bg-green-900/80 text-white py-2 px-4 flex justify-between items-center rounded-t-lg shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title="Can">
            <Heart className="w-5 h-5 text-red-400" />
            <span className="text-lg font-semibold">{gameState.playerHealth}</span>
          </div>
          <div className="flex items-center gap-1" title="Para">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-lg font-semibold">{gameState.money}</span>
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center gap-1 justify-center">
            <Layers className="w-4 h-4 text-blue-300" />
            <span className="text-sm">
              Dalga: {gameState.currentMainWaveDisplay > 0 ? gameState.currentMainWaveDisplay : '0'}-{gameState.currentSubWaveInMainDisplay > 0 ? gameState.currentSubWaveInMainDisplay : '0'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title="Skor">
            <Award className="w-5 h-5 text-amber-400" />
            <span className="text-lg font-semibold">{gameState.score}</span>
          </div>
          {gameState.setGameState && (
            <select
                value={gameState.gameSpeed}
                onChange={(e) => gameState.setGameState!(prev => ({...prev, gameSpeed: Number(e.target.value)}))}
                className="bg-green-800 text-white p-1 rounded text-sm border border-green-700 focus:ring-amber-500 focus:border-amber-500"
            >
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Board Area */}
      <div
        className="relative bg-green-200 flex-grow border-x-2 border-green-700 shadow-inner overflow-hidden mx-auto"
        style={{ width: boardWidth, height: boardHeight }}
        aria-label="Game Board"
      >
        {/* Draw Path */}
        {gameConfig.enemyPath.map((segment, index) => (
          <div
            key={`path-${index}`}
            className="absolute bg-yellow-600/40 border border-yellow-700/50"
            style={{
              left: segment.col * gameConfig.cellSize,
              top: segment.row * gameConfig.cellSize,
              width: gameConfig.cellSize,
              height: gameConfig.cellSize,
            }}
          />
        ))}

        {/* Draw Placement Spots */}
        {placementSpots.map((spot) => {
          let spotColor = 'bg-gray-400/30';
          let hoverEffect = 'hover:bg-gray-400/50';
          let cursorStyle = 'cursor-default';

          if (spot.isOccupied) {
            spotColor = 'bg-gray-500/40';
            cursorStyle = 'cursor-pointer';
          } else if (selectedTowerForMovingId) {
            spotColor = 'bg-green-400/40';
            hoverEffect = 'hover:bg-green-400/60';
            cursorStyle = 'cursor-pointer';
          } else if (gameState.selectedTowerType) {
            spotColor = 'bg-blue-300/40';
            hoverEffect = 'hover:bg-blue-400/60';
            cursorStyle = 'cursor-pointer';
          }

          return (
            <div
              key={spot.id}
              className={`absolute border border-dashed border-gray-500/70 transition-colors ${spotColor} ${hoverEffect} ${cursorStyle}`}
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

        {/* Draw Towers */}
        {towers.map((tower) => {
          const towerDef = gameConfig.towerTypes[tower.type];
          if (!towerDef) return null;
          const levelColor = towerDef.levels[tower.level]?.color || 'gray';
          const isSelectedForMoving = tower.id === selectedTowerForMovingId;

          return (
            <div
              key={tower.id}
              className={cn(
                `absolute rounded-full flex items-center justify-center shadow-lg`,
                isSelectedForMoving ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-background' : 'ring-1 ring-black/20'
              )}
              style={{
                left: tower.x - gameConfig.cellSize / 2,
                top: tower.y - gameConfig.cellSize / 2,
                width: gameConfig.cellSize * 0.8,
                height: gameConfig.cellSize * 0.8,
                backgroundColor: levelColor,
                border: `2px solid ${levelColor.replace('0.8', '1').replace('0.9','1')}`,
                transform: `rotate(${tower.rotation || 0}deg) scale(${isSelectedForMoving ? 1.1 : 1})`,
                transformOrigin: 'center center',
                zIndex: isSelectedForMoving ? 12 : 10,
                cursor: 'pointer',
              }}
              onClick={() => onTowerClick(tower.id)}
              role="button"
              aria-label={`${towerDef.name} level ${tower.level}${isSelectedForMoving ? ', selected for moving' : ''}`}
            >
              <TowerIconDisplay type={tower.type} sizeClass="w-3/5 h-3/5" />
              <span className="absolute -bottom-1 -right-1 text-[10px] bg-black/60 text-white rounded-full px-0.5 leading-tight">
                {tower.level}
              </span>
              {showRangeIndicatorForTower?.id === tower.id && (
                <div
                  className="absolute rounded-full bg-blue-500/15 border border-blue-500/50 pointer-events-none"
                  style={{
                    width: tower.stats.range * 2,
                    height: tower.stats.range * 2,
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 5,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Draw Enemies */}
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
            <div className="absolute -top-1.5 w-full h-1 bg-gray-400/70 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-100"
                style={{ width: `${(enemy.health / enemy.maxHealth) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {/* Draw Projectiles */}
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
         {gameState.selectedTowerType && !selectedTowerForMovingId && placementSpots.some(spot => !spot.isOccupied) && (
          placementSpots.map(spot => {
            if (!spot.isOccupied) {
              const towerDef = gameConfig.towerTypes[gameState.selectedTowerType!];
              if (!towerDef) return null;
              const tempTowerStats = towerDef.levels[1];
              const spotPx = gridToPixel(spot);
              return (
                <div
                  key={`range-indicator-new-${spot.id}`}
                  className="absolute rounded-full bg-blue-500/10 border border-dashed border-blue-500/50 pointer-events-none"
                  style={{
                    width: tempTowerStats.range * 2,
                    height: tempTowerStats.range * 2,
                    left: spotPx.x,
                    top: spotPx.y,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 5,
                  }}
                  aria-hidden="true"
                />
              );
            }
            return null;
          })
        )}
      </div>

      {/* Game Controls - Cannon at Bottom */}
      <div className="bg-stone-800/90 relative py-3 px-2 rounded-b-lg shadow-inner">
        {/* Cannon Base visual fluff */}
        <div className="w-full flex justify-center mb-2">
          <div className="flex items-center">
            <div className="h-10 w-12 bg-stone-700 rounded-l-md flex items-center justify-center border-t border-l border-b border-stone-600 shadow-sm">
                <div className="w-6 h-6 bg-stone-500 rounded-full border-2 border-stone-400"></div>
            </div>
            <div className="h-10 px-4 bg-stone-600 flex items-center justify-center border-t border-b border-stone-500 shadow-inner">
                <span className="text-sm font-bold text-amber-400 tracking-wider">KULELER</span>
            </div>
            <div className="h-10 w-12 bg-stone-700 rounded-r-md flex items-center justify-center border-t border-r border-b border-stone-600 shadow-sm">
                <div className="w-6 h-6 bg-stone-500 rounded-full border-2 border-stone-400"></div>
            </div>
          </div>
        </div>

        {/* Tower Selection */}
        <div className="grid grid-cols-5 gap-2 px-2">
          {(gameState.availableTowerTypes && gameState.availableTowerTypes.length > 0) ? (
            gameState.availableTowerTypes.slice(0, 5).map((towerType: TowerCategory) => {
              const towerInfo = gameConfig.towerTypes[towerType] as TowerDefinition | undefined; // Ensure type
              const isSelected = gameState.selectedTowerType === towerType;
              const canAfford = towerInfo ? gameState.money >= towerInfo.baseCost : false;

              if (!towerInfo) { // Handle case where towerInfo might be undefined if towerType is bad
                return (
                    <div key={towerType} className="flex flex-col items-center justify-center p-1.5 rounded-md aspect-square bg-gray-700/50 text-red-400 text-xs text-center">
                        Hatalı Kule: {towerType.substring(0,10)}
                    </div>
                );
              }

              return (
                <button
                  key={towerType}
                  onClick={() => onSelectTowerType(isSelected ? null : towerType)}
                  disabled={!canAfford && !isSelected}
                  className={cn(
                    "flex flex-col items-center justify-center p-1.5 rounded-md transition-all transform active:scale-95 aspect-square focus:outline-none focus:ring-2 focus:ring-amber-400",
                    isSelected ? "bg-amber-500 text-white ring-2 ring-amber-300 shadow-lg scale-105" :
                      canAfford ? "bg-blue-700/70 hover:bg-blue-600/80 text-blue-100 shadow-md hover:shadow-lg" : "bg-gray-600/50 text-gray-400 opacity-70 cursor-not-allowed",
                  )}
                  title={`${towerInfo.name} - Bedel: ${towerInfo.baseCost}`}
                >
                  <div className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 border-2",
                    isSelected ? "bg-amber-400 border-amber-200" :
                      canAfford ? "bg-blue-500/80 border-blue-400" : "bg-gray-500/50 border-gray-400"
                  )}>
                    <TowerIconDisplay type={towerType} sizeClass="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold">{towerInfo.baseCost}</span>
                </button>
              );
            })
          ) : (
            <p className="col-span-5 text-center text-stone-400 text-sm py-4">Kule Mevcut Değil</p>
          )}
          {/* Fill remaining slots if less than 5 towers are available */}
          {gameState.availableTowerTypes && Array.from({ length: Math.max(0, 5 - gameState.availableTowerTypes.length) }).map((_, index) => (
            <div key={`placeholder-slot-${index}`} className="aspect-square bg-stone-700/50 rounded-md flex items-center justify-center opacity-50 shadow-inner">
              <span className="text-stone-500 text-2xl">-</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImprovedGameBoard;


