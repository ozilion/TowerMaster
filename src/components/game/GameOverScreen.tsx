
"use client";

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'; // Assuming DialogClose might not be needed if controlled externally

interface GameOverScreenProps {
  isOpen: boolean;
  score: number;
  onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ isOpen, score, onRestart }) => {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onRestart()}> {/* Restart if dialog is closed by clicking outside or Esc */}
      <DialogContent className="sm:max-w-md bg-card text-card-foreground shadow-xl rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-destructive">Oyun Bitti!</DialogTitle>
          <DialogDescription className="text-center text-lg mt-2">
            Maalesef tüm canlarını kaybettin.
          </DialogDescription>
        </DialogHeader>
        <div className="my-6 text-center">
          <p className="text-xl">
            Skorun: <span className="font-semibold text-primary">{score}</span>
          </p>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            onClick={onRestart}
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-3 px-6"
          >
            Yeniden Başlat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GameOverScreen;
