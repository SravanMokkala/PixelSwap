'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GameGrid from '@/components/GameGrid';
import HUD from '@/components/HUD';
import Countdown from '@/components/Countdown';
import MemorizationView from '@/components/MemorizationView';
import WinModal from '@/components/WinModal';
import { scrambleBoard, isSolved, calculatePercentCorrect } from '@/lib/scramble';

// Helper to check if user is in match (client-side check)
function isUserInMatchClient(match: MatchState | null, userId: string | null): boolean {
  if (!match || !userId) return false;
  return match.p1?.handle === userId || match.p2?.handle === userId || 
         match.p1?.userId === userId || match.p2?.userId === userId;
}

interface MatchState {
  id: string;
  rows: number;
  cols: number;
  k: number;
  seed: string;
  imageUrl: string;
  status: 'waiting' | 'active' | 'done';
  startedAt?: number;
  winnerId?: string;
  p1?: {
    userId?: string;
    handle: string;
    moves: number;
    percent: number;
    durationMs?: number;
    won?: boolean;
    ready?: boolean;
    board?: number[];
  };
  p2?: {
    userId?: string;
    handle: string;
    moves: number;
    percent: number;
    durationMs?: number;
    won?: boolean;
    ready?: boolean;
    board?: number[];
  };
}

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [match, setMatch] = useState<MatchState | null>(null);
  const [p1Board, setP1Board] = useState<number[]>([]);
  const [p2Board, setP2Board] = useState<number[]>([]);
  const [consecutive404s, setConsecutive404s] = useState(0);
  const [selectedTileP1, setSelectedTileP1] = useState<number | null>(null);
  const [selectedTileP2, setSelectedTileP2] = useState<number | null>(null);
  const [highlightedTileP1, setHighlightedTileP1] = useState<number>(0); // Track highlighted position for P1
  const [highlightedTileP2, setHighlightedTileP2] = useState<number>(0); // Track highlighted position for P2
  const [p1Moves, setP1Moves] = useState(0);
  const [p2Moves, setP2Moves] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [clientStartTime, setClientStartTime] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [finishResult, setFinishResult] = useState<any>(null);
  const timeoutTriggeredRef = useRef(false);
  const [lastInputTime, setLastInputTime] = useState(0);

  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [enteredHandle, setEnteredHandle] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);

  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
  const handle = typeof window !== 'undefined' ? localStorage.getItem('handle') : null;
  const displayHandle = handle || enteredHandle;

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const p1BoardRef = useRef<number[]>([]);
  const p2BoardRef = useRef<number[]>([]);
  const p1MovesRef = useRef(0);
  const p2MovesRef = useRef(0);

  // Initialize boards when match data is available
  useEffect(() => {
    if (match && match.seed && match.rows && match.cols && match.k && p1Board.length === 0) {
      // Only initialize if we don't have server board state
      if (match.status === 'active') {
        // Try to get from server state first
        if (match.p1?.board && Array.isArray(match.p1.board) && match.p1.board.length === 25) {
          setP1Board(match.p1.board);
        } else {
          const scrambled = scrambleBoard(match.seed, match.rows, match.cols, match.k);
          setP1Board(scrambled);
        }
        
        if (match.p2?.board && Array.isArray(match.p2.board) && match.p2.board.length === 25) {
          setP2Board(match.p2.board);
        } else {
          const scrambled = scrambleBoard(match.seed, match.rows, match.cols, match.k);
          setP2Board(scrambled);
        }
      } else {
        // For waiting matches, just initialize from seed
        const scrambled = scrambleBoard(match.seed, match.rows, match.cols, match.k);
        setP1Board(scrambled);
        setP2Board(scrambled);
      }
    }
  }, [match, p1Board.length]);

  // Fetch match state
  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/match/${matchId}`);
      if (!res.ok) {
        if (res.status === 404) {
          const errorData = await res.json().catch(() => ({}));
          const new404Count = consecutive404s + 1;
          setConsecutive404s(new404Count);
          
          // Only show error if we've had multiple consecutive 404s and we had match data
          // This prevents showing errors on transient issues
          if (match && new404Count >= 3) {
            setJoinError('Match not found. It may have expired or been deleted. Click the button below to go home and create a new match.');
          } else if (match) {
            // First or second 404 - might be a timing issue, just show error and wait
            setJoinError(errorData.error || 'Match temporarily unavailable. Please wait...');
          } else {
            setJoinError(errorData.error || 'Match not found');
          }
        } else {
          // Only set error for non-404 errors, and only if we don't have match data yet
          if (!match) {
            setJoinError('Failed to fetch match state');
          }
        }
        return;
      }
      const data = await res.json();
      setMatch(data);
      
      // Clear error and reset 404 counter on successful fetch
      setJoinError(null);
      setConsecutive404s(0);
      
      // Update both boards from server state (always sync from server for real-time updates)
      if (data.status === 'active') {
        // Always update boards from server state to keep them in sync
        // Compare with current state to avoid unnecessary updates
        if (data.p1?.board && Array.isArray(data.p1.board) && data.p1.board.length === 25) {
          const currentP1BoardStr = JSON.stringify(p1BoardRef.current);
          const serverP1BoardStr = JSON.stringify(data.p1.board);
          if (currentP1BoardStr !== serverP1BoardStr) {
            setP1Board(data.p1.board);
          }
        } else if (p1Board.length === 0 && data.seed && data.rows && data.cols && data.k) {
          // Initialize if no server board state yet
          const scrambled = scrambleBoard(data.seed, data.rows, data.cols, data.k);
          setP1Board(scrambled);
        }
        
        if (data.p2?.board && Array.isArray(data.p2.board) && data.p2.board.length === 25) {
          const currentP2BoardStr = JSON.stringify(p2BoardRef.current);
          const serverP2BoardStr = JSON.stringify(data.p2.board);
          if (currentP2BoardStr !== serverP2BoardStr) {
            setP2Board(data.p2.board);
          }
        } else if (p2Board.length === 0 && data.seed && data.rows && data.cols && data.k) {
          // Initialize if no server board state yet
          const scrambled = scrambleBoard(data.seed, data.rows, data.cols, data.k);
          setP2Board(scrambled);
        }
        
        // Update moves from server state to keep in sync
        if (data.p1?.moves !== undefined && data.p1.moves !== p1MovesRef.current) {
          setP1Moves(data.p1.moves);
        }
        if (data.p2?.moves !== undefined && data.p2.moves !== p2MovesRef.current) {
          setP2Moves(data.p2.moves);
        }
      }

      // For active matches, allow anyone to view (for multi-tab support)
      // Only require join for waiting matches
      if (data.status === 'active') {
        // Active matches - allow viewing even without userId (multi-tab support)
        setHasJoined(true);
        
        // Ensure boards are initialized even if we just loaded the match
        if (p1Board.length === 0 || p2Board.length === 0) {
          if (data.p1?.board && Array.isArray(data.p1.board) && data.p1.board.length === 25) {
            setP1Board(data.p1.board);
          }
          if (data.p2?.board && Array.isArray(data.p2.board) && data.p2.board.length === 25) {
            setP2Board(data.p2.board);
          }
          
          // Fallback to seed if no board state available
          if ((p1Board.length === 0 || p2Board.length === 0) && data.seed && data.rows && data.cols && data.k) {
            const scrambled = scrambleBoard(data.seed, data.rows, data.cols, data.k);
            if (p1Board.length === 0) setP1Board(scrambled);
            if (p2Board.length === 0) setP2Board(scrambled);
          }
        }
      } else if (data && userId) {
        // Waiting matches - check if already joined
        const isPlayer1 = data.p1?.userId && data.p1.userId === userId;
        const isPlayer2 = data.p2?.userId && data.p2.userId === userId;
        
        if (isPlayer1 || isPlayer2) {
          setHasJoined(true);
        } else {
          setHasJoined(false);
        }
      } else {
        setHasJoined(false);
      }

      if (data.startedAt !== undefined && startTime === null) {
        setStartTime(data.startedAt);
      }

      // Check if game finished - automatically show modal
      if (data.status === 'done' && !gameFinished) {
        setGameFinished(true);
        // Set finish result with winner info
        setFinishResult({
          winnerId: data.winnerId,
          p1Time: data.p1?.durationMs,
          p2Time: data.p2?.durationMs,
          solved: (data.p1?.won && data.p1?.percent === 100) || (data.p2?.won && data.p2?.percent === 100),
          timeout: !data.p1?.won && !data.p2?.won && data.status === 'done', // Neither won but match is done = timeout
          adjudicated: data.p1?.won === false || data.p2?.won === false, // If someone lost, it might have been adjudicated
        });
      }
    } catch (error) {
      console.error('Failed to fetch match:', error);
      // Only set error if we don't have match data
      if (!match) {
        setJoinError('Failed to fetch match state');
      }
    }
  }, [matchId, startTime, gameFinished, userId, match, consecutive404s, router]);

  // Fetch match state first (without needing to join)
  useEffect(() => {
    if (matchId) {
      fetchMatch();
    }
  }, [matchId, fetchMatch]);


  // Handle signup from match page - ALWAYS joins as Player 2
  const handleSignupAndJoin = async () => {
    if (!enteredHandle.trim()) {
      setJoinError('Please enter your name');
      return;
    }

    setIsSigningUp(true);
    setJoinError(null);

    try {
      // Sign up first (or use existing userId if they have one)
      let newUserId: string = userId || '';
      if (!newUserId) {
        const signupRes = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle: enteredHandle.trim() }),
        });

        if (!signupRes.ok) {
          throw new Error('Failed to sign up');
        }

        const data = await signupRes.json();
        newUserId = data.userId;
        if (!newUserId) {
          throw new Error('Failed to get userId');
        }
        localStorage.setItem('userId', newUserId);
        localStorage.setItem('handle', enteredHandle.trim());
      }

      // Now join the match as Player 2
      const joinRes = await fetch(`/api/match/${matchId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newUserId, handle: enteredHandle.trim() }),
      });

      if (!joinRes.ok) {
        const errorData = await joinRes.json().catch(() => ({ error: 'Failed to join match' }));
        throw new Error(errorData.error || 'Failed to join match');
      }

      // Successfully joined - refresh match state
      setHasJoined(true);
      setJoinError(null);
      fetchMatch();
    } catch (error: any) {
      setJoinError(error.message || 'Failed to join match. Please try again.');
      setIsSigningUp(false);
    }
  };

  // Note: We removed the auto-join useEffect because we want manual join only
  // This gives users control and prevents confusion

  // Poll match state every 1s for faster real-time updates
  useEffect(() => {
    if (matchId) {
      pollingIntervalRef.current = setInterval(fetchMatch, 1000);
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [matchId, fetchMatch]);

  // Update refs when boards/moves change
  useEffect(() => {
    p1BoardRef.current = p1Board;
    p2BoardRef.current = p2Board;
    p1MovesRef.current = p1Moves;
    p2MovesRef.current = p2Moves;
  }, [p1Board, p2Board, p1Moves, p2Moves]);

  // Send progress updates every 2s for both boards
  // Allow updates even without userId (for multi-tab viewing)
  useEffect(() => {
    if (match?.status === 'active' && p1Board.length === 25 && p2Board.length === 25) {
      progressIntervalRef.current = setInterval(async () => {
        const currentP1Board = p1BoardRef.current;
        const currentP2Board = p2BoardRef.current;
        const currentP1Moves = p1MovesRef.current;
        const currentP2Moves = p2MovesRef.current;

        // Update P1 progress
        if (match.p1?.userId === userId) {
          const p1Percent = calculatePercentCorrect(currentP1Board);
          const p1LastCorrect = currentP1Board.findIndex((v: number, i: number) => v === i);
          try {
            await fetch(`/api/match/${matchId}/progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                percentCorrect: p1Percent,
                moves: currentP1Moves,
                lastCorrectAt: p1LastCorrect >= 0 ? Date.now() : undefined,
                board: currentP1Board,
                playerNumber: 1,
              }),
            });
          } catch (error) {
            console.error('Failed to update P1 progress:', error);
          }
        }

        // Update P2 progress
        if (match.p2?.userId === userId) {
          const p2Percent = calculatePercentCorrect(currentP2Board);
          const p2LastCorrect = currentP2Board.findIndex((v: number, i: number) => v === i);
          try {
            await fetch(`/api/match/${matchId}/progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                percentCorrect: p2Percent,
                moves: currentP2Moves,
                lastCorrectAt: p2LastCorrect >= 0 ? Date.now() : undefined,
                board: currentP2Board,
                playerNumber: 2,
              }),
            });
          } catch (error) {
            console.error('Failed to update P2 progress:', error);
          }
        }

        // Always send both boards to keep server in sync (anyone can edit either)
        // This ensures all tabs see changes immediately
        try {
          // Send P1 board state (only if we have a userId or it's a system update)
          const p1Percent = calculatePercentCorrect(currentP1Board);
          await fetch(`/api/match/${matchId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userId || 'system',
              board: currentP1Board,
              moves: currentP1Moves,
              percentCorrect: p1Percent,
              playerNumber: 1,
            }),
          }).catch(err => console.error('Failed to sync P1 board:', err));
          
          // Send P2 board state
          const p2Percent = calculatePercentCorrect(currentP2Board);
          await fetch(`/api/match/${matchId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userId || 'system',
              board: currentP2Board,
              moves: currentP2Moves,
              percentCorrect: p2Percent,
              playerNumber: 2,
            }),
          }).catch(err => console.error('Failed to sync P2 board:', err));
        } catch (error) {
          console.error('Failed to update board states:', error);
        }
      }, 2000);

      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };
    }
  }, [match?.status, userId, matchId, p1Board.length, p2Board.length, match]);

  // Handle ready
  const handleReady = async () => {
    if (!userId) return;

    try {
      const readyRes = await fetch(`/api/match/${matchId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!readyRes.ok) {
        const errorData = await readyRes.json().catch(() => ({ error: 'Failed to ready up' }));
        // Show the error message (which includes the helpful text about hot-reloads)
        setJoinError(errorData.error || 'Failed to ready up');
        
        if (readyRes.status === 404) {
          // Match not found - fetchMatch will also fail, so we've already set the error
          console.error('Ready failed - match not found');
          return;
        } else {
          console.error('Ready failed:', errorData);
          return;
        }
      }

      // Refresh match state
      await fetchMatch();
    } catch (error) {
      console.error('Failed to ready up:', error);
      setJoinError('Network error while readying up. Please try again.');
    }
  };

  // Helper function to send board update immediately
  const sendBoardUpdate = useCallback(async (boardType: 'p1' | 'p2', board: number[], moves: number) => {
    if (!match || match.status !== 'active') return;
    
    try {
      const percent = calculatePercentCorrect(board);
      await fetch(`/api/match/${matchId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || 'system',
          board,
          moves,
          percentCorrect: percent,
          playerNumber: boardType === 'p1' ? 1 : 2,
        }),
      });
    } catch (error) {
      console.error(`Failed to update ${boardType} board:`, error);
    }
  }, [match, matchId, userId]);

  // Get adjacent positions
  const getAdjacentPositions = useCallback((pos: number): number[] => {
    if (!match) return [];
    const row = Math.floor(pos / match.cols);
    const col = pos % match.cols;
    const adjacent: number[] = [];

    if (row > 0) adjacent.push(pos - match.cols);
    if (row < match.rows - 1) adjacent.push(pos + match.cols);
    if (col > 0) adjacent.push(pos - 1);
    if (col < match.cols - 1) adjacent.push(pos + 1);

    return adjacent;
  }, [match]);

  // Swap tiles for a specific board
  const swapTiles = useCallback(async (boardType: 'p1' | 'p2', pos1: number, pos2: number) => {
    if (isAnimating || gameFinished || match?.status !== 'active') return;
    if (!clientStartTime) return; // Game hasn't started yet (includes memorization phase)
    
      // Check if we're in memorization phase
      if (match?.startedAt) {
        const memorizationEndTime = match.startedAt + 20 * 1000;
        if (Date.now() < memorizationEndTime) return; // Still in memorization phase
      }
    
    // Allow anyone to make moves (for multi-tab support)

    const now = Date.now();
    if (now - lastInputTime < 80) return; // Rate limit
    setLastInputTime(now);

    const adjacent = getAdjacentPositions(pos1);
    if (!adjacent.includes(pos2)) return;

    setIsAnimating(true);

      // Perform swap on the correct board
    if (boardType === 'p1') {
      const newBoard = [...p1Board];
      [newBoard[pos1], newBoard[pos2]] = [newBoard[pos2], newBoard[pos1]];
      setP1Board(newBoard);
      const newMoves = p1Moves + 1;
      setP1Moves(newMoves);
      setSelectedTileP1(null);
      
      // Send board update immediately after swap for real-time sync
      sendBoardUpdate('p1', newBoard, newMoves);

      // Check if solved
      if (isSolved(newBoard)) {
        const solvedAt = Date.now();
        setGameFinished(true);
        setIsAnimating(false);

        try {
          const percent = calculatePercentCorrect(newBoard);
          const res = await fetch(`/api/match/${matchId}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: match.p1?.userId || userId || 'guest',
              board: newBoard,
              moves: newMoves,
              percentCorrect: percent,
              lastCorrectAt: solvedAt,
            }),
          });

          if (res.ok) {
            const result = await res.json();
            // Fetch full match state to get winner info
            const updatedMatch = await fetch(`/api/match/${matchId}`).then(res => res.ok ? res.json() : null);
            if (updatedMatch) {
              setMatch(updatedMatch);
              setFinishResult({
                winnerId: updatedMatch.winnerId || result.winnerId,
                p1Time: updatedMatch.p1?.durationMs,
                p2Time: updatedMatch.p2?.durationMs,
                solved: true,
                timeout: false,
              });
            } else {
              setFinishResult(result);
            }
            fetchMatch();
          }
        } catch (error) {
          console.error('Failed to submit finish:', error);
        }
      } else {
        setTimeout(() => setIsAnimating(false), 160);
      }
    } else {
      const newBoard = [...p2Board];
      [newBoard[pos1], newBoard[pos2]] = [newBoard[pos2], newBoard[pos1]];
      setP2Board(newBoard);
      const newMoves = p2Moves + 1;
      setP2Moves(newMoves);
      setSelectedTileP2(null);
      
      // Send board update immediately after swap
      sendBoardUpdate('p2', newBoard, newMoves);

      // Check if solved
      if (isSolved(newBoard)) {
        const solvedAt = Date.now();
        setGameFinished(true);
        setIsAnimating(false);

        try {
          const percent = calculatePercentCorrect(newBoard);
          const res = await fetch(`/api/match/${matchId}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: match.p2?.userId || userId || 'guest',
              board: newBoard,
              moves: newMoves,
              percentCorrect: percent,
              lastCorrectAt: solvedAt,
            }),
          });

          if (res.ok) {
            const result = await res.json();
            // Fetch full match state to get winner info
            const updatedMatch = await fetch(`/api/match/${matchId}`).then(res => res.ok ? res.json() : null);
            if (updatedMatch) {
              setMatch(updatedMatch);
              setFinishResult({
                winnerId: updatedMatch.winnerId || result.winnerId,
                p1Time: updatedMatch.p1?.durationMs,
                p2Time: updatedMatch.p2?.durationMs,
                solved: true,
                timeout: false,
              });
            } else {
              setFinishResult(result);
            }
            fetchMatch();
          }
        } catch (error) {
          console.error('Failed to submit finish:', error);
        }
      } else {
        setTimeout(() => setIsAnimating(false), 160);
      }
    }
  }, [p1Board, p2Board, p1Moves, p2Moves, isAnimating, gameFinished, match?.status, clientStartTime, lastInputTime, getAdjacentPositions, matchId, userId, fetchMatch, match, sendBoardUpdate]);

  // Remove click handlers - using keyboard only now
  const handleTileClickP1 = () => {}; // No-op
  const handleTileClickP2 = () => {}; // No-op

  // Keyboard controls
  // Left board (P1): WASD to move, Tab to select/swap
  // Right board (P2): Arrow keys to move, Shift to select/swap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating || gameFinished || match?.status !== 'active' || !clientStartTime) return;
      
      // Disable controls during memorization phase
      if (match?.startedAt) {
        const memorizationEndTime = match.startedAt + 20 * 1000;
        if (Date.now() < memorizationEndTime) return;
      }

      // Prevent default for keys we're using
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'Tab', 'Shift'].includes(e.key)) {
        e.preventDefault();
      }

      // LEFT BOARD (P1) - WASD controls
      if (e.key === 'w' || e.key === 'W') {
        const newPos = Math.max(0, highlightedTileP1 - match!.cols);
        setHighlightedTileP1(newPos);
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        const newPos = Math.min(match!.rows * match!.cols - 1, highlightedTileP1 + match!.cols);
        setHighlightedTileP1(newPos);
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        const newPos = Math.max(0, highlightedTileP1 - 1);
        if (Math.floor(newPos / match!.cols) === Math.floor(highlightedTileP1 / match!.cols)) {
          setHighlightedTileP1(newPos);
        }
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        const newPos = Math.min(match!.rows * match!.cols - 1, highlightedTileP1 + 1);
        if (Math.floor(newPos / match!.cols) === Math.floor(highlightedTileP1 / match!.cols)) {
          setHighlightedTileP1(newPos);
        }
        return;
      }
      // Handle Tab for P1 board (only Tab, not Shift+Tab)
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (selectedTileP1 === null) {
          // Select the highlighted tile
          setSelectedTileP1(highlightedTileP1);
        } else {
          // Check if highlighted tile is adjacent to selected tile
          const adjacent = getAdjacentPositions(selectedTileP1);
          if (adjacent.includes(highlightedTileP1)) {
            // Swap with highlighted tile
            swapTiles('p1', selectedTileP1, highlightedTileP1);
            setSelectedTileP1(null);
          } else if (highlightedTileP1 === selectedTileP1) {
            // Deselect if same tile
            setSelectedTileP1(null);
          } else {
            // Select the new highlighted tile
            setSelectedTileP1(highlightedTileP1);
          }
        }
        return;
      }

      // RIGHT BOARD (P2) - Arrow keys controls
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newPos = Math.max(0, highlightedTileP2 - match!.cols);
        setHighlightedTileP2(newPos);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newPos = Math.min(match!.rows * match!.cols - 1, highlightedTileP2 + match!.cols);
        setHighlightedTileP2(newPos);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newPos = Math.max(0, highlightedTileP2 - 1);
        if (Math.floor(newPos / match!.cols) === Math.floor(highlightedTileP2 / match!.cols)) {
          setHighlightedTileP2(newPos);
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newPos = Math.min(match!.rows * match!.cols - 1, highlightedTileP2 + 1);
        if (Math.floor(newPos / match!.cols) === Math.floor(highlightedTileP2 / match!.cols)) {
          setHighlightedTileP2(newPos);
        }
        return;
      }
      // Handle Shift for P2 board
      if (e.key === 'Shift') {
        e.preventDefault();
        if (selectedTileP2 === null) {
          // Select the highlighted tile
          setSelectedTileP2(highlightedTileP2);
        } else {
          // Check if highlighted tile is adjacent to selected tile
          const adjacent = getAdjacentPositions(selectedTileP2);
          if (adjacent.includes(highlightedTileP2)) {
            // Swap with highlighted tile
            swapTiles('p2', selectedTileP2, highlightedTileP2);
            setSelectedTileP2(null);
          } else if (highlightedTileP2 === selectedTileP2) {
            // Deselect if same tile
            setSelectedTileP2(null);
          } else {
            // Select the new highlighted tile
            setSelectedTileP2(highlightedTileP2);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTileP1, selectedTileP2, highlightedTileP1, highlightedTileP2, isAnimating, gameFinished, match?.status, clientStartTime, getAdjacentPositions, swapTiles, match]);

  // Update client start time when server start time is known
  // Start timer after memorization phase (20 seconds after match starts)
  useEffect(() => {
    if (match?.startedAt && !clientStartTime) {
      const now = Date.now();
      const delay = match.startedAt - now;
      const memorizationDuration = 20 * 1000; // 20 seconds
      
      if (delay > 0) {
        // Wait for countdown + memorization phase
        setTimeout(() => {
          const actualGameStart = match.startedAt! + memorizationDuration;
          const gameStartDelay = actualGameStart - Date.now();
          if (gameStartDelay > 0) {
            setTimeout(() => {
              setClientStartTime(Date.now());
            }, gameStartDelay);
          } else {
            setClientStartTime(Date.now());
          }
        }, delay);
      } else {
        // Game already started, check if we're past memorization
        const memorizationEnd = match.startedAt + memorizationDuration;
        if (Date.now() >= memorizationEnd) {
          setClientStartTime(Date.now());
        } else {
          // Still in memorization, wait for it to end
          const remaining = memorizationEnd - Date.now();
          setTimeout(() => {
            setClientStartTime(Date.now());
          }, remaining);
        }
      }
    }
  }, [match?.startedAt, clientStartTime]);

  // Timeout check (1 minute for testing) - backup check via interval
  useEffect(() => {
    if (match?.status === 'active' && !gameFinished && !timeoutTriggeredRef.current) {
      const checkTimeout = setInterval(() => {
        // Use clientStartTime if available (actual game start after memorization)
        // Otherwise calculate from match.startedAt + memorization duration
        const actualStartTime = clientStartTime || (match?.startedAt ? match.startedAt + 20 * 1000 : null);
        if (!actualStartTime) return; // Wait until we have a start time
        
        const elapsed = Date.now() - actualStartTime;
        const MATCH_DURATION_MS = 1 * 60 * 1000; // 1 minute
        
        if (elapsed >= MATCH_DURATION_MS && !gameFinished && !timeoutTriggeredRef.current) {
          // Clear the interval immediately to prevent multiple triggers
          clearInterval(checkTimeout);
          timeoutTriggeredRef.current = true;
          console.log('Timeout triggered (interval)! Elapsed:', elapsed, 'ms');
          // Timeout - submit current state for both players
          const p1Percent = calculatePercentCorrect(p1BoardRef.current);
          const p2Percent = calculatePercentCorrect(p2BoardRef.current);
          const p1LastCorrect = p1BoardRef.current.findIndex((v: number, i: number) => v === i);
          const p2LastCorrect = p2BoardRef.current.findIndex((v: number, i: number) => v === i);

          // Submit P1 finish
          const p1FinishPromise = match?.p1?.userId ? fetch(`/api/match/${matchId}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: match.p1.userId,
              board: p1BoardRef.current,
              moves: p1MovesRef.current,
              percentCorrect: p1Percent,
              lastCorrectAt: p1LastCorrect >= 0 ? Date.now() : undefined,
            }),
          }).catch(console.error) : Promise.resolve();

          // Submit P2 finish
          const p2FinishPromise = match?.p2?.userId ? fetch(`/api/match/${matchId}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: match.p2.userId,
              board: p2BoardRef.current,
              moves: p2MovesRef.current,
              percentCorrect: p2Percent,
              lastCorrectAt: p2LastCorrect >= 0 ? Date.now() : undefined,
            }),
          }).catch(console.error) : Promise.resolve();

          // Wait for both finish requests, then fetch match state and show modal
          Promise.all([p1FinishPromise, p2FinishPromise])
            .then(() => {
              // Small delay to ensure server has processed the finish requests
              return new Promise(resolve => setTimeout(resolve, 500));
            })
            .then(() => fetch(`/api/match/${matchId}`))
            .then(res => res.ok ? res.json() : null)
            .then(updatedMatch => {
              console.log('Timeout: Got updated match:', updatedMatch);
              if (updatedMatch) {
                setMatch(updatedMatch);
                setFinishResult({
                  winnerId: updatedMatch.winnerId,
                  p1Time: updatedMatch.p1?.durationMs,
                  p2Time: updatedMatch.p2?.durationMs,
                  solved: false,
                  timeout: true,
                  adjudicated: true,
                });
                setGameFinished(true);
                console.log('Timeout: Set gameFinished and finishResult');
              } else {
                // Fallback if match fetch fails - still show modal
                console.log('Timeout: Match fetch failed, using fallback');
                setFinishResult({
                  winnerId: match?.p1?.userId || match?.p2?.userId,
                  p1Time: undefined,
                  p2Time: undefined,
                  solved: false,
                  timeout: true,
                  adjudicated: true,
                });
                setGameFinished(true);
              }
            })
            .catch(error => {
              console.error('Error handling timeout:', error);
              // Still show modal even if there's an error
              setFinishResult({
                winnerId: match?.p1?.userId || match?.p2?.userId,
                p1Time: undefined,
                p2Time: undefined,
                solved: false,
                timeout: true,
                adjudicated: true,
              });
              setGameFinished(true);
              console.log('Timeout: Set gameFinished and finishResult (error case)');
            });
          fetchMatch();
        }
      }, 500); // Check every 500ms for faster timeout detection

      return () => clearInterval(checkTimeout);
    }
  }, [match?.status, startTime, clientStartTime, gameFinished, matchId, fetchMatch, match, p1BoardRef, p2BoardRef, p1MovesRef, p2MovesRef]);

  // Calculate values needed for timeout check (before early returns)
  const actualStartTime = clientStartTime || (match?.startedAt ? match.startedAt + 20 * 1000 : null);
  const elapsed = actualStartTime ? Date.now() - actualStartTime : 0;
  const MATCH_DURATION_MS = 1 * 60 * 1000; // 1 minute for testing
  const MEMORIZATION_DURATION_MS = 20 * 1000; // 20 seconds
  const memorizationEndTime = match?.startedAt ? match.startedAt + MEMORIZATION_DURATION_MS : 0;
  const gameCanStart = match?.startedAt && Date.now() >= memorizationEndTime;
  const timeRemaining = Math.max(0, MATCH_DURATION_MS - elapsed);

  // Trigger timeout immediately when timer hits 0 (must be before early returns)
  useEffect(() => {
    if (match?.status === 'active' && !gameFinished && !timeoutTriggeredRef.current && gameCanStart && timeRemaining <= 0 && elapsed > 0) {
      console.log('Timer reached 0:00, triggering timeout immediately');
      timeoutTriggeredRef.current = true; // Prevent multiple triggers
      
      if (!gameFinished) {
        const p1Percent = calculatePercentCorrect(p1BoardRef.current);
        const p2Percent = calculatePercentCorrect(p2BoardRef.current);
        const p1LastCorrect = p1BoardRef.current.findIndex((v: number, i: number) => v === i);
        const p2LastCorrect = p2BoardRef.current.findIndex((v: number, i: number) => v === i);

        // Submit P1 finish
        const p1FinishPromise = match?.p1?.userId ? fetch(`/api/match/${matchId}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: match.p1.userId,
            board: p1BoardRef.current,
            moves: p1MovesRef.current,
            percentCorrect: p1Percent,
            lastCorrectAt: p1LastCorrect >= 0 ? Date.now() : undefined,
          }),
        }).catch(console.error) : Promise.resolve();

        // Submit P2 finish
        const p2FinishPromise = match?.p2?.userId ? fetch(`/api/match/${matchId}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: match.p2.userId,
            board: p2BoardRef.current,
            moves: p2MovesRef.current,
            percentCorrect: p2Percent,
            lastCorrectAt: p2LastCorrect >= 0 ? Date.now() : undefined,
          }),
        }).catch(console.error) : Promise.resolve();

        // Wait for both finish requests, then fetch match state and show modal
        Promise.all([p1FinishPromise, p2FinishPromise])
          .then(() => {
            // Small delay to ensure server has processed the finish requests
            return new Promise(resolve => setTimeout(resolve, 500));
          })
          .then(() => fetch(`/api/match/${matchId}`))
          .then(res => res.ok ? res.json() : null)
          .then(updatedMatch => {
            console.log('Timeout (0:00): Got updated match:', updatedMatch);
            if (updatedMatch) {
              setMatch(updatedMatch);
              setFinishResult({
                winnerId: updatedMatch.winnerId,
                p1Time: updatedMatch.p1?.durationMs,
                p2Time: updatedMatch.p2?.durationMs,
                solved: false,
                timeout: true,
                adjudicated: true,
              });
              setGameFinished(true);
              console.log('Timeout (0:00): Set gameFinished and finishResult');
            } else {
              // Fallback if match fetch fails - still show modal
              console.log('Timeout (0:00): Match fetch failed, using fallback');
              setFinishResult({
                winnerId: match?.p1?.userId || match?.p2?.userId,
                p1Time: undefined,
                p2Time: undefined,
                solved: false,
                timeout: true,
                adjudicated: true,
              });
              setGameFinished(true);
            }
          })
          .catch(error => {
            console.error('Error handling timeout (0:00):', error);
            // Still show modal even if there's an error
            setFinishResult({
              winnerId: match?.p1?.userId || match?.p2?.userId,
              p1Time: undefined,
              p2Time: undefined,
              solved: false,
              timeout: true,
              adjudicated: true,
            });
            setGameFinished(true);
            console.log('Timeout (0:00): Set gameFinished and finishResult (error case)');
          });
        fetchMatch();
      }
    }
  }, [timeRemaining, match?.status, gameFinished, gameCanStart, elapsed, matchId, match, fetchMatch, p1BoardRef, p2BoardRef, p1MovesRef, p2MovesRef]);

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full">
          <div className="text-white text-xl mb-4 text-center">Loading match...</div>
          {joinError && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
              <p className="mb-2">{joinError}</p>
              {joinError.includes('hot-reloads') || joinError.includes('server restart') ? (
                <button
                  onClick={() => router.push('/')}
                  className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
                >
                  Go to Home & Create New Match
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Check if you're Player 1 or Player 2
  const isPlayer1 = userId && match.p1?.userId ? (match.p1.userId === userId) : false;
  const isPlayer2 = userId && match.p2?.userId ? (match.p2.userId === userId) : false;
  
  // Allow anyone to view active matches - players can play from multiple tabs
  // Only block finished matches for non-players
  if (!isPlayer1 && !isPlayer2 && match.status === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Match Finished</h2>
          <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-200 px-4 py-3 rounded mb-4">
            This match has ended
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }
  
  // Handle joining as Player 2 (when someone visits the link)
  const handleJoinAsPlayer2 = async () => {
    if (!enteredHandle.trim()) {
      setJoinError('Please enter your name');
      return;
    }

    setIsSigningUp(true);
    setJoinError(null);

    try {
      // Sign up first (or use existing userId if they have one)
      let newUserId: string = userId || '';
      if (!newUserId) {
        const signupRes = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle: enteredHandle.trim() }),
        });

        if (!signupRes.ok) {
          throw new Error('Failed to sign up');
        }

        const data = await signupRes.json();
        newUserId = data.userId;
        if (!newUserId) {
          throw new Error('Failed to get userId');
        }
        localStorage.setItem('userId', newUserId);
        localStorage.setItem('handle', enteredHandle.trim());
      }

      // Join the match as Player 2
      const joinRes = await fetch(`/api/match/${matchId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newUserId, handle: enteredHandle.trim() }),
      });

      if (!joinRes.ok) {
        const errorData = await joinRes.json().catch(() => ({ error: 'Failed to join match' }));
        throw new Error(errorData.error || 'Failed to join match');
      }

      fetchMatch();
    } catch (error: any) {
      setJoinError(error.message || 'Failed to join match. Please try again.');
    } finally {
      setIsSigningUp(false);
    }
  };

  // Handle Player 1 adding Player 2 by name and starting game
  const handleStartGameWithPlayer2 = async () => {
    if (!enteredHandle.trim()) {
      setJoinError('Please enter Player 2 name');
      return;
    }

    if (!matchId) {
      setJoinError('Match ID is missing. Please refresh the page.');
      return;
    }

    if (!userId) {
      setJoinError('You must be logged in to start the game');
      return;
    }

    if (!isPlayer1) {
      setJoinError('Only Player 1 can start the game');
      return;
    }

    if (!match) {
      setJoinError('Match data not loaded. Please wait...');
      return;
    }

    setIsSigningUp(true);
    setJoinError(null);

    try {
      // Use the new endpoint that allows Player 1 to directly add Player 2
      console.log('Adding Player 2:', { 
        matchId, 
        userId, 
        player2Handle: enteredHandle.trim(),
        matchStatus: match.status,
        matchP1UserId: match.p1?.userId 
      });
      
      const addP2Res = await fetch(`/api/match/${matchId}/add-player2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          p1UserId: userId,
          player2Handle: enteredHandle.trim() 
        }),
      });

      if (!addP2Res.ok) {
        const errorText = await addP2Res.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Failed to add Player 2 (status: ${addP2Res.status})` };
        }
        console.error('Add Player 2 failed:', errorData, 'Status:', addP2Res.status);
        
        // If match not found, provide helpful message
        if (addP2Res.status === 404 && errorData.code === 'MATCH_NOT_FOUND') {
          const errorMsg = errorData.error || 'Match not found. The server may have restarted. Please create a new match.';
          // Redirect to home after showing error
          setTimeout(() => {
            router.push('/');
          }, 3000);
          throw new Error(errorMsg);
        }
        
        throw new Error(errorData.error || `Failed to add Player 2 (status: ${addP2Res.status})`);
      }

      const addP2Data = await addP2Res.json();
      const p2UserId = addP2Data.p2UserId;

      if (!p2UserId) {
        throw new Error('Failed to get Player 2 userId');
      }

      // Clear any errors before proceeding
      setJoinError(null);
      
      // Small delay to ensure match state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refresh match state to get the updated Player 2
      const fetchRes = await fetch(`/api/match/${matchId}`);
      if (fetchRes.ok) {
        const matchData = await fetchRes.json();
        setMatch(matchData);
      }

      // Mark both players as ready and start the game
      const readyRes1 = await fetch(`/api/match/${matchId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!readyRes1.ok) {
        const errorData = await readyRes1.json().catch(() => ({ error: 'Failed to ready Player 1' }));
        throw new Error(errorData.error || 'Failed to ready Player 1');
      }

      const readyRes2 = await fetch(`/api/match/${matchId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: p2UserId }),
      });

      if (!readyRes2.ok) {
        const errorData = await readyRes2.json().catch(() => ({ error: 'Failed to ready Player 2' }));
        throw new Error(errorData.error || 'Failed to ready Player 2');
      }

      // Game should start automatically when both are ready
      // Refresh match state to see the game start
      await new Promise(resolve => setTimeout(resolve, 200));
      fetchMatch();
      setJoinError(null); // Clear any errors on success
    } catch (error: any) {
      console.error('Error starting game:', error);
      setJoinError(error.message || 'Failed to start game');
      setIsSigningUp(false);
    }
  };

  const myPlayer = isPlayer1 ? match.p1 : match.p2;
  const opponentPlayer = isPlayer1 ? match.p2 : match.p1;
  const p1PercentCorrect = p1Board.length === 25 ? calculatePercentCorrect(p1Board) : 0;
  const p2PercentCorrect = p2Board.length === 25 ? calculatePercentCorrect(p2Board) : 0;
  
  // Memorization phase: 20 seconds after game starts
  const isMemorizationPhase = match?.status === 'active' && match.startedAt && Date.now() >= match.startedAt && Date.now() < memorizationEndTime;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      {match.status === 'waiting' && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Waiting for Players</h2>
            
            {joinError && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
                <p className="mb-2">{joinError}</p>
                {joinError.includes('hot-reloads') || joinError.includes('server restart') ? (
                  <button
                    onClick={() => router.push('/')}
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
                  >
                    Go to Home & Create New Match
                  </button>
                ) : null}
              </div>
            )}

            <div className="space-y-6">
              <div className="text-white text-center">
                <p className="text-lg mb-2">Player 1: <span className="font-semibold">{match.p1?.handle || 'Waiting...'}</span></p>
                <p className="text-lg">Player 2: <span className="font-semibold">{match.p2?.handle || 'Waiting...'}</span></p>
              </div>

              {/* If no Player 2, show input field for Player 2 name */}
              {!match.p2 && (
                <div className="space-y-4">
                  {isPlayer1 ? (
                    // Player 1 can enter Player 2 name and start game
                    <>
                      <div>
                        <label className="block text-white mb-2 text-center">Enter Player 2 Name</label>
                        <input
                          type="text"
                          value={enteredHandle}
                          onChange={(e) => setEnteredHandle(e.target.value)}
                          placeholder="Player 2 name"
                          className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && enteredHandle.trim()) {
                              handleStartGameWithPlayer2();
                            }
                          }}
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={handleStartGameWithPlayer2}
                        disabled={isSigningUp || !enteredHandle.trim()}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSigningUp ? 'Starting...' : 'Start Game'}
                      </button>
                    </>
                  ) : (
                    // Someone else visiting - they can join as Player 2
                    <>
                      <div>
                        <label className="block text-white mb-2 text-center">Enter Your Name to Join as Player 2</label>
                        <input
                          type="text"
                          value={enteredHandle}
                          onChange={(e) => setEnteredHandle(e.target.value)}
                          placeholder="Your name"
                          className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && enteredHandle.trim()) {
                              handleJoinAsPlayer2();
                            }
                          }}
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={handleJoinAsPlayer2}
                        disabled={isSigningUp || !enteredHandle.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSigningUp ? 'Joining...' : 'Join as Player 2'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* If both players exist, show ready buttons */}
              {match.p1 && match.p2 && (
                <>
                  {!myPlayer?.ready && (
                    <button
                      onClick={handleReady}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition"
                    >
                      Ready
                    </button>
                  )}
                  {myPlayer?.ready && (!match.p1?.ready || !match.p2?.ready) && (
                    <p className="text-white/80 text-center">Waiting for opponent to ready up...</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {match.status === 'active' && match.startedAt && (
        <>
          {Date.now() < match.startedAt && (
            <Countdown targetTime={match.startedAt} />
          )}

          {isMemorizationPhase && (
            <MemorizationView
              imageUrl={match.imageUrl}
              startTime={match.startedAt}
              duration={MEMORIZATION_DURATION_MS}
            />
          )}

          {gameCanStart && p1Board.length === 25 && p2Board.length === 25 && match.status === 'active' && (
            <>
              <HUD
                myPlayer={myPlayer}
                opponentPlayer={opponentPlayer}
                moves={isPlayer1 ? p1Moves : p2Moves}
                percentCorrect={isPlayer1 ? p1PercentCorrect : p2PercentCorrect}
                elapsed={elapsed}
              />

              {/* Both players' boards side by side - both editable */}
              <div className="max-w-7xl mx-auto mt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Player 1's board */}
                  <div>
                    <GameGrid
                      board={p1Board}
                      rows={match.rows}
                      cols={match.cols}
                      imageUrl={match.imageUrl}
                      selectedTile={selectedTileP1}
                      highlightedTile={highlightedTileP1}
                      onTileClick={handleTileClickP1}
                      isAnimating={isAnimating}
                      isInteractive={false}
                      playerLabel={`${match.p1?.handle || 'Player 1'} (${p1Moves} moves) - WASD + Tab`}
                    />
                  </div>

                  {/* Player 2's board */}
                  {match.p2 && (
                    <div>
                    <GameGrid
                      board={p2Board}
                      rows={match.rows}
                      cols={match.cols}
                      imageUrl={match.imageUrl}
                      selectedTile={selectedTileP2}
                      highlightedTile={highlightedTileP2}
                      onTileClick={handleTileClickP2}
                      isAnimating={isAnimating}
                      isInteractive={false}
                      playerLabel={`${match.p2.handle || 'Player 2'} (${p2Moves} moves) - Arrows + Shift`}
                    />
                    </div>
                  )}
                </div>
              </div>

        <div className="text-center mt-4 text-white/80 text-sm">
          <p><strong>Left board:</strong> WASD to navigate, Tab to select/swap</p>
          <p className="mt-1"><strong>Right board:</strong> Arrow keys to navigate, Shift to select/swap</p>
        </div>
            </>
          )}
        </>
      )}

      {gameFinished && finishResult && (
        <WinModal
          result={finishResult}
          myPlayer={myPlayer}
          opponentPlayer={opponentPlayer}
          userId={userId || ''}
          onClose={() => router.push('/')}
        />
      )}
    </div>
  );
}

