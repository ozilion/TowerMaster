
import type { GameConfig, TowerCategory, MainWave, SubWave, EnemyType, TowerDefinition, InitialGameStateConfig } from '@/types/game';
import { Target, Flame, Snowflake, Shield, Zap, Gem } from 'lucide-react'; // Shield for cannon, Zap for laser, Gem for boss (unused tower)

const GRID_ROWS = 10;
const GRID_COLS = 15;
const CELL_SIZE = 40; // pixels

const ENEMY_PATH: { row: number; col: number }[] = [
  { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
  { row: 3, col: 3 }, { row: 4, col: 3 }, { row: 5, col: 3 },
  { row: 5, col: 4 }, { row: 5, col: 5 }, { row: 5, col: 6 }, { row: 5, col: 7 },
  { row: 4, col: 7 }, { row: 3, col: 7 },
  { row: 3, col: 8 }, { row: 3, col: 9 }, { row: 3, col: 10 }, { row: 3, col: 11 },
  { row: 4, col: 11 }, { row: 5, col: 11 }, { row: 6, col: 11 }, { row: 7, col: 11 },
  { row: 7, col: 12 }, { row: 7, col: 13 }, { row: 7, col: 14 },
];

const PLACEMENT_SPOTS: { id: string, row: number; col: number; isOccupied: boolean }[] = [
  { id: 'ps-1', row: 1, col: 2, isOccupied: false }, { id: 'ps-2', row: 3, col: 2, isOccupied: false },
  { id: 'ps-3', row: 4, col: 4, isOccupied: false }, { id: 'ps-4', row: 6, col: 4, isOccupied: false },
  { id: 'ps-5', row: 4, col: 6, isOccupied: false }, { id: 'ps-6', row: 6, col: 6, isOccupied: false },
  { id: 'ps-7', row: 2, col: 8, isOccupied: false }, { id: 'ps-8', row: 4, col: 8, isOccupied: false },
  { id: 'ps-9', row: 2, col: 10, isOccupied: false }, { id: 'ps-10', row: 4, col: 10, isOccupied: false },
  { id: 'ps-11', row: 6, col: 10, isOccupied: false }, { id: 'ps-12', row: 8, col: 10, isOccupied: false },
  { id: 'ps-13', row: 6, col: 12, isOccupied: false }, { id: 'ps-14', row: 8, col: 12, isOccupied: false },
];

export const TOWER_TYPES: Record<TowerCategory, TowerDefinition> = {
  simple: {
    id: 'simple', name: 'Basit Kule', icon: Target, baseCost: 50,
    levels: {
      1: { damage: 10, range: 100, fireRate: 1, projectileSpeed: 300, color: 'rgba(100,100,100,0.9)' },
      2: { damage: 20, range: 110, fireRate: 1.2, mergeCost: 75, projectileSpeed: 320, color: 'rgba(120,120,120,0.9)', special: 'Hafif Zırh Delme' },
      3: { damage: 35, range: 120, fireRate: 1.5, mergeCost: 150, projectileSpeed: 350, color: 'rgba(150,150,150,0.9)', special: 'Orta Zırh Delme' },
    }
  },
  fire: {
    id: 'fire', name: 'Ateş Kulesi', icon: Flame, baseCost: 75,
    levels: {
      1: { damage: 15, range: 80, fireRate: 1.5, projectileSpeed: 250, color: 'rgba(255,100,0,0.9)' },
      2: { damage: 30, range: 90, fireRate: 1.8, mergeCost: 100, projectileSpeed: 270, color: 'rgba(255,120,0,0.9)', special: 'Alan Hasarı (Küçük)' },
      3: { damage: 50, range: 100, fireRate: 2.2, mergeCost: 200, projectileSpeed: 300, color: 'rgba(255,150,0,0.9)', special: 'Alan Hasarı (Orta)' },
    }
  },
  ice: {
    id: 'ice', name: 'Buz Kulesi', icon: Snowflake, baseCost: 100,
    levels: {
      1: { damage: 5, range: 120, fireRate: 0.8, projectileSpeed: 350, color: 'rgba(0,150,255,0.8)', special: 'Yavaşlatma %10' },
      2: { damage: 10, range: 130, fireRate: 1, mergeCost: 125, projectileSpeed: 370, color: 'rgba(50,170,255,0.8)', special: 'Yavaşlatma %20' },
      3: { damage: 18, range: 140, fireRate: 1.2, mergeCost: 250, projectileSpeed: 400, color: 'rgba(100,190,255,0.8)', special: 'Yavaşlatma %30' },
    }
  },
  laser: {
    id: 'laser', name: 'Lazer Kulesi', icon: Zap, baseCost: 150,
    levels: {
        1: { damage: 25, range: 150, fireRate: 0.5, color: 'rgba(255,0,255,0.7)', projectileSpeed: 1000 /* anlık gibi */, special: 'Zırh İgnoru' },
        2: { damage: 50, range: 160, fireRate: 0.6, mergeCost: 200, color: 'rgba(255,50,255,0.7)', projectileSpeed: 1000, special: 'Zırh İgnoru+' },
        3: { damage: 90, range: 170, fireRate: 0.7, mergeCost: 350, color: 'rgba(255,100,255,0.7)', projectileSpeed: 1000, special: 'Zırh İgnoru++' },
    }
  },
  cannon: {
      id: 'cannon', name: 'Top Kulesi', icon: Shield, baseCost: 120, // Shield used as placeholder
      levels: {
          1: { damage: 30, range: 90, fireRate: 0.4, color: 'rgba(50,50,50,0.9)', projectileSpeed: 150, special: 'Alan Etkili Patlama (Sıçrama)' },
          2: { damage: 60, range: 100, fireRate: 0.5, mergeCost: 180, color: 'rgba(70,70,70,0.9)', projectileSpeed: 160, special: 'Geniş Alan Etkili Patlama' },
          3: { damage: 110, range: 110, fireRate: 0.6, mergeCost: 300, color: 'rgba(90,90,90,0.9)', projectileSpeed: 170, special: 'Çok Geniş Alan Etkili Patlama' },
      }
  },
  // 'boss' tower type is not meant to be placeable by player, but defined for completeness if ever needed
  boss: {
    id: 'boss', name: 'Boss Kulesi (Kullanılmaz)', icon: Gem, baseCost: 9999,
    levels: {
        1: { damage: 0, range: 0, fireRate: 0, color: 'transparent' },
        2: { damage: 0, range: 0, fireRate: 0, mergeCost:0, color: 'transparent' },
        3: { damage: 0, range: 0, fireRate: 0, mergeCost:0, color: 'transparent' },
    }
  }
};

export const ALL_TOWER_IDS: TowerCategory[] = ['simple', 'fire', 'ice', 'laser', 'cannon'];
export const MAX_UNLOCKABLE_TOWERS = 4;


export const ENEMY_TYPES: Record<EnemyType, { baseHealth: number; baseSpeed: number; baseValue: number; color: string; size: number }> = {
  goblin: { baseHealth: 50, baseSpeed: 50, baseValue: 5, color: 'rgba(0,128,0,0.8)', size: CELL_SIZE * 0.4 },
  orc: { baseHealth: 120, baseSpeed: 40, baseValue: 10, color: 'rgba(128,128,0,0.8)', size: CELL_SIZE * 0.5 },
  troll: { baseHealth: 300, baseSpeed: 30, baseValue: 20, color: 'rgba(128,0,128,0.8)', size: CELL_SIZE * 0.6 },
  boss: { baseHealth: 2000, baseSpeed: 25, baseValue: 100, color: 'rgba(255,0,0,0.9)', size: CELL_SIZE * 0.8 },
};

const initialGameStateConfig: InitialGameStateConfig = {
  playerHealth: 100,
  money: 200, // Start with enough for a couple of towers
  score: 0,
  gameSpeed: 1,
};

const TOTAL_MAIN_WAVES = 50;
const SUB_WAVES_PER_MAIN = 10;

const generateWaves = (totalMainWaves: number, subWavesPerMain: number): MainWave[] => {
  const mainWaves: MainWave[] = [];
  let overallSubWaveCounter = 0;

  for (let i = 1; i <= totalMainWaves; i++) {
    const subWaves: SubWave[] = [];
    const baseHealthMultiplier = 1 + (i - 1) * 0.25; // Increase health by 25% each main wave
    const baseSpeedMultiplier = 1 + (i - 1) * 0.05;  // Increase speed by 5% each main wave

    for (let j = 1; j <= subWavesPerMain; j++) {
      overallSubWaveCounter++;
      const enemies: SubWaveEnemyConfig[] = [];
      let enemyCount = Math.floor(3 + (i-1) * 0.5 + (j-1) * 0.2); // Gradually increase enemy count
      enemyCount = Math.max(3, Math.min(enemyCount, 15)); // Clamp enemy count

      const enemyTypesThisWave: EnemyType[] = ['goblin'];
      if (i > 2 && j > 3) enemyTypesThisWave.push('orc');
      if (i > 5 && j > 5) enemyTypesThisWave.push('troll');
      
      // Boss wave logic
      if (i % 10 === 0 && j === subWavesPerMain) { // Every 10th main wave, last sub-wave is a boss
        enemies.push({ type: 'boss', count: 1, healthMultiplierOverride: baseHealthMultiplier * 1.5, speedMultiplierOverride: baseSpeedMultiplier * 0.8 });
        enemyCount = 0; // No other enemies with the boss for simplicity
      } else {
         for (let k = 0; k < enemyCount; k++) {
            const randomEnemyType = enemyTypesThisWave[Math.floor(Math.random() * enemyTypesThisWave.length)];
            enemies.push({ type: randomEnemyType, count: 1 }); // Add individual enemies
        }
      }
      
      subWaves.push({
        id: `main${i}-sub${j}`,
        subWaveInMainIndex: j,
        enemies: enemies.flatMap(config => Array(config.count).fill({...config, count: 1})), // Expand counts
        spawnIntervalMs: Math.max(300, 1000 - (i * 20) - (j * 10)), // Faster spawns in later waves
        postSubWaveDelayMs: Math.max(1000, 2500 - (i * 30)), // Shorter delays between sub-waves later
      });
    }
    mainWaves.push({
      mainWaveNumber: i,
      baseHealthMultiplier,
      baseSpeedMultiplier,
      subWaves,
    });
  }
  return mainWaves;
};


const gameConfig: GameConfig = {
  gridRows: GRID_ROWS,
  gridCols: GRID_COLS,
  cellSize: CELL_SIZE,
  enemyPath: ENEMY_PATH,
  placementSpots: PLACEMENT_SPOTS,
  towerTypes: TOWER_TYPES,
  enemyTypes: ENEMY_TYPES,
  initialGameState: initialGameStateConfig,
  mainWaves: generateWaves(TOTAL_MAIN_WAVES, SUB_WAVES_PER_MAIN),
  totalMainWaves: TOTAL_MAIN_WAVES,
  subWavesPerMain: SUB_WAVES_PER_MAIN,
  allTowerIds: ALL_TOWER_IDS,
  maxUnlockableTowers: MAX_UNLOCKABLE_TOWERS,
};

export default gameConfig;
