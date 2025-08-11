import { Card, DealConfig, Rank, Suit } from "./types.js";

const SUITS: Suit[] = ["Clubs", "Diamonds", "Hearts", "Spades"];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K", "A"];

export function createStandardDeal(config?: Partial<DealConfig>): Card[] {
  const cfg: DealConfig = {
    numberOfDecks: 2,
    includeJokers: true,
    numJokers: 4,
    ...config,
  } as DealConfig;

  const cards: Card[] = [];
  for (let d = 1 as 1 | 2; d <= cfg.numberOfDecks; d = ((d + 1) as 1 | 2)) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `${d}-${suit}-${rank}-${cryptoRandom()}`,
          suit,
          rank,
          isJoker: false,
          fromDeckId: d,
        });
      }
    }
  }
  if (cfg.includeJokers) {
    for (let i = 0; i < cfg.numJokers; i++) {
      // distribute jokers across decks for uniqueness
      const d = ((i % cfg.numberOfDecks) + 1) as 1 | 2;
      cards.push({
        id: `${d}-Joker-${i}-${cryptoRandom()}`,
        isJoker: true,
        fromDeckId: d,
      });
    }
  }
  return shuffle(cards);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Simple wrapper to allow deterministic seeding later if desired
let seededRandom: (() => number) | null = null;
export function setSeededRandom(rng: () => number) {
  seededRandom = rng;
}
function random(): number {
  return seededRandom ? seededRandom() : Math.random();
}
function cryptoRandom(): string {
  // Not cryptographically secure here; just uniqueness within tests/runtime
  return Math.random().toString(36).slice(2, 10);
}