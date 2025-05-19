
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, PlacedTower, Enemy, Projectile, TowerCategory, PlacementSpot, GridPosition, PixelPosition, TowerLevelStats, MainWave, SubWave, EnemyType } from '@/types/game';
import gameConfig, { ENEMY_TYPES, TOWER_TYPES } from '@/config/gameConfig';
import { v4 as uuidv4 } from 'uuid';

const getStatsForLevel = (towerType: TowerCategory, level: 1 | 2 | 3): TowerLevelStats => {
  const definition = TOWER_TYPES[towerType];
  if (!definition) {
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
  const allDefinedTowerIds = [...gameConfig.allTowerIds];
  const simpleTowerId: TowerCategory = 'simple';
  let firstTower: TowerCategory = simpleTowerId;

  const simpleTowerIndex = allDefinedTowerIds.indexOf(simpleTowerId);
  if (simpleTowerIndex !== -1) {
    allDefinedTowerIds.splice(simpleTowerIndex, 1);
  } else if (allDefinedTowerIds.length > 0) {
    firstTower = allDefinedTowerIds[0];
    allDefinedTowerIds.splice(0, 1);
  } else {
    return { progression: [], available: [] };
  }

  const shuffledRemainingTowers = shuffleArray(allDefinedTowerIds);
  progressionSequence = [firstTower, ...shuffledRemainingTowers];

  if (progressionSequence.length > gameConfig.maxUnlockableTowers) {
    progressionSequence = progressionSequence.slice(0, gameConfig.maxUnlockableTowers);
  }
  
  // Ensure firstTower (e.g. 'simple') is indeed the first element if it was part of original set
  if (progressionSequence[0] !== firstTower && gameConfig.allTowerIds.includes(firstTower)) {
     const ftIndex = progressionSequence.indexOf(firstTower);
     if (ftIndex > 0) { // if simple is in the list but not first, move it to first
        progressionSequence.splice(ftIndex, 1);
        progressionSequence.unshift(firstTower);
     } else if (ftIndex === -1) { // if simple was somehow excluded but should be there
        progressionSequence.unshift(firstTower); // Add it
        if(progressionSequence.length > gameConfig.maxUnlockableTowers) {
            progressionSequence.pop(); // Keep max size
        }
     }
  }


  return {
    progression: progressionSequence,
    available: [firstTower], 
  };
};


export function useGameLogic() {
  const [towers, setTowers] = useState<PlacedTower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [currentPlacementSpots, setCurrentPlacementSpots] = useState<PlacementSpot[]>(
    gameConfig.placementSpots.map(ps => ({...ps, isOccupied: false}))
  );
  
  const initialGameStateSetup = {
    ...gameConfig.initialGameState,
    selectedTowerType: null,
    placementMode: false,
    unlockableTowerProgression: [], 
    availableTowerTypes: [],      
  };
  const [gameState, setGameState] = useState<GameState>(initialGameStateSetup);

  const gameLoopRef = useRef<number>();
  const enemiesToSpawnRef = useRef<Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>>>([])
  const nextSpawnTimeRef = useRef<number>(0);
  const nextSubWaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickTimeRef = useRef<number>(performance.now());

  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  
  const towersRef = useRef(towers);
  useEffect(() => { towersRef.current = towers; }, [towers]);

  const projectilesRef = useRef(projectiles);
  useEffect(() => { projectilesRef.current = projectiles; }, [projectiles]);

  const enemiesRef = useRef(enemies); // Ensure enemiesRef is defined
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]); // Keep enemiesRef.current updated

  const placementSpotsRef = useRef(currentPlacementSpots);
  useEffect(() => { placementSpotsRef.current = currentPlacementSpots; }, [currentPlacementSpots]);

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
  }, []); 

  const placeTower = useCallback((spot: PlacementSpot, towerType: TowerCategory) => {
    if (spot.isOccupied) return;
    const definition = TOWER_TYPES[towerType];
    if (!definition) return;

    const currentMoney = gameStateRef.current.money; 
    if (currentMoney < definition.baseCost) return;

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
  }, [gridToPixel]); 

  const attemptMergeTowers = useCallback((tower1Id: string, tower2Id: string): { success: boolean; message: string; resultingTower?: PlacedTower } => {
    const tower1 = towersRef.current.find(t => t.id === tower1Id); 
    const tower2 = towersRef.current.find(t => t.id === tower2Id); 

    if (!tower1 || !tower2) return { success: false, message: 'Kulelerden biri veya her ikisi bulunamadı.' };
    if (tower1.type !== tower2.type || tower1.level !== tower2.level) return { success: false, message: 'Kuleler aynı tipte ve aynı seviyede olmalıdır.' };
    if (tower1.level >= 3) return { success: false, message: 'Kule zaten maksimum seviyede (Seviye 3).' };

    const nextLevel = (tower1.level + 1) as 2 | 3;
    const towerDefinition = TOWER_TYPES[tower1.type];
    const mergeCost = towerDefinition.levels[nextLevel].mergeCost || 0;
    
    const currentMoney = gameStateRef.current.money; 
    if (currentMoney < mergeCost) return { success: false, message: `Yetersiz para. Gerekli: ${mergeCost}, Mevcut: ${currentMoney}` };

    const newStats = getStatsForLevel(tower1.type, nextLevel);
    const mergedTower: PlacedTower = { ...tower1, level: nextLevel, stats: newStats, lastShotTime: 0 };
    
    setTowers(prevTowers => [mergedTower, ...prevTowers.filter(t => t.id !== tower1Id && t.id !== tower2Id)]);
    setGameState(prev => ({ ...prev, money: prev.money - mergeCost }));
    
    const spotOfTower2 = placementSpotsRef.current.find(s => { 
      const spotPx = gridToPixel(s);
      return Math.abs(tower2.x - spotPx.x) < gameConfig.cellSize / 2 && Math.abs(tower2.y - spotPx.y) < gameConfig.cellSize / 2;
    });
    if (spotOfTower2) setCurrentPlacementSpots(prevSpots => prevSpots.map(s => s.id === spotOfTower2.id ? {...s, isOccupied: false} : s));
    
    return { success: true, message: `${towerDefinition.name} Seviye ${nextLevel}'e yükseltildi!`, resultingTower: mergedTower };
  }, [gridToPixel]);

  const moveTower = useCallback((towerId: string, newSpotId: string): boolean => {
    const towerToMove = towersRef.current.find(t => t.id === towerId); 
    const newSpot = placementSpotsRef.current.find(s => s.id === newSpotId); 

    if (!towerToMove || !newSpot || newSpot.isOccupied) return false;

    const oldSpot = placementSpotsRef.current.find(s => { 
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
  }, [gridToPixel]);


  const startNextWave = useCallback(() => {
    const currentGS = gameStateRef.current;
    if (currentGS.gameStatus === 'subWaveInProgress' || currentGS.isGameOver || currentGS.gameStatus === 'gameWon') return;
    if (nextSubWaveTimerRef.current) {
        clearTimeout(nextSubWaveTimerRef.current);
        nextSubWaveTimerRef.current = null;
    }

    let nextOverallSubWaveToProcess = currentGS.currentOverallSubWave + 1;
    if (currentGS.gameStatus === 'initial') nextOverallSubWaveToProcess = 1;

    const totalPossibleSubWaves = gameConfig.totalMainWaves * gameConfig.subWavesPerMain;
    if (nextOverallSubWaveToProcess > totalPossibleSubWaves) {
      setGameState(prev => ({ ...prev, gameStatus: 'gameWon' }));
      return;
    }

    const mainWaveIndex = Math.floor((nextOverallSubWaveToProcess - 1) / gameConfig.subWavesPerMain);
    const subWaveInMainIndexActual = (nextOverallSubWaveToProcess - 1) % gameConfig.subWavesPerMain;
    
    const currentMainWaveConfig = gameConfig.mainWaves[mainWaveIndex];
    if (!currentMainWaveConfig || !currentMainWaveConfig.subWaves[subWaveInMainIndexActual]) {
      setGameState(prev => ({ ...prev, gameStatus: prev.currentOverallSubWave >= totalPossibleSubWaves ? 'gameWon' : 'betweenMainWaves' }));
      return;
    }
    const currentSubWaveConfig = currentMainWaveConfig.subWaves[subWaveInMainIndexActual];
    
    const newEnemiesToSpawn: Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>> = [];
    currentSubWaveConfig.enemies.forEach(enemyGroup => {
      const enemyTypeData = ENEMY_TYPES[enemyGroup.type];
      if (!enemyTypeData) return;
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
    nextSpawnTimeRef.current = performance.now(); // Initial spawn can happen almost immediately, gameLoop will check interval

    let updatedAvailableTowers = [...currentGS.availableTowerTypes];
    const progression = currentGS.unlockableTowerProgression;
    const currentMainWaveNumberForUnlock = mainWaveIndex + 1;

    if (subWaveInMainIndexActual === 0 && progression.length > 0) { // Start of a new main wave
        const currentUnlockCount = updatedAvailableTowers.length;
        let targetUnlockCount = currentUnlockCount;

        if (currentMainWaveNumberForUnlock === 1 && currentUnlockCount < 1 && progression[0]) {
            targetUnlockCount = 1; 
        } else if (currentMainWaveNumberForUnlock === 2 && currentUnlockCount < Math.min(3, progression.length)) {
            targetUnlockCount = Math.min(3, progression.length);
        } else if (currentMainWaveNumberForUnlock > 2 && currentUnlockCount < gameConfig.maxUnlockableTowers && currentUnlockCount < progression.length) {
            targetUnlockCount = Math.min(currentUnlockCount + 1, progression.length, gameConfig.maxUnlockableTowers);
        }
        
        if (targetUnlockCount > currentUnlockCount) {
            updatedAvailableTowers = progression.slice(0, targetUnlockCount);
        }
    }

    setGameState(prev => ({
      ...prev,
      currentOverallSubWave: nextOverallSubWaveToProcess,
      currentMainWaveDisplay: currentMainWaveConfig.mainWaveNumber,
      currentSubWaveInMainDisplay: currentSubWaveConfig.subWaveInMainIndex + 1, 
      gameStatus: 'subWaveInProgress',
      availableTowerTypes: updatedAvailableTowers,
    }));

    // Ensure game loop starts if not already running
    if (!gameLoopRef.current) {
      lastTickTimeRef.current = performance.now();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gridToPixel, /* gameLoop added further down if needed */ ]); 


  const gameLoop = useCallback((currentTime: number) => {
    const currentGameState = gameStateRef.current; 
    
    const deltaTime = (currentTime - lastTickTimeRef.current) / 1000 * currentGameState.gameSpeed; 
    
    if (currentGameState.gameStatus === 'subWaveInProgress' && enemiesToSpawnRef.current.length > 0 && currentTime >= nextSpawnTimeRef.current) {
        const enemyToSpawnData = enemiesToSpawnRef.current.shift();
        if (enemyToSpawnData) {
            const startPos = gridToPixel(gameConfig.enemyPath[0]);
            const newEnemy: Enemy = { ...enemyToSpawnData, id: uuidv4(), x: startPos.x, y: startPos.y, pathIndex: 0 };
            setEnemies(prev => [...prev, newEnemy]); // This will update enemiesRef.current via its useEffect
        }
        if (enemiesToSpawnRef.current.length > 0) { 
            const mainWaveIdx = Math.floor((currentGameState.currentOverallSubWave - 1) / gameConfig.subWavesPerMain);
            const subWaveIdx = (currentGameState.currentOverallSubWave - 1) % gameConfig.subWavesPerMain;
            const subWaveConf = gameConfig.mainWaves[mainWaveIdx]?.subWaves[subWaveIdx];
            nextSpawnTimeRef.current = currentTime + ((subWaveConf?.spawnIntervalMs || 1000) / currentGameState.gameSpeed);
        }
    }

    setEnemies(prevEnemies => {
      let newPlayerHealth = gameStateRef.current.playerHealth; 
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
        return enemy.health > 0; 
      });
      if (healthChanged) {
         setGameState(prev => ({ ...prev, playerHealth: newPlayerHealth, isGameOver: newPlayerHealth <= 0 ? true : prev.isGameOver, gameStatus: newPlayerHealth <=0 ? 'gameOver' : prev.gameStatus }));
      }
      return updatedEnemies;
    });

    setTowers(prevTowers => prevTowers.map(tower => {
      if (currentTime < tower.lastShotTime + (1000 / tower.stats.fireRate / currentGameState.gameSpeed)) return tower; 
      
      let target: Enemy | null = null;
      let minDistance = tower.stats.range + 1;

      enemiesRef.current.forEach(enemy => { 
        const distance = Math.sqrt(Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2));
        if (distance <= tower.stats.range && distance < minDistance) {
          minDistance = distance; target = enemy;
        }
      });

      if (target) {
        const newProjectile: Projectile = { 
            id: uuidv4(), towerId: tower.id, targetId: target.id, x: tower.x, y: tower.y, 
            damage: tower.stats.damage, speed: tower.stats.projectileSpeed || 200, color: tower.stats.color, 
            targetPosition: { x: target.x, y: target.y } 
        };
        setProjectiles(prev => [...prev, newProjectile]);
        const angleToTarget = Math.atan2(target.y - tower.y, target.x - tower.x) * (180 / Math.PI) + 90;
        return { ...tower, lastShotTime: currentTime, targetId: target.id, rotation: angleToTarget };
      }
      return { ...tower, targetId: undefined, rotation: tower.rotation }; 
    }));

    setProjectiles(prevProjectiles => {
      const damageToApply: Record<string, { totalDamage: number; value: number }> = {};
      const projectilesThatHitOrExpired = new Set<string>();

      const nextProjectilesState = prevProjectiles.map(p => {
        if (projectilesThatHitOrExpired.has(p.id)) return p;

        const currentTarget = enemiesRef.current.find(e => e.id === p.targetId); 
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
        setEnemies(currentEnemiesDamagePhase => {
          const updatedEnemiesAfterDamage = currentEnemiesDamagePhase.map(enemy => {
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
    
    const finalEnemies = enemiesRef.current; // Accessing enemiesRef here
    const finalEnemiesToSpawn = enemiesToSpawnRef.current;
    const currentGSForTransition = gameStateRef.current;

    if (currentGSForTransition.gameStatus === 'subWaveInProgress' && finalEnemies.length === 0 && finalEnemiesToSpawn.length === 0) {
        const mainWaveIdx = Math.floor((currentGSForTransition.currentOverallSubWave - 1) / gameConfig.subWavesPerMain);
        const subWaveIdx = (currentGSForTransition.currentOverallSubWave - 1) % gameConfig.subWavesPerMain;
        const subWaveConf = gameConfig.mainWaves[mainWaveIdx]?.subWaves[subWaveIdx];

        if (subWaveConf && (subWaveIdx + 1) < gameConfig.subWavesPerMain) { 
            setGameState(prev => ({ ...prev, gameStatus: 'waitingForNextSubWave' }));
            if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);
            nextSubWaveTimerRef.current = setTimeout(() => {
                if(gameStateRef.current.gameStatus === 'waitingForNextSubWave') { 
                    startNextWave();
                }
            }, (subWaveConf.postSubWaveDelayMs || 2500) / currentGSForTransition.gameSpeed);
        } else { 
            if (currentGSForTransition.currentOverallSubWave >= gameConfig.totalMainWaves * gameConfig.subWavesPerMain) {
                setGameState(prev => ({ ...prev, gameStatus: 'gameWon' }));
            } else {
                setGameState(prev => ({ ...prev, gameStatus: 'betweenMainWaves' }));
            }
        }
    }
    
    lastTickTimeRef.current = currentTime; 

    const stateAfterFrameLogic = gameStateRef.current;
    const shouldContinueLooping = (
        stateAfterFrameLogic.gameStatus === 'subWaveInProgress' ||
        stateAfterFrameLogic.gameStatus === 'waitingForNextSubWave' ||
        (projectilesRef.current.length > 0 && !stateAfterFrameLogic.isGameOver && stateAfterFrameLogic.gameStatus !== 'gameWon')
    );

    if (shouldContinueLooping) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else {
        gameLoopRef.current = undefined; 
    }
  }, [gridToPixel, startNextWave]); 

  useEffect(() => {
    const currentGameState = gameStateRef.current;
    let loopShouldBeRunning = false;

    if (currentGameState.gameStatus === 'subWaveInProgress' || currentGameState.gameStatus === 'waitingForNextSubWave') {
        loopShouldBeRunning = true;
    } else if (projectilesRef.current.length > 0 && !currentGameState.isGameOver && currentGameState.gameStatus !== 'gameWon') {
        loopShouldBeRunning = true;
    }

    if (loopShouldBeRunning) {
        if (!gameLoopRef.current) {
            lastTickTimeRef.current = performance.now(); // Set time before starting loop
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        }
    } else {
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
            gameLoopRef.current = undefined;
        }
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
      if (nextSubWaveTimerRef.current) {
        clearTimeout(nextSubWaveTimerRef.current);
        nextSubWaveTimerRef.current = null;
      }
    };
  }, [gameState.gameStatus, gameState.isGameOver, gameState.gameSpeed, gameLoop]);


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

