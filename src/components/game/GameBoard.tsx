
"use client";

import type React from 'react';
import type { PlacedTower, Enemy, Projectile, PlacementSpot, TowerCategory, GridPosition, PixelPosition } from '@/types/game';
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
  onMoveTowerRequest: (towerId: string, spot: PlacementSpot) => void;
  gridToPixel: (gridPos: GridPosition) => PixelPosition;
  showRangeIndicatorForTower: PlacedTower | null;
}

const TowerIcon: React.FC<{ type: TowerCategory, sizeClass?: string }> = ({ type, sizeClass="w-5 h-5" }) => {
  const IconComponent = gameConfig.towerTypes[type]?.icon;
  if (!IconComponent) { 
    return <div className={`${sizeClass} bg-primary/50 rounded-sm flex items-center justify-center text-xs text-primary-foreground`}>T</div>;
  }
  return <IconComponent className={`${sizeClass} text-primary-foreground`} />;
};

const GameBoard: React.FC<GameBoardProps> = ({
  towers,
  enemies,
  projectiles,
  placementSpots,
  selectedTowerType,
  selectedTowerForMovingId,
  onPlaceTower,
  onTowerClick,
  onMoveTowerRequest,
  gridToPixel,
  showRangeIndicatorForTower,
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
    <div
      className="relative bg-green-100 border-2 border-green-300 shadow-inner overflow-hidden"
      style={{ width: boardWidth, height: boardHeight }}
      aria-label="Game Board"
    >
      {/* Draw Path */}
      {gameConfig.enemyPath.map((segment, index) => {
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
        let spotColor = 'bg-gray-300/50';
        let hoverEffect = '';
        let cursorStyle = 'cursor-default';

        if (spot.isOccupied) {
          spotColor = 'bg-gray-500/50';
          cursorStyle = 'cursor-pointer'; 
        } else if (selectedTowerForMovingId) {
          spotColor = 'bg-green-300/50'; 
          hoverEffect = 'hover:bg-green-400/70';
          cursorStyle = 'cursor-pointer';
        } else if (selectedTowerType) {
          spotColor = 'bg-blue-300/50'; 
          hoverEffect = 'hover:bg-blue-400/70';
          cursorStyle = 'cursor-pointer';
        }
        
        return (
          <div
            key={spot.id}
            className={`absolute border border-dashed border-gray-400 transition-colors ${spotColor} ${hoverEffect} ${cursorStyle}`}
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
        const levelColor = towerDef.levels[tower.level].color || 'gray';
        const isSelectedForMoving = tower.id === selectedTowerForMovingId;
        
        return (
          <div
            key={tower.id}
            className={`absolute rounded-full flex items-center justify-center
                        ${isSelectedForMoving ? 'ring-4 ring-accent ring-offset-2 ring-offset-background' : ''}`}
            style={{
              left: tower.x - gameConfig.cellSize / 2,
              top: tower.y - gameConfig.cellSize / 2,
              width: gameConfig.cellSize * 0.8,
              height: gameConfig.cellSize * 0.8,
              backgroundColor: levelColor,
              border: `3px solid ${levelColor.replace('0.8', '1').replace('0.9','1')}`,
              boxShadow: `0 0 5px rgba(0,0,0,0.5)${isSelectedForMoving ? ', 0 0 15px var(--accent)' : ''}`,
              transform: `rotate(${tower.rotation || 0}deg) scale(${isSelectedForMoving ? 1.1 : 1})`,
              transformOrigin: 'center center',
              zIndex: isSelectedForMoving ? 12 : 10, 
              cursor: 'pointer',
            }}
            onClick={() => onTowerClick(tower.id)}
            role="button"
            aria-label={`${towerDef.name} level ${tower.level}${isSelectedForMoving ? ', selected for moving' : ''}`}
          >
            <TowerIcon type={tower.type} sizeClass="w-4/5 h-4/5" />
            <span className="absolute -bottom-1 -right-1 text-xs bg-black/70 text-white rounded-full px-1 leading-tight">
              {tower.level}
            </span>
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
            backgroundColor: gameConfig.enemyTypes[enemy.type as keyof typeof gameConfig.enemyTypes]?.color || 'purple',
            zIndex: 20,
            // Removed CSS transition for smoother JS-driven animation
          }}
          aria-label={`Enemy ${enemy.type}`}
        >
          <div className="absolute -top-2 w-full h-1 bg-gray-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-100"
              style={{ width: `${(enemy.health / enemy.maxHealth) * 100}%` }}
            />
          </div>
          <span className="text-white text-xs font-bold">E</span> {/* Placeholder, can be icon later */}
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
            // Removed CSS transition
          }}
          aria-hidden="true"
        />
      ))}

       {/* Range indicator for new tower placement */}
       {selectedTowerType && !selectedTowerForMovingId && placementSpots.some(spot => !spot.isOccupied) && (
        placementSpots.map(spot => {
          if (!spot.isOccupied) {
            const towerDef = gameConfig.towerTypes[selectedTowerType];
            if (!towerDef) return null;
            const tempTowerStats = towerDef.levels[1]; 
            const spotPx = gridToPixel(spot);
            return (
              <div
                key={`range-indicator-new-${spot.id}`}
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
