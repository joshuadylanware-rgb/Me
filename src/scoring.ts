import { Card, Rank } from "./types.js";

export function cardPoints(card: Card): number {
  if (card.isJoker) return 50;
  if (!card.rank) return 0;
  switch (card.rank) {
    case 2:
      return 25;
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 9:
      return 5;
    case 10:
    case "J":
    case "Q":
    case "K":
      return 10;
    case "A":
      return 20;
  }
}

export function handPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardPoints(c), 0);
}