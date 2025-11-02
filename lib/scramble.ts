/**
 * Deterministic PRNG using seed
 */
class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    // Hash the seed string to a number
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    this.seed = hash >>> 0; // Ensure non-negative
  }

  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }
}

/**
 * Get adjacent positions (orthogonal only: up, down, left, right)
 */
function getAdjacentPositions(pos: number, rows: number, cols: number): number[] {
  const row = Math.floor(pos / cols);
  const col = pos % cols;
  const adjacent: number[] = [];

  if (row > 0) adjacent.push(pos - cols); // up
  if (row < rows - 1) adjacent.push(pos + cols); // down
  if (col > 0) adjacent.push(pos - 1); // left
  if (col < cols - 1) adjacent.push(pos + 1); // right

  return adjacent;
}

/**
 * Deterministic scramble: starting from solved board [0..(rows*cols-1)],
 * perform K orthogonal adjacent swaps using seeded RNG.
 * Avoids immediate undo of previous swap.
 */
export function scrambleBoard(seed: string, rows: number, cols: number, k: number): number[] {
  const size = rows * cols;
  const board = Array.from({ length: size }, (_, i) => i);
  const rng = new SeededRandom(`${seed}-${rows}-${cols}-${k}`);
  let lastSwap: [number, number] | null = null;

  for (let i = 0; i < k; i++) {
    // Pick a random position
    const pos1 = Math.floor(rng.next() * size);
    const adjacent = getAdjacentPositions(pos1, rows, cols);
    
    if (adjacent.length === 0) continue;

    // Filter out the position that would undo the last swap
    let validAdjacent = adjacent;
    if (lastSwap) {
      const [prev1, prev2] = lastSwap;
      validAdjacent = adjacent.filter(pos => {
        // Avoid swapping back to previous state
        return !(
          (pos1 === prev1 && pos === prev2) ||
          (pos1 === prev2 && pos === prev1)
        );
      });
    }

    // If no valid adjacent (shouldn't happen often), use all adjacent
    if (validAdjacent.length === 0) {
      validAdjacent = adjacent;
    }

    const pos2 = validAdjacent[Math.floor(rng.next() * validAdjacent.length)];

    // Perform swap
    [board[pos1], board[pos2]] = [board[pos2], board[pos1]];
    lastSwap = [pos1, pos2];
  }

  return board;
}

/**
 * Check if board is solved (board[i] === i for all cells)
 */
export function isSolved(board: number[]): boolean {
  return board.every((value, index) => value === index);
}

/**
 * Calculate percentage of correct tiles
 */
export function calculatePercentCorrect(board: number[]): number {
  const correct = board.filter((value, index) => value === index).length;
  return Math.round((correct / board.length) * 100);
}

