
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, PlacedTower, Enemy, Projectile, TowerCategory, PlacementSpot, GridPosition, PixelPosition, TowerLevelStats, EnemyType, InitialGameStateConfig, SubWaveEnemyConfig } from '@/types/game';
import gameConfig from '@/config/gameConfig';
import { v4 as uuidv4 } from 'uuid';


const getStatsForLevel = (towerType: TowerCategory, level: 1 | 2 | 3): TowerLevelStats => {
  const towerDef = gameConfig.towerTypes[towerType];
  if (!towerDef) throw new Error(`Tower type ${towerType} not found in config`);
  
  const baseStats = towerDef.levels[level];
  return {
    ...baseStats,
    level: level,
    cost: level === 1 ? towerDef.baseCost : undefined,
    mergeCost: level > 1 ? towerDef.levels[level].mergeCost : undefined,
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

const initialHardcodedGameState: GameState = {
  playerHealth: gameConfig.initialGameState.playerHealth,
  money: gameConfig.initialGameState.money,
  currentOverallSubWave: gameConfig.initialGameState.currentOverallSubWave,
  currentMainWaveDisplay: gameConfig.initialGameState.currentMainWaveDisplay,
  currentSubWaveInMainDisplay: gameConfig.initialGameState.currentSubWaveInMainDisplay,
  score: gameConfig.initialGameState.score,
  isGameOver: gameConfig.initialGameState.isGameOver,
  gameSpeed: gameConfig.initialGameState.gameSpeed,
  selectedTowerType: gameConfig.initialGameState.selectedTowerType,
  placementMode: gameConfig.initialGameState.placementMode,
  gameStatus: gameConfig.initialGameState.gameStatus,
  unlockableTowerProgression: [], // Initialized in useEffect
  availableTowerTypes: [],      // Initialized in useEffect
  waveStartTime: gameConfig.initialGameState.waveStartTime,
};


export function useGameLogic() {
  const [gameState, setGameState] = useState<GameState>(initialHardcodedGameState);
  const [towers, setTowers] = useState<PlacedTower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [currentPlacementSpots, setCurrentPlacementSpots] = useState<PlacementSpot[]>(gameConfig.placementSpots.map(spot => ({ ...spot, isOccupied: false })));

  const gameLoopRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(performance.now());
  const enemiesToSpawnRef = useRef<EnemyType[]>([]);
  const nextSpawnTimeRef = useRef<number>(0);
  const nextSubWaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const gameStateRef = useRef(gameState);
  const towersRef = useRef(towers);
  const enemiesRef = useRef(enemies);
  const projectilesRef = useRef(projectiles);
  const currentPlacementSpotsRef = useRef(currentPlacementSpots);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { towersRef.current = towers; }, [towers]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { projectilesRef.current = projectiles; }, [projectiles]);
  useEffect(() => { currentPlacementSpotsRef.current = currentPlacementSpots; }, [currentPlacementSpots]);

  const gridToPixel = useCallback((gridPos: GridPosition): PixelPosition => {
    return {
      x: gridPos.col * gameConfig.cellSize + gameConfig.cellSize / 2,
      y: gridPos.row * gameConfig.cellSize + gameConfig.cellSize / 2,
    };
  }, []);

  const initializeTowerStateForGame = useCallback(() => {
    const allPossibleTowers = [...gameConfig.allTowerIds];
    const simpleTowerIdx = allPossibleTowers.indexOf('simple');
    let progression: TowerCategory[] = [];

    if (simpleTowerIdx > -1) {
      progression.push(allPossibleTowers.splice(simpleTowerIdx, 1)[0]); 
    } else if (allPossibleTowers.length > 0) {
      progression.push(allPossibleTowers.shift()!); 
    }
    
    const shuffledRemainingTowers = shuffleArray(allPossibleTowers);
    while (progression.length < gameConfig.maxUnlockableTowers && shuffledRemainingTowers.length > 0) {
      progression.push(shuffledRemainingTowers.shift()!);
    }

    setGameState(prev => ({
      ...prev,
      unlockableTowerProgression: progression,
      availableTowerTypes: progression.length > 0 ? [progression[0]] : [],
    }));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        initializeTowerStateForGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);
    gameLoopRef.current = null;
    nextSubWaveTimerRef.current = null;
    
    setGameState(prev => ({
        ...initialHardcodedGameState,
        gameSpeed: prev.gameSpeed, // Preserve game speed setting
        // unlockableTowerProgression and availableTowerTypes will be reset by initializeTowerStateForGame
    }));
    initializeTowerStateForGame(); // Re-initialize tower progression and available types

    setTowers([]);
    setEnemies([]);
    setProjectiles([]);
    setCurrentPlacementSpots(gameConfig.placementSpots.map(spot => ({ ...spot, isOccupied: false })));
    enemiesToSpawnRef.current = [];
    nextSpawnTimeRef.current = 0;
    lastTickTimeRef.current = performance.now();
  }, [initializeTowerStateForGame]);


  const startNextWave = useCallback(() => {
    // DO NOT clear nextSubWaveTimerRef.current here if we want to reproduce the "3 enemies stop" bug
    // The bug was caused by the main useEffect cleanup clearing it too early.

    let newOverallSubWave = gameStateRef.current.currentOverallSubWave + 1;
    let newMainWaveDisplay = gameStateRef.current.currentMainWaveDisplay;
    let newSubWaveInMainDisplay = gameStateRef.current.currentSubWaveInMainDisplay + 1;

    if (gameStateRef.current.gameStatus === 'initial') {
        newMainWaveDisplay = 1;
        newSubWaveInMainDisplay = 1;
    } else if (gameStateRef.current.gameStatus === 'betweenMainWaves') {
        newMainWaveDisplay += 1;
        newSubWaveInMainDisplay = 1;
    }
    // If 'waitingForNextSubWave', newSubWaveInMainDisplay is already correct.

    if (newMainWaveDisplay > gameConfig.totalMainWaves) {
      setGameState(prev => ({ ...prev, gameStatus: 'gameWon', isGameOver: false }));
      return;
    }

    const currentMainWaveConfig = gameConfig.mainWaves.find(mw => mw.mainWaveNumber === newMainWaveDisplay);
    if (!currentMainWaveConfig) {
      console.error(`Main wave ${newMainWaveDisplay} configuration not found!`);
      setGameState(prev => ({...prev, gameStatus: 'betweenMainWaves'}));
      return;
    }

    const currentSubWaveConfig = currentMainWaveConfig.subWaves.find(sw => sw.subWaveInMainIndex === newSubWaveInMainDisplay);
    if (!currentSubWaveConfig) {
      console.error(`Sub-wave ${newSubWaveInMainDisplay} in main wave ${newMainWaveDisplay} not found!`);
      setGameState(prev => ({
        ...prev,
        gameStatus: 'betweenMainWaves',
        currentSubWaveInMainDisplay: 0, 
      }));
      return;
    }
    
    let updatedAvailableTowers = [...gameStateRef.current.availableTowerTypes];
    const progression = gameStateRef.current.unlockableTowerProgression;
    const currentUnlockCount = updatedAvailableTowers.length;

    // Tower unlocking logic
    // This condition means a new main wave is truly starting (either game's first wave, or first sub-wave of a new main wave)
    if ((gameStateRef.current.gameStatus === 'initial' && newMainWaveDisplay === 1 && newSubWaveInMainDisplay === 1) || 
        (newSubWaveInMainDisplay === 1 && newMainWaveDisplay > gameStateRef.current.currentMainWaveDisplay)) {
        
        if (newMainWaveDisplay === 1 && progression.length > 0 && updatedAvailableTowers.length === 0) {
             // This should be handled by initializeTowerStateForGame, but as a fallback:
             if (!updatedAvailableTowers.includes(progression[0])) {
                updatedAvailableTowers.push(progression[0]);
             }
        } else if (newMainWaveDisplay === 2 ) { // End of Main Wave 1, start of Main Wave 2
            // Unlock up to 3 towers total
            for (let k = currentUnlockCount; k < Math.min(3, progression.length); k++) {
                if (progression[k] && !updatedAvailableTowers.includes(progression[k])) {
                    updatedAvailableTowers.push(progression[k]);
                }
            }
        } else if (newMainWaveDisplay > 2) { // Start of Main Wave 3+
            // Unlock one more tower if not at max and available in progression
            if (currentUnlockCount < gameConfig.maxUnlockableTowers && currentUnlockCount < progression.length) {
                 const nextTowerToUnlock = progression[currentUnlockCount];
                 if (nextTowerToUnlock && !updatedAvailableTowers.includes(nextTowerToUnlock)) {
                    updatedAvailableTowers.push(nextTowerToUnlock);
                 }
            }
        }
    }

    const enemiesForSubWave = currentSubWaveConfig.enemies.flatMap(
      (config: SubWaveEnemyConfig) => Array(config.count).fill(config.type)
    ).map((type: EnemyType) => type); 
    
    enemiesToSpawnRef.current = [...enemiesForSubWave];
    
    const firstSpawnDelay = Math.max(currentSubWaveConfig.spawnIntervalMs, 300); // Ensure some delay for first spawn.
    nextSpawnTimeRef.current = performance.now() + (firstSpawnDelay / gameStateRef.current.gameSpeed);

    setGameState(prev => ({
      ...prev,
      currentOverallSubWave: newOverallSubWave,
      currentMainWaveDisplay: newMainWaveDisplay,
      currentSubWaveInMainDisplay: newSubWaveInMainDisplay,
      gameStatus: 'subWaveInProgress',
      availableTowerTypes: updatedAvailableTowers,
      waveStartTime: performance.now(),
    }));
  }, [gridToPixel]);


  const gameLoop = useCallback((currentTime: number) => {
    const currentGameState = gameStateRef.current; // Use ref for freshest state in loop
    if (currentGameState.isGameOver || currentGameState.gameStatus === 'gameWon') {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
      return;
    }
    
    const deltaTime = (currentTime - lastTickTimeRef.current) * currentGameState.gameSpeed / 1000;
    lastTickTimeRef.current = currentTime;

    let newEnemies: Enemy[] = [...enemiesRef.current];
    let newTowers: PlacedTower[] = [...towersRef.current];
    let newProjectiles: Projectile[] = [...projectilesRef.current];
    let currentMoney = currentGameState.money;
    let currentScore = currentGameState.score;
    let playerHealth = currentGameState.playerHealth;

    if (currentGameState.gameStatus === 'subWaveInProgress' && 
        enemiesToSpawnRef.current.length > 0 && 
        currentTime >= nextSpawnTimeRef.current &&
        currentGameState.waveStartTime > 0
    ) {
      const enemyTypeToSpawn = enemiesToSpawnRef.current.shift() as EnemyType;
      const enemyConfig = gameConfig.enemyTypes[enemyTypeToSpawn];
      const currentMainWaveConfig = gameConfig.mainWaves.find(mw => mw.mainWaveNumber === currentGameState.currentMainWaveDisplay);
      const healthMultiplier = currentMainWaveConfig?.baseHealthMultiplier || 1;
      const speedMultiplier = currentMainWaveConfig?.baseSpeedMultiplier || 1;

      const newEnemy: Enemy = {
        id: uuidv4(),
        type: enemyTypeToSpawn,
        x: gridToPixel(gameConfig.enemyPath[0]).x,
        y: gridToPixel(gameConfig.enemyPath[0]).y,
        health: enemyConfig.baseHealth * healthMultiplier,
        maxHealth: enemyConfig.baseHealth * healthMultiplier,
        speed: enemyConfig.baseSpeed * speedMultiplier,
        pathIndex: 0,
        value: enemyConfig.baseValue, // Consider valueMultiplier later if needed
        size: enemyConfig.size,
      };
      newEnemies.push(newEnemy);
      
      const subWaveConfig = currentMainWaveConfig?.subWaves.find(sw => sw.subWaveInMainIndex === currentGameState.currentSubWaveInMainDisplay);
      if (enemiesToSpawnRef.current.length > 0 && subWaveConfig) {
        nextSpawnTimeRef.current = currentTime + subWaveConfig.spawnIntervalMs / currentGameState.gameSpeed;
      }
    }

    newEnemies = newEnemies.map(enemy => {
      if (enemy.pathIndex >= gameConfig.enemyPath.length - 1) {
        playerHealth -= 1; 
        return null; 
      }
      const targetPos = gridToPixel(gameConfig.enemyPath[enemy.pathIndex + 1]);
      const dx = targetPos.x - enemy.x;
      const dy = targetPos.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = enemy.speed * deltaTime;
      if (distance < moveSpeed) {
        return { ...enemy, x: targetPos.x, y: targetPos.y, pathIndex: enemy.pathIndex + 1 };
      } else {
        return { ...enemy, x: enemy.x + (dx / distance) * moveSpeed, y: enemy.y + (dy / distance) * moveSpeed };
      }
    }).filter(enemy => enemy !== null) as Enemy[];

    newTowers = newTowers.map(tower => {
      let newTargetId = tower.targetId;
      const targetEnemy = newTargetId ? newEnemies.find(e => e.id === newTargetId) : undefined;
      if (!targetEnemy || Math.sqrt(Math.pow(targetEnemy.x - tower.x, 2) + Math.pow(targetEnemy.y - tower.y, 2)) > tower.stats.range) {
        newTargetId = undefined; 
        let closestEnemy: Enemy | undefined = undefined;
        let minDistance = tower.stats.range;
        newEnemies.forEach(enemy => {
          const dist = Math.sqrt(Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            closestEnemy = enemy;
          }
        });
        if (closestEnemy) newTargetId = closestEnemy.id;
      }
      let newRotation = tower.rotation;
      if (newTargetId) {
          const currentTarget = newEnemies.find(e => e.id === newTargetId);
          if (currentTarget) {
            const dx = currentTarget.x - tower.x;
            const dy = currentTarget.y - tower.y;
            newRotation = (Math.atan2(dy, dx) * 180) / Math.PI;
          }
      }
      if (newTargetId && currentTime - tower.lastShotTime >= 1000 / tower.stats.fireRate / currentGameState.gameSpeed) {
        const projectile: Projectile = {
          id: uuidv4(),
          towerId: tower.id,
          targetId: newTargetId,
          x: tower.x,
          y: tower.y,
          damage: tower.stats.damage,
          speed: tower.stats.projectileSpeed || 300,
          color: tower.stats.color,
          targetPosition: { x: 0, y: 0 }
        };
        const currentTargetForProjectile = newEnemies.find(e => e.id === newTargetId);
        if (currentTargetForProjectile) {
            projectile.targetPosition = { x: currentTargetForProjectile.x, y: currentTargetForProjectile.y };
        }
        newProjectiles.push(projectile);
        return { ...tower, targetId: newTargetId, lastShotTime: currentTime, rotation: newRotation };
      }
      return { ...tower, targetId: newTargetId, rotation: newRotation };
    });

    const hitEnemyIds = new Set<string>();
    const damageMap: Record<string, number> = {};
    newProjectiles = newProjectiles.filter(p => {
      const target = newEnemies.find(e => e.id === p.targetId);
      if (!target) return false;
      p.targetPosition = { x: target.x, y: target.y }; 
      const dx = p.targetPosition.x - p.x;
      const dy = p.targetPosition.y - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = p.speed * deltaTime;
      if (distance < moveSpeed || distance < 5) {
        hitEnemyIds.add(p.targetId);
        damageMap[p.targetId] = (damageMap[p.targetId] || 0) + p.damage;
        return false;
      } else {
        p.x += (dx / distance) * moveSpeed;
        p.y += (dy / distance) * moveSpeed;
        return true;
      }
    });
    
    let moneyEarnedThisTick = 0;
    let scoreEarnedThisTick = 0;
    if (hitEnemyIds.size > 0) {
      newEnemies = newEnemies.map(enemy => {
        if (damageMap[enemy.id]) {
          const newHealth = enemy.health - damageMap[enemy.id];
          if (newHealth <= 0) {
            moneyEarnedThisTick += enemy.value;
            scoreEarnedThisTick += enemy.value; // Add to score as well
            return null;
          }
          return { ...enemy, health: newHealth };
        }
        return enemy;
      }).filter(enemy => enemy !== null) as Enemy[];
    }
    currentMoney += moneyEarnedThisTick;
    currentScore += scoreEarnedThisTick;
    
    setTowers(newTowers);
    setEnemies(newEnemies);
    setProjectiles(newProjectiles);
    
    let nextGameStatus = currentGameState.gameStatus;
    if (playerHealth <= 0 && !currentGameState.isGameOver) {
      playerHealth = 0;
      nextGameStatus = 'gameOver';
      setGameState(prev => ({ ...prev, playerHealth, money: currentMoney, score: currentScore, isGameOver: true, gameStatus: 'gameOver' }));
    } else {
       setGameState(prev => ({ ...prev, playerHealth, money: currentMoney, score: currentScore }));
    }

    const finalEnemiesCount = newEnemies.length;
    const finalEnemiesToSpawnCount = enemiesToSpawnRef.current.length;
    
    if (nextGameStatus === 'subWaveInProgress' && finalEnemiesCount === 0 && finalEnemiesToSpawnCount === 0) {
        const mainWaveCfg = gameConfig.mainWaves.find(mw => mw.mainWaveNumber === currentGameState.currentMainWaveDisplay);
        const subWaveCfg = mainWaveCfg?.subWaves.find(sw => sw.subWaveInMainIndex === currentGameState.currentSubWaveInMainDisplay);

        if (currentGameState.currentSubWaveInMainDisplay < gameConfig.subWavesPerMain) {
            nextGameStatus = 'waitingForNextSubWave';
            // To reproduce the bug, nextSubWaveTimerRef.current WILL BE CLEARED by useEffect cleanup
            nextSubWaveTimerRef.current = setTimeout(() => {
                startNextWave(); // This will likely not be called if the timer is cleared too soon
            }, subWaveCfg?.postSubWaveDelayMs || 2000);
        } else { 
            if (currentGameState.currentMainWaveDisplay >= gameConfig.totalMainWaves) {
                nextGameStatus = 'gameWon';
            } else {
                nextGameStatus = 'betweenMainWaves';
            }
        }
         setGameState(prev => ({ ...prev, gameStatus: nextGameStatus, waveStartTime: 0 }));
    }
    
    if (nextGameStatus !== 'gameOver' && nextGameStatus !== 'gameWon' && (nextGameStatus === 'subWaveInProgress' || (nextGameStatus === 'waitingForNextSubWave' && projectilesRef.current.length > 0))) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else {
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
        // DO NOT clear nextSubWaveTimerRef here if it's managed by useEffect cleanup for the bug
    }
  }, [gridToPixel, startNextWave /* gameLoop depends on startNextWave */]);

  useEffect(() => {
    const currentGameState = gameState; // Direct state access for dependencies
    let loopShouldBeRunning =
      (currentGameState.gameStatus === 'subWaveInProgress' ||
        (currentGameState.gameStatus === 'waitingForNextSubWave' && projectiles.length > 0)) &&
      !currentGameState.isGameOver &&
      currentGameState.gameStatus !== 'gameWon';

    if (loopShouldBeRunning && !gameLoopRef.current) {
      lastTickTimeRef.current = performance.now();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (!loopShouldBeRunning && gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      // This is the crucial part to reintroduce the "3 enemies stop" bug
      if (nextSubWaveTimerRef.current) {
        clearTimeout(nextSubWaveTimerRef.current);
        nextSubWaveTimerRef.current = null;
      }
    };
  }, [gameState.gameStatus, gameState.isGameOver, gameState.gameWon, projectiles.length, gameLoop]);

  const placeTower = useCallback((spot: PlacementSpot, towerType: TowerCategory): { success: boolean; message: string } => {
    if (spot.isOccupied) return { success: false, message: "Bu nokta dolu."};
    const towerDef = gameConfig.towerTypes[towerType];
    if (!towerDef) return { success: false, message: "Geçersiz kule tipi."};
    if (gameStateRef.current.money < towerDef.baseCost) return { success: false, message: "Yeterli paranız yok."};
    const newTower: PlacedTower = {
      id: uuidv4(), type: towerType, level: 1, ...gridToPixel(spot),
      stats: getStatsForLevel(towerType, 1), lastShotTime: 0, rotation: 0,
    };
    setTowers(prev => [...prev, newTower]);
    setGameState(prev => ({ ...prev, money: prev.money - towerDef.baseCost, selectedTowerType: null, placementMode: false }));
    setCurrentPlacementSpots(prevSpots => prevSpots.map(s => s.id === spot.id ? { ...s, isOccupied: true } : s));
    return { success: true, message: `${towerDef.name} yerleştirildi.`};
  }, [gridToPixel]);

  const attemptMergeTowers = useCallback((tower1Id: string, tower2Id: string): {success: boolean; message: string, resultingTower?: PlacedTower} => {
    const tower1 = towersRef.current.find(t => t.id === tower1Id);
    const tower2 = towersRef.current.find(t => t.id === tower2Id);
    if (!tower1 || !tower2 || tower1.id === tower2.id) return {success: false, message: "Birleştirmek için iki farklı kule seçilmeli."};
    if (tower1.type !== tower2.type || tower1.level !== tower2.level) return {success: false, message: "Sadece aynı tip ve seviyedeki kuleler birleştirilebilir."};
    if (tower1.level >= 3) return {success: false, message: "Kule zaten maksimum seviyede."};
    const nextLevel = (tower1.level + 1) as 2 | 3;
    const towerDef = gameConfig.towerTypes[tower1.type];
    const mergeCost = towerDef.levels[nextLevel]?.mergeCost;
    if (mergeCost === undefined) return {success: false, message: "Bu kule için birleştirme tanımlanmamış."};
    if (gameStateRef.current.money < mergeCost) return {success: false, message: `Birleştirme için yeterli para yok. Bedel: ${mergeCost}`};
    const newStats = getStatsForLevel(tower1.type, nextLevel);
    const mergedTower: PlacedTower = {
      ...tower1, id: uuidv4(), level: nextLevel, stats: newStats,
      lastShotTime: 0, targetId: undefined,
    };
    const spot1 = currentPlacementSpotsRef.current.find(s => {
        const spotPx = gridToPixel(s);
        return Math.abs(tower1.x - spotPx.x) < gameConfig.cellSize / 2 && Math.abs(tower1.y - spotPx.y) < gameConfig.cellSize / 2;
    });
    const spot2 = currentPlacementSpotsRef.current.find(s => {
        const spotPx = gridToPixel(s);
        return Math.abs(tower2.x - spotPx.x) < gameConfig.cellSize / 2 && Math.abs(tower2.y - spotPx.y) < gameConfig.cellSize / 2;
    });
    setTowers(prev => [...prev.filter(t => t.id !== tower1Id && t.id !== tower2Id), mergedTower]);
    setGameState(prev => ({ ...prev, money: prev.money - mergeCost }));
    setCurrentPlacementSpots(prevSpots => prevSpots.map(s => {
        if (s.id === spot1?.id) return { ...s, isOccupied: true };
        if (s.id === spot2?.id) return { ...s, isOccupied: false };
        return s;
    }));
    return {success: true, message: `${towerDef.name} Seviye ${nextLevel}'e yükseltildi!`, resultingTower: mergedTower};
  }, [gridToPixel]);

  const moveTower = useCallback((towerId: string, newSpotId: string): boolean => {
    const towerToMove = towersRef.current.find(t => t.id === towerId);
    const newSpot = currentPlacementSpotsRef.current.find(s => s.id === newSpotId);
    if (!towerToMove || !newSpot || newSpot.isOccupied) return false;
    const oldSpot = currentPlacementSpotsRef.current.find(s => {
        const spotPx = gridToPixel(s);
        return Math.abs(towerToMove.x - spotPx.x) < gameConfig.cellSize / 2 && Math.abs(towerToMove.y - spotPx.y) < gameConfig.cellSize / 2;
    });
    const newPosition = gridToPixel(newSpot);
    setTowers(prevTowers => prevTowers.map(t => 
        t.id === towerId ? { ...t, x: newPosition.x, y: newPosition.y, targetId: undefined, lastShotTime: 0 } : t
    ));
    setCurrentPlacementSpots(prevSpots => prevSpots.map(s => {
        if (s.id === oldSpot?.id) return { ...s, isOccupied: false };
        if (s.id === newSpot.id) return { ...s, isOccupied: true };
        return s;
    }));
    return true;
  }, [gridToPixel]);

  const setSelectedTowerType = useCallback((type: TowerCategory | null) => {
    setGameState(prev => ({ ...prev, selectedTowerType: type, placementMode: !!type }));
  }, []);

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

