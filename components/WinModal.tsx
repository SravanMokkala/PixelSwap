'use client';

interface Player {
  handle: string;
  moves: number;
  percent: number;
  durationMs?: number;
  won?: boolean;
}

interface WinModalProps {
  result: {
    winnerId?: string;
    p1Time?: number;
    p2Time?: number;
    adjudicated?: boolean;
    solved?: boolean;
    timeout?: boolean;
  };
  myPlayer?: Player;
  opponentPlayer?: Player;
  userId: string;
  onClose: () => void;
}

export default function WinModal({
  result,
  myPlayer,
  opponentPlayer,
  userId,
  onClose,
}: WinModalProps) {
  const formatTime = (ms?: number): string => {
    if (ms === undefined) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const iWon = result.winnerId === userId;
  const wasTie = !result.winnerId;
  
  // Determine winner name - always show actual player name
  let winnerName = '';
  if (result.winnerId) {
    // Check if winner is the current user
    if (result.winnerId === userId && myPlayer?.handle) {
      winnerName = myPlayer.handle;
    } 
    // Check if winner is opponent
    else if (result.winnerId !== userId && opponentPlayer?.handle) {
      winnerName = opponentPlayer.handle;
    }
    // Fallback to generic name
    else {
      winnerName = 'Player';
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full">
        <h2 className="text-4xl font-bold text-center mb-6 text-white">
          {wasTie ? '🤝 Tie!' : result.winnerId ? `${winnerName} Won!` : 'Game Over'}
        </h2>

        <div className="space-y-4 mb-6">
          <div className="bg-white/10 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Your Results</h3>
            <div className="text-white/90 space-y-1">
              <div>Time: {formatTime(myPlayer?.durationMs)}</div>
              <div>Moves: {myPlayer?.moves || 0}</div>
              <div>Correct: {myPlayer?.percent || 0}%</div>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Opponent Results</h3>
            <div className="text-white/90 space-y-1">
              <div>Time: {formatTime(opponentPlayer?.durationMs)}</div>
              <div>Moves: {opponentPlayer?.moves || 0}</div>
              <div>Correct: {opponentPlayer?.percent || 0}%</div>
            </div>
          </div>

          {result.timeout && (
            <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-200 px-4 py-2 rounded text-sm text-center">
              Time limit reached (1 minute)
            </div>
          )}

          {result.adjudicated && (
            <div className="bg-blue-500/20 border border-blue-500 text-blue-200 px-4 py-2 rounded text-sm text-center">
              Winner decided by tiebreakers
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}

