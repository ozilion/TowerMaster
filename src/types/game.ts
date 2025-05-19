
import type { LucideIcon } from 'lucide-react';

export interface GridPosition {
  row: number;
  col: number;
}

export interface PixelPosition {
  x: number;
  y: number;
}

export type TowerCategory = 'simple' | 'fire' | 'ice' | 'laser' | 'cannon' | 'boss'; // Added boss as a potential tower type for flexibility, though not used as such yet.

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
  icon: LucideIcon; // Icon is now mandatory
  baseCost: number;
  levels: {
    1: Omit<TowerLevelStats, 'level' | 'mergeCost'>;
    2: Omit<TowerLevelStats, 'level' | 'cost'>;
    3: Omit<TowerLevelStats, 'level' | 'cost'>;
  };
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
  subWaveInMainIndex: number; // 1-indexed for display
  enemies: SubWaveEnemyConfig[];
  spawnIntervalMs: number; // Time between individual enemy spawns in this sub-wave
  postSubWaveDelayMs: number; // Delay AFTER this sub-wave completes, before next auto starts
}

export interface MainWave {
  mainWaveNumber: number; // 1-indexed
  baseHealthMultiplier: number;
  baseSpeedMultiplier: number;
  subWaves: SubWave[]; // Array of sub-waves
}
export interface GameState {
  playerHealth: number;
  money: number;
  currentOverallSubWave: number; // Overall sub-wave counter (1 to TOTAL_SUB_WAVES)
  currentMainWaveDisplay: number; // Current main wave number for display (1-indexed)
  currentSubWaveInMainDisplay: number; // Current sub-wave within the main wave for display (1-indexed)
  score: number;
  isGameOver: boolean;
  gameSpeed: number;
  selectedTowerType: TowerCategory | null;
  placementMode: boolean; // To indicate if player is in tower placement mode
  gameStatus: 'initial' | 'subWaveInProgress' | 'waitingForNextSubWave' | 'betweenMainWaves' | 'gameOver' | 'gameWon';
  unlockableTowerProgression: TowerCategory[]; // The sequence of towers that can be unlocked
  availableTowerTypes: TowerCategory[]; // Towers currently available to the player
  waveStartTime: number; // Timestamp when the current sub-wave's enemy spawning started
}

export interface InitialGameStateConfig {
  playerHealth: number;
  money: number;
  score: number;
  gameSpeed: number;
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
  enemyTypes: Record<EnemyType, { baseHealth: number; baseSpeed: number; baseValue: number; color: string; size: number; }>;
  initialGameState: InitialGameStateConfig;
  mainWaves: MainWave[];
  totalMainWaves: number;
  subWavesPerMain: number;
  allTowerIds: TowerCategory[];
  maxUnlockableTowers: number; // Max number of tower types a player can unlock in a game
}
