import { NextRequest, NextResponse } from 'next/server';
import { matches, generateMatchId, generateSeed } from '@/lib/state';
import type { MatchState } from '@/lib/state';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, handle } = body;

    if (!userId || !handle) {
      return NextResponse.json(
        { error: 'userId and handle are required' },
        { status: 400 }
      );
    }

    const matchId = generateMatchId();
    const seed = generateSeed();
    const now = Date.now();

    const match: MatchState = {
      id: matchId,
      rows: 5,
      cols: 5,
      k: 512,
      seed,
      imageUrl: '/images/nycimagesquare.jpeg',
      status: 'waiting',
      p1: {
        userId,
        handle,
        ready: false,
        moves: 0,
        percent: 0,
      },
      expiresAt: now + 20 * 60 * 1000, // 20 minutes
    };

    matches.set(matchId, match);

    const joinUrl = `${request.nextUrl.origin}/match/${matchId}`;

    return NextResponse.json({
      matchId,
      seed,
      rows: 5,
      cols: 5,
      k: 512,
      imageUrl: match.imageUrl,
      joinUrl,
    });
  } catch (error) {
    console.error('Error creating match:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

