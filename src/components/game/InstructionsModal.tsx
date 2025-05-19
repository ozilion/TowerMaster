
"use client";

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card text-card-foreground shadow-xl rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-primary">Nasıl Oynanır?</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] p-1 pr-4 my-4">
          <div className="space-y-3 text-sm text-foreground">
            <p><strong>Amaç:</strong> Düşmanların yolun sonuna ulaşmasını engellemek.</p>
            
            <h4 className="font-semibold mt-2 text-primary">Temel Mekanikler:</h4>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Düşmanlar belirli bir yolda dalga şeklinde ilerler.</li>
              <li>Kuleleri sadece haritadaki işaretli taş bloklara yerleştirebilirsin.</li>
              <li>Her öldürülen düşman için para kazanırsın.</li>
              <li>Kazandığın parayla yeni kuleler alabilir veya mevcut kuleleri birleştirebilirsin.</li>
              <li>Aynı tipte ve aynı seviyedeki iki kuleyi birleştirerek daha güçlü bir kule (maksimum 3. seviye) elde edebilirsin. Birleştirmek için önce bir kuleye, sonra diğerine tıkla.</li>
              <li>Düşmanlar yolun sonuna ulaştığında canın azalır. Canın biterse oyun sona erer.</li>
            </ul>

            <h4 className="font-semibold mt-2 text-primary">Oyun Akışı:</h4>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Oyuna belirli bir miktar para ile başlarsın.</li>
              <li>Sağdaki menüden kule seçip haritadaki uygun bir yere tıklayarak kule yerleştir.</li>
              <li>"Dalga Başlat" düğmesi ile düşman dalgalarını başlat.</li>
              <li>Dalgalar arasında kule yerleştirebilir ve birleştirebilirsin.</li>
              <li>Her dalga bir öncekinden daha zorlu olacaktır.</li>
            </ul>

            <h4 className="font-semibold mt-2 text-primary">Kule Bilgileri:</h4>
            <ul className="list-disc list-inside space-y-1 pl-2">
                <li><strong>Basit Kule:</strong> Dengeli hasar, menzil ve atış hızı.</li>
                <li><strong>Ateş Kulesi:</strong> Yüksek hasar, kısa menzil, hızlı atış.</li>
                <li><strong>Buz Kulesi:</strong> Düşük hasar, uzun menzil, yavaş atış (ileride yavaşlatma etkisi eklenebilir).</li>
            </ul>
            <p>Kulelerin üzerine tıklayarak özelliklerini (hasar, menzil, atış hızı, birleştirme bedeli) görebilirsin.</p>
          </div>
        </ScrollArea>
        <DialogFooter className="sm:justify-center">
          <Button type="button" onClick={onClose} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Anladım
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InstructionsModal;
