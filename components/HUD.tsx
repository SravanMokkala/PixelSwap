'use client';

interface Player {
  handle: string;
  moves: number;
  percent: number;
  durationMs?: number;
  won?: boolean;
}

interface HUDProps {
  myPlayer?: Player;
  opponentPlayer?: Player;
  moves: number;
  percentCorrect: number;
  elapsed: number;
}

export default function HUD({
  myPlayer,
  opponentPlayer,
  moves,
  percentCorrect,
  elapsed,
}: HUDProps) {
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const remainingMs = 2.5 * 60 * 1000 - elapsed; // 2:30
  const timeRemaining = Math.max(0, remainingMs);

  return (
    <div className="max-w-4xl mx-auto mb-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* My Stats */}
        <div className="space-y-2">
          <h3 className="text-white font-semibold text-lg">You ({myPlayer?.handle || 'You'})</h3>
          <div className="space-y-1 text-white/90">
            <div>Time: {formatTime(elapsed)}</div>
            <div>Moves: {moves}</div>
            <div>Correct: {percentCorrect}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${percentCorrect}%` }}
              />
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className="space-y-2 text-center">
          <h3 className="text-white font-semibold text-lg">Time Remaining</h3>
          <div className={`text-3xl font-bold ${timeRemaining < 60000 ? 'text-red-400' : 'text-white'}`}>
            {formatTime(timeRemaining)}
          </div>
        </div>

        {/* Opponent Stats */}
        <div className="space-y-2">
          <h3 className="text-white font-semibold text-lg">Opponent ({opponentPlayer?.handle || 'Waiting...'})</h3>
          <div className="space-y-1 text-white/90">
            <div>
              Time: {opponentPlayer?.durationMs ? formatTime(opponentPlayer.durationMs) : '--:--'}
            </div>
            <div>Moves: {opponentPlayer?.moves || 0}</div>
            <div>Correct: {opponentPlayer?.percent || 0}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${opponentPlayer?.percent || 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

