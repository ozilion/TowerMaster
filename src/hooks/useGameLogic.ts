
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, PlacedTower, Enemy, Projectile, TowerCategory, PlacementSpot, GridPosition, PixelPosition, TowerLevelStats, MainWave, SubWave, EnemyType } from '@/types/game';
import gameConfig, { ENEMY_TYPES, TOWER_TYPES } from '@/config/gameConfig';
import { v4 as uuidv4 } from 'uuid';

const getStatsForLevel = (towerType: TowerCategory, level: 1 | 2 | 3): TowerLevelStats => {
  const definition = TOWER_TYPES[towerType];
  if (!definition) {
    console.error(`Tower definition not found for type: ${towerType}`);
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

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const initializeTowerStateForGame = (): { progression: TowerCategory[]; available: TowerCategory[] } => {
  let progressionSequence: TowerCategory[];
  const allDefinedTowerIds = [...gameConfig.allTowerIds]; // Create a mutable copy

  const simpleTowerIndex = allDefinedTowerIds.indexOf('simple');
  let firstTower: TowerCategory = 'simple';

  if (simpleTowerIndex !== -1) {
    allDefinedTowerIds.splice(simpleTowerIndex, 1); // Remove 'simple' to shuffle the rest
  } else if (allDefinedTowerIds.length > 0) {
    // If 'simple' is not defined but other towers are, pick the first as default (fallback)
    // This case should ideally not happen if 'simple' is always intended as a starting tower.
    firstTower = allDefinedTowerIds[0];
    allDefinedTowerIds.splice(0, 1);
  } else {
    // No towers defined, return empty (should be handled by UI)
    return { progression: [], available: [] };
  }

  const shuffledRemainingTowers = shuffleArray(allDefinedTowerIds);
  progressionSequence = [firstTower, ...shuffledRemainingTowers];

  // Limit to maxUnlockableTowers if necessary
  if (progressionSequence.length > gameConfig.maxUnlockableTowers) {
    progressionSequence = progressionSequence.slice(0, gameConfig.maxUnlockableTowers);
  }
  
  // Ensure 'simple' is in the progression if it was defined, even if not picked by shuffle initially (if maxUnlockable < total defined)
  // This logic is a bit complex due to ensuring 'simple' is first and then respecting maxUnlockableTowers.
  // The current above logic already prioritizes 'simple' as firstTower in the sequence.

  return {
    progression: progressionSequence, // This is the full potential unlock sequence for this game instance
    available: [firstTower],        // Initially, only the first tower in the sequence is available
  };
};


export function useGameLogic() {
  const [towers, setTowers] = useState<PlacedTower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [currentPlacementSpots, setCurrentPlacementSpots] = useState<PlacementSpot[]>(gameConfig.placementSpots.map(ps => ({...ps, isOccupied: false})));
  
  const [gameState, setGameState] = useState<GameState>({
    ...gameConfig.initialGameState,
    selectedTowerType: null,
    placementMode: false,
    waveStartTime: null,
    unlockableTowerProgression: [], // Will be set by client-side useEffect
    availableTowerTypes: [],      // Will be set by client-side useEffect
  });

  const gameLoopRef = useRef<number>();
  const enemiesToSpawnRef = useRef<Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>>>([])
  const nextSpawnTimeRef = useRef<number>(0);
  const nextSubWaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const { progression, available } = initializeTowerStateForGame();
    setGameState(prev => ({
      ...prev,
      unlockableTowerProgression: progression,
      availableTowerTypes: available,
    }));
  }, []);


  const gridToPixel = useCallback((gridPos: GridPosition): PixelPosition => {
    return {
      x: gridPos.col * gameConfig.cellSize + gameConfig.cellSize / 2,
      y: gridPos.row * gameConfig.cellSize + gameConfig.cellSize / 2,
    };
  }, []);
  
  const resetGame = useCallback(() => {
    if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);
    nextSubWaveTimerRef.current = null;

    const { progression, available } = initializeTowerStateForGame();

    setGameState({
      ...gameConfig.initialGameState,
      selectedTowerType: null,
      placementMode: false,
      waveStartTime: null,
      unlockableTowerProgression: progression,
      availableTowerTypes: available,
    });
    
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
    lastTickTimeRef.current = performance.now();
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

  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const startNextWave = useCallback(() => {
    if (gameStateRef.current.gameStatus === 'subWaveInProgress' || gameStateRef.current.isGameOver || gameStateRef.current.gameStatus === 'gameWon') return;
    if (nextSubWaveTimerRef.current) {
        clearTimeout(nextSubWaveTimerRef.current);
        nextSubWaveTimerRef.current = null;
    }

    let nextOverallSubWaveToProcess = gameStateRef.current.currentOverallSubWave + 1;
    if (gameStateRef.current.gameStatus === 'initial') nextOverallSubWaveToProcess = 1;

    const totalPossibleSubWaves = gameConfig.totalMainWaves * gameConfig.subWavesPerMain;
    if (nextOverallSubWaveToProcess > totalPossibleSubWaves) {
      setGameState(prev => ({ ...prev, gameStatus: 'gameWon' }));
      return;
    }

    const mainWaveIndex = Math.floor((nextOverallSubWaveToProcess - 1) / gameConfig.subWavesPerMain); // 0-indexed for array access
    const subWaveInMainIndexActual = (nextOverallSubWaveToProcess - 1) % gameConfig.subWavesPerMain; // 0-indexed
    
    const currentMainWaveConfig = gameConfig.mainWaves[mainWaveIndex];
    if (!currentMainWaveConfig || !currentMainWaveConfig.subWaves[subWaveInMainIndexActual]) {
      console.error(`Wave config not found for Main: ${mainWaveIndex + 1}, Sub: ${subWaveInMainIndexActual + 1} (Overall: ${nextOverallSubWaveToProcess})`);
      setGameState(prev => ({ ...prev, gameStatus: 'betweenMainWaves' })); // Or gameWon if all waves truly done
      return;
    }
    const currentSubWaveConfig = currentMainWaveConfig.subWaves[subWaveInMainIndexActual];
    
    const newEnemiesToSpawn: Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>> = [];
    currentSubWaveConfig.enemies.forEach(enemyGroup => {
      const enemyTypeData = ENEMY_TYPES[enemyGroup.type];
      if (!enemyTypeData) {
        console.warn(`Enemy type ${enemyGroup.type} not found in ENEMY_TYPES`);
        return;
      }
      for (let k = 0; k < enemyGroup.count; k++) {
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
    nextSpawnTimeRef.current = performance.now() + (currentSubWaveConfig.spawnIntervalMs / gameStateRef.current.gameSpeed);

    let updatedAvailableTowers = [...gameStateRef.current.availableTowerTypes];
    // Tower unlocking logic at the start of a new main wave
    if (subWaveInMainIndexActual === 0 && gameStateRef.current.unlockableTowerProgression.length > 0) {
        const currentUnlockedCount = updatedAvailableTowers.length;
        const mainWaveForDisplay = mainWaveIndex + 1; // 1-indexed
        let targetUnlockCount = currentUnlockedCount;

        if (mainWaveForDisplay === 1) { // Start of Main Wave 1
            targetUnlockCount = 1; // Should already be 1 from initialization
        } else if (mainWaveForDisplay === 2) { // Start of Main Wave 2 (after MW1 completion)
            targetUnlockCount = Math.min(3, gameStateRef.current.unlockableTowerProgression.length);
        } else { // Start of Main Wave 3+
            if (currentUnlockedCount < gameConfig.maxUnlockableTowers) {
                targetUnlockCount = Math.min(currentUnlockedCount + 1, gameStateRef.current.unlockableTowerProgression.length);
            }
        }
        
        if (targetUnlockCount > currentUnlockedCount) {
            for (let i = currentUnlockedCount; i < targetUnlockCount; i++) {
                const towerToUnlock = gameStateRef.current.unlockableTowerProgression[i];
                if (towerToUnlock && !updatedAvailableTowers.includes(towerToUnlock)) {
                    updatedAvailableTowers.push(towerToUnlock);
                }
            }
        }
    }

    setGameState(prev => ({
      ...prev,
      currentOverallSubWave: nextOverallSubWaveToProcess,
      currentMainWaveDisplay: currentMainWaveConfig.mainWaveNumber,
      currentSubWaveInMainDisplay: currentSubWaveConfig.subWaveInMainIndex,
      gameStatus: 'subWaveInProgress',
      waveStartTime: performance.now(),
      availableTowerTypes: updatedAvailableTowers,
    }));

    if (!gameLoopRef.current) {
      lastTickTimeRef.current = performance.now();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }

  }, []); // gridToPixel removed as it's stable, gameState direct access via ref


  const gameLoop = useCallback((currentTime: number) => {
    const currentGameState = gameStateRef.current; // Use ref for freshest state
    if (currentGameState.isGameOver || currentGameState.gameStatus === 'gameWon') { 
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
      return;
    }
    
    const deltaTime = (currentTime - lastTickTimeRef.current) / 1000 * currentGameState.gameSpeed; 
    lastTickTimeRef.current = currentTime; // Update lastTickTime at the START of the loop processing for this frame
    
    // Spawn new enemies if it's time
    if (currentGameState.gameStatus === 'subWaveInProgress' && enemiesToSpawnRef.current.length > 0 && currentTime >= nextSpawnTimeRef.current) {
        const enemyToSpawnData = enemiesToSpawnRef.current.shift();
        if (enemyToSpawnData) {
            const startPos = gridToPixel(gameConfig.enemyPath[0]);
            const newEnemy: Enemy = { ...enemyToSpawnData, id: uuidv4(), x: startPos.x, y: startPos.y, pathIndex: 0 };
            setEnemies(prev => [...prev, newEnemy]);
        }
        if (enemiesToSpawnRef.current.length > 0) { // If there are still enemies to spawn for this sub-wave
            const mainWaveIdx = Math.floor((currentGameState.currentOverallSubWave - 1) / gameConfig.subWavesPerMain);
            const subWaveIdx = (currentGameState.currentOverallSubWave - 1) % gameConfig.subWavesPerMain;
            const subWaveConf = gameConfig.mainWaves[mainWaveIdx]?.subWaves[subWaveIdx];
            nextSpawnTimeRef.current = currentTime + ((subWaveConf?.spawnIntervalMs || 1000) / currentGameState.gameSpeed);
        }
    }

    // Update enemy positions and handle reaching end of path
    setEnemies(prevEnemies => {
      let newPlayerHealth = currentGameState.playerHealth; 
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
        return enemy.health > 0; // Also filter out enemies that might have been marked for removal but not processed yet
      });
      if (healthChanged) {
        // Defer state update to batch with other game state changes at end of loop if possible
        // For now, direct update:
         setGameState(prev => ({ ...prev, playerHealth: newPlayerHealth, isGameOver: newPlayerHealth <= 0 ? true : prev.isGameOver, gameStatus: newPlayerHealth <=0 ? 'gameOver' : prev.gameStatus }));
      }
      return updatedEnemies;
    });

    // Tower targeting and firing
    const currentEnemiesForTargeting = enemiesRef.current; // Use ref for enemies here
    setTowers(prevTowers => prevTowers.map(tower => {
      if (currentTime < tower.lastShotTime + (1000 / tower.stats.fireRate / currentGameState.gameSpeed)) return tower; 
      
      let target: Enemy | null = null;
      let minDistance = tower.stats.range + 1;

      currentEnemiesForTargeting.forEach(enemy => { 
        const distance = Math.sqrt(Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2));
        if (distance <= tower.stats.range && distance < minDistance) {
          minDistance = distance; target = enemy;
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
            targetPosition: { x: target.x, y: target.y } // Store initial target position
        };
        setProjectiles(prev => [...prev, newProjectile]);
        const angleToTarget = Math.atan2(target.y - tower.y, target.x - tower.x) * (180 / Math.PI) + 90; // Adjust for tower sprite
        return { ...tower, lastShotTime: currentTime, targetId: target.id, rotation: angleToTarget };
      }
      return { ...tower, targetId: undefined, rotation: tower.rotation }; // Keep current rotation if no target
    }));

    // Update projectiles and handle hits
    const currentEnemiesForProjectileLogic = enemiesRef.current; // Use ref
    setProjectiles(prevProjectiles => {
      const damageToApply: Record<string, { totalDamage: number; value: number }> = {};
      const projectilesThatHitOrExpired = new Set<string>();

      const nextProjectilesState = prevProjectiles.map(p => {
        if (projectilesThatHitOrExpired.has(p.id)) return p; // Already processed

        const currentTarget = currentEnemiesForProjectileLogic.find(e => e.id === p.targetId); 
        const targetPos = currentTarget ? { x: currentTarget.x, y: currentTarget.y } : p.targetPosition; // Use last known if target is gone

        const angle = Math.atan2(targetPos.y - p.y, targetPos.x - p.x);
        const moveDistance = p.speed * deltaTime;
        const distanceToTarget = Math.sqrt(Math.pow(targetPos.x - p.x, 2) + Math.pow(targetPos.y - p.y, 2));
        
        let newX = p.x + Math.cos(angle) * moveDistance;
        let newY = p.y + Math.sin(angle) * moveDistance;

        if (distanceToTarget <= moveDistance) { 
          projectilesThatHitOrExpired.add(p.id);
          if (currentTarget) { // Apply damage only if target still exists
            if (!damageToApply[currentTarget.id]) damageToApply[currentTarget.id] = { totalDamage: 0, value: currentTarget.value };
            damageToApply[currentTarget.id].totalDamage += p.damage;
          }
        } else if (!currentTarget && Math.abs(newX - targetPos.x) < 1 && Math.abs(newY - targetPos.y) < 1) {
            // Projectile reached last known position of a gone target
            projectilesThatHitOrExpired.add(p.id);
        }
        return { ...p, x: newX, y: newY, targetPosition: targetPos }; // Update projectile's targetPosition if target moves
      });

      if (Object.keys(damageToApply).length > 0) {
        let moneyEarnedThisTick = 0;
        let scoreEarnedThisTick = 0;
        setEnemies(currentEnemiesDamagePhase => {
          const updatedEnemiesAfterDamage = currentEnemiesDamagePhase.map(enemy => {
            if (damageToApply[enemy.id]) {
              const enemyDamageRecord = damageToApply[enemy.id];
              const newHealth = enemy.health - enemyDamageRecord.totalDamage;
              if (newHealth <= 0) {
                moneyEarnedThisTick += enemyDamageRecord.value;
                scoreEarnedThisTick += enemyDamageRecord.value; 
                return null; // Mark for removal
              }
              return { ...enemy, health: newHealth };
            }
            return enemy;
          }).filter(Boolean) as Enemy[]; // Remove nulls (defeated enemies)
          
          if (moneyEarnedThisTick > 0 || scoreEarnedThisTick > 0) {
            setGameState(prevGameState => ({ ...prevGameState, money: prevGameState.money + moneyEarnedThisTick, score: prevGameState.score + scoreEarnedThisTick }));
          }
          return updatedEnemiesAfterDamage;
        });
      }
      return nextProjectilesState.filter(p => !projectilesThatHitOrExpired.has(p.id));
    });
    
    // Wave transition logic (check after all updates in this tick)
    const finalEnemies = enemiesRef.current;
    const finalEnemiesToSpawn = enemiesToSpawnRef.current;

    if (currentGameState.gameStatus === 'subWaveInProgress' && finalEnemies.length === 0 && finalEnemiesToSpawn.length === 0) {
        const mainWaveIdx = Math.floor((currentGameState.currentOverallSubWave - 1) / gameConfig.subWavesPerMain);
        const subWaveIdx = (currentGameState.currentOverallSubWave - 1) % gameConfig.subWavesPerMain;
        const subWaveConf = gameConfig.mainWaves[mainWaveIdx]?.subWaves[subWaveIdx];

        if (subWaveConf && subWaveConf.subWaveInMainIndex < gameConfig.subWavesPerMain) {
            setGameState(prev => ({ ...prev, gameStatus: 'waitingForNextSubWave' }));
            if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);
            nextSubWaveTimerRef.current = setTimeout(() => {
                if(gameStateRef.current.gameStatus === 'waitingForNextSubWave') { 
                    startNextWave();
                }
            }, (subWaveConf.postSubWaveDelayMs || 2500) / currentGameState.gameSpeed);
        } else { 
            if (currentGameState.currentOverallSubWave >= gameConfig.totalMainWaves * gameConfig.subWavesPerMain) {
                setGameState(prev => ({ ...prev, gameStatus: 'gameWon' }));
            } else {
                setGameState(prev => ({ ...prev, gameStatus: 'betweenMainWaves' }));
            }
        }
    }
    
    // Continue loop if game is active
    if (currentGameState.gameStatus === 'subWaveInProgress' || 
        currentGameState.gameStatus === 'waitingForNextSubWave' || 
        (projectilesRef.current.length > 0 && !currentGameState.isGameOver && currentGameState.gameStatus !== 'gameWon')) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else {
        if(gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
    }
  }, [gridToPixel]); // Removed gameState, startNextWave. Relies on gameStateRef now.

  const enemiesRef = useRef(enemies);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);

  const projectilesRef = useRef(projectiles);
  useEffect(() => { projectilesRef.current = projectiles; }, [projectiles]);


  useEffect(() => {
    // This effect now primarily manages starting/stopping the loop based on high-level game status.
    // The loop itself will call requestAnimationFrame for continuation.
    const currentGameState = gameStateRef.current;
    let shouldLoopRun = (currentGameState.gameStatus === 'subWaveInProgress' || 
                        currentGameState.gameStatus === 'waitingForNextSubWave' || 
                        (projectilesRef.current.length > 0 && !currentGameState.isGameOver && currentGameState.gameStatus !== 'gameWon'));

    if (shouldLoopRun) {
      if (!gameLoopRef.current) { 
        lastTickTimeRef.current = performance.now(); // Ensure tick time is current before starting loop
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      }
    } else { 
      if (gameLoopRef.current) { 
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
    }
    
    // Cleanup function for the effect
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);
    };
  }, [gameState.gameStatus, gameState.isGameOver, gameState.gameSpeed, projectiles.length, gameLoop]); // gameLoop is stable due to its own useCallback deps


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
    setGameState // Expose setGameState if direct manipulation is needed, e.g., for game speed
  };
}
