/**
 * Database setup and utilities for persistent match state
 */

import Database from 'better-sqlite3';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const dbDir = path.join(process.cwd(), '.data');
const dbPath = path.join(dbDir, 'matches.db');

// Ensure .data directory exists
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  db = new Database(dbPath);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      rows INTEGER NOT NULL,
      cols INTEGER NOT NULL,
      k INTEGER NOT NULL,
      seed TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      status TEXT NOT NULL,
      startedAt INTEGER,
      endedAt INTEGER,
      winnerId TEXT,
      expiresAt INTEGER NOT NULL,
      p1 TEXT, -- JSON string of Player object
      p2 TEXT, -- JSON string of Player object
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expiresAt ON matches(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_status ON matches(status);
  `);

  return db;
}

// Close database connection (useful for cleanup)
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

