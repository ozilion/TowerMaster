
import type { GameConfig, TowerCategory, EnemyType, MainWave, SubWave, SubWaveEnemyConfig, TowerDefinition } from '@/types/game';
import { Shield, Flame, Snowflake, Zap, Target as CannonIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const GRID_ROWS = 12;
const GRID_COLS = 20;
const CELL_SIZE = 40; // pixels

const enemyPath = [
  { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 },
  { row: 3, col: 4 }, { row: 4, col: 4 }, { row: 5, col: 4 },
  { row: 5, col: 5 }, { row: 5, col: 6 }, { row: 5, col: 7 }, { row: 5, col: 8 },
  { row: 4, col: 8 }, { row: 3, col: 8 }, { row: 2, col: 8 },
  { row: 2, col: 9 }, { row: 2, col: 10 }, { row: 2, col: 11 }, { row: 2, col: 12 },
  { row: 3, col: 12 }, { row: 4, col: 12 }, { row: 5, col: 12 }, { row: 6, col: 12 }, { row: 7, col: 12 },
  { row: 7, col: 13 }, { row: 7, col: 14 }, { row: 7, col: 15 }, { row: 7, col: 16 }, { row: 7, col: 17 }, { row: 7, col: 18 }, { row: 7, col: 19 } // Exit
];

const placementSpots = [
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


export const TOWER_TYPES: Record<TowerCategory, TowerDefinition> = {
  simple: {
    id: 'simple', name: 'Basit Kule', icon: Shield, baseCost: 50,
    levels: {
      1: { damage: 10, range: CELL_SIZE * 2.5, fireRate: 1, projectileSpeed: 300, color: 'rgba(100, 100, 255, 0.8)' },
      2: { damage: 20, range: CELL_SIZE * 2.7, fireRate: 1.2, mergeCost: 75, projectileSpeed: 320, color: 'rgba(80, 80, 230, 0.9)' },
      3: { damage: 35, range: CELL_SIZE * 3, fireRate: 1.5, mergeCost: 125, projectileSpeed: 350, color: 'rgba(60, 60, 200, 1)' },
    },
  },
  fire: {
    id: 'fire', name: 'Ateş Kulesi', icon: Flame, baseCost: 75,
    levels: {
      1: { damage: 15, range: CELL_SIZE * 1.8, fireRate: 2, projectileSpeed: 400, color: 'rgba(255, 100, 100, 0.8)' },
      2: { damage: 30, range: CELL_SIZE * 2, fireRate: 2.5, mergeCost: 100, projectileSpeed: 420, color: 'rgba(230, 80, 80, 0.9)' },
      3: { damage: 50, range: CELL_SIZE * 2.2, fireRate: 3, mergeCost: 150, projectileSpeed: 450, color: 'rgba(200, 60, 60, 1)' },
    },
  },
  ice: {
    id: 'ice', name: 'Buz Kulesi', icon: Snowflake, baseCost: 100,
    levels: {
      1: { damage: 8, range: CELL_SIZE * 3.5, fireRate: 0.7, projectileSpeed: 250, color: 'rgba(100, 200, 255, 0.8)', special: 'slow' },
      2: { damage: 15, range: CELL_SIZE * 3.8, fireRate: 0.8, mergeCost: 125, projectileSpeed: 270, color: 'rgba(80, 180, 230, 0.9)', special: 'slow' },
      3: { damage: 25, range: CELL_SIZE * 4.2, fireRate: 1, mergeCost: 175, projectileSpeed: 300, color: 'rgba(60, 160, 200, 1)', special: 'slow' },
    },
  },
  laser: {
    id: 'laser', name: 'Lazer Kulesi', icon: Zap, baseCost: 120,
    levels: {
      1: { damage: 5, range: CELL_SIZE * 3, fireRate: 5, projectileSpeed: 1000, color: 'rgba(255, 255, 0, 0.8)' },
      2: { damage: 10, range: CELL_SIZE * 3.2, fireRate: 6, mergeCost: 150, projectileSpeed: 1000, color: 'rgba(230, 230, 0, 0.9)' },
      3: { damage: 18, range: CELL_SIZE * 3.5, fireRate: 7, mergeCost: 200, projectileSpeed: 1000, color: 'rgba(200, 200, 0, 1)' },
    }
  },
  cannon: {
    id: 'cannon', name: 'Top Kulesi', icon: CannonIcon, baseCost: 150,
    levels: {
      1: { damage: 30, range: CELL_SIZE * 2.5, fireRate: 0.5, projectileSpeed: 200, color: 'rgba(50, 50, 50, 0.8)', special: 'aoe' },
      2: { damage: 50, range: CELL_SIZE * 2.8, fireRate: 0.6, mergeCost: 180, projectileSpeed: 220, color: 'rgba(40, 40, 40, 0.9)', special: 'aoe' },
      3: { damage: 80, range: CELL_SIZE * 3.1, fireRate: 0.7, mergeCost: 250, projectileSpeed: 240, color: 'rgba(30, 30, 30, 1)', special: 'aoe' },
    }
  }
};

export const ALL_TOWER_IDS = Object.keys(TOWER_TYPES) as TowerCategory[];

export const ENEMY_TYPES: Record<EnemyType, { baseHealth: number; baseSpeed: number; value: number; size: number; color: string }> = {
  goblin: { baseHealth: 30, baseSpeed: CELL_SIZE / 2.5, value: 2, size: CELL_SIZE * 0.6, color: 'green' },
  orc: { baseHealth: 100, baseSpeed: CELL_SIZE / 3.5, value: 5, size: CELL_SIZE * 0.8, color: 'darkred' },
  troll: { baseHealth: 250, baseSpeed: CELL_SIZE / 4.5, value: 10, size: CELL_SIZE * 1.0, color: 'saddlebrown'},
  boss: { baseHealth: 2000, baseSpeed: CELL_SIZE / 5, value: 100, size: CELL_SIZE * 1.5, color: 'purple' },
};

const TOTAL_MAIN_WAVES = 50;
const SUB_WAVES_PER_MAIN = 10;

function generateWaves(): MainWave[] {
  const mainWaves: MainWave[] = [];
  const enemyTypesCycle: EnemyType[] = ['goblin', 'orc', 'troll'];

  for (let i = 1; i <= TOTAL_MAIN_WAVES; i++) {
    const mainWave: MainWave = {
      mainWaveNumber: i,
      baseHealthMultiplier: 1 + (i - 1) * 0.12, 
      baseSpeedMultiplier: 1 + (i - 1) * 0.025, 
      subWaves: [],
    };

    for (let j = 1; j <= SUB_WAVES_PER_MAIN; j++) {
      const subWaveEnemies: SubWaveEnemyConfig[] = [];
      let enemyTypeForSubWave = enemyTypesCycle[(i + j - 2 + Math.floor(i/5)) % enemyTypesCycle.length]; 
      let enemyCount = Math.floor(3 + i * 0.3 + j * 0.15); 

      if (j === SUB_WAVES_PER_MAIN && i % 10 === 0) { 
        subWaveEnemies.push({ type: 'boss', count: 1 + Math.floor((i-10)/20) });
        if (i > 10) { 
            const escortType = enemyTypesCycle[i % enemyTypesCycle.length];
            subWaveEnemies.push({ type: escortType, count: Math.floor(enemyCount / 2) });
        }
      } else {
        subWaveEnemies.push({ type: enemyTypeForSubWave, count: Math.max(1, enemyCount) });
        if (i > 3 && (j % 4 === 0 || i > 15)) {
          const secondaryEnemyType = enemyTypesCycle[(i + j) % enemyTypesCycle.length];
          if (secondaryEnemyType !== enemyTypeForSubWave) {
            subWaveEnemies.push({ type: secondaryEnemyType, count: Math.max(1, Math.floor(enemyCount / 3)) });
          }
        }
        if (i > 25 && j % 5 === 0) {
            const tertiaryEnemyType = enemyTypesCycle[(i + j + 1) % enemyTypesCycle.length];
            if (tertiaryEnemyType !== enemyTypeForSubWave && !subWaveEnemies.find(e => e.type === tertiaryEnemyType)) {
                 subWaveEnemies.push({ type: tertiaryEnemyType, count: Math.max(1, Math.floor(enemyCount / 4)) });
            }
        }
      }
      
      const subWave: SubWave = {
        id: `main${i}-sub${j}`,
        subWaveInMainIndex: j,
        enemies: subWaveEnemies.filter(group => group.count > 0),
        spawnIntervalMs: Math.max(250, 1200 - i * 15 - j * 5),
        postSubWaveDelayMs: (j === SUB_WAVES_PER_MAIN) ? 0 : Math.max(1500, 3000 - i * 20), // Increased postSubWaveDelayMs slightly for very late waves
      };
      if (subWave.enemies.length > 0) {
        mainWave.subWaves.push(subWave);
      }
    }
    if (mainWave.subWaves.length > 0) {
        mainWaves.push(mainWave);
    }
  }
  return mainWaves;
}


const gameConfig: GameConfig = {
  gridRows: GRID_ROWS,
  gridCols: GRID_COLS,
  cellSize: CELL_SIZE,
  enemyPath,
  placementSpots,
  towerTypes: TOWER_TYPES,
  initialGameState: {
    playerHealth: 20,
    money: 200,
    currentOverallSubWave: 0,
    currentMainWaveDisplay: 1,
    currentSubWaveInMainDisplay: 0,
    score: 0,
    isGameOver: false,
    gameSpeed: 1,
    gameStatus: 'initial',
    waveStartTime: null,
    unlockableTowerProgression: [], // Set by client-side useEffect in useGameLogic
    availableTowerTypes: ['simple'], // Start with 'simple' tower available for immediate render
  },
  mainWaves: generateWaves(),
  totalMainWaves: TOTAL_MAIN_WAVES,
  subWavesPerMain: SUB_WAVES_PER_MAIN,
  allTowerIds: ALL_TOWER_IDS,
  maxUnlockableTowers: 4,
};

export default gameConfig;
