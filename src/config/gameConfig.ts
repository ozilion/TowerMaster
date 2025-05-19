
import type { GameConfig, TowerCategory } from '@/types/game';
import { Shield, Flame, Snowflake } from 'lucide-react';

const GRID_ROWS = 12;
const GRID_COLS = 20;
const CELL_SIZE = 40; // pixels

// Simple S-shaped path
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
  // Around first horizontal segment
  { row: 1, col: 1, id: 'spot-1-1', isOccupied: false }, { row: 3, col: 1, id: 'spot-3-1', isOccupied: false },
  { row: 1, col: 3, id: 'spot-1-3', isOccupied: false }, { row: 3, col: 3, id: 'spot-3-3', isOccupied: false },
  // Around first vertical segment
  { row: 4, col: 3, id: 'spot-4-3', isOccupied: false }, { row: 4, col: 5, id: 'spot-4-5', isOccupied: false },
  // Around second horizontal segment
  { row: 6, col: 5, id: 'spot-6-5', isOccupied: false }, { row: 4, col: 6, id: 'spot-4-6', isOccupied: false },
  { row: 6, col: 7, id: 'spot-6-7', isOccupied: false },
  // Around second vertical segment (leading to third horizontal)
  { row: 1, col: 7, id: 'spot-1-7', isOccupied: false }, { row: 1, col: 9, id: 'spot-1-9', isOccupied: false },
  // Around third horizontal segment
  { row: 1, col: 11, id: 'spot-1-11', isOccupied: false }, { row: 3, col: 11, id: 'spot-3-11', isOccupied: false },
  // Around final vertical segment
  { row: 4, col: 11, id: 'spot-4-11', isOccupied: false }, { row: 6, col: 11, id: 'spot-6-11', isOccupied: false },
  { row: 4, col: 13, id: 'spot-4-13', isOccupied: false }, { row: 6, col: 13, id: 'spot-6-13', isOccupied: false },
  // Around final horizontal segment
  { row: 8, col: 14, id: 'spot-8-14', isOccupied: false }, { row: 6, col: 14, id: 'spot-6-14', isOccupied: false },
  { row: 8, col: 16, id: 'spot-8-16', isOccupied: false }, { row: 6, col: 16, id: 'spot-6-16', isOccupied: false },
  { row: 8, col: 18, id: 'spot-8-18', isOccupied: false }, { row: 6, col: 18, id: 'spot-6-18', isOccupied: false },
];


export const TOWER_TYPES: GameConfig['towerTypes'] = {
  simple: {
    id: 'simple',
    name: 'Basit Kule',
    icon: Shield,
    baseCost: 50,
    levels: {
      1: { damage: 10, range: CELL_SIZE * 2.5, fireRate: 1, cost: 50, projectileSpeed: 300, color: 'rgba(100, 100, 255, 0.8)'},
      2: { damage: 20, range: CELL_SIZE * 2.7, fireRate: 1.2, mergeCost: 75, projectileSpeed: 320, color: 'rgba(80, 80, 230, 0.9)' },
      3: { damage: 35, range: CELL_SIZE * 3, fireRate: 1.5, mergeCost: 125, projectileSpeed: 350, color: 'rgba(60, 60, 200, 1)' },
    },
  },
  fire: {
    id: 'fire',
    name: 'Ateş Kulesi',
    icon: Flame,
    baseCost: 75,
    levels: {
      1: { damage: 15, range: CELL_SIZE * 1.8, fireRate: 2, cost: 75, projectileSpeed: 400, color: 'rgba(255, 100, 100, 0.8)' },
      2: { damage: 30, range: CELL_SIZE * 2, fireRate: 2.5, mergeCost: 100, projectileSpeed: 420, color: 'rgba(230, 80, 80, 0.9)' },
      3: { damage: 50, range: CELL_SIZE * 2.2, fireRate: 3, mergeCost: 150, projectileSpeed: 450, color: 'rgba(200, 60, 60, 1)' },
    },
  },
  ice: {
    id: 'ice',
    name: 'Buz Kulesi',
    icon: Snowflake,
    baseCost: 100,
    levels: {
      // Ice towers often have a slow effect, not implemented yet. Damage is lower.
      1: { damage: 8, range: CELL_SIZE * 3.5, fireRate: 0.7, cost: 100, projectileSpeed: 250, color: 'rgba(100, 200, 255, 0.8)' },
      2: { damage: 15, range: CELL_SIZE * 3.8, fireRate: 0.8, mergeCost: 125, projectileSpeed: 270, color: 'rgba(80, 180, 230, 0.9)' },
      3: { damage: 25, range: CELL_SIZE * 4.2, fireRate: 1, mergeCost: 175, projectileSpeed: 300, color: 'rgba(60, 160, 200, 1)' },
    },
  },
};

