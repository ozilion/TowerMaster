
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, PlacedTower, Enemy, Projectile, TowerCategory, PlacementSpot, GridPosition, PixelPosition, TowerLevelStats, MainWave, SubWave, EnemyType } from '@/types/game';
import gameConfig from '@/config/gameConfig';
import { v4 as uuidv4 } from 'uuid';

const getStatsForLevel = (towerType: TowerCategory, level: 1 | 2 | 3): TowerLevelStats => {
  const towerDef = gameConfig.towerTypes[towerType];
  if (!towerDef) throw new Error(`Tower type ${towerType} not found in config`);
  
  const baseStats = towerDef.levels[level];
  return {
    ...baseStats,
    level: level,
    cost: level === 1 ? towerDef.baseCost : undefined, // Initial cost only for level 1
    mergeCost: level > 1 ? towerDef.levels[level].mergeCost : undefined,
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
  const [gameState, setGameState] = useState<GameState>({
    playerHealth: gameConfig.initialGameState.playerHealth,
    money: gameConfig.initialGameState.money,
    currentOverallSubWave: 0,
    currentMainWaveDisplay: 0, 
    currentSubWaveInMainDisplay: 0,
    score: gameConfig.initialGameState.score,
    isGameOver: false,
    gameSpeed: gameConfig.initialGameState.gameSpeed,
    selectedTowerType: null,
    placementMode: false,
    gameStatus: 'initial',
    unlockableTowerProgression: [],
    availableTowerTypes: [],
    waveStartTime: 0,
  });

  const [towers, setTowers] = useState<PlacedTower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [currentPlacementSpots, setCurrentPlacementSpots] = useState<PlacementSpot[]>(gameConfig.placementSpots);

  // Refs for mutable values that don't trigger re-renders but are needed in game loop
  const gameLoopRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(performance.now());
  const enemiesToSpawnRef = useRef<EnemyType[]>([]);
  const nextSpawnTimeRef = useRef<number>(0);
  const nextSubWaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for state values to access freshest values in callbacks without re-triggering effects often
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

  // Client-side effect for initializing tower progression (depends on Math.random)
  const initializeTowerStateForGame = useCallback(() => {
    const allPossibleTowers = [...gameConfig.allTowerIds];
    const simpleTowerIndex = allPossibleTowers.indexOf('simple');
    if (simpleTowerIndex > -1) {
      allPossibleTowers.splice(simpleTowerIndex, 1); // Remove simple tower
    }
    const shuffledRemainingTowers = shuffleArray(allPossibleTowers);
    
    // Ensure 'simple' is always first, then add shuffled towers up to maxUnlockableTowers
    const progression: TowerCategory[] = ['simple'];
    for (let i = 0; i < shuffledRemainingTowers.length && progression.length < gameConfig.maxUnlockableTowers; i++) {
      progression.push(shuffledRemainingTowers[i]);
    }

    setGameState(prev => ({
      ...prev,
      unlockableTowerProgression: progression,
      availableTowerTypes: [progression[0]], // Start with the first tower (simple)
    }));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') { // Ensure this runs only on client
        initializeTowerStateForGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current);
    gameLoopRef.current = null;
    nextSubWaveTimerRef.current = null;
    
    initializeTowerStateForGame(); // Re-initialize tower progression

    setGameState(prev => ({
      ...prev, // Keep some settings like gameSpeed
      playerHealth: gameConfig.initialGameState.playerHealth,
      money: gameConfig.initialGameState.money,
      currentOverallSubWave: 0,
      currentMainWaveDisplay: 0,
      currentSubWaveInMainDisplay: 0,
      score: gameConfig.initialGameState.score,
      isGameOver: false,
      selectedTowerType: null,
      placementMode: false,
      gameStatus: 'initial',
      waveStartTime: 0,
    }));
    setTowers([]);
    setEnemies([]);
    setProjectiles([]);
    setCurrentPlacementSpots(gameConfig.placementSpots.map(spot => ({ ...spot, isOccupied: false })));
    enemiesToSpawnRef.current = [];
    nextSpawnTimeRef.current = 0;
    lastTickTimeRef.current = performance.now();
  }, [initializeTowerStateForGame]);


  const startNextWave = useCallback(() => {
    // If there's a pending timer for the next sub-wave, clear it as we are manually starting.
    // This was part of the fix for "3 enemies then stop" but we are reverting to the buggy state.
    // if (nextSubWaveTimerRef.current) {
    //   clearTimeout(nextSubWaveTimerRef.current);
    //   nextSubWaveTimerRef.current = null;
    // }

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
    // If it was 'waitingForNextSubWave', newSubWaveInMainDisplay is already correctly incremented.

    if (newMainWaveDisplay > gameConfig.totalMainWaves) {
      setGameState(prev => ({ ...prev, gameStatus: 'gameWon', isGameOver: false })); // Or a specific game won state
      return;
    }

    const currentMainWaveConfig = gameConfig.mainWaves.find(mw => mw.mainWaveNumber === newMainWaveDisplay);
    if (!currentMainWaveConfig) {
      console.error(`Main wave ${newMainWaveDisplay} configuration not found!`);
      setGameState(prev => ({...prev, gameStatus: 'betweenMainWaves'})); // Go to a safe state
      return;
    }

    const currentSubWaveConfig = currentMainWaveConfig.subWaves.find(sw => sw.subWaveInMainIndex === newSubWaveInMainDisplay);
    if (!currentSubWaveConfig) {
      console.error(`Sub-wave ${newSubWaveInMainDisplay} in main wave ${newMainWaveDisplay} not found!`);
       // This main wave is done, move to betweenMainWaves
      setGameState(prev => ({
        ...prev,
        gameStatus: 'betweenMainWaves',
        currentSubWaveInMainDisplay: 0, // Reset for next main wave
      }));
      return;
    }
    
    // Kule kilit açma mantığı
    let updatedAvailableTowers = [...gameStateRef.current.availableTowerTypes];
    if (newMainWaveDisplay > gameStateRef.current.currentMainWaveDisplay && newSubWaveInMainDisplay === 1) { // Yeni ana dalga başlıyor
        const currentUnlockCount = updatedAvailableTowers.length;
        if (currentUnlockCount < gameStateRef.current.unlockableTowerProgression.length) {
            if (newMainWaveDisplay === 1 && currentUnlockCount < 1) { // Should be covered by init
                 // No, this logic is handled by initializeTowerStateForGame
            } else if (newMainWaveDisplay === 2 && currentUnlockCount < 3) { // İlk ana dalga bitti, 2 kule daha aç (toplam 3)
                for (let k = currentUnlockCount; k < 3 && k < gameStateRef.current.unlockableTowerProgression.length; k++) {
                    if (!updatedAvailableTowers.includes(gameStateRef.current.unlockableTowerProgression[k])) {
                        updatedAvailableTowers.push(gameStateRef.current.unlockableTowerProgression[k]);
                    }
                }
            } else if (newMainWaveDisplay > 2) { // Sonraki her ana dalgada 1 yeni kule
                 const nextTowerToUnlockIndex = currentUnlockCount; // index since 'simple' is at 0
                 if (nextTowerToUnlockIndex < gameStateRef.current.unlockableTowerProgression.length) {
                    if (!updatedAvailableTowers.includes(gameStateRef.current.unlockableTowerProgression[nextTowerToUnlockIndex])) {
                        updatedAvailableTowers.push(gameStateRef.current.unlockableTowerProgression[nextTowerToUnlockIndex]);
                    }
                 }
            }
        }
    }


    enemiesToSpawnRef.current = currentSubWaveConfig.enemies.flatMap(
      config => Array(config.count).fill(config.type)
    ).map(type => type as EnemyType); // Ensure it's EnemyType[]
    
    nextSpawnTimeRef.current = performance.now() + currentSubWaveConfig.spawnIntervalMs; // First spawn after interval

    setGameState(prev => ({
      ...prev,
      currentOverallSubWave: newOverallSubWave,
      currentMainWaveDisplay: newMainWaveDisplay,
      currentSubWaveInMainDisplay: newSubWaveInMainDisplay,
      gameStatus: 'subWaveInProgress',
      availableTowerTypes: updatedAvailableTowers,
      waveStartTime: performance.now(),
    }));
    
    // lastTickTimeRef.current = performance.now(); // Reset tick time for new wave
    // if (!gameLoopRef.current) { // Ensure game loop is running
    //   gameLoopRef.current = requestAnimationFrame(gameLoop);
    // }
  }, [/* No startNextWave in deps to avoid loops, relies on gameStateRef.current */]);


  const gameLoop = useCallback((currentTime: number) => {
    if (gameStateRef.current.isGameOver || gameStateRef.current.gameStatus === 'gameWon') {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
      return;
    }
    
    const deltaTime = (currentTime - lastTickTimeRef.current) * gameStateRef.current.gameSpeed / 1000; // in seconds
    lastTickTimeRef.current = currentTime;

    let newEnemies: Enemy[] = [...enemiesRef.current];
    let newTowers: PlacedTower[] = [...towersRef.current];
    let newProjectiles: Projectile[] = [...projectilesRef.current];
    let currentMoney = gameStateRef.current.money;
    let currentScore = gameStateRef.current.score;
    let playerHealth = gameStateRef.current.playerHealth;

    // Spawn Enemies if in subWaveInProgress and it's time
    if (gameStateRef.current.gameStatus === 'subWaveInProgress' && 
        enemiesToSpawnRef.current.length > 0 && 
        currentTime >= nextSpawnTimeRef.current &&
        gameStateRef.current.waveStartTime > 0 // Ensure wave has actually started
    ) {
      const enemyTypeToSpawn = enemiesToSpawnRef.current.shift() as EnemyType;
      const enemyConfig = gameConfig.enemyTypes[enemyTypeToSpawn];
      const currentMainWaveConfig = gameConfig.mainWaves.find(mw => mw.mainWaveNumber === gameStateRef.current.currentMainWaveDisplay);
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
        value: enemyConfig.baseValue,
        size: enemyConfig.size,
      };
      newEnemies.push(newEnemy);
      
      const currentSubWaveConfig = currentMainWaveConfig?.subWaves.find(sw => sw.subWaveInMainIndex === gameStateRef.current.currentSubWaveInMainDisplay);
      if (enemiesToSpawnRef.current.length > 0 && currentSubWaveConfig) {
        nextSpawnTimeRef.current = currentTime + currentSubWaveConfig.spawnIntervalMs / gameStateRef.current.gameSpeed;
      }
    }

    // Move Enemies
    newEnemies = newEnemies.map(enemy => {
      if (enemy.pathIndex >= gameConfig.enemyPath.length - 1) {
        playerHealth -= 1; // Enemy reached the end
        return null; // Mark for removal
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

    // Towers Target and Shoot
    newTowers = newTowers.map(tower => {
      let newTargetId = tower.targetId;
      const targetEnemy = newTargetId ? newEnemies.find(e => e.id === newTargetId) : undefined;

      if (!targetEnemy || Math.sqrt(Math.pow(targetEnemy.x - tower.x, 2) + Math.pow(targetEnemy.y - tower.y, 2)) > tower.stats.range) {
        newTargetId = undefined; // Target out of range or gone
        // Find new target
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
            newRotation = (Math.atan2(dy, dx) * 180) / Math.PI; // Calculate rotation in degrees
          }
      }


      if (newTargetId && currentTime - tower.lastShotTime >= 1000 / tower.stats.fireRate / gameStateRef.current.gameSpeed) {
        const projectile: Projectile = {
          id: uuidv4(),
          towerId: tower.id,
          targetId: newTargetId,
          x: tower.x,
          y: tower.y,
          damage: tower.stats.damage,
          speed: tower.stats.projectileSpeed || 300,
          color: tower.stats.color,
          targetPosition: { x: 0, y: 0 } // Will be updated
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

    // Move Projectiles and Handle Hits
    const hitEnemyIds = new Set<string>();
    const damageMap: Record<string, number> = {}; // To accumulate damage per enemy

    newProjectiles = newProjectiles.filter(p => {
      const target = newEnemies.find(e => e.id === p.targetId);
      if (!target) return false; // Target gone

      // Update target position for homing
      p.targetPosition = { x: target.x, y: target.y }; 

      const dx = p.targetPosition.x - p.x;
      const dy = p.targetPosition.y - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = p.speed * deltaTime;

      if (distance < moveSpeed || distance < 5) { // Hit
        hitEnemyIds.add(p.targetId);
        damageMap[p.targetId] = (damageMap[p.targetId] || 0) + p.damage;
        return false; // Remove projectile
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
            scoreEarnedThisTick += enemy.value;
            return null; // Mark for removal
          }
          return { ...enemy, health: newHealth };
        }
        return enemy;
      }).filter(enemy => enemy !== null) as Enemy[];
    }

    currentMoney += moneyEarnedThisTick;
    currentScore += scoreEarnedThisTick;
    
    // Update states
    setTowers(newTowers);
    setEnemies(newEnemies);
    setProjectiles(newProjectiles);
    
    const currentGS = gameStateRef.current; // Use the ref for decision making to avoid stale closures
    let nextGameStatus = currentGS.gameStatus;

    if (playerHealth <= 0 && !currentGS.isGameOver) {
      playerHealth = 0;
      nextGameStatus = 'gameOver';
      setGameState(prev => ({ ...prev, playerHealth, isGameOver: true, gameStatus: 'gameOver' }));
    } else {
       setGameState(prev => ({ ...prev, playerHealth, money: currentMoney, score: currentScore }));
    }


    // Wave transition logic
    const finalEnemies = newEnemies; // enemiesRef.current already updated effectively
    const finalEnemiesToSpawn = enemiesToSpawnRef.current;
    const currentGSForTransition = gameStateRef.current; // Use freshest state for transition decisions

    if (currentGSForTransition.gameStatus === 'subWaveInProgress' && finalEnemies.length === 0 && finalEnemiesToSpawn.length === 0) {
        const currentMainWaveConfig = gameConfig.mainWaves.find(mw => mw.mainWaveNumber === currentGSForTransition.currentMainWaveDisplay);
        const currentSubWaveConfig = currentMainWaveConfig?.subWaves.find(sw => sw.subWaveInMainIndex === currentGSForTransition.currentSubWaveInMainDisplay);

        if (currentGSForTransition.currentSubWaveInMainDisplay < gameConfig.subWavesPerMain) {
            nextGameStatus = 'waitingForNextSubWave';
            if (nextSubWaveTimerRef.current) clearTimeout(nextSubWaveTimerRef.current); // Clear any existing timer
            nextSubWaveTimerRef.current = setTimeout(() => {
                startNextWave();
            }, currentSubWaveConfig?.postSubWaveDelayMs || 2000); // Use configured delay
        } else { // Main wave finished
            if (currentGSForTransition.currentMainWaveDisplay >= gameConfig.totalMainWaves) {
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
        if (nextSubWaveTimerRef.current && (nextGameStatus === 'gameOver' || nextGameStatus === 'gameWon' || nextGameStatus === 'initial' || nextGameStatus === 'betweenMainWaves')) {
            clearTimeout(nextSubWaveTimerRef.current);
            nextSubWaveTimerRef.current = null;
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridToPixel /* startNextWave is intentionally omitted from deps to break potential cycles, it uses refs */]);

  // Main game loop effect
  useEffect(() => {
    let loopShouldBeRunning = 
        (gameState.gameStatus === 'subWaveInProgress' || 
        (gameState.gameStatus === 'waitingForNextSubWave' && projectiles.length > 0)) && // Keep loop for projectiles
        !gameState.isGameOver && 
        gameState.gameStatus !== 'gameWon';

    if (loopShouldBeRunning && !gameLoopRef.current) {
      lastTickTimeRef.current = performance.now(); // Reset tick time when loop (re)starts
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (!loopShouldBeRunning && gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    // This is the cleanup that was causing the "3 enemies then stop" bug.
    // To revert to the buggy state, we re-introduce it.
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      // This clearTimeout was the cause of the "3 enemies then stop" bug.
      // It's re-added here to go back to that buggy state as requested.
      if (nextSubWaveTimerRef.current) {
        clearTimeout(nextSubWaveTimerRef.current);
        nextSubWaveTimerRef.current = null;
      }
    };
  }, [gameState.gameStatus, gameState.isGameOver, gameState.gameWon, projectiles.length, gameLoop]);

  // Effect to clear sub-wave timer on game over/won (THIS WAS PART OF THE FIX, SO WE REMOVE IT TO REINTRODUCE THE BUG)
  // useEffect(() => {
  //   if ((gameState.isGameOver || gameState.gameStatus === 'gameWon') && nextSubWaveTimerRef.current) {
  //     clearTimeout(nextSubWaveTimerRef.current);
  //     nextSubWaveTimerRef.current = null;
  //   }
  // }, [gameState.isGameOver, gameState.gameStatus]);


  const placeTower = useCallback((spot: PlacementSpot, towerType: TowerCategory): { success: boolean; message: string } => {
    if (spot.isOccupied) return { success: false, message: "Bu nokta dolu."};
    
    const towerDef = gameConfig.towerTypes[towerType];
    if (!towerDef) return { success: false, message: "Geçersiz kule tipi."};

    if (gameStateRef.current.money < towerDef.baseCost) return { success: false, message: "Yeterli paranız yok."};

    const newTower: PlacedTower = {
      id: uuidv4(),
      type: towerType,
      level: 1,
      ...gridToPixel(spot),
      stats: getStatsForLevel(towerType, 1),
      lastShotTime: 0,
      rotation: 0,
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
      ...tower1, // Keep position of the first tower, ID can be tower1's or new
      id: uuidv4(), // Give merged tower a new ID for simplicity in state updates
      level: nextLevel,
      stats: newStats,
      lastShotTime: 0, // Reset
      targetId: undefined, // Reset
    };
    
    // Find original spots
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
        if (s.id === spot1?.id) return { ...s, isOccupied: true }; // Spot of merged tower remains occupied
        if (s.id === spot2?.id) return { ...s, isOccupied: false }; // Spot of removed tower becomes free
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
    setGameState // Expose for direct manipulation if needed (e.g. game speed)
  };
}
