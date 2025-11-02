# PixelSwap

A real-time competitive puzzle game where two players race to reconstruct a single image on an 8×8 grid using orthogonal adjacent swaps.

## Features

- **8×8 Grid**: Exactly 64 tiles to rearrange
- **Two Players**: Head-to-head competitive gameplay
- **Deterministic Scrambling**: Both players start with identical boards from the same seed
- **Real-time Progress**: Poll opponent's progress every 1-2 seconds
- **Fair Timing**: Server-authoritative timestamps ensure fair competition
- **Keyboard Controls**: Arrow keys or WASD for navigation, Enter to swap
- **Win Conditions**: Fastest completion time, with tiebreakers for timeout scenarios

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React, Tailwind CSS
- **Backend**: Next.js Route Handlers (REST API)
- **State Management**: In-memory Map (no database)
- **Real-time**: REST + polling (no WebSockets)

## Setup

### Prerequisites

- Node.js 18+ and pnpm (or npm/yarn)

### Installation

1. Clone the repository and install dependencies:

```bash
pnpm install
```

2. Place your image at `/public/images/pic.jpg`. This will be the image that players reconstruct.

3. Run the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
pnpm build
pnpm start
```

## How to Play

1. **Sign Up**: Enter your handle on the home page
2. **Create Match**: Click "Create Match" and share the link with your opponent
3. **Join Match**: Paste the match link or click the shared link
4. **Ready Up**: Both players must click "Ready" to start
5. **Play**: 
   - Click tiles to select them
   - Click an adjacent tile to swap
   - Use arrow keys/WASD to move selection
   - Press Enter to swap with the selected neighbor
   - Hold G to show ghost image
6. **Win**: First player to solve the puzzle wins!

## Game Rules

- **Moves**: Only orthogonal adjacent swaps (up, down, left, right) are allowed
- **Time Limit**: 15 minutes per match
- **Starting Boards**: Both players receive identical scrambled boards from the same seed
- **Input Rate Limit**: Swaps must be at least 80ms apart (client-side)
- **Server Validation**: The server validates all finish submissions

### Tiebreakers (at 15-minute cap)

If neither player solves within the time limit, winner is determined by:
1. **Higher percent correct** (correct tiles / 64)
2. **Fewer moves** (if percent tied)
3. **Earlier lastCorrectAt** (if moves tied)


## API Endpoints

- `POST /api/signup` - Create a new user account
- `POST /api/match` - Create a new match
- `POST /api/match/:id/join` - Join an existing match
- `POST /api/match/:id/ready` - Mark player as ready
- `GET /api/match/:id` - Get match state (polled every 1-2s)
- `POST /api/match/:id/progress` - Update player progress
- `POST /api/match/:id/finish` - Submit finished board

## Technical Details

### Deterministic Scrambling

The scramble algorithm:
1. Starts with a solved board `[0, 1, 2, ..., 63]`
2. Performs K=512 random orthogonal adjacent swaps
3. Uses a seeded PRNG (hash of `seed-rows-cols-k`) for determinism
4. Avoids immediate undo of the previous swap pair

Both clients compute this locally from the shared seed, ensuring identical starting boards without the server storing board state.

### State Management

- **SQLite Database**: All match state persisted in a local SQLite database (`/.data/matches.db`)
- **Persistent**: State survives server restarts and hot-reloads
- **Cleanup**: Matches are automatically cleaned up after 20 minutes or 2 minutes after completion
- **Rate Limiting**: Tracked per user per match to prevent abuse

### Limitations

- SQLite file-based database (stored in `/.data/` directory)
- Maximum 2 players per match
- Exactly 8×8 grid (64 tiles)
- REST + polling (no WebSockets)

## Testing

Run the test suite:

```bash
pnpm test
```

Tests cover:
- Scramble determinism (same seed → same board)
- Solved check (identity board recognized as solved)
- Percent correct calculation

## Image Requirements

- Place your image at `/public/images/pic.jpg`
- Recommended: Square aspect ratio (1:1) for best results
- The image will be automatically sliced into 64 tiles (8×8 grid)

## License

MIT

