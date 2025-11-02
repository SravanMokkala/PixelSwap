import { scrambleBoard, isSolved, calculatePercentCorrect } from '../scramble';

describe('scramble', () => {
  describe('scrambleBoard', () => {
    it('should generate identical boards for same seed', () => {
      const seed = 'test-seed-123';
      const rows = 8;
      const cols = 8;
      const k = 512;

      const board1 = scrambleBoard(seed, rows, cols, k);
      const board2 = scrambleBoard(seed, rows, cols, k);

      expect(board1).toEqual(board2);
    });

    it('should generate different boards for different seeds', () => {
      const rows = 8;
      const cols = 8;
      const k = 512;

      const board1 = scrambleBoard('seed-1', rows, cols, k);
      const board2 = scrambleBoard('seed-2', rows, cols, k);

      expect(board1).not.toEqual(board2);
    });

    it('should generate 64-element board for 8x8 grid', () => {
      const board = scrambleBoard('test', 8, 8, 512);
      expect(board.length).toBe(64);
    });

    it('should contain all numbers from 0 to 63', () => {
      const board = scrambleBoard('test', 8, 8, 512);
      const sorted = [...board].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: 64 }, (_, i) => i));
    });
  });

  describe('isSolved', () => {
    it('should return true for solved board', () => {
      const solved = Array.from({ length: 64 }, (_, i) => i);
      expect(isSolved(solved)).toBe(true);
    });

    it('should return false for scrambled board', () => {
      const scrambled = scrambleBoard('test', 8, 8, 512);
      expect(isSolved(scrambled)).toBe(false);
    });

    it('should return false for board with one swap', () => {
      const board = Array.from({ length: 64 }, (_, i) => i);
      [board[0], board[1]] = [board[1], board[0]];
      expect(isSolved(board)).toBe(false);
    });
  });

  describe('calculatePercentCorrect', () => {
    it('should return 100 for solved board', () => {
      const solved = Array.from({ length: 64 }, (_, i) => i);
      expect(calculatePercentCorrect(solved)).toBe(100);
    });

    it('should return 0 for completely wrong board', () => {
      const wrong = Array.from({ length: 64 }, (_, i) => (i + 1) % 64);
      expect(calculatePercentCorrect(wrong)).toBe(0);
    });

    it('should return correct percentage for partially correct board', () => {
      const board = Array.from({ length: 64 }, (_, i) => i);
      // Make 32 tiles wrong
      for (let i = 0; i < 32; i++) {
        board[i] = (i + 1) % 64;
      }
      expect(calculatePercentCorrect(board)).toBe(50);
    });
  });
});

