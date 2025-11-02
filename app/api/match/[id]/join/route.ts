import { NextRequest, NextResponse } from 'next/server';
import { matches, isUserInMatch, updateMatch } from '@/lib/state';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;
    const body = await request.json();
    const { userId, handle } = body;

    if (!userId || !handle) {
      return NextResponse.json(
        { error: 'userId and handle are required' },
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

    if (match.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Match is not accepting new players' },
        { status: 400 }
      );
    }

    // Check if user is already in match
    if (isUserInMatch(match, userId)) {
      return NextResponse.json({
        id: match.id,
        status: match.status,
        p1: match.p1,
        p2: match.p2,
      });
    }

    // Add p2 if not already set
    if (!match.p2) {
      match.p2 = {
        userId,
        handle,
        ready: false,
        moves: 0,
        percent: 0,
      };
      updateMatch(match);
    } else if (match.p2.userId !== userId) {
      return NextResponse.json(
        { error: 'Match is full' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: match.id,
      status: match.status,
      p1: match.p1,
      p2: match.p2,
    });
  } catch (error) {
    console.error('Error joining match:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

