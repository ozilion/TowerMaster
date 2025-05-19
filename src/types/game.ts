
import type { LucideIcon } from 'lucide-react';

export interface GridPosition {
  row: number;
  col: number;
}

export interface PixelPosition {
  x: number;
  y: number;
}

export type TowerCategory = 'simple' | 'fire' | 'ice';

export interface TowerLevelStats {
  level: 1 | 2 | 3;
  damage: number;
  range: number; // in pixels
  fireRate: number; // attacks per second
  cost?: number; // cost for this level if upgrading, or initial cost for level 1
  mergeCost?: number; // cost to merge to this level
  projectileSpeed?: number; // pixels per second
  color: string; // For projectile/visuals
}

export interface TowerDefinition {
  id: TowerCategory;
  name: string;
  icon: LucideIcon;
  baseCost: number;
  levels: {
    1: Omit<TowerLevelStats, 'level' | 'mergeCost'>;
    2: Omit<TowerLevelStats, 'level' | 'cost'>;
    3: Omit<TowerLevelStats, 'level' | 'cost'>;
  };
}

export interface PlacedTower extends PixelPosition {
  id: string; // Unique instance ID
  type: TowerCategory;
  level: 1 | 2 | 3;
  stats: TowerLevelStats; // current effective stats
  targetId?: string; // ID of the current enemy target
  lastShotTime: number; // timestamp of the last shot
  rotation?: number; // degrees, for aiming
}

export interface Enemy extends PixelPosition {
  id: string;
  type: string; // e.g., 'goblin', 'orc'
  health: number;
  maxHealth: number;
  speed: number; // pixels per game tick or second
  pathIndex: number;
  value: number; // money awarded on defeat
  size: number; // visual size
}

export interface Projectile extends PixelPosition {
  id: string;
  towerId: string;
  targetId: string;
  damage: number;
  speed: number;
  color: string;
  targetPosition: PixelPosition; // Last known position of the target
}

export interface Wave {
  waveNumber: number;
  enemies: Array<{ type: string; count: number; spawnDelayMs: number; healthMultiplier: number; speedMultiplier: number }>;
  spawnIntervalMs: number; // Interval between spawning each enemy within the wave
}

export interface GameState {
  playerHealth: number;
  money: number;
  currentWaveNumber: number;
  score: number;
  isGameOver: boolean;
  gameSpeed: number; // e.g., 1x, 2x
  selectedTowerType: TowerCategory | null;
  placementMode: boolean;
  gameStatus: 'initial' | 'waveInProgress' | 'betweenWaves' | 'gameOver';
  waveStartTime: number | null;
  lastTickTime: number;
}

export interface PlacementSpot extends GridPosition {
  id: string; // e.g. "spot-row-col"
  isOccupied: boolean;
}

export interface GameConfig {
  gridRows: number;
  gridCols: number;
  cellSize: number; // in pixels
  enemyPath: GridPosition[];
  placementSpots: PlacementSpot[];
  towerTypes: Record<TowerCategory, TowerDefinition>;
  initialGameState: Omit<GameState, 'selectedTowerType' | 'placementMode' | 'waveStartTime' | 'lastTickTime' | 'gameStatus'>;
  waves: Wave[];
}
