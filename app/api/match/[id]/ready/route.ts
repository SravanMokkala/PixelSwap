import { NextRequest, NextResponse } from 'next/server';
import { matches, isUserInMatch, updateMatch } from '@/lib/state';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const match = matches.get(matchId);

    if (!match) {
      return NextResponse.json(
        { 
          error: 'Match not found',
          code: 'MATCH_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    if (!isUserInMatch(match, userId)) {
      return NextResponse.json(
        { error: 'User not in match' },
        { status: 403 }
      );
    }

    // Mark player as ready
    if (match.p1?.userId === userId && match.p1) {
      match.p1.ready = true;
    } else if (match.p2?.userId === userId && match.p2) {
      match.p2.ready = true;
    }

    // If both ready and status is waiting, start the match
    if (
      match.status === 'waiting' &&
      match.p1?.ready &&
      match.p2?.ready
    ) {
      match.startedAt = Date.now() + 3000; // 3 second countdown
      match.status = 'active';
    }

    updateMatch(match);

    return NextResponse.json({
      startedAt: match.startedAt,
    });
  } catch (error) {
    console.error('Error setting ready:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

