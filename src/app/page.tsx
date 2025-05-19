
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button'; 
import { useToast } from '@/hooks/use-toast';
import { useGameLogic } from '@/hooks/useGameLogic';
import gameConfig from '@/config/gameConfig';
// import { Heart, Coins, Layers, Award } from 'lucide-react'; // Icons are now in ImprovedGameBoard
import type { PlacedTower, TowerCategory, PlacementSpot, GameState as GameStateType, GameEndScreenProps, InstructionsModalProps } from '@/types/game';

// İyileştirilmiş oyun arayüzünü içe aktarıyoruz
import ImprovedGameBoard from '@/components/game/ImprovedGameBoard'; // Corrected path

// GameWon ekranı
const GameWonScreen: React.FC<GameEndScreenProps> = ({ isOpen, score, onRestart }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground p-8 rounded-lg shadow-2xl text-center">
        <h2 className="text-3xl font-bold text-green-500 mb-4">Tebrikler, Oyunu Kazandın!</h2>
        <p className="text-xl mb-6">Skorun: <span className="font-semibold text-amber-500">{score}</span></p>
        <Button onClick={onRestart} className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-3 px-6">
          Yeniden Başlat
        </Button>
      </div>
    </div>
  );
};

// GameOver ekranı
const GameOverScreen: React.FC<GameEndScreenProps> = ({ isOpen, score, onRestart }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground p-8 rounded-lg shadow-2xl text-center">
        <h2 className="text-3xl font-bold text-destructive mb-4">Oyun Bitti!</h2>
        <p className="text-xl mb-6">Skorun: <span className="font-semibold text-accent">{score}</span></p>
        <Button onClick={onRestart} className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-3 px-6">
          Yeniden Başlat
        </Button>
      </div>
    </div>
  );
};

