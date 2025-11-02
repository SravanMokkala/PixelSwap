import { NextRequest, NextResponse } from 'next/server';
import { matches, isUserInMatch, checkRateLimit, updateMatch } from '@/lib/state';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;
    const body = await request.json();
    let { userId, percentCorrect, moves, lastCorrectAt, board, playerNumber } = body;

    // Allow board updates even if userId is missing (for board state sync)
    // But still require userId for progress updates
    if (!userId && percentCorrect === undefined && moves === undefined) {
      userId = 'system'; // Allow board-only updates
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
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

    // Only check user in match if userId is provided and not 'system'
    if (userId && userId !== 'system' && !isUserInMatch(match, userId)) {
      return NextResponse.json(
        { error: 'User not in match' },
        { status: 403 }
      );
    }

    if (!checkRateLimit(userId, matchId)) {
      return NextResponse.json(
        { error: 'Rate limited' },
        { status: 429 }
      );
    }

    // Update player progress - support both userId-based and playerNumber-based updates
    // If playerNumber is specified, use that; otherwise use userId to determine player
    let targetPlayer = null;
    if (playerNumber === 1 || playerNumber === '1') {
      targetPlayer = match.p1;
      if (!targetPlayer) {
        // Create P1 if it doesn't exist (for board state sync)
        match.p1 = { userId: userId || 'system', handle: 'Player 1', ready: false, moves: 0, percent: 0 };
      }
    } else if (playerNumber === 2 || playerNumber === '2') {
      targetPlayer = match.p2;
      if (!targetPlayer) {
        // Create P2 if it doesn't exist (for board state sync)
        match.p2 = { userId: userId || 'system', handle: 'Player 2', ready: false, moves: 0, percent: 0 };
      }
    } else if (match.p1?.userId === userId && match.p1) {
      targetPlayer = match.p1;
    } else if (match.p2?.userId === userId && match.p2) {
      targetPlayer = match.p2;
    }

    if (targetPlayer) {
      if (percentCorrect !== undefined) targetPlayer.percent = percentCorrect;
      if (moves !== undefined) targetPlayer.moves = moves;
      if (lastCorrectAt !== undefined) targetPlayer.lastCorrectAt = lastCorrectAt;
      if (board !== undefined) targetPlayer.board = board;
      
      // Update the match state
      if (playerNumber === 1 || playerNumber === '1') {
        match.p1 = targetPlayer;
      } else if (playerNumber === 2 || playerNumber === '2') {
        match.p2 = targetPlayer;
      }
    }

    updateMatch(match);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

