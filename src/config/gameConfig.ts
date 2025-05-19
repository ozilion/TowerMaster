
import type { GameConfig, TowerCategory, EnemyType, MainWave, SubWave, TowerDefinition, PlacementSpot, GridPosition, InitialGameStateConfig } from '@/types/game';
// import { v4 as uuidv4 } from 'uuid'; // Keep commented out for now

const GRID_ROWS = 12;
const GRID_COLS = 20;
const CELL_SIZE = 40; // pixels

const enemyPath: GridPosition[] = [
  { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 },
  { row: 3, col: 4 }, { row: 4, col: 4 }, { row: 5, col: 4 },
  { row: 5, col: 5 }, { row: 5, col: 6 }, { row: 5, col: 7 }, { row: 5, col: 8 },
  { row: 4, col: 8 }, { row: 3, col: 8 }, { row: 2, col: 8 },
  { row: 2, col: 9 }, { row: 2, col: 10 }, { row: 2, col: 11 }, { row: 2, col: 12 },
  { row: 3, col: 12 }, { row: 4, col: 12 }, { row: 5, col: 12 }, { row: 6, col: 12 }, { row: 7, col: 12 },
  { row: 7, col: 13 }, { row: 7, col: 14 }, { row: 7, col: 15 }, { row: 7, col: 16 }, { row: 7, col: 17 }, { row: 7, col: 18 }, { row: 7, col: 19 } // Exit
];

const placementSpots: PlacementSpot[] = [
  { row: 1, col: 1, id: 'spot-1-1', isOccupied: false }, { row: 3, col: 1, id: 'spot-3-1', isOccupied: false },
  { row: 1, col: 3, id: 'spot-1-3', isOccupied: false }, { row: 3, col: 3, id: 'spot-3-3', isOccupied: false },
  { row: 4, col: 3, id: 'spot-4-3', isOccupied: false }, { row: 4, col: 5, id: 'spot-4-5', isOccupied: false },
  { row: 6, col: 5, id: 'spot-6-5', isOccupied: false }, { row: 4, col: 6, id: 'spot-4-6', isOccupied: false },
  { row: 6, col: 7, id: 'spot-6-7', isOccupied: false },
  { row: 1, col: 7, id: 'spot-1-7', isOccupied: false }, { row: 1, col: 9, id: 'spot-1-9', isOccupied: false },
  { row: 1, col: 11, id: 'spot-1-11', isOccupied: false }, { row: 3, col: 11, id: 'spot-3-11', isOccupied: false },
  { row: 4, col: 11, id: 'spot-4-11', isOccupied: false }, { row: 6, col: 11, id: 'spot-6-11', isOccupied: false },
  { row: 4, col: 13, id: 'spot-4-13', isOccupied: false }, { row: 6, col: 13, id: 'spot-6-13', isOccupied: false },
  { row: 8, col: 14, id: 'spot-8-14', isOccupied: false }, { row: 6, col: 14, id: 'spot-6-14', isOccupied: false },
  { row: 8, col: 16, id: 'spot-8-16', isOccupied: false }, { row: 6, col: 16, id: 'spot-6-16', isOccupied: false },
  { row: 8, col: 18, id: 'spot-8-18', isOccupied: false }, { row: 6, col: 18, id: 'spot-6-18', isOccupied: false },
];

// Extremely simplified TOWER_TYPES for diagnosing chunk loading errors
export const TOWER_TYPES: Record<TowerCategory, TowerDefinition> = {
  simple: {
    id: 'simple', 
    name: 'Basit Kule', 
    // icon: Target, // Lucide icons removed for diagnostics
    baseCost: 50,
    levels: {
      1: { damage: 10, range: CELL_SIZE * 2.5, fireRate: 1, projectileSpeed: 300, color: 'rgba(100, 100, 255, 0.8)' },
      2: { damage: 20, range: CELL_SIZE * 2.7, fireRate: 1.2, mergeCost: 75, projectileSpeed: 320, color: 'rgba(80, 80, 230, 0.9)' },
      3: { damage: 35, range: CELL_SIZE * 3, fireRate: 1.5, mergeCost: 125, projectileSpeed: 350, color: 'rgba(60, 60, 200, 1)' },
    },
  }
  // Other tower types (fire, ice, laser, cannon) are intentionally removed for this diagnostic step.
};

export const ALL_TOWER_IDS: TowerCategory[] = ['simple']; // Only 'simple' tower for diagnostics

export const ENEMY_TYPES: Record<EnemyType, { baseHealth: number; baseSpeed: number; value: number; size: number; color: string }> = {
  goblin: { baseHealth: 30, baseSpeed: CELL_SIZE / 2.5, value: 2, size: CELL_SIZE * 0.6, color: 'green' },
  orc: { baseHealth: 100, baseSpeed: CELL_SIZE / 3.5, value: 5, size: CELL_SIZE * 0.8, color: 'darkred' },
  troll: { baseHealth: 250, baseSpeed: CELL_SIZE / 4.5, value: 10, size: CELL_SIZE * 1.0, color: 'saddlebrown'},
  boss: { baseHealth: 2000, baseSpeed: CELL_SIZE / 5, value: 100, size: CELL_SIZE * 1.5, color: 'purple' },
};

const TOTAL_MAIN_WAVES = 1; // Drastically reduced for diagnostics
const SUB_WAVES_PER_MAIN = 1; // Drastically reduced for diagnostics

// Using static waves for diagnostics, ensuring it's extremely simple
const staticMainWaves: MainWave[] = [
  {
    mainWaveNumber: 1,
    baseHealthMultiplier: 1,
    baseSpeedMultiplier: 1,
    subWaves: [
      {
        id: 'main1-sub1-static', // Ensure IDs are simple strings
        subWaveInMainIndex: 0,
        enemies: [{ type: 'goblin', count: 3 }], // Only goblins for simplicity
        spawnIntervalMs: 1000,
        postSubWaveDelayMs: 2000,
      },
    ],
  },
];

// const generateWaves = (totalMainWaves: number, subWavesPerMainNum: number): MainWave[] => {
//   // ... (generateWaves function commented out as it's not used with staticMainWaves and was a suspect)
//   // For diagnostics, we are using staticMainWaves.
//   return []; // Or throw error if called, to ensure it's not being used.
// }


const initialGameStateConfig: InitialGameStateConfig = {
    playerHealth: 20,
    money: 200,
    currentOverallSubWave: 0,
    currentMainWaveDisplay: 1, // Start at wave 1
    currentSubWaveInMainDisplay: 0, // 0 means wave not started yet
    score: 0,
    isGameOver: false,
    gameSpeed: 1,
    gameStatus: 'initial' as const, // Ensure 'as const' for strict typing
    // availableTowerTypes and unlockableTowerProgression will be initialized client-side
};

const gameConfig: GameConfig = {
  gridRows: GRID_ROWS,
  gridCols: GRID_COLS,
  cellSize: CELL_SIZE,
  enemyPath,
  placementSpots,
  towerTypes: TOWER_TYPES,
  initialGameState: initialGameStateConfig, // Use the refined type
  mainWaves: staticMainWaves, // Using static waves for diagnostics
  totalMainWaves: TOTAL_MAIN_WAVES,
  subWavesPerMain: SUB_WAVES_PER_MAIN,
  allTowerIds: ALL_TOWER_IDS,
  maxUnlockableTowers: 1, // Simplified for diagnostics
};

export default gameConfig;

    