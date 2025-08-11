import { describe, it, expect } from "vitest";
import { validateSet, validateRun } from "../src/rules.js";
import { Card, RunMeld, SetMeld } from "../src/types.js";

function card(id: string, rank?: any, suit?: any, isJoker = false): Card {
  return {
    id,
    rank,
    suit,
    isJoker,
    fromDeckId: 1,
  } as any;
}

describe("Set validation", () => {
  it("allows set with wilds up to natural-1 and disallows natural 2s", () => {
    const s: SetMeld = {
      id: "s1",
      type: "set",
      rank: 3,
      cards: [card("a", 3, "Hearts"), card("b", 3, "Spades"), card("j", undefined, undefined, true)],
      wildPositions: [2],
    };
    expect(validateSet(s).ok).toBe(true);

    const tooManyWilds: SetMeld = {
      ...s,
      cards: [card("a", 3, "Hearts"), card("j1", undefined, undefined, true), card("j2", undefined, undefined, true)],
      wildPositions: [1, 2],
    };
    expect(validateSet(tooManyWilds).ok).toBe(false);

    const natural2s: SetMeld = {
      id: "s2",
      type: "set",
      rank: 2 as any,
      cards: [card("h2", 2, "Hearts"), card("d2", 2, "Diamonds"), card("s2", 2, "Spades")],
      wildPositions: [],
    } as any;
    expect(validateSet(natural2s).ok).toBe(false);
  });
});

describe("Run validation", () => {
  it("allows simple natural run of 4", () => {
    const r: RunMeld = {
      id: "r1",
      type: "run",
      suit: "Spades",
      cards: [card("3s", 3, "Spades"), card("4s", 4, "Spades"), card("5s", 5, "Spades"), card("6s", 6, "Spades")],
      wildPositions: [],
    };
    expect(validateRun(r).ok).toBe(true);
  });

  it("disallows consecutive wilds and duplicate naturals", () => {
    const r1: RunMeld = {
      id: "r2",
      type: "run",
      suit: "Hearts",
      cards: [card("3h", 3, "Hearts"), card("w1", 2, undefined), card("w2", undefined, undefined, true), card("6h", 6, "Hearts")],
      wildPositions: [1, 2],
    } as any;
    expect(validateRun(r1).ok).toBe(false);

    const r2: RunMeld = {
      id: "r3",
      type: "run",
      suit: "Hearts",
      cards: [card("3h", 3, "Hearts"), card("4h", 4, "Hearts"), card("4h2", 4, "Hearts"), card("5h", 5, "Hearts")],
      wildPositions: [],
    };
    expect(validateRun(r2).ok).toBe(false);
  });

  it("allows K-A-2 wrap with wilds filling gaps", () => {
    const r: RunMeld = {
      id: "r4",
      type: "run",
      suit: "Clubs",
      cards: [card("Kc", "K", "Clubs"), card("Ac", "A", "Clubs"), card("2c", 2, "Clubs"), card("w", undefined, undefined, true)],
      wildPositions: [3],
    } as any;
    expect(validateRun(r).ok).toBe(true);
  });
});