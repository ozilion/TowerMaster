
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
    lastTickTime: performance.now(),
  }));
  const [towers, setTowers] = useState<PlacedTower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [currentPlacementSpots, setCurrentPlacementSpots] = useState<PlacementSpot[]>(gameConfig.placementSpots);

  const gameLoopRef = useRef<number>();
  const enemiesToSpawnRef = useRef<Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>>>([])
  const nextSpawnTimeRef = useRef<number>(0);

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
      lastTickTime: performance.now(),
    });
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
  }, [gameState.currentWaveNumber, gameState.gameStatus, gameState.isGameOver]);


  const gameLoop = useCallback((currentTime: number) => {
    const deltaTime = (currentTime - gameState.lastTickTime) / 1000; // deltaTime in seconds

    if (gameState.isGameOver) {
      cancelAnimationFrame(gameLoopRef.current!);
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
          setGameState(prev => ({ ...prev, playerHealth: Math.max(0, prev.playerHealth - 1) }));
          if (gameState.playerHealth -1 <= 0) {
             setGameState(prev => ({ ...prev, isGameOver: true, gameStatus: 'gameOver'}));
          }
          return false; // Remove enemy that reached end
        }
        return true;
      });
      return updatedEnemies;
    });

    // Update towers and shoot projectiles
    setTowers(prevTowers => prevTowers.map(tower => {
      if (currentTime < tower.lastShotTime + (1000 / tower.stats.fireRate / gameState.gameSpeed)) {
        return tower; // Cooldown
      }

      let target: Enemy | null = null;
      let minDistance = tower.stats.range + 1;

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
        const angleToTarget = Math.atan2(target.y - tower.y, target.x - tower.x) * (180 / Math.PI) + 90; // +90 if tower sprite aims up
        return { ...tower, lastShotTime: currentTime, targetId: target.id, rotation: angleToTarget };
      }
      return { ...tower, targetId: undefined, rotation: tower.rotation }; // Keep last rotation or reset
    }));

    // Update projectiles
    setProjectiles(prevProjectiles => {
      const updatedProjectiles = prevProjectiles.map(p => {
        const targetEnemy = enemies.find(e => e.id === p.targetId);
        const targetPos = targetEnemy ? { x: targetEnemy.x, y: targetEnemy.y } : p.targetPosition; // Use last known if target is gone

        const angle = Math.atan2(targetPos.y - p.y, targetPos.x - p.x);
        const moveDistance = p.speed * deltaTime * gameState.gameSpeed;
        const distanceToTarget = Math.sqrt(Math.pow(targetPos.x - p.x, 2) + Math.pow(targetPos.y - p.y, 2));

        if (distanceToTarget <= moveDistance) {
          // Hit target
          setEnemies(prevEnemies => prevEnemies.map(e => {
            if (e.id === p.targetId) {
              const newHealth = e.health - p.damage;
              if (newHealth <= 0) {
                setGameState(prev => ({ ...prev, money: prev.money + e.value, score: prev.score + e.value }));
                return null; // Mark for removal
              }
              return { ...e, health: newHealth };
            }
            return e;
          }).filter(Boolean) as Enemy[]);
          return null; // Mark projectile for removal
        } else {
          return { ...p, x: p.x + Math.cos(angle) * moveDistance, y: p.y + Math.sin(angle) * moveDistance };
        }
      }).filter(Boolean) as Projectile[];
      return updatedProjectiles;
    });
    
    // Check for wave completion
    if (gameState.gameStatus === 'waveInProgress' && enemies.length === 0 && enemiesToSpawnRef.current.length === 0) {
        setGameState(prev => ({ ...prev, gameStatus: 'betweenWaves' }));
    }


    setGameState(prev => ({ ...prev, lastTickTime: currentTime }));
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, enemies, gridToPixel]);

  useEffect(() => {
    if (gameState.playerHealth <= 0 && !gameState.isGameOver) {
      setGameState(prev => ({ ...prev, isGameOver: true, gameStatus: 'gameOver' }));
    }
  }, [gameState.playerHealth, gameState.isGameOver]);
  
  useEffect(() => {
    if (gameState.gameStatus === 'waveInProgress' || (gameState.gameStatus === 'betweenWaves' && enemies.length > 0)) { // Keep loop if clearing remaining enemies
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameState.gameStatus !== 'gameOver') { // Pause if not in progress and not game over
       if(gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
       // Keep updating lastTickTime to prevent large deltaTime jump when resuming
       setGameState(prev => ({ ...prev, lastTickTime: performance.now() }));
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameLoop, gameState.gameStatus, gameState.isGameOver]);


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
