
"use client";

import type React from 'react';
import type { PlacedTower, Enemy, Projectile, PlacementSpot, TowerCategory, GridPosition, PixelPosition } from '@/types/game';
import gameConfig, { ENEMY_TYPES } from '@/config/gameConfig'; // Added ENEMY_TYPES import
import { Target, Flame, Snowflake, Shield } from 'lucide-react'; // Shield for Simple Tower

interface GameBoardProps {
  towers: PlacedTower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  placementSpots: PlacementSpot[];
  selectedTowerType: TowerCategory | null;
  onPlaceTower: (spot: PlacementSpot, towerType: TowerCategory) => void;
  onTowerClick: (towerId: string) => void; // For selecting a tower to merge/upgrade
  gridToPixel: (gridPos: GridPosition) => PixelPosition;
  showRangeIndicatorForTower: PlacedTower | null; // Tower whose range to show
}

const TowerIcon: React.FC<{ type: TowerCategory, sizeClass?: string }> = ({ type, sizeClass="w-5 h-5" }) => {
  const Icon = gameConfig.towerTypes[type].icon;
  return <Icon className={`${sizeClass} text-primary-foreground`} />;
};

const GameBoard: React.FC<GameBoardProps> = ({
  towers,
  enemies,
  projectiles,
  placementSpots,
  selectedTowerType,
  onPlaceTower,
  onTowerClick,
  gridToPixel,
  showRangeIndicatorForTower,
}) => {
  const boardWidth = gameConfig.gridCols * gameConfig.cellSize;
  const boardHeight = gameConfig.gridRows * gameConfig.cellSize;

  const handleSpotClick = (spot: PlacementSpot) => {
    if (selectedTowerType && !spot.isOccupied) {
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
    <div
      className="relative bg-green-100 border-2 border-green-300 shadow-inner overflow-hidden"
      style={{ width: boardWidth, height: boardHeight }}
      aria-label="Game Board"
    >
      {/* Draw Path */}
      {gameConfig.enemyPath.map((segment, index) => {
        const pos = gridToPixel(segment);
        return (
          <div
            key={`path-${index}`}
            className="absolute bg-yellow-600/30 border border-yellow-700/50"
            style={{
              left: segment.col * gameConfig.cellSize,
              top: segment.row * gameConfig.cellSize,
              width: gameConfig.cellSize,
              height: gameConfig.cellSize,
            }}
          />
        );
      })}

      {/* Draw Placement Spots */}
      {placementSpots.map((spot) => {
        const spotColor = spot.isOccupied ? 'bg-gray-500/50' : (selectedTowerType ? 'bg-blue-300/50 hover:bg-blue-400/70 cursor-pointer' : 'bg-gray-300/50');
        return (
          <div
            key={spot.id}
            className={`absolute border border-dashed border-gray-400 transition-colors ${spotColor}`}
            style={{
              left: spot.col * gameConfig.cellSize,
              top: spot.row * gameConfig.cellSize,
              width: gameConfig.cellSize,
              height: gameConfig.cellSize,
            }}
            onClick={() => handleSpotClick(spot)}
            role="button"
            aria-label={`Placement spot ${spot.row}, ${spot.col}`}
          />
        );
      })}
      
      {/* Draw Towers */}
      {towers.map((tower) => {
        const towerDef = gameConfig.towerTypes[tower.type];
        const levelColor = towerDef.levels[tower.level].color || 'gray';
        return (
          <div
            key={tower.id}
            className="absolute rounded-full flex items-center justify-center"
            style={{
              left: tower.x - gameConfig.cellSize / 2,
              top: tower.y - gameConfig.cellSize / 2,
              width: gameConfig.cellSize * 0.8,
              height: gameConfig.cellSize * 0.8,
              backgroundColor: levelColor,
              border: `3px solid ${levelColor.replace('0.8', '1').replace('0.9','1')}`,
              boxShadow: '0 0 5px rgba(0,0,0,0.5)',
              transform: `rotate(${tower.rotation || 0}deg)`,
              transformOrigin: 'center center',
              zIndex: 10,
            }}
            onClick={() => onTowerClick(tower.id)}
            role="button"
            aria-label={`${towerDef.name} level ${tower.level}`}
          >
            <TowerIcon type={tower.type} sizeClass="w-4/5 h-4/5" />
            <span className="absolute -bottom-1 -right-1 text-xs bg-black/70 text-white rounded-full px-1 leading-tight">
              {tower.level}
            </span>
             {/* Range indicator for THIS tower when it's the selected one for range display */}
            {showRangeIndicatorForTower?.id === tower.id && (
              <div
                className="absolute rounded-full bg-blue-500/20 border border-blue-500 pointer-events-none"
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
            backgroundColor: ENEMY_TYPES[enemy.type as keyof typeof ENEMY_TYPES]?.color || 'purple',
            zIndex: 20,
            transition: 'left 0.1s linear, top 0.1s linear', // Smooth movement
          }}
          aria-label={`Enemy ${enemy.type}`}
        >
          {/* Health Bar */}
          <div className="absolute -top-2 w-full h-1 bg-gray-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-100"
              style={{ width: `${(enemy.health / enemy.maxHealth) * 100}%` }}
            />
          </div>
          <span className="text-white text-xs font-bold">E</span>
        </div>
      ))}

      {/* Draw Projectiles */}
      {projectiles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x - 3, // 3 is half of projectile size 6
            top: p.y - 3,
            width: 6,
            height: 6,
            backgroundColor: p.color,
            zIndex: 15,
            transition: 'left 0.05s linear, top 0.05s linear',
          }}
          aria-hidden="true" // Decorative
        />
      ))}

       {/* Range indicator for tower placement */}
       {selectedTowerType && placementSpots.some(spot => !spot.isOccupied) && (
        placementSpots.map(spot => {
          if (!spot.isOccupied) {
            const tempTowerStats = gameConfig.towerTypes[selectedTowerType].levels[1]; // Show range for level 1
            const spotPx = gridToPixel(spot);
            return (
              <div
                key={`range-indicator-${spot.id}`}
                className="absolute rounded-full bg-blue-500/10 border border-dashed border-blue-500 pointer-events-none"
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
  );
};

export default GameBoard;