const gameConfig: GameConfig = {
  gridRows: GRID_ROWS,
  gridCols: GRID_COLS,
  cellSize: CELL_SIZE,
  enemyPath,
  placementSpots,
  towerTypes: TOWER_TYPES,
  initialGameState: { // Omit now correctly reflects GameState without lastTickTime
    playerHealth: 20,
    money: 200,
    currentWaveNumber: 0,
    score: 0,
    isGameOver: false,
    gameSpeed: 1,
    // waveStartTime and gameStatus are handled dynamically in useGameLogic
  },
  waves: [
    { waveNumber: 1, enemies: [{ type: 'goblin', count: 10, spawnDelayMs: 1000, healthMultiplier: 1, speedMultiplier: 1 }], spawnIntervalMs: 1000 },
    { waveNumber: 2, enemies: [{ type: 'goblin', count: 15, spawnDelayMs: 800, healthMultiplier: 1.2, speedMultiplier: 1 }], spawnIntervalMs: 800 },
    { waveNumber: 3, enemies: [{ type: 'orc', count: 5, spawnDelayMs: 2000, healthMultiplier: 1, speedMultiplier: 0.8 }, { type: 'goblin', count:10, spawnDelayMs:500, healthMultiplier:1.3, speedMultiplier:1.1}], spawnIntervalMs: 1500 },
    { waveNumber: 4, enemies: [{ type: 'orc', count: 10, spawnDelayMs: 1500, healthMultiplier: 1.2, speedMultiplier: 0.85 }], spawnIntervalMs: 1500 },
    { waveNumber: 5, enemies: [{ type: 'goblin', count: 25, spawnDelayMs: 500, healthMultiplier: 1.5, speedMultiplier: 1.2 }, { type: 'orc', count:5, spawnDelayMs:1200, healthMultiplier:1.5, speedMultiplier:0.9}], spawnIntervalMs: 1000 },
    { waveNumber: 6, enemies: [{ type: 'goblin', count: 30, spawnDelayMs: 450, healthMultiplier: 1.6, speedMultiplier: 1.2 }, { type: 'orc', count: 7, spawnDelayMs: 1100, healthMultiplier: 1.6, speedMultiplier: 0.9 }], spawnIntervalMs: 900 },
    { waveNumber: 7, enemies: [{ type: 'goblin', count: 40, spawnDelayMs: 400, healthMultiplier: 1.7, speedMultiplier: 1.3 }, { type: 'orc', count: 8, spawnDelayMs: 1000, healthMultiplier: 1.7, speedMultiplier: 0.95 }], spawnIntervalMs: 800 },
    { waveNumber: 8, enemies: [{ type: 'goblin', count: 20, spawnDelayMs: 500, healthMultiplier: 1.8, speedMultiplier: 1.3 }, { type: 'orc', count: 12, spawnDelayMs: 900, healthMultiplier: 1.8, speedMultiplier: 1.0 }], spawnIntervalMs: 700 },
    { waveNumber: 9, enemies: [{ type: 'goblin', count: 15, spawnDelayMs: 600, healthMultiplier: 1.9, speedMultiplier: 1.4 }, { type: 'orc', count: 15, spawnDelayMs: 800, healthMultiplier: 1.9, speedMultiplier: 1.0 }], spawnIntervalMs: 600 },
    { waveNumber: 10, enemies: [{ type: 'goblin', count: 50, spawnDelayMs: 300, healthMultiplier: 2.0, speedMultiplier: 1.5 }, { type: 'orc', count: 20, spawnDelayMs: 700, healthMultiplier: 2.0, speedMultiplier: 1.1 }], spawnIntervalMs: 500 },
  ],
};

export const ENEMY_TYPES = {
  goblin: { baseHealth: 30, baseSpeed: CELL_SIZE / 2.5, value: 5, size: CELL_SIZE * 0.6, color: 'green' }, // speed per second
  orc: { baseHealth: 100, baseSpeed: CELL_SIZE / 3.5, value: 15, size: CELL_SIZE * 0.8, color: 'darkred' },
};

export default gameConfig;
