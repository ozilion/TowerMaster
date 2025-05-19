
import type { LucideIcon } from 'lucide-react';

export interface GridPosition {
  row: number;
  col: number;
}

export interface PixelPosition {
  x: number;
  y: number;
}

export type TowerCategory = 'simple' | 'fire' | 'ice' | 'laser' | 'cannon' | 'boss';

export interface TowerLevelStats {
  level: 1 | 2 | 3;
  damage: number;
  range: number; // in pixels
  fireRate: number; // attacks per second
  cost?: number; 
  mergeCost?: number; 
  projectileSpeed?: number; // pixels per second
  color: string; 
  special?: string; 
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
  speed: number; 
  pathIndex: number;
  value: number; 
  size: number; 
}

export interface Projectile extends PixelPosition {
  id: string;
  towerId: string;
  targetId: string;
  damage: number;
  speed: number;
  color: string;
  targetPosition: PixelPosition; 
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
  waveStartTime: number; 
}

export interface InitialGameStateConfig {
  playerHealth: number;
  money: number;
  score: number;
  gameSpeed: number;
  gameStatus: 'initial'; // Keep this fixed for initial config
  // These will be initialized by the hook on client-side or have specific starting values
  currentOverallSubWave: number;
  currentMainWaveDisplay: number;
  currentSubWaveInMainDisplay: number;
  selectedTowerType: null;
  placementMode: boolean;
  isGameOver: boolean;
  waveStartTime: number;
  unlockableTowerProgression: TowerCategory[]; // Empty, will be set by useGameLogic
  availableTowerTypes: TowerCategory[];      // Empty or ['simple'], will be set by useGameLogic
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
  maxUnlockableTowers: number; 
}
