
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, PlacedTower, Enemy, Projectile, TowerCategory, PlacementSpot, GridPosition, PixelPosition, TowerLevelStats } from '@/types/game';
import gameConfig, { ENEMY_TYPES, TOWER_TYPES } from '@/config/gameConfig';
import { v4 as uuidv4 } from 'uuid';

const getStatsForLevel = (towerType: TowerCategory, level: 1 | 2 | 3): TowerLevelStats => {
  const definition = TOWER_TYPES[towerType];
  const levelStats = definition.levels[level];
  return {
    level,
    damage: levelStats.damage,
    range: levelStats.range,
    fireRate: levelStats.fireRate,
    cost: level === 1 ? definition.baseCost : undefined,
    mergeCost: level > 1 ? (definition.levels[level as 2 | 3] as { mergeCost?: number }).mergeCost : undefined,
    projectileSpeed: levelStats.projectileSpeed,
    color: levelStats.color,
  };
};


export function useGameLogic() {
  const [gameState, setGameState] = useState<GameState>(() => ({
    ...gameConfig.initialGameState,
    selectedTowerType: null,
    placementMode: false,
    gameStatus: 'initial',
    waveStartTime: null,
    // lastTickTime is now managed by a ref
  }));
  const [towers, setTowers] = useState<PlacedTower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [currentPlacementSpots, setCurrentPlacementSpots] = useState<PlacementSpot[]>(gameConfig.placementSpots);

  const gameLoopRef = useRef<number>();
  const enemiesToSpawnRef = useRef<Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>>>([])
  const nextSpawnTimeRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number>(performance.now());


  const gridToPixel = useCallback((gridPos: GridPosition): PixelPosition => {
    return {
      x: gridPos.col * gameConfig.cellSize + gameConfig.cellSize / 2,
      y: gridPos.row * gameConfig.cellSize + gameConfig.cellSize / 2,
    };
  }, []);
  
  const resetGame = useCallback(() => {
    setGameState({
      ...gameConfig.initialGameState,
      selectedTowerType: null,
      placementMode: false,
      gameStatus: 'initial',
      waveStartTime: null,
    });
    lastTickTimeRef.current = performance.now();
    setTowers([]);
    setEnemies([]);
    setProjectiles([]);
    setCurrentPlacementSpots(gameConfig.placementSpots.map(ps => ({...ps, isOccupied: false})));
    enemiesToSpawnRef.current = [];
    nextSpawnTimeRef.current = 0;
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
  }, []);

  const placeTower = useCallback((spot: PlacementSpot, towerType: TowerCategory) => {
    if (spot.isOccupied) return;
    const definition = TOWER_TYPES[towerType];
    if (gameState.money < definition.baseCost) return;

    const pixelPos = gridToPixel(spot);
    const newTower: PlacedTower = {
      id: uuidv4(),
      type: towerType,
      level: 1,
      stats: getStatsForLevel(towerType, 1),
      x: pixelPos.x,
      y: pixelPos.y,
      lastShotTime: 0,
    };

    setTowers(prev => [...prev, newTower]);
    setGameState(prev => ({ ...prev, money: prev.money - definition.baseCost, selectedTowerType: null, placementMode: false }));
    setCurrentPlacementSpots(prevSpots => prevSpots.map(s => s.id === spot.id ? {...s, isOccupied: true} : s));
  }, [gameState.money, gridToPixel]);

  const attemptMergeTowers = useCallback((tower1Id: string, tower2Id: string) => {
    const tower1 = towers.find(t => t.id === tower1Id);
    const tower2 = towers.find(t => t.id === tower2Id);

    if (!tower1 || !tower2 || tower1.type !== tower2.type || tower1.level !== tower2.level || tower1.level >= 3) {
      console.log("Merge failed: conditions not met.");
      return;
    }

    const nextLevel = (tower1.level + 1) as 2 | 3;
    const mergeCost = TOWER_TYPES[tower1.type].levels[nextLevel].mergeCost || 0;

    if (gameState.money < mergeCost) {
      console.log("Merge failed: not enough money.");
      return;
    }

    const newStats = getStatsForLevel(tower1.type, nextLevel);
    const mergedTower: PlacedTower = {
      ...tower1,
      level: nextLevel,
      stats: newStats,
    };
    
    setTowers(prevTowers => [mergedTower, ...prevTowers.filter(t => t.id !== tower1Id && t.id !== tower2Id)]);
    setGameState(prev => ({ ...prev, money: prev.money - mergeCost }));
    
    const spot1 = currentPlacementSpots.find(s => gridToPixel(s).x === tower1.x && gridToPixel(s).y === tower1.y);
    const spot2 = currentPlacementSpots.find(s => gridToPixel(s).x === tower2.x && gridToPixel(s).y === tower2.y);
    
    if (spot2) { // Free up the spot of the tower that was merged into the other
       setCurrentPlacementSpots(prevSpots => prevSpots.map(s => s.id === spot2.id ? {...s, isOccupied: false} : s));
    }
    // spot1 remains occupied by the merged tower

    console.log(`Tower merged to level ${nextLevel}!`);

  }, [towers, gameState.money, currentPlacementSpots, gridToPixel]);


  const startNextWave = useCallback(() => {
    if (gameState.gameStatus === 'waveInProgress' || gameState.isGameOver) return;

    const nextWaveNumber = gameState.currentWaveNumber + 1;
    const waveData = gameConfig.waves.find(w => w.waveNumber === nextWaveNumber);

    if (!waveData) {
      // All waves completed - potentially a win condition
      console.log("All waves completed!");
      setGameState(prev => ({ ...prev, gameStatus: 'initial' })); // Or 'gameWon'
      return;
    }
    
    const newEnemiesToSpawn: Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>> = [];
    waveData.enemies.forEach(enemyGroup => {
      const enemyTypeData = ENEMY_TYPES[enemyGroup.type as keyof typeof ENEMY_TYPES];
      for (let i = 0; i < enemyGroup.count; i++) {
        newEnemiesToSpawn.push({
          type: enemyGroup.type,
          maxHealth: enemyTypeData.baseHealth * enemyGroup.healthMultiplier,
          health: enemyTypeData.baseHealth * enemyGroup.healthMultiplier,
          speed: enemyTypeData.baseSpeed * enemyGroup.speedMultiplier,
          value: enemyTypeData.value,
          size: enemyTypeData.size,
          // Spawn delay for this specific enemy within the group
        });
      }
    });
    enemiesToSpawnRef.current = newEnemiesToSpawn;
    nextSpawnTimeRef.current = performance.now() + (waveData.enemies[0]?.spawnDelayMs || gameConfig.waves[0].spawnIntervalMs) ;


    setGameState(prev => ({
      ...prev,
      currentWaveNumber: nextWaveNumber,
      gameStatus: 'waveInProgress',
      waveStartTime: performance.now(),
    }));
    lastTickTimeRef.current = performance.now(); // Ensure tick time is fresh for new wave
  }, [gameState.currentWaveNumber, gameState.gameStatus, gameState.isGameOver]);


  const gameLoop = useCallback((currentTime: number) => {
    const deltaTime = (currentTime - lastTickTimeRef.current) / 1000; // deltaTime in seconds

    if (gameState.isGameOver) { // Use live gameState here
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      return;
    }
    
    // Spawn enemies
    if (gameState.gameStatus === 'waveInProgress' && enemiesToSpawnRef.current.length > 0 && currentTime >= nextSpawnTimeRef.current) {
        const enemyToSpawnData = enemiesToSpawnRef.current.shift();
        if (enemyToSpawnData) {
            const startPos = gridToPixel(gameConfig.enemyPath[0]);
            const newEnemy: Enemy = {
                ...enemyToSpawnData,
                id: uuidv4(),
                x: startPos.x,
                y: startPos.y,
                pathIndex: 0,
            };
            setEnemies(prev => [...prev, newEnemy]);
        }
        const currentWaveData = gameConfig.waves.find(w => w.waveNumber === gameState.currentWaveNumber);
        nextSpawnTimeRef.current = currentTime + (currentWaveData?.spawnIntervalMs || 1000);
    }


    // Update enemies
    setEnemies(prevEnemies => {
      let newPlayerHealth = gameState.playerHealth; // Read current health before mapping
      let healthChanged = false;

      const updatedEnemies = prevEnemies.map(enemy => {
        if (enemy.pathIndex >= gameConfig.enemyPath.length - 1) return enemy; // Already at end

        const targetGridPos = gameConfig.enemyPath[enemy.pathIndex + 1];
        const targetPixelPos = gridToPixel(targetGridPos);
        const angle = Math.atan2(targetPixelPos.y - enemy.y, targetPixelPos.x - enemy.x);
        const distanceToTarget = Math.sqrt(Math.pow(targetPixelPos.x - enemy.x, 2) + Math.pow(targetPixelPos.y - enemy.y, 2));
        const moveDistance = enemy.speed * deltaTime * gameState.gameSpeed;

        let newX = enemy.x;
        let newY = enemy.y;

        if (distanceToTarget <= moveDistance) {
          newX = targetPixelPos.x;
          newY = targetPixelPos.y;
          return { ...enemy, x: newX, y: newY, pathIndex: enemy.pathIndex + 1 };
        } else {
          newX += Math.cos(angle) * moveDistance;
          newY += Math.sin(angle) * moveDistance;
          return { ...enemy, x: newX, y: newY };
        }
      }).filter(enemy => {
        if (enemy.pathIndex >= gameConfig.enemyPath.length - 1) {
          newPlayerHealth = Math.max(0, newPlayerHealth - 1);
          healthChanged = true;
          return false; // Remove enemy that reached end
        }
        return true;
      });

      if (healthChanged) {
        setGameState(prev => {
          const updatedHealthState = { ...prev, playerHealth: newPlayerHealth };
          if (newPlayerHealth <= 0 && !prev.isGameOver) {
            updatedHealthState.isGameOver = true;
            updatedHealthState.gameStatus = 'gameOver';
          }
          return updatedHealthState;
        });
      }
      return updatedEnemies;
    });

    // Update towers and shoot projectiles
    setTowers(prevTowers => prevTowers.map(tower => {
      if (currentTime < tower.lastShotTime + (1000 / tower.stats.fireRate / gameState.gameSpeed)) {
        return tower; // Cooldown
      }

      let target: Enemy | null = null;
      let minDistance = tower.stats.range + 1;

      // Read current enemies state for targeting
      // Note: `enemies` in closure of gameLoop might be slightly stale if setEnemies above hasn't re-rendered yet for this exact tick.
      // For precise targeting, might need to pass `updatedEnemies` from above or use `enemiesRef.current`.
      // However, for typical game loops, this level of staleness is often acceptable.
      enemies.forEach(enemy => { 
        const distance = Math.sqrt(Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2));
        if (distance <= tower.stats.range && distance < minDistance) {
          minDistance = distance;
          target = enemy;
        }
      });

      if (target) {
        const newProjectile: Projectile = {
          id: uuidv4(),
          towerId: tower.id,
          targetId: target.id,
          x: tower.x,
          y: tower.y,
          damage: tower.stats.damage,
          speed: tower.stats.projectileSpeed || 200,
          color: tower.stats.color,
          targetPosition: { x: target.x, y: target.y }
        };
        setProjectiles(prev => [...prev, newProjectile]);
        const angleToTarget = Math.atan2(target.y - tower.y, target.x - tower.x) * (180 / Math.PI) + 90;
        return { ...tower, lastShotTime: currentTime, targetId: target.id, rotation: angleToTarget };
      }
      return { ...tower, targetId: undefined, rotation: tower.rotation }; 
    }));

    // Update projectiles
    setProjectiles(prevProjectiles => {
      let moneyEarned = 0;
      let scoreEarned = 0;
      const liveEnemyIds = new Set(enemies.map(e => e.id)); // Get current live enemy IDs

      const updatedProjectiles = prevProjectiles.map(p => {
        const targetEnemy = enemies.find(e => e.id === p.targetId); // Use current enemies
        const targetPos = targetEnemy ? { x: targetEnemy.x, y: targetEnemy.y } : p.targetPosition; 

        const angle = Math.atan2(targetPos.y - p.y, targetPos.x - p.x);
        const moveDistance = p.speed * deltaTime * gameState.gameSpeed;
        const distanceToTarget = Math.sqrt(Math.pow(targetPos.x - p.x, 2) + Math.pow(targetPos.y - p.y, 2));

        if (distanceToTarget <= moveDistance && liveEnemyIds.has(p.targetId)) { // Check if target still exists
          setEnemies(prevEnemies => prevEnemies.map(e => {
            if (e.id === p.targetId) {
              const newHealth = e.health - p.damage;
              if (newHealth <= 0) {
                moneyEarned += e.value;
                scoreEarned += e.value;
                return null; 
              }
              return { ...e, health: newHealth };
            }
            return e;
          }).filter(Boolean) as Enemy[]);
          return null; 
        } else if (distanceToTarget <= moveDistance && !liveEnemyIds.has(p.targetId)) {
            return null; // Target already gone, remove projectile
        }else {
          return { ...p, x: p.x + Math.cos(angle) * moveDistance, y: p.y + Math.sin(angle) * moveDistance };
        }
      }).filter(Boolean) as Projectile[];

      if (moneyEarned > 0 || scoreEarned > 0) {
        setGameState(prev => ({ ...prev, money: prev.money + moneyEarned, score: prev.score + scoreEarned }));
      }
      return updatedProjectiles;
    });
    
    // Check for wave completion
    if (gameState.gameStatus === 'waveInProgress' && enemies.length === 0 && enemiesToSpawnRef.current.length === 0) {
        setGameState(prev => ({ ...prev, gameStatus: 'betweenWaves' }));
    }

    lastTickTimeRef.current = currentTime;
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, enemies, gridToPixel, projectiles]); // projectiles added as it's read for targetEnemy check

  useEffect(() => {
    if (gameState.playerHealth <= 0 && !gameState.isGameOver) {
      setGameState(prev => ({ ...prev, isGameOver: true, gameStatus: 'gameOver' }));
    }
  }, [gameState.playerHealth, gameState.isGameOver]);
  
  useEffect(() => {
    if (gameState.isGameOver) {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      return;
    }

    if (gameState.gameStatus === 'waveInProgress' || (gameState.gameStatus === 'betweenWaves' && enemies.length > 0)) {
        // If resuming, ensure lastTickTimeRef is current to avoid large initial deltaTime
        if (!gameLoopRef.current) { // Only if we are truly starting/restarting the loop
            lastTickTimeRef.current = performance.now();
        }
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameState.gameStatus !== 'gameOver') { 
       if(gameLoopRef.current) {
         cancelAnimationFrame(gameLoopRef.current);
         gameLoopRef.current = undefined; // Clear ref when loop is not running
       }
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameLoop, gameState.gameStatus, gameState.isGameOver, enemies.length]);


  const setSelectedTowerType = (type: TowerCategory | null) => {
    setGameState(prev => ({ ...prev, selectedTowerType: type, placementMode: !!type }));
  };

  return {
    gameState,
    towers,
    enemies,
    projectiles,
    currentPlacementSpots,
    placeTower,
    attemptMergeTowers,
    startNextWave,
    setSelectedTowerType,
    resetGame,
    gridToPixel,
    setGameState
  };
}
