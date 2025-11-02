'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [handle, setHandle] = useState('');
  const [matchLink, setMatchLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Load handle from localStorage on mount
  useEffect(() => {
    const savedHandle = localStorage.getItem('handle');
    if (savedHandle) {
      setHandle(savedHandle);
    }
  }, []);

  const handleSignup = async (skipLoadingReset = false) => {
    if (!handle.trim()) {
      setError('Please enter a handle');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim() }),
      });

      if (!res.ok) {
        throw new Error('Failed to sign up');
      }

      const { userId } = await res.json();
      localStorage.setItem('userId', userId);
      localStorage.setItem('handle', handle.trim());
      
      if (!skipLoadingReset) {
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to sign up. Please try again.');
      setLoading(false);
      return;
    }
  };

  const handleCreateMatch = async () => {
    if (!handle.trim()) {
      setError('Please enter a handle');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Sign up first if needed
      let userId = localStorage.getItem('userId');
      if (!userId) {
        await handleSignup();
        userId = localStorage.getItem('userId');
        if (!userId) throw new Error('Failed to get userId');
      }

      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          handle: handle.trim() || localStorage.getItem('handle') || 'Player',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create match');
      }

      const data = await res.json();
      // Automatically navigate to the match page - Player 1 is already in the match
      router.push(`/match/${data.matchId}`);
    } catch (err) {
      setError('Failed to create match. Please try again.');
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(matchLink);
    alert('Match link copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          PixelSwap
        </h1>
        <p className="text-white/80 text-center mb-8">
          Race to reconstruct the image
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Handle</label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Enter your handle"
              className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && handle.trim()) {
                  handleCreateMatch();
                }
              }}
            />
          </div>

          {!matchLink ? (
            <button
              onClick={handleCreateMatch}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Match'}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-white/80 text-sm mb-2">Match created! Share this link:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={matchLink}
                    readOnly
                    className="flex-1 px-3 py-2 rounded bg-white/20 text-white text-sm border border-white/30"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <button
                onClick={() => router.push(matchLink.replace(window.location.origin, ''))}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition"
              >
                Start Game
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

