import { describe, it, expect } from 'vitest';
import { getGames, getGameBySlug } from '../games';

describe('Games Content Library', () => {
  describe('getGames', () => {
    it('should return English games by default', () => {
      const games = getGames('en');
      expect(games.length).toBeGreaterThan(0);
      expect(games[0].title).toBe('Tiến Lên');
    });

    it('should return Vietnamese games when requested', () => {
      const games = getGames('vi');
      expect(games.length).toBeGreaterThan(0);
      expect(games[0].title).toBe('Tiến Lên');
      expect(games[0].subtitle).toBe('Game Bài Phổ Biến Nhất Việt Nam');
    });

    it('should fallback to English if locale is invalid', () => {
      // @ts-ignore - testing runtime behavior
      const games = getGames('fr');
      // If the implementation strictly checks keys, it might return undefined or empty.
      // Based on typical patterns, let's see.
      // Checking code: return gamesData[locale] || gamesData.en;
      expect(games).toBeDefined();
      expect(games[0].subtitle).toBe("Vietnam's Most Popular Card Game");
    });
  });

  describe('getGameBySlug', () => {
    it('should return the correct game for a valid slug', () => {
      const game = getGameBySlug('tien-len', 'en');
      expect(game).toBeDefined();
      expect(game?.title).toBe('Tiến Lên');
    });

    it('should return undefined for an invalid slug', () => {
      const game = getGameBySlug('invalid-game', 'en');
      expect(game).toBeUndefined();
    });

    it('should return the correct localized version', () => {
      const gameEn = getGameBySlug('phom', 'en');
      const gameVi = getGameBySlug('phom', 'vi');

      expect(gameEn?.subtitle).toBe('Vietnamese Rummy');
      expect(gameVi?.subtitle).toBe('Game Bài Rummy Việt Nam');
    });
  });
});
