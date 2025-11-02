'use client';

import { useState, useEffect } from 'react';

interface CountdownProps {
  targetTime: number;
}

export default function Countdown({ targetTime }: CountdownProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, targetTime - now);
      setRemaining(Math.ceil(diff / 1000));
    };

    update();
    const interval = setInterval(update, 100);

    return () => clearInterval(interval);
  }, [targetTime]);

  if (remaining <= 0) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="text-9xl font-bold text-white animate-pulse">
        {remaining}
      </div>
    </div>
  );
}

