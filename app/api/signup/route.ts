import { NextRequest, NextResponse } from 'next/server';
import { generateUserId } from '@/lib/state';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { handle } = body;

    if (!handle || typeof handle !== 'string' || handle.trim().length === 0) {
      return NextResponse.json(
        { error: 'Handle is required' },
        { status: 400 }
      );
    }

    const userId = generateUserId();

    return NextResponse.json({
      userId,
      handle: handle.trim(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

