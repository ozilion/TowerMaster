
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, PlacedTower, Enemy, Projectile, TowerCategory, PlacementSpot, GridPosition, PixelPosition, TowerLevelStats, MainWave, SubWave, EnemyType, InitialGameStateConfig } from '@/types/game';
import gameConfig, { ENEMY_TYPES, TOWER_TYPES, ALL_TOWER_IDS as allTowerCategoriesFromConfig } from '@/config/gameConfig'; // Ensure simplified config is used

// Simple ID generator to replace uuid
let nextGeneratedId = 0;
const generateId = () => {
  nextGeneratedId++;
  return `id-${nextGeneratedId}`;
};

const getStatsForLevel = (towerType: TowerCategory, level: 1 | 2 | 3): TowerLevelStats => {
  const definition = TOWER_TYPES[towerType];
  if (!definition) {
    // Fallback for tower types not in the simplified TOWER_TYPES for diagnostics
    console.warn(`Tower definition for ${towerType} not found. Using default.`);
    return { level, damage: 5, range: gameConfig.cellSize * 2, fireRate: 0.5, projectileSpeed: 250, color: 'grey' };
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

export function useGameLogic() {
  const [towers, setTowers] = useState<PlacedTower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [currentPlacementSpots, setCurrentPlacementSpots] = useState<PlacementSpot[]>(
    gameConfig.placementSpots.map(ps => ({...ps, isOccupied: false}))
  );

  // Manually define initial state values instead of spreading gameConfig.initialGameState
  const [gameState, setGameState] = useState<GameState>({
    playerHealth: 20, // From previous manual setup
    money: 200,       // From previous manual setup
    currentOverallSubWave: 0,
    currentMainWaveDisplay: 1,
    currentSubWaveInMainDisplay: 0,
    score: 0,
    isGameOver: false,
    gameSpeed: 1,
    gameStatus: 'initial',
    selectedTowerType: null,
    placementMode: false,
    unlockableTowerProgression: [], // Initialized in useEffect
    availableTowerTypes: [],      // Initialized in useEffect
  });

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

  const enemiesRef = useRef(enemies);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);

  const placementSpotsRef = useRef(currentPlacementSpots);
  useEffect(() => { placementSpotsRef.current = currentPlacementSpots; }, [currentPlacementSpots]);


  const initializeTowerStateForGame = useCallback(() => {
    const allIds = [...allTowerCategoriesFromConfig]; // Use the simplified allTowerIds from config
    const simpleTowerId: TowerCategory = 'simple';
    let progression: TowerCategory[] = [];

    if (allIds.includes(simpleTowerId)) {
      progression.push(simpleTowerId);
      allIds.splice(allIds.indexOf(simpleTowerId), 1);
    } else if (allIds.length > 0) {
      progression.push(allIds.shift()!);
    }
    
    const shuffledRemaining = shuffleArray(allIds);
    progression.push(...shuffledRemaining);

    if (progression.length > gameConfig.maxUnlockableTowers) {
      progression = progression.slice(0, gameConfig.maxUnlockableTowers);
    }
    
    // Ensure 'simple' is first if it's part of the progression
    if (allTowerCategoriesFromConfig.includes(simpleTowerId) && !progression.includes(simpleTowerId) && progression.length < gameConfig.maxUnlockableTowers) {
        progression.unshift(simpleTowerId);
        if(progression.length > gameConfig.maxUnlockableTowers) progression.pop();
    } else if (allTowerCategoriesFromConfig.includes(simpleTowerId) && progression.includes(simpleTowerId) && progression[0] !== simpleTowerId) {
        progression.splice(progression.indexOf(simpleTowerId), 1);
        progression.unshift(simpleTowerId);
    }
    
    setGameState(prev => ({
      ...prev,
      unlockableTowerProgression: progression,
      // Start with only the first tower from progression, or 'simple' if progression is empty
      availableTowerTypes: progression.length > 0 ? [progression[0]] : (allTowerCategoriesFromConfig.includes('simple') ? ['simple'] : []),
    }));
  }, []);


  useEffect(() => {
    initializeTowerStateForGame();
    // Reset ID generator on game init/reset for consistency if needed, though for global counter it's fine
    nextGeneratedId = 0; 
  }, [initializeTowerStateForGame]);


  const gridToPixel = useCallback((gridPos: GridPosition): PixelPosition => {
    return {
      x: gridPos.col * gameConfig.cellSize + gameConfig.cellSize / 2,
      y: gridPos.row * gameConfig.cellSize + gameConfig.cellSize / 2,
    };
  }, []);

  const resetGame = useCallback(() => {
    if (nextSubWaveTimerRef.current) {
      clearTimeout(nextSubWaveTimerRef.current);
      nextSubWaveTimerRef.current = null;
    }
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    nextGeneratedId = 0; // Reset ID counter

    setGameState({
      playerHealth: 20, // Reset to hardcoded initial values
      money: 200,
      currentOverallSubWave: 0,
      currentMainWaveDisplay: 1,
      currentSubWaveInMainDisplay: 0,
      score: 0,
      isGameOver: false,
      gameSpeed: 1,
      gameStatus: 'initial',
      selectedTowerType: null,
      placementMode: false,
      unlockableTowerProgression: [], // Re-initialized by initializeTowerStateForGame
      availableTowerTypes: [],      // Re-initialized by initializeTowerStateForGame
    });

    setTowers([]);
    setEnemies([]);
    setProjectiles([]);
    setCurrentPlacementSpots(gameConfig.placementSpots.map(ps => ({...ps, isOccupied: false})));
    enemiesToSpawnRef.current = [];
    nextSpawnTimeRef.current = 0;
    // initializeTowerStateForGame will be called by its own useEffect
  }, [initializeTowerStateForGame]);

  const placeTower = useCallback((spot: PlacementSpot, towerType: TowerCategory) => {
    if (spot.isOccupied) return { success: false, message: "Spot is occupied."};
    const definition = TOWER_TYPES[towerType];
    if (!definition) return { success: false, message: "Tower definition not found."};

    const currentMoney = gameStateRef.current.money;
    if (currentMoney < definition.baseCost) return { success: false, message: `Not enough money. Cost: ${definition.baseCost}`};

    const pixelPos = gridToPixel(spot);
    const newTower: PlacedTower = {
      id: generateId(), // Use new ID generator
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
    return { success: true, message: `${definition.name} placed.` };
  }, [gridToPixel]);

  const attemptMergeTowers = useCallback((tower1Id: string, tower2Id: string): { success: boolean; message: string; resultingTower?: PlacedTower } => {
    const tower1 = towersRef.current.find(t => t.id === tower1Id);
    const tower2 = towersRef.current.find(t => t.id === tower2Id);

    if (!tower1 || !tower2) return { success: false, message: 'One or both towers not found.' };
    if (tower1.type !== tower2.type || tower1.level !== tower2.level) return { success: false, message: 'Towers must be of the same type and level to merge.' };
    if (tower1.level >= 3) return { success: false, message: 'Tower is already at max level (Level 3).' };

    const nextLevel = (tower1.level + 1) as 2 | 3;
    const towerDefinition = TOWER_TYPES[tower1.type];
    if (!towerDefinition) return { success: false, message: 'Tower definition not found for merge.' };

    const mergeCost = towerDefinition.levels[nextLevel]?.mergeCost ?? Infinity;

    const currentMoney = gameStateRef.current.money;
    if (currentMoney < mergeCost) return { success: false, message: `Not enough money for merge. Required: ${mergeCost}, Have: ${currentMoney}` };

    const newStats = getStatsForLevel(tower1.type, nextLevel);
    const mergedTower: PlacedTower = { ...tower1, level: nextLevel, stats: newStats, lastShotTime: 0 };

    setTowers(prevTowers => [mergedTower, ...prevTowers.filter(t => t.id !== tower1Id && t.id !== tower2Id)]);
    setGameState(prev => ({ ...prev, money: prev.money - mergeCost }));

    const spotOfTower2 = placementSpotsRef.current.find(s => {
      const spotPx = gridToPixel(s);
      return Math.abs(tower2.x - spotPx.x) < gameConfig.cellSize / 2 && Math.abs(tower2.y - spotPx.y) < gameConfig.cellSize / 2;
    });
    if (spotOfTower2) setCurrentPlacementSpots(prevSpots => prevSpots.map(s => s.id === spotOfTower2.id ? {...s, isOccupied: false} : s));

    return { success: true, message: `${towerDefinition.name} upgraded to Level ${nextLevel}!`, resultingTower: mergedTower };
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
    if (nextSubWaveTimerRef.current) {
        clearTimeout(nextSubWaveTimerRef.current);
        nextSubWaveTimerRef.current = null;
    }

    const currentGS = gameStateRef.current;
    if (currentGS.gameStatus === 'subWaveInProgress' && enemiesRef.current.length > 0) return;
    if (currentGS.isGameOver || currentGS.gameStatus === 'gameWon') return;

    let nextOverallSubWaveToProcess = currentGS.currentOverallSubWave;
    if (currentGS.gameStatus === 'initial' || currentGS.gameStatus === 'betweenMainWaves' || currentGS.gameStatus === 'waitingForNextSubWave') {
      nextOverallSubWaveToProcess = currentGS.currentOverallSubWave + 1;
    }
    if (currentGS.gameStatus === 'initial' && currentGS.currentOverallSubWave === 0) {
      nextOverallSubWaveToProcess = 1;
    }

    const totalPossibleSubWaves = gameConfig.totalMainWaves * gameConfig.subWavesPerMain;
    if (nextOverallSubWaveToProcess > totalPossibleSubWaves ) {
      if (enemiesRef.current.length === 0 && enemiesToSpawnRef.current.length === 0) {
         setGameState(prev => ({ ...prev, gameStatus: 'gameWon' }));
      }
      return;
    }

    const mainWaveIndex = Math.floor((nextOverallSubWaveToProcess - 1) / gameConfig.subWavesPerMain);
    const subWaveInMainIndexActual = (nextOverallSubWaveToProcess - 1) % gameConfig.subWavesPerMain;

    const currentMainWaveConfig = gameConfig.mainWaves[mainWaveIndex];
    if (!currentMainWaveConfig) {
      if (enemiesRef.current.length === 0 && enemiesToSpawnRef.current.length === 0) {
        setGameState(prev => ({ ...prev, gameStatus: prev.currentOverallSubWave >= totalPossibleSubWaves ? 'gameWon' : 'betweenMainWaves' }));
      }
      return;
    }
    const currentSubWaveConfig = currentMainWaveConfig.subWaves[subWaveInMainIndexActual];
     if (!currentSubWaveConfig) {
       if (enemiesRef.current.length === 0 && enemiesToSpawnRef.current.length === 0) {
         setGameState(prev => ({ ...prev, gameStatus: 'betweenMainWaves'}));
       }
       return;
    }

    const newEnemiesToSpawn: Array<Omit<Enemy, 'id' | 'x' | 'y' | 'pathIndex'>>> = [];
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
    nextSpawnTimeRef.current = performance.now();

    let updatedAvailableTowers = [...currentGS.availableTowerTypes];
    const progression = currentGS.unlockableTowerProgression;
    const currentMainWaveNumberForDisplay = mainWaveIndex + 1; 

    if (subWaveInMainIndexActual === 0 && progression.length > 0) { 
        if (currentMainWaveNumberForDisplay === 1 && progression[0] && !updatedAvailableTowers.includes(progression[0])) {
            // This is handled by initializeTowerStateForGame
        } else if (currentMainWaveNumberForDisplay === 2) { 
            const towersToUnlockCount = Math.min(3, progression.length);
            for (let i = 0; i < towersToUnlockCount; i++) {
                if (progression[i] && !updatedAvailableTowers.includes(progression[i])) {
                    updatedAvailableTowers.push(progression[i]);
                }
            }
        } else if (currentMainWaveNumberForDisplay > 2) { 
            const nextTowerIndex = updatedAvailableTowers.length;
            if (nextTowerIndex < progression.length && nextTowerIndex < gameConfig.maxUnlockableTowers) {
                if (progression[nextTowerIndex] && !updatedAvailableTowers.includes(progression[nextTowerIndex])) {
                    updatedAvailableTowers.push(progression[nextTowerIndex]);
                }
            }
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
  }, [gridToPixel]);


  const gameLoop = useCallback((currentTime: number) => {
    if (!gameLoopRef.current) return; // Loop was cancelled

    const currentGameState = gameStateRef.current; // Use ref for freshest state inside loop
    const deltaTime = (currentTime - lastTickTimeRef.current) / 1000 * currentGameState.gameSpeed;
    lastTickTimeRef.current = currentTime; // Update lastTickTime at the beginning of the loop processing


    if (currentGameState.gameStatus === 'subWaveInProgress' && enemiesToSpawnRef.current.length > 0 && currentTime >= nextSpawnTimeRef.current) {
        const enemyToSpawnData = enemiesToSpawnRef.current.shift();
        if (enemyToSpawnData) {
            const startPos = gridToPixel(gameConfig.enemyPath[0]);
            const newEnemy: Enemy = { ...enemyToSpawnData, id: generateId(), x: startPos.x, y: startPos.y, pathIndex: 0 }; // Use new ID generator
            setEnemies(prev => [...prev, newEnemy]);
        }
        if (enemiesToSpawnRef.current.length > 0) {
            const mainWaveIdx = Math.floor((currentGameState.currentOverallSubWave - 1) / gameConfig.subWavesPerMain);
            const subWaveIdx = (currentGameState.currentOverallSubWave - 1) % gameConfig.subWavesPerMain;
            const subWaveConf = gameConfig.mainWaves[mainWaveIdx]?.subWaves[subWaveIdx];
            nextSpawnTimeRef.current = currentTime + ((subWaveConf?.spawnIntervalMs || 1000) / currentGameState.gameSpeed);
        }
    }

    setEnemies(prevEnemies => {
      let newPlayerHealth = gameStateRef.current.playerHealth; // Use ref for current health
      let healthChanged = false;
      const updatedEnemies = prevEnemies.map(enemy => {
        if (enemy.pathIndex >= gameConfig.enemyPath.length - 1) return enemy; // Already at exit
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
          return false; // Remove enemy that reached the end
        }
        return enemy.health > 0; // Keep enemy if health > 0
      });
      if (healthChanged && newPlayerHealth !== gameStateRef.current.playerHealth) {
         setGameState(prev => ({ ...prev, playerHealth: newPlayerHealth, isGameOver: newPlayerHealth <= 0, gameStatus: newPlayerHealth <=0 ? 'gameOver' : prev.gameStatus }));
      }
      return updatedEnemies;
    });

    setTowers(prevTowers => prevTowers.map(tower => {
      if (currentTime < tower.lastShotTime + (1000 / tower.stats.fireRate / currentGameState.gameSpeed)) return tower;

      let target: Enemy | null = null;
      let minDistance = tower.stats.range + 1;

      enemiesRef.current.forEach(enemy => { // Use ref for current enemies
        const distance = Math.sqrt(Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2));
        if (distance <= tower.stats.range && distance < minDistance) {
          minDistance = distance; target = enemy;
        }
      });

      if (target) {
        const newProjectile: Projectile = {
            id: generateId(), towerId: tower.id, targetId: target.id, x: tower.x, y: tower.y, // Use new ID generator
            damage: tower.stats.damage, speed: tower.stats.projectileSpeed || 200, color: tower.stats.color,
            targetPosition: { x: target.x, y: target.y }
        };
        setProjectiles(prev => [...prev, newProjectile]);
        const angleToTarget = Math.atan2(target.y - tower.y, target.x - tower.x) * (180 / Math.PI) + 90;
        return { ...tower, lastShotTime: currentTime, targetId: target.id, rotation: angleToTarget };
      }
      return { ...tower, targetId: undefined, rotation: tower.rotation }; // Keep current rotation if no target
    }));

    setProjectiles(prevProjectiles => {
      const damageToApply: Record<string, { totalDamage: number; value: number }> = {};
      const projectilesThatHitOrExpired = new Set<string>();

      const nextProjectilesState = prevProjectiles.map(p => {
        if (projectilesThatHitOrExpired.has(p.id)) return p;

        const currentTarget = enemiesRef.current.find(e => e.id === p.targetId); // Use ref
        const targetPos = currentTarget ? { x: currentTarget.x, y: currentTarget.y } : p.targetPosition;

        const angle = Math.atan2(targetPos.y - p.y, targetPos.x - p.x);
        const moveDistance = p.speed * deltaTime;
        const distanceToTarget = Math.sqrt(Math.pow(targetPos.x - p.x, 2) + Math.pow(targetPos.y - p.y, 2));

        let newX = p.x + Math.cos(angle) * moveDistance;
        let newY = p.y + Math.sin(angle) * moveDistance;

        if (distanceToTarget <= moveDistance) {
          projectilesThatHitOrExpired.add(p.id);
          if (currentTarget) { // Only apply damage if target still exists
            if (!damageToApply[currentTarget.id]) damageToApply[currentTarget.id] = { totalDamage: 0, value: currentTarget.value };
            damageToApply[currentTarget.id].totalDamage += p.damage;
          }
        } else if (!currentTarget && Math.abs(newX - targetPos.x) < 1 && Math.abs(newY - targetPos.y) < 1) {
            // Projectile reached last known position of a disappeared target
            projectilesThatHitOrExpired.add(p.id);
        }
        return { ...p, x: newX, y: newY, targetPosition: targetPos }; // Update targetPosition continuously
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
                scoreEarnedThisTick += enemyDamageRecord.value; // Assuming score = value for now
                return null; // Mark for removal
              }
              return { ...enemy, health: newHealth };
            }
            return enemy;
          }).filter(Boolean) as Enemy[]; // Remove nulls (killed enemies)

          if (moneyEarnedThisTick > 0 || scoreEarnedThisTick > 0) {
            setGameState(prevGameState => ({ ...prevGameState, money: prevGameState.money + moneyEarnedThisTick, score: prevGameState.score + scoreEarnedThisTick }));
          }
          return updatedEnemiesAfterDamage;
        });
      }
      return nextProjectilesState.filter(p => !projectilesThatHitOrExpired.has(p.id));
    });

    const finalEnemies = enemiesRef.current; // Use ref
    const finalEnemiesToSpawn = enemiesToSpawnRef.current;
    const currentGSForTransition = gameStateRef.current; // Use ref

    if (currentGSForTransition.gameStatus === 'subWaveInProgress' && finalEnemies.length === 0 && finalEnemiesToSpawn.length === 0) {
        const mainWaveIdx = Math.floor((currentGSForTransition.currentOverallSubWave - 1) / gameConfig.subWavesPerMain);
        const subWaveIdx = (currentGSForTransition.currentOverallSubWave - 1) % gameConfig.subWavesPerMain;
        const subWaveConf = gameConfig.mainWaves[mainWaveIdx]?.subWaves[subWaveIdx];

        if (subWaveConf && (subWaveIdx + 1) < gameConfig.subWavesPerMain) {
            setGameState(prev => ({ ...prev, gameStatus: 'waitingForNextSubWave' }));
            // Clear any existing timer before setting a new one
            if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);
            nextSubWaveTimerRef.current = setTimeout(() => {
                // Check game status again inside timeout to prevent starting wave if game ended/reset
                if(gameStateRef.current.gameStatus === 'waitingForNextSubWave') { // Use ref
                    startNextWave();
                }
            }, (subWaveConf.postSubWaveDelayMs || 2500) / currentGSForTransition.gameSpeed);
        } else { // End of a main wave
            if (currentGSForTransition.currentOverallSubWave >= gameConfig.totalMainWaves * gameConfig.subWavesPerMain) {
                setGameState(prev => ({ ...prev, gameStatus: 'gameWon' }));
            } else {
                setGameState(prev => ({ ...prev, gameStatus: 'betweenMainWaves' }));
            }
        }
    }

    if (gameLoopRef.current) { // Check if it wasn't cancelled by a state change
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gridToPixel, startNextWave]);


  useEffect(() => {
    let loopShouldBeRunning = false;
    // Use direct gameState values for conditions driving the effect itself
    if (gameState.gameStatus === 'subWaveInProgress' && !gameState.isGameOver && gameState.gameStatus !== 'gameWon') {
        loopShouldBeRunning = true;
    } else if (
        (gameState.gameStatus === 'waitingForNextSubWave' || projectilesRef.current.length > 0) && // Check ref for projectiles
        !gameState.isGameOver && gameState.gameStatus !== 'gameWon'
    ) {
        loopShouldBeRunning = true;
    }

    if (gameState.isGameOver || gameState.gameStatus === 'gameWon') {
        loopShouldBeRunning = false;
    }

    if (loopShouldBeRunning) {
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
    // Cleanup function is important
    return () => {
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
            gameLoopRef.current = undefined;
        }
        // Do NOT clear nextSubWaveTimerRef.current here, it's managed by startNextWave and game end states
    };
  }, [gameState.gameStatus, gameState.isGameOver, gameState.gameWon, projectiles.length, gameLoop]); // projectiles.length is fine here


  // Effect to specifically handle cleaning up timers when the game truly ends or is reset
  useEffect(() => {
    if (gameState.isGameOver || gameState.gameStatus === 'gameWon') {
      if (nextSubWaveTimerRef.current) {
        clearTimeout(nextSubWaveTimerRef.current);
        nextSubWaveTimerRef.current = null;
      }
      // Ensure game loop is stopped (already handled by the main useEffect, but good for clarity)
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
    }
  }, [gameState.isGameOver, gameState.gameWon]);

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

    