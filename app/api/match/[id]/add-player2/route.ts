import { NextRequest, NextResponse } from 'next/server';
import { matches, generateUserId, updateMatch } from '@/lib/state';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;
    
    if (!matchId) {
      console.error('add-player2: matchId is missing or undefined');
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { p1UserId, player2Handle } = body;

    if (!p1UserId || !player2Handle) {
      return NextResponse.json(
        { error: 'p1UserId and player2Handle are required' },
        { status: 400 }
      );
    }

    console.log('[add-player2] Request received:', { matchId, p1UserId, player2Handle });
    console.log('[add-player2] Total matches in memory:', matches.size);
    console.log('[add-player2] All match IDs:', Array.from(matches.keys()));
    
    const match = matches.get(matchId);

    if (!match) {
      const now = Date.now();
      console.error('[add-player2] Match not found in memory!', {
        matchId,
        totalMatches: matches.size,
        allMatchIds: Array.from(matches.keys()),
        timestamp: now
      });
      return NextResponse.json(
        { 
          error: 'Match not found',
          code: 'MATCH_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Verify that the requester is Player 1
    console.log('[add-player2] Match found!', {
      matchId: match.id,
      status: match.status,
      p1UserId: match.p1?.userId,
      requestedUserId: p1UserId,
      expiresAt: match.expiresAt,
      timeUntilExpiry: match.expiresAt - Date.now()
    });
    
    if (match.p1?.userId !== p1UserId) {
      console.error('add-player2: User is not Player 1. Match P1:', match.p1?.userId, 'Request:', p1UserId);
      return NextResponse.json(
        { error: 'Only Player 1 can add Player 2' },
        { status: 403 }
      );
    }

    if (match.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Match is not accepting new players' },
        { status: 400 }
      );
    }

    if (match.p2) {
      return NextResponse.json(
        { error: 'Player 2 already exists' },
        { status: 400 }
      );
    }

    // Generate a userId for Player 2
    const p2UserId = generateUserId();

    // Add Player 2 directly
    match.p2 = {
      userId: p2UserId,
      handle: player2Handle.trim(),
      ready: false,
      moves: 0,
      percent: 0,
    };

    updateMatch(match);

    return NextResponse.json({
      success: true,
      p2UserId,
      p2Handle: player2Handle.trim(),
    });
  } catch (error) {
    console.error('Error adding Player 2:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

