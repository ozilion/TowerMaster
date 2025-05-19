
import type { LucideIcon } from 'lucide-react';

export interface GridPosition {
  row: number;
  col: number;
}

export interface PixelPosition {
  x: number;
  y: number;
}

export type TowerCategory = 'simple' | 'fire' | 'ice' | 'laser' | 'cannon'; // Added more tower types for future flexibility

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

export type EnemyType = 'goblin' | 'orc' | 'troll' | 'boss'; // Added troll and boss

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
  healthMultiplierOverride?: number; // Optional: to override main wave's multiplier for this specific group in subwave
  speedMultiplierOverride?: number;  // Optional
}

export interface SubWave {
  id: string; // e.g., "main1-sub1"
  subWaveInMainIndex: number; // 1-10
  enemies: SubWaveEnemyConfig[];
  spawnIntervalMs: number; // Interval between spawning each enemy *group* within the sub-wave
  postSubWaveDelayMs: number; // Delay *after* this sub-wave completes before the next one starts automatically
}

export interface MainWave {
  mainWaveNumber: number; // 1-50
  baseHealthMultiplier: number;
  baseSpeedMultiplier: number;
  subWaves: SubWave[];
}


export interface GameState {
  playerHealth: number;
  money: number;
  currentOverallSubWave: number; // Overall progress, 1 to (totalMainWaves * subWavesPerMain)
  currentMainWaveDisplay: number; // For UI: 1 to totalMainWaves
  currentSubWaveInMainDisplay: number; // For UI: 1 to subWavesPerMain (or 0 if between main waves)
  score: number;
  isGameOver: boolean;
  gameSpeed: number; // e.g., 1x, 2x
  selectedTowerType: TowerCategory | null;
  placementMode: boolean;
  gameStatus: 'initial' | 'subWaveInProgress' | 'waitingForNextSubWave' | 'betweenMainWaves' | 'gameOver' | 'gameWon';
  waveStartTime: number | null; // Timestamp when the current sub-wave (or group of enemies) started spawning
  availableTowerTypes: TowerCategory[];
  unlockableTowerProgression: TowerCategory[]; // The sequence of towers to be unlocked
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
  initialGameState: Omit<GameState, 'selectedTowerType' | 'placementMode' | 'waveStartTime' | 'unlockableTowerProgression'>;
  mainWaves: MainWave[];
  totalMainWaves: number;
  subWavesPerMain: number;
  allTowerIds: TowerCategory[]; // All defined tower IDs for unlock progression
  maxUnlockableTowers: number;
}
