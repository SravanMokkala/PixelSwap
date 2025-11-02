/**
 * Server-side state management with SQLite database
 */

import { getDb } from './db';
import type Database from 'better-sqlite3';

export interface Player {
  userId: string;
  handle: string;
  ready: boolean;
  moves: number;
  percent: number;
  lastCorrectAt?: number;
  finishedAt?: number;
  durationMs?: number;
  won?: boolean;
  board?: number[]; // Current board state
}

export interface MatchState {
  id: string;
  rows: 8;
  cols: 8;
  k: 512;
  seed: string;
  imageUrl: string;
  status: "waiting" | "active" | "done";
  p1?: Player;
  p2?: Player;
  startedAt?: number;
  endedAt?: number;
  winnerId?: string;
  expiresAt: number;
}

// Rate limiting: track last request time per user per match
const rateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 300;

/**
 * Check rate limit for a user in a match
 */
export function checkRateLimit(userId: string, matchId: string): boolean {
  const key = `${matchId}:${userId}`;
  const now = Date.now();
  const lastRequest = rateLimit.get(key);
  
  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
    return false;
  }
  
  rateLimit.set(key, now);
  return true;
}

/**
 * Generate a unique match ID
 */
export function generateMatchId(): string {
  return `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique user ID
 */
export function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a random seed
 */
export function generateSeed(): string {
  return Math.random().toString(36).substr(2, 16);
}

/**
 * Check if user is in match
 */
export function isUserInMatch(match: MatchState, userId: string): boolean {
  return match.p1?.userId === userId || match.p2?.userId === userId;
}

/**
 * Convert database row to MatchState
 */
function rowToMatchState(row: any): MatchState {
  return {
    id: row.id,
    rows: row.rows,
    cols: row.cols,
    k: row.k,
    seed: row.seed,
    imageUrl: row.imageUrl,
    status: row.status,
    startedAt: row.startedAt || undefined,
    endedAt: row.endedAt || undefined,
    winnerId: row.winnerId || undefined,
    expiresAt: row.expiresAt,
    p1: row.p1 ? JSON.parse(row.p1) : undefined,
    p2: row.p2 ? JSON.parse(row.p2) : undefined,
  };
}

/**
 * Get a match by ID
 */
export function getMatch(matchId: string): MatchState | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any;
  
  if (!row) {
    return null;
  }
  
  return rowToMatchState(row);
}

/**
 * Create a new match
 */
export function createMatch(match: MatchState): void {
  const db = getDb();
  
  db.prepare(`
    INSERT INTO matches (
      id, rows, cols, k, seed, imageUrl, status,
      startedAt, endedAt, winnerId, expiresAt,
      p1, p2, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    match.id,
    match.rows,
    match.cols,
    match.k,
    match.seed,
    match.imageUrl,
    match.status,
    match.startedAt || null,
    match.endedAt || null,
    match.winnerId || null,
    match.expiresAt,
    match.p1 ? JSON.stringify(match.p1) : null,
    match.p2 ? JSON.stringify(match.p2) : null,
    Date.now()
  );
}

/**
 * Update a match
 */
export function updateMatch(match: MatchState): void {
  const db = getDb();
  
  db.prepare(`
    UPDATE matches SET
      status = ?,
      startedAt = ?,
      endedAt = ?,
      winnerId = ?,
      expiresAt = ?,
      p1 = ?,
      p2 = ?
    WHERE id = ?
  `).run(
    match.status,
    match.startedAt || null,
    match.endedAt || null,
    match.winnerId || null,
    match.expiresAt,
    match.p1 ? JSON.stringify(match.p1) : null,
    match.p2 ? JSON.stringify(match.p2) : null,
    match.id
  );
}

/**
 * Delete a match
 */
export function deleteMatch(matchId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM matches WHERE id = ?').run(matchId);
  
  // Clean up rate limit entries
  for (const key of rateLimit.keys()) {
    if (key.startsWith(`${matchId}:`)) {
      rateLimit.delete(key);
    }
  }
}

/**
 * Cleanup expired matches (run every 60s)
 */
export function cleanupMatches(): void {
  const now = Date.now();
  const db = getDb();
  
  // Find matches to delete
  const toDelete = db.prepare(`
    SELECT id FROM matches
    WHERE 
      (status = 'done' AND endedAt IS NOT NULL AND ? - endedAt >= 120000)
      OR ? > expiresAt
  `).all(now, now) as Array<{ id: string }>;
  
  if (toDelete.length > 0) {
    console.log(`[cleanup] Removing ${toDelete.length} expired match(es):`, toDelete.map(m => m.id));
    
    const deleteStmt = db.prepare('DELETE FROM matches WHERE id = ?');
    const deleteMany = db.transaction((ids: string[]) => {
      for (const id of ids) {
        deleteStmt.run(id);
        // Clean up rate limit entries
        for (const key of rateLimit.keys()) {
          if (key.startsWith(`${id}:`)) {
            rateLimit.delete(key);
          }
        }
      }
    });
    
    deleteMany(toDelete.map(m => m.id));
  }
}

// Start cleanup interval (60 seconds)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupMatches, 60000);
}

// Legacy Map-based interface for backward compatibility during migration
// This is now just a wrapper around database operations
export const matches = {
  get: getMatch,
  set: (matchId: string, match: MatchState) => {
    const existing = getMatch(matchId);
    if (existing) {
      updateMatch(match);
    } else {
      createMatch(match);
    }
  },
  delete: deleteMatch,
  has: (matchId: string) => getMatch(matchId) !== null,
  size: () => {
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM matches').get() as { count: number };
    return result.count;
  },
  keys: () => {
    const db = getDb();
    const rows = db.prepare('SELECT id FROM matches').all() as Array<{ id: string }>;
    return rows.map(r => r.id);
  },
  entries: () => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM matches').all() as any[];
    return rows.map(row => [row.id, rowToMatchState(row)] as [string, MatchState]);
  },
  values: () => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM matches').all() as any[];
    return rows.map(row => rowToMatchState(row));
  },
};
