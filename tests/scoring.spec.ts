import { describe, it, expect } from "vitest";
import { cardPoints, handPoints } from "../src/scoring.js";
import { Card } from "../src/types.js";

function c(rank?: any, suit?: any, isJoker = false): Card {
  return { id: Math.random().toString(), rank, suit, isJoker, fromDeckId: 1 } as any;
}

describe("Scoring", () => {
  it("assigns correct points per card", () => {
    expect(cardPoints(c(2, "Hearts"))).toBe(25);
    expect(cardPoints(c(3, "Hearts"))).toBe(5);
    expect(cardPoints(c(9, "Hearts"))).toBe(5);
    expect(cardPoints(c(10, "Hearts"))).toBe(10);
    expect(cardPoints(c("J", "Hearts"))).toBe(10);
    expect(cardPoints(c("Q", "Hearts"))).toBe(10);
    expect(cardPoints(c("K", "Hearts"))).toBe(10);
    expect(cardPoints(c("A", "Hearts"))).toBe(20);
    expect(cardPoints(c(undefined, undefined, true))).toBe(50);
  });

  it("tallies a hand", () => {
    const hand = [c(2, "Hearts"), c(3, "Clubs"), c(10, "Spades"), c("A", "Diamonds"), c(undefined, undefined, true)];
    expect(handPoints(hand)).toBe(25 + 5 + 10 + 20 + 50);
  });
});