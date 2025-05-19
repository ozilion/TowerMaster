
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, PlacedTower, Enemy, Projectile, TowerCategory, PlacementSpot, GridPosition, PixelPosition, TowerLevelStats, MainWave, SubWave, EnemyType } from '@/types/game';
import gameConfig, { ENEMY_TYPES, TOWER_TYPES } from '@/config/gameConfig';
import { v4 as uuidv4 } from 'uuid';

const getStatsForLevel = (towerType: TowerCategory, level: 1 | 2 | 3): TowerLevelStats => {
  const definition = TOWER_TYPES[towerType];
  if (!definition) {
    console.error(`Tower definition not found for type: ${towerType}`);
    // Return some default/fallback stats to prevent crash
    return { level, damage: 1, range: 1, fireRate: 1, projectileSpeed: 100, color: 'grey' };
  }
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
    special: levelStats.special,
  };
};

// Helper to shuffle an array (Fisher-Yates shuffle)
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}


export function useGameLogic() {
  const [towers, setTowers] = useState<PlacedTower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [currentPlacementSpots, setCurrentPlacementSpots] = useState<PlacementSpot[]>(gameConfig.placementSpots.map(ps => ({...ps, isOccupied: false})));
  
  const [gameState, setGameState] = useState<GameState>(() => {
    let initialUnlockableProgression: TowerCategory[];
    const allDefinedTowerIds = gameConfig.allTowerIds;

    if (allDefinedTowerIds.length <= gameConfig.maxUnlockableTowers) {
      initialUnlockableProgression = [...allDefinedTowerIds];
    } else {
      initialUnlockableProgression = shuffleArray(allDefinedTowerIds).slice(0, gameConfig.maxUnlockableTowers);
    }
    
    // Ensure 'simple' tower is always first if it exists and is part of the progression.
    // If not, pick the first from the (shuffled) progression.
    let firstTowerToUnlock: TowerCategory | undefined = initialUnlockableProgression[0];
    const simpleTowerIndex = initialUnlockableProgression.indexOf('simple');

    if (simpleTowerIndex > 0) { // 'simple' exists but not first, make it first
        const simpleTower = initialUnlockableProgression.splice(simpleTowerIndex, 1)[0];
        initialUnlockableProgression.unshift(simpleTower);
        firstTowerToUnlock = simpleTower;
    } else if (simpleTowerIndex === -1 && allDefinedTowerIds.includes('simple') && initialUnlockableProgression.length < gameConfig.maxUnlockableTowers) {
        // 'simple' exists but wasn't selected, and we have space, add it first
        if (initialUnlockableProgression.length > 0) initialUnlockableProgression.pop(); // make space if full
        initialUnlockableProgression.unshift('simple');
        firstTowerToUnlock = 'simple';
    } else if (simpleTowerIndex === -1 && !allDefinedTowerIds.includes('simple')) {
        // 'simple' tower not defined at all, use whatever is first in progression
        firstTowerToUnlock = initialUnlockableProgression[0];
    }


    return {
      ...gameConfig.initialGameState,
      selectedTowerType: null,
      placementMode: false,
      waveStartTime: null,
      unlockableTowerProgression: initialUnlockableProgression,
      availableTowerTypes: firstTowerToUnlock ? [firstTowerToUnlock] : [],
    };
  });


  const gameLoopRef = useRef<number>();
  const enemiesToSpawnRef = useRef<Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>>>([])
  const nextSpawnTimeRef = useRef<number>(0); // For enemies within a sub-wave
  const nextSubWaveTimerRef = useRef<NodeJS.Timeout | null>(null); // For delay between sub-waves
  const lastTickTimeRef = useRef<number>(performance.now()); 


  const gridToPixel = useCallback((gridPos: GridPosition): PixelPosition => {
    return {
      x: gridPos.col * gameConfig.cellSize + gameConfig.cellSize / 2,
      y: gridPos.row * gameConfig.cellSize + gameConfig.cellSize / 2,
    };
  }, []);
  
  const resetGame = useCallback(() => {
    if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);

    let initialUnlockableProgression: TowerCategory[];
    const allDefinedTowerIds = gameConfig.allTowerIds;
    if (allDefinedTowerIds.length <= gameConfig.maxUnlockableTowers) {
      initialUnlockableProgression = [...allDefinedTowerIds];
    } else {
      initialUnlockableProgression = shuffleArray(allDefinedTowerIds).slice(0, gameConfig.maxUnlockableTowers);
    }
    
    let firstTowerToUnlock: TowerCategory | undefined = initialUnlockableProgression[0];
    const simpleTowerIndex = initialUnlockableProgression.indexOf('simple');
    if (simpleTowerIndex > 0) {
        const simpleTower = initialUnlockableProgression.splice(simpleTowerIndex, 1)[0];
        initialUnlockableProgression.unshift(simpleTower);
        firstTowerToUnlock = simpleTower;
    } else if (simpleTowerIndex === -1 && allDefinedTowerIds.includes('simple') && initialUnlockableProgression.length < gameConfig.maxUnlockableTowers) {
        if (initialUnlockableProgression.length > 0 && initialUnlockableProgression.length === gameConfig.maxUnlockableTowers) initialUnlockableProgression.pop();
        initialUnlockableProgression.unshift('simple');
        firstTowerToUnlock = 'simple';
    }


    setGameState({
      ...gameConfig.initialGameState,
      selectedTowerType: null,
      placementMode: false,
      waveStartTime: null,
      unlockableTowerProgression: initialUnlockableProgression,
      availableTowerTypes: firstTowerToUnlock ? [firstTowerToUnlock] : [],
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
      gameLoopRef.current = undefined;
    }
  }, []);

  const placeTower = useCallback((spot: PlacementSpot, towerType: TowerCategory) => {
    if (spot.isOccupied) return;
    const definition = TOWER_TYPES[towerType];
    if (!definition) return;
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

  const attemptMergeTowers = useCallback((tower1Id: string, tower2Id: string): { success: boolean; message: string; resultingTower?: PlacedTower } => {
    const tower1 = towers.find(t => t.id === tower1Id);
    const tower2 = towers.find(t => t.id === tower2Id);

    if (!tower1 || !tower2) return { success: false, message: 'Kulelerden biri veya her ikisi bulunamadı.' };
    if (tower1.type !== tower2.type || tower1.level !== tower2.level) return { success: false, message: 'Kuleler aynı tipte ve aynı seviyede olmalıdır.' };
    if (tower1.level >= 3) return { success: false, message: 'Kule zaten maksimum seviyede (Seviye 3).' };

    const nextLevel = (tower1.level + 1) as 2 | 3;
    const towerDefinition = TOWER_TYPES[tower1.type];
    const mergeCost = towerDefinition.levels[nextLevel].mergeCost || 0;

    if (gameState.money < mergeCost) return { success: false, message: `Yetersiz para. Gerekli: ${mergeCost}, Mevcut: ${gameState.money}` };

    const newStats = getStatsForLevel(tower1.type, nextLevel);
    const mergedTower: PlacedTower = { ...tower1, level: nextLevel, stats: newStats, lastShotTime: 0 };
    
    setTowers(prevTowers => [mergedTower, ...prevTowers.filter(t => t.id !== tower1Id && t.id !== tower2Id)]);
    setGameState(prev => ({ ...prev, money: prev.money - mergeCost }));
    
    const spotOfTower2 = currentPlacementSpots.find(s => {
      const spotPx = gridToPixel(s);
      return Math.abs(tower2.x - spotPx.x) < gameConfig.cellSize / 2 && Math.abs(tower2.y - spotPx.y) < gameConfig.cellSize / 2;
    });
    if (spotOfTower2) setCurrentPlacementSpots(prevSpots => prevSpots.map(s => s.id === spotOfTower2.id ? {...s, isOccupied: false} : s));
    
    return { success: true, message: `${towerDefinition.name} Seviye ${nextLevel}'e yükseltildi!`, resultingTower: mergedTower };
  }, [towers, gameState.money, currentPlacementSpots, gridToPixel]);

  const moveTower = useCallback((towerId: string, newSpotId: string): boolean => {
    const towerToMove = towers.find(t => t.id === towerId);
    const newSpot = currentPlacementSpots.find(s => s.id === newSpotId);

    if (!towerToMove || !newSpot || newSpot.isOccupied) return false;

    const oldSpot = currentPlacementSpots.find(s => {
      const spotPx = gridToPixel(s);
      return Math.abs(towerToMove.x - spotPx.x) < gameConfig.cellSize / 2 && Math.abs(towerToMove.y - spotPx.y) < gameConfig.cellSize / 2;
    });
    if (!oldSpot) return false;
    
    const newPixelPos = gridToPixel(newSpot);
    setTowers(prevTowers => prevTowers.map(t => t.id === towerId ? { ...t, x: newPixelPos.x, y: newPixelPos.y } : t));
    setCurrentPlacementSpots(prevSpots => prevSpots.map(s => {
      if (s.id === oldSpot.id) return { ...s, isOccupied: false };
      if (s.id === newSpot.id) return { ...s, isOccupied: true };
      return s;
    }));
    return true;
  }, [towers, currentPlacementSpots, gridToPixel]);


  const startNextWave = useCallback(() => {
    if (gameState.gameStatus === 'subWaveInProgress' || gameState.gameStatus === 'waitingForNextSubWave' || gameState.isGameOver || gameState.gameStatus === 'gameWon') return;
    if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);

    let nextOverallSubWave = gameState.currentOverallSubWave + 1;
    if (gameState.gameStatus === 'initial') nextOverallSubWave = 1;

    const totalPossibleSubWaves = gameConfig.totalMainWaves * gameConfig.subWavesPerMain;
    if (nextOverallSubWave > totalPossibleSubWaves) {
      setGameState(prev => ({ ...prev, gameStatus: 'gameWon' }));
      return;
    }

    const mainWaveIndex = Math.floor((nextOverallSubWave - 1) / gameConfig.subWavesPerMain);
    const subWaveInMainIndex = (nextOverallSubWave - 1) % gameConfig.subWavesPerMain;
    
    const currentMainWaveConfig = gameConfig.mainWaves[mainWaveIndex];
    if (!currentMainWaveConfig) {
      console.error(`Main wave config not found for mainWaveIndex: ${mainWaveIndex} (overall sub wave ${nextOverallSubWave})`);
      setGameState(prev => ({ ...prev, gameStatus: 'betweenMainWaves' })); // Or handle as error/end
      return;
    }
    const currentSubWaveConfig = currentMainWaveConfig.subWaves[subWaveInMainIndex];
    if (!currentSubWaveConfig) {
      console.error(`Sub wave config not found for mainWaveIndex: ${mainWaveIndex}, subWaveInMainIndex: ${subWaveInMainIndex}`);
      setGameState(prev => ({ ...prev, gameStatus: 'betweenMainWaves' }));
      return;
    }
    
    const newEnemiesToSpawn: Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>> = [];
    currentSubWaveConfig.enemies.forEach(enemyGroup => {
      const enemyTypeData = ENEMY_TYPES[enemyGroup.type];
      if (!enemyTypeData) {
        console.warn(`Enemy type ${enemyGroup.type} not found in ENEMY_TYPES`);
        return;
      }
      for (let i = 0; i < enemyGroup.count; i++) {
        newEnemiesToSpawn.push({
          type: enemyGroup.type,
          maxHealth: enemyTypeData.baseHealth * (enemyGroup.healthMultiplierOverride ?? currentMainWaveConfig.baseHealthMultiplier),
          health: enemyTypeData.baseHealth * (enemyGroup.healthMultiplierOverride ?? currentMainWaveConfig.baseHealthMultiplier),
          speed: enemyTypeData.baseSpeed * (enemyGroup.speedMultiplierOverride ?? currentMainWaveConfig.baseSpeedMultiplier),
          value: enemyTypeData.value,
          size: enemyTypeData.size,
        });
      }
    });
    enemiesToSpawnRef.current = newEnemiesToSpawn;
    nextSpawnTimeRef.current = performance.now() + (currentSubWaveConfig.spawnIntervalMs / gameState.gameSpeed); // Delay before first spawn in sub-wave

    let newAvailableTowers = [...gameState.availableTowerTypes];
    if (subWaveInMainIndex === 0 && mainWaveIndex < gameState.unlockableTowerProgression.length && mainWaveIndex >= newAvailableTowers.length) {
        // Unlock new tower at the start of a new main wave if conditions met
        const towerToUnlock = gameState.unlockableTowerProgression[mainWaveIndex];
        if (towerToUnlock && !newAvailableTowers.includes(towerToUnlock)) {
             newAvailableTowers.push(towerToUnlock);
        }
    }


    setGameState(prev => ({
      ...prev,
      currentOverallSubWave: nextOverallSubWave,
      currentMainWaveDisplay: currentMainWaveConfig.mainWaveNumber,
      currentSubWaveInMainDisplay: currentSubWaveConfig.subWaveInMainIndex + 1,
      gameStatus: 'subWaveInProgress',
      waveStartTime: performance.now(),
      availableTowerTypes: newAvailableTowers,
    }));

  }, [gameState]);


  const gameLoop = useCallback((currentTime: number) => {
    const deltaTime = (currentTime - lastTickTimeRef.current) / 1000 * gameState.gameSpeed; 

    if (gameState.isGameOver || gameState.gameStatus === 'gameWon') { 
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      return;
    }
    
    // Spawn enemies for current sub-wave
    if (gameState.gameStatus === 'subWaveInProgress' && enemiesToSpawnRef.current.length > 0 && currentTime >= nextSpawnTimeRef.current) {
        const enemyToSpawnData = enemiesToSpawnRef.current.shift();
        if (enemyToSpawnData) {
            const startPos = gridToPixel(gameConfig.enemyPath[0]);
            const newEnemy: Enemy = { ...enemyToSpawnData, id: uuidv4(), x: startPos.x, y: startPos.y, pathIndex: 0 };
            setEnemies(prev => [...prev, newEnemy]);
        }
        // Determine next spawn time based on current sub-wave's config
        const mainWaveIndex = Math.floor((gameState.currentOverallSubWave - 1) / gameConfig.subWavesPerMain);
        const subWaveInMainIndex = (gameState.currentOverallSubWave - 1) % gameConfig.subWavesPerMain;
        const currentSubWaveConfig = gameConfig.mainWaves[mainWaveIndex]?.subWaves[subWaveInMainIndex];
        nextSpawnTimeRef.current = currentTime + ((currentSubWaveConfig?.spawnIntervalMs || 1000) / gameState.gameSpeed);
    }

    // Move enemies
    setEnemies(prevEnemies => {
      let newPlayerHealth = gameState.playerHealth; 
      let healthChanged = false;
      const updatedEnemies = prevEnemies.map(enemy => {
        if (enemy.pathIndex >= gameConfig.enemyPath.length - 1) return enemy; 
        const targetGridPos = gameConfig.enemyPath[enemy.pathIndex + 1];
        const targetPixelPos = gridToPixel(targetGridPos);
        const angle = Math.atan2(targetPixelPos.y - enemy.y, targetPixelPos.x - enemy.x);
        const distanceToTarget = Math.sqrt(Math.pow(targetPixelPos.x - enemy.x, 2) + Math.pow(targetPixelPos.y - enemy.y, 2));
        const moveDistance = enemy.speed * deltaTime;
        let newX = enemy.x, newY = enemy.y;
        if (distanceToTarget <= moveDistance) {
          newX = targetPixelPos.x; newY = targetPixelPos.y;
          return { ...enemy, x: newX, y: newY, pathIndex: enemy.pathIndex + 1 };
        } else {
          newX += Math.cos(angle) * moveDistance; newY += Math.sin(angle) * moveDistance;
          return { ...enemy, x: newX, y: newY };
        }
      }).filter(enemy => {
        if (enemy.pathIndex >= gameConfig.enemyPath.length - 1) {
          newPlayerHealth = Math.max(0, newPlayerHealth - 1);
          healthChanged = true;
          return false; 
        }
        return true;
      });
      if (healthChanged) {
        setGameState(prev => ({ ...prev, playerHealth: newPlayerHealth, isGameOver: newPlayerHealth <= 0 ? true : prev.isGameOver, gameStatus: newPlayerHealth <=0 ? 'gameOver' : prev.gameStatus }));
      }
      return updatedEnemies;
    });

    // Towers attack
    setTowers(prevTowers => prevTowers.map(tower => {
      if (currentTime < tower.lastShotTime + (1000 / tower.stats.fireRate / gameState.gameSpeed)) return tower; 
      let target: Enemy | null = null;
      let minDistance = tower.stats.range + 1;
      const currentEnemiesForTargeting = enemiesRef.current;
      currentEnemiesForTargeting.forEach(enemy => { 
        const distance = Math.sqrt(Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2));
        if (distance <= tower.stats.range && distance < minDistance) {
          minDistance = distance; target = enemy;
        }
      });
      if (target) {
        const newProjectile: Projectile = { id: uuidv4(), towerId: tower.id, targetId: target.id, x: tower.x, y: tower.y, damage: tower.stats.damage, speed: tower.stats.projectileSpeed || 200, color: tower.stats.color, targetPosition: { x: target.x, y: target.y } };
        setProjectiles(prev => [...prev, newProjectile]);
        const angleToTarget = Math.atan2(target.y - tower.y, target.x - tower.x) * (180 / Math.PI) + 90;
        return { ...tower, lastShotTime: currentTime, targetId: target.id, rotation: angleToTarget };
      }
      return { ...tower, targetId: undefined, rotation: tower.rotation }; 
    }));

    // Move projectiles and apply damage
    setProjectiles(prevProjectiles => {
      const damageToApply: Record<string, { totalDamage: number; value: number }> = {};
      const projectilesThatHitOrExpired = new Set<string>();
      const currentEnemiesForProjectileLogic = enemiesRef.current;
      const nextProjectilesState = prevProjectiles.map(p => {
        if (projectilesThatHitOrExpired.has(p.id)) return p;
        const currentTarget = currentEnemiesForProjectileLogic.find(e => e.id === p.targetId); 
        const targetPos = currentTarget ? { x: currentTarget.x, y: currentTarget.y } : p.targetPosition;
        const angle = Math.atan2(targetPos.y - p.y, targetPos.x - p.x);
        const moveDistance = p.speed * deltaTime;
        const distanceToTarget = Math.sqrt(Math.pow(targetPos.x - p.x, 2) + Math.pow(targetPos.y - p.y, 2));
        let newX = p.x + Math.cos(angle) * moveDistance;
        let newY = p.y + Math.sin(angle) * moveDistance;
        if (distanceToTarget <= moveDistance) { 
          projectilesThatHitOrExpired.add(p.id);
          if (currentTarget) { 
            if (!damageToApply[currentTarget.id]) damageToApply[currentTarget.id] = { totalDamage: 0, value: currentTarget.value };
            damageToApply[currentTarget.id].totalDamage += p.damage;
          }
        } else if (!currentTarget && Math.abs(newX - targetPos.x) < 1 && Math.abs(newY - targetPos.y) < 1) {
          projectilesThatHitOrExpired.add(p.id);
        }
        return { ...p, x: newX, y: newY, targetPosition: targetPos }; 
      });
      if (Object.keys(damageToApply).length > 0) {
        let moneyEarnedThisTick = 0;
        let scoreEarnedThisTick = 0;
        setEnemies(currentEnemies => {
          const updatedEnemiesAfterDamage = currentEnemies.map(enemy => {
            if (damageToApply[enemy.id]) {
              const enemyDamageRecord = damageToApply[enemy.id];
              const newHealth = enemy.health - enemyDamageRecord.totalDamage;
              if (newHealth <= 0) {
                moneyEarnedThisTick += enemyDamageRecord.value;
                scoreEarnedThisTick += enemyDamageRecord.value; 
                return null; 
              }
              return { ...enemy, health: newHealth };
            }
            return enemy;
          }).filter(Boolean) as Enemy[];
          if (moneyEarnedThisTick > 0 || scoreEarnedThisTick > 0) {
            setGameState(prevGameState => ({ ...prevGameState, money: prevGameState.money + moneyEarnedThisTick, score: prevGameState.score + scoreEarnedThisTick }));
          }
          return updatedEnemiesAfterDamage;
        });
      }
      return nextProjectilesState.filter(p => !projectilesThatHitOrExpired.has(p.id));
    });
    
    // Check for sub-wave completion and transition
    if (gameState.gameStatus === 'subWaveInProgress' && enemiesRef.current.length === 0 && enemiesToSpawnRef.current.length === 0) {
        const mainWaveIndex = Math.floor((gameState.currentOverallSubWave - 1) / gameConfig.subWavesPerMain);
        const subWaveInMainIndex = (gameState.currentOverallSubWave - 1) % gameConfig.subWavesPerMain;
        const currentSubWaveConfig = gameConfig.mainWaves[mainWaveIndex]?.subWaves[subWaveInMainIndex];

        if (currentSubWaveConfig && currentSubWaveConfig.subWaveInMainIndex < gameConfig.subWavesPerMain) { // Not the last sub-wave of a main wave
            setGameState(prev => ({ ...prev, gameStatus: 'waitingForNextSubWave' }));
            if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);
            nextSubWaveTimerRef.current = setTimeout(() => {
                startNextWave(); // This will increment currentOverallSubWave and start the next sub-wave
            }, (currentSubWaveConfig.postSubWaveDelayMs || 2500) / gameState.gameSpeed);
        } else { // Last sub-wave of a main wave completed
            if (gameState.currentOverallSubWave >= gameConfig.totalMainWaves * gameConfig.subWavesPerMain) {
                setGameState(prev => ({ ...prev, gameStatus: 'gameWon' }));
            } else {
                setGameState(prev => ({ ...prev, gameStatus: 'betweenMainWaves' }));
            }
        }
    }

    lastTickTimeRef.current = currentTime;
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, gridToPixel, enemies, projectiles, startNextWave]); // Added startNextWave to dependencies

  const enemiesRef = useRef(enemies);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);

  useEffect(() => {
    let shouldLoopRun = gameState.gameStatus === 'subWaveInProgress' || 
                        gameState.gameStatus === 'waitingForNextSubWave' || 
                        (projectiles.length > 0 && (gameState.gameStatus !== 'gameOver' && gameState.gameStatus !== 'gameWon'));


    if (shouldLoopRun && !gameState.isGameOver && gameState.gameStatus !== 'gameWon') {
      if (!gameLoopRef.current) { 
        lastTickTimeRef.current = performance.now(); 
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      }
    } else { 
      if (gameLoopRef.current) { 
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
    }
    
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);
    };
  }, [gameLoop, gameState.gameStatus, gameState.isGameOver, projectiles.length]);

  useEffect(() => {
    if (gameState.playerHealth <= 0 && !gameState.isGameOver) {
      setGameState(prev => ({ ...prev, isGameOver: true, gameStatus: 'gameOver' }));
    }
  }, [gameState.playerHealth, gameState.isGameOver]);

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
    moveTower,
    startNextWave,
    setSelectedTowerType,
    resetGame,
    gridToPixel,
    setGameState
  };
}
