
import type { LucideIcon } from 'lucide-react';

export interface GridPosition {
  row: number;
  col: number;
}

export interface PixelPosition {
  x: number;
  y: number;
}

export type TowerCategory = 'simple' | 'fire' | 'ice' | 'laser' | 'cannon';

export interface TowerLevelStats {
  level: 1 | 2 | 3;
  damage: number;
  range: number; // in pixels
  fireRate: number; // attacks per second
  cost?: number; // cost for this level if upgrading, or initial cost for level 1
  mergeCost?: number; // cost to merge to this level
  projectileSpeed?: number; // pixels per second
  color: string; // For projectile/visuals
  special?: string; // e.g., 'slow', 'aoe'
}

export interface TowerDefinition {
  id: TowerCategory;
  name: string;
  icon?: LucideIcon; // Made icon optional
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

export type EnemyType = 'goblin' | 'orc' | 'troll' | 'boss';

export interface Enemy extends PixelPosition {
  id: string;
  type: EnemyType;
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

export interface SubWaveEnemyConfig {
  type: EnemyType;
  count: number;
  healthMultiplierOverride?: number;
  speedMultiplierOverride?: number;
}

export interface SubWave {
  id: string;
  subWaveInMainIndex: number;
  enemies: SubWaveEnemyConfig[];
  spawnIntervalMs: number;
  postSubWaveDelayMs: number;
}

export interface MainWave {
  mainWaveNumber: number;
  baseHealthMultiplier: number;
  baseSpeedMultiplier: number;
  subWaves: SubWave[];
}

export interface GameState {
  playerHealth: number;
  money: number;
  currentOverallSubWave: number;
  currentMainWaveDisplay: number;
  currentSubWaveInMainDisplay: number;
  score: number;
  isGameOver: boolean;
  gameSpeed: number;
  selectedTowerType: TowerCategory | null;
  placementMode: boolean;
  gameStatus: 'initial' | 'subWaveInProgress' | 'waitingForNextSubWave' | 'betweenMainWaves' | 'gameOver' | 'gameWon';
  unlockableTowerProgression: TowerCategory[];
  availableTowerTypes: TowerCategory[];
}

// This type is for the initialGameState object within GameConfig
export interface InitialGameStateConfig {
  playerHealth: number;
  money: number;
  currentOverallSubWave: number;
  currentMainWaveDisplay: number;
  currentSubWaveInMainDisplay: number;
  score: number;
  isGameOver: boolean;
  gameSpeed: number;
  gameStatus: 'initial'; // Can be more specific if it's always 'initial' here
}

export interface PlacementSpot extends GridPosition {
  id: string;
  isOccupied: boolean;
}

export interface GameConfig {
  gridRows: number;
  gridCols: number;
  cellSize: number;
  enemyPath: GridPosition[];
  placementSpots: PlacementSpot[];
  towerTypes: Record<TowerCategory, TowerDefinition>;
  initialGameState: InitialGameStateConfig; // Use the new type
  mainWaves: MainWave[];
  totalMainWaves: number;
  subWavesPerMain: number;
  allTowerIds: TowerCategory[];
  maxUnlockableTowers: number;
}
