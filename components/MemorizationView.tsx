'use client';

import { useState, useEffect } from 'react';

interface MemorizationViewProps {
  imageUrl: string;
  startTime: number;
  duration: number; // in milliseconds
}

export default function MemorizationView({ imageUrl, startTime, duration }: MemorizationViewProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const timeLeft = Math.max(0, duration - elapsed);
      setRemaining(Math.ceil(timeLeft / 1000));
    };

    update();
    const interval = setInterval(update, 100);

    return () => clearInterval(interval);
  }, [startTime, duration]);

  if (remaining <= 0) return null;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="max-w-7xl w-full px-4 flex items-center gap-8">
        <div className="flex-1 text-center">
          <h2 className="text-white text-4xl font-bold animate-pulse">
            Memorize the Image
          </h2>
        </div>
        <div className="relative flex-1 max-w-2xl" style={{ aspectRatio: '1' }}>
          <img
            src={imageUrl}
            alt="Image to memorize"
            className="w-full h-full object-contain border-4 border-white rounded-lg"
          />
        </div>
        <div className="flex-1 text-center">
          <div className="text-white text-6xl font-bold">
            {remaining}
          </div>
        </div>
      </div>
    </div>
  );
}

