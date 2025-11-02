import { NextRequest, NextResponse } from 'next/server';
import { matches } from '@/lib/state';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;
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

    // Return public state only
    return NextResponse.json({
      id: match.id,
      rows: match.rows,
      cols: match.cols,
      k: match.k,
      seed: match.seed,
      imageUrl: match.imageUrl,
      status: match.status,
      startedAt: match.startedAt,
      winnerId: match.winnerId,
      p1: match.p1
        ? {
            userId: match.p1.userId,
            handle: match.p1.handle,
            moves: match.p1.moves,
            percent: match.p1.percent,
            ready: match.p1.ready,
            durationMs: match.p1.durationMs,
            finishedAt: match.p1.finishedAt,
            won: match.p1.won,
            board: match.p1.board,
          }
        : undefined,
      p2: match.p2
        ? {
            userId: match.p2.userId,
            handle: match.p2.handle,
            moves: match.p2.moves,
            percent: match.p2.percent,
            ready: match.p2.ready,
            durationMs: match.p2.durationMs,
            finishedAt: match.p2.finishedAt,
            won: match.p2.won,
            board: match.p2.board,
          }
        : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