// InstructionsModal bileşeni
const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card text-card-foreground p-6 rounded-lg shadow-2xl max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-primary mb-4 text-center">Nasıl Oynanır?</h2>
        
        <div className="space-y-3 text-sm">
          <p><strong>Amaç:</strong> Düşmanların yolun sonuna ulaşmasını engellemek.</p>
          
          <h3 className="font-semibold mt-2 text-primary">Temel Mekanikler:</h3>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Düşmanlar belirli bir yolda dalga şeklinde ilerler.</li>
            <li>Kuleleri sadece haritadaki işaretli taş bloklara yerleştirebilirsin.</li>
            <li>Her öldürülen düşman için para kazanırsın.</li>
            <li>Kazandığın parayla yeni kuleler alabilir veya mevcut kuleleri birleştirebilirsin.</li>
            <li>Aynı tipte ve aynı seviyedeki iki kuleyi birleştirerek daha güçlü bir kule (maksimum 3. seviye) elde edebilirsin.</li>
            <li>Düşmanlar yolun sonuna ulaştığında canın azalır. Canın biterse oyun sona erer.</li>
          </ul>
          
          <div className="flex justify-end mt-4">
            <Button onClick={onClose} className="bg-primary text-primary-foreground">Anladım</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function KuleSavunmaPage() {
  const {
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
  } = useGameLogic();

  const { toast } = useToast();
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [firstSelectedTowerForMerge, setFirstSelectedTowerForMerge] = useState<string | null>(null);
  const [selectedTowerForMovingId, setSelectedTowerForMovingId] = useState<string | null>(null);
  const [showRangeIndicatorForTower, setShowRangeIndicatorForTower] = useState<PlacedTower | null>(null);

  // Kule seçim işlemleri (ImprovedGameBoard içindeki UI için)
  const handleTowerSelectionForPlacement = (type: TowerCategory | null) => {
    setSelectedTowerType(type);
    setFirstSelectedTowerForMerge(null);
    setSelectedTowerForMovingId(null); 
    setShowRangeIndicatorForTower(null);
  };

  // Oyun tahtasında kule tıklama işlemi (mevcut kuleyi seçmek/birleştirmek/taşımak için)
  const handleTowerClickOnBoard = (towerId: string) => {
    const clickedTower = towers.find(t => t.id === towerId);
    if (!clickedTower) return;

    setShowRangeIndicatorForTower(clickedTower); 
    setSelectedTowerType(null); // Clear any new tower placement selection

    if (firstSelectedTowerForMerge === towerId) { 
        setFirstSelectedTowerForMerge(null); // Deselect if clicking the same tower again
        setSelectedTowerForMovingId(null); // Also deselect for moving
    } else if (firstSelectedTowerForMerge) { 
        const firstTowerOriginal = towers.find(t => t.id === firstSelectedTowerForMerge);
        const mergeResult = attemptMergeTowers(firstSelectedTowerForMerge, towerId);

        if (mergeResult.success && mergeResult.resultingTower) {
            setShowRangeIndicatorForTower(mergeResult.resultingTower); 
            toast({ title: "Kule Birleştirildi!", description: mergeResult.message });
        } else {
            toast({ title: "Birleştirme Başarısız", description: mergeResult.message, variant: "destructive" });
            setShowRangeIndicatorForTower(firstTowerOriginal || null); 
        }
        setFirstSelectedTowerForMerge(null);
        setSelectedTowerForMovingId(null); 
    } else { // First tower selected for a potential merge or move
        setFirstSelectedTowerForMerge(towerId);
        setSelectedTowerForMovingId(towerId);
    }
  };

  // Kule taşıma işlemi
  const handleMoveTowerRequest = (towerId: string, spot: PlacementSpot) => {
    const success = moveTower(towerId, spot.id);
    const movedTower = towers.find(t => t.id === towerId); 
    if (success && movedTower) {
      setShowRangeIndicatorForTower(movedTower); 
      toast({ title: "Kule Taşındı!", description: `${gameConfig.towerTypes[movedTower.type]?.name || 'Kule'} yeni yerine taşındı.` });
    } else {
      toast({ title: "Taşıma Başarısız", description: "Kule bu noktaya taşınamadı.", variant: "destructive" });
    }
    setSelectedTowerForMovingId(null); 
    setFirstSelectedTowerForMerge(null); 
  };
  
  // Yeni kule yerleştirme
  const handlePlaceNewTower = (spot: PlacementSpot, towerType: TowerCategory) => {
    const result = placeTower(spot, towerType);
    if (result.success) {
        toast({ title: "Kule Yerleştirildi", description: result.message });
        // Find the newly placed tower to show its range
        const newPlacedTower = towers.find(t => {
            const spotPx = gridToPixel(spot);
            // This might be tricky if multiple towers of same type are placed quickly.
            // A more robust way would be if placeTower returned the new tower's ID.
            // For now, we find the last one matching type and roughly the spot.
            const allOfTypeAtSpot = towers.filter(t => 
                t.type === towerType && 
                Math.abs(t.x - spotPx.x) < gameConfig.cellSize / 2 && 
                Math.abs(t.y - spotPx.y) < gameConfig.cellSize / 2
            );
            return allOfTypeAtSpot.length > 0 ? allOfTypeAtSpot[allOfTypeAtSpot.length-1] : undefined;
        });
        if (newPlacedTower) setShowRangeIndicatorForTower(newPlacedTower);

    } else {
        toast({ title: "Yerleştirme Başarısız", description: result.message, variant: "destructive" });
    }
    // Clear selections after attempting to place a new tower
    setSelectedTowerType(null);
    setFirstSelectedTowerForMerge(null);
    setSelectedTowerForMovingId(null);
  };

  // Seçili kule tipi (yeni yerleştirme için) değiştiğinde diğer seçimleri temizle
  useEffect(() => {
    if (gameState.selectedTowerType) {
      setFirstSelectedTowerForMerge(null);
      setSelectedTowerForMovingId(null);
      // Don't clear showRangeIndicatorForTower here, as it might be for an existing tower.
      // It will be cleared by handleTowerSelectionForPlacement if a new type is selected.
    }
  }, [gameState.selectedTowerType]);

  // Oyun bitti veya kazanıldığında seçimleri temizle
  useEffect(() => {
    if (gameState.isGameOver || gameState.gameStatus === 'gameWon') {
      setFirstSelectedTowerForMerge(null);
      setSelectedTowerForMovingId(null);
      setShowRangeIndicatorForTower(null);
      setSelectedTowerType(null); // Also clear selected tower type for placement
    }
  }, [gameState.isGameOver, gameState.gameStatus, setSelectedTowerType]);

  // Dalga butonunun metnini belirleme
  const getWaveButtonText = () => {
    if (gameState.gameStatus === 'initial') return 'Oyunu Başlat';
    if (gameState.gameStatus === 'betweenMainWaves') {
        if (gameState.currentMainWaveDisplay >= gameConfig.totalMainWaves) return 'Oyun Bitti';
        return `Ana Dalga ${gameState.currentMainWaveDisplay + 1} Başlat`;
    }
    if (gameState.gameStatus === 'subWaveInProgress' || gameState.gameStatus === 'waitingForNextSubWave') {
        return `Dalga ${gameState.currentMainWaveDisplay}-${gameState.currentSubWaveInMainDisplay} / ${gameConfig.subWavesPerMain}`;
    }
    return 'Dalga Başlat';
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-green-100">
      <header className="h-12 bg-green-800 text-white p-2 flex justify-between items-center shadow-lg z-20 shrink-0">
        <h1 className="text-xl font-bold ml-2">Kule Savunma Ustası</h1>
        <div className="flex items-center gap-3 mr-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsInstructionsOpen(true)}
            className="bg-green-700 text-white hover:bg-green-600 border-green-600"
          >
            Nasıl Oynanır?
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              resetGame();
              // Clear local selections on reset
              setFirstSelectedTowerForMerge(null);
              setSelectedTowerForMovingId(null);
              setShowRangeIndicatorForTower(null);
              setSelectedTowerType(null);
            }}
            className="bg-amber-600 text-white hover:bg-amber-500 border-amber-500"
          >
            Yeniden Başlat
          </Button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-2 sm:p-4"> {/* Added responsive padding */}
        <div className="w-full max-w-4xl flex flex-col items-center"> {/* Max width for game area + button */}
            <div className="shadow-2xl rounded-lg overflow-hidden border-2 border-green-800 w-full">
                <ImprovedGameBoard
                    towers={towers}
                    enemies={enemies}
                    projectiles={projectiles}
                    placementSpots={currentPlacementSpots}
                    selectedTowerType={gameState.selectedTowerType} // Pass this from gameState for highlighting spots
                    selectedTowerForMovingId={selectedTowerForMovingId}
                    onPlaceTower={handlePlaceNewTower}
                    onTowerClick={handleTowerClickOnBoard} // For clicking existing towers
                    onSelectTowerType={handleTowerSelectionForPlacement} // For selecting new tower from ImprovedGameBoard's UI
                    onMoveTowerRequest={handleMoveTowerRequest}
                    gridToPixel={gridToPixel}
                    showRangeIndicatorForTower={showRangeIndicatorForTower}
                    gameState={{...gameState, setGameState}} // Pass full gameState and setGameState
                />
            </div>
          
            {/* Dalga Başlatma Butonu */}
            <div className="w-full bg-green-800 text-white p-3 flex justify-center rounded-b-lg border-2 border-t-0 border-green-800 mt-[-2px]"> {/* Adjusted margin for seamless look */}
                <Button
                onClick={startNextWave}
                disabled={
                    !(gameState.gameStatus === 'initial' || gameState.gameStatus === 'betweenMainWaves') || 
                    gameState.isGameOver || 
                    gameState.gameStatus === 'gameWon' ||
                    !!selectedTowerForMovingId // Disable if moving a tower
                }
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-8 rounded-lg shadow-lg transition-all text-base"
                >
                {getWaveButtonText()}
                </Button>
            </div>
        </div>
      </div>

      {/* Oyun Sonu ve Talimat Ekranları */}
      <GameOverScreen
        isOpen={gameState.isGameOver && gameState.gameStatus === 'gameOver'}
        score={gameState.score}
        onRestart={() => {
            resetGame();
            setFirstSelectedTowerForMerge(null);
            setSelectedTowerForMovingId(null);
            setShowRangeIndicatorForTower(null);
            setSelectedTowerType(null);
        }}
      />
      
      <GameWonScreen
        isOpen={gameState.gameStatus === 'gameWon'}
        score={gameState.score}
        onRestart={() => {
            resetGame();
            setFirstSelectedTowerForMerge(null);
            setSelectedTowerForMovingId(null);
            setShowRangeIndicatorForTower(null);
            setSelectedTowerType(null);
        }}
      />
      
      <InstructionsModal
        isOpen={isInstructionsOpen}
        onClose={() => setIsInstructionsOpen(false)}
      />
    </div>
  );
}
