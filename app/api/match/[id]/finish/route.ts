import { NextRequest, NextResponse } from 'next/server';
import { matches, isUserInMatch, checkRateLimit, updateMatch, type MatchState } from '@/lib/state';
import { isSolved as checkSolved } from '@/lib/scramble';

const MATCH_DURATION_MS = 1 * 60 * 1000; // 1 minute (for testing)

function adjudicateWinner(match: MatchState) {
  if (!match.p1 || !match.p2) return null;

  const p1 = match.p1;
  const p2 = match.p2;

  // Tiebreaker 1: percent correct (higher wins)
  if (p1.percent !== p2.percent) {
    return p1.percent > p2.percent ? p1.userId : p2.userId;
  }

  // Tiebreaker 2: fewer moves (fewer wins)
  if (p1.moves !== p2.moves) {
    return p1.moves < p2.moves ? p1.userId : p2.userId;
  }

  // If still tied (same percent and same moves), pick p1 arbitrarily
  return p1.userId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;
    const body = await request.json();
    const { userId, board, moves, percentCorrect, lastCorrectAt } = body;

    if (!userId || !board || !Array.isArray(board) || board.length !== 25) {
      return NextResponse.json(
        { error: 'userId and valid board (25 elements) are required' },
        { status: 400 }
      );
    }

    const match = matches.get(matchId);

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    if (!isUserInMatch(match, userId)) {
      return NextResponse.json(
        { error: 'User not in match' },
        { status: 403 }
      );
    }

    if (match.status !== 'active') {
      return NextResponse.json(
        { error: 'Match is not active' },
        { status: 400 }
      );
    }

    if (!match.startedAt) {
      return NextResponse.json(
        { error: 'Match has not started' },
        { status: 400 }
      );
    }

    if (!checkRateLimit(userId, matchId)) {
      return NextResponse.json(
        { error: 'Rate limited' },
        { status: 429 }
      );
    }

    const now = Date.now();
    const timeSinceStart = now - match.startedAt;
    const solved = checkSolved(board);
    const isTimeout = timeSinceStart >= MATCH_DURATION_MS;

    // Update player progress
    const player = match.p1?.userId === userId ? match.p1 : match.p2;
    if (player) {
      player.moves = moves;
      if (percentCorrect !== undefined) player.percent = percentCorrect;
      if (lastCorrectAt !== undefined) player.lastCorrectAt = lastCorrectAt;
    }

    let adjudicated = false;

    // Update player finish time and duration
    if (player) {
      player.finishedAt = now;
      player.durationMs = timeSinceStart;
    }

    // If player reached 100% (solved), they win immediately
    if (solved && match.status === 'active') {
      match.winnerId = userId;
      if (player) player.won = true;
      // Mark opponent as loser
      if (match.p1?.userId === userId && match.p2) {
        match.p2.won = false;
      } else if (match.p2?.userId === userId && match.p1) {
        match.p1.won = false;
      }
      match.status = 'done';
      match.endedAt = now;
      updateMatch(match);
      
      return NextResponse.json({
        winnerId: match.winnerId,
        p1Time: match.p1?.durationMs,
        p2Time: match.p2?.durationMs,
        adjudicated: false,
        solved: true,
        timeout: false,
      });
    }

    // Handle timeout case - determine winner by % correct, then moves
    if (isTimeout && match.status === 'active') {
      // Ensure both players have their final state recorded
      const p1Finished = match.p1?.finishedAt !== undefined;
      const p2Finished = match.p2?.finishedAt !== undefined;
      
      // If a player hasn't submitted finish yet, record their current state
      if (!p1Finished && match.p1) {
        match.p1.finishedAt = now;
        match.p1.durationMs = timeSinceStart;
      }
      if (!p2Finished && match.p2) {
        match.p2.finishedAt = now;
        match.p2.durationMs = timeSinceStart;
      }

      // Determine winner using tiebreakers
      match.winnerId = adjudicateWinner(match) || match.p1?.userId || match.p2?.userId;
      
      // Set won flags
      if (match.p1 && match.winnerId === match.p1.userId) {
        match.p1.won = true;
        if (match.p2) match.p2.won = false;
      } else if (match.p2 && match.winnerId === match.p2.userId) {
        match.p2.won = true;
        if (match.p1) match.p1.won = false;
      }
      
      match.status = 'done';
      match.endedAt = now;
      adjudicated = true;
    }

    // Save all changes to database
    updateMatch(match);

    const p1Time = match.p1?.durationMs;
    const p2Time = match.p2?.durationMs;

    return NextResponse.json({
      winnerId: match.winnerId,
      p1Time,
      p2Time,
      adjudicated,
      solved,
      timeout: isTimeout,
    });
  } catch (error) {
    console.error('Error finishing match:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

