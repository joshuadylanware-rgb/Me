import { Card, Meld, RunMeld, SetMeld, Suit } from "./types.js";

export function isWild(card: Card): boolean {
  // Jokers and 2s are wild by default. 2 can be used naturally, but we mark wild by context in melds via positions.
  if (card.isJoker) return true;
  return card.rank === 2;
}

export function validateSet(m: SetMeld): { ok: true } | { ok: false; reason: string } {
  // cannot be a set of natural 2s
  if (m.rank === 2 as any) {
    return { ok: false, reason: "Sets of natural 2s are not allowed" };
  }
  const cards = m.cards;
  if (cards.length < 3) return { ok: false, reason: "Set must have at least 3 cards" };

  // Each non-wild must match rank (excluding 2). Duplicates allowed.
  for (let i = 0; i < cards.length; i++) {
    const isPosWild = m.wildPositions.includes(i);
    const c = cards[i];
    if (!isPosWild) {
      if (!c.rank || c.rank !== m.rank || c.isJoker || c.rank === 2) {
        return { ok: false, reason: "Natural cards in a set must match the set rank and cannot be Jokers or 2s" };
      }
    }
  }

  const naturalCount = cards.length - m.wildPositions.length;
  const wildCount = m.wildPositions.length;
  if (wildCount > Math.max(0, naturalCount - 1)) {
    return { ok: false, reason: "Too many wilds in set (must be <= natural - 1)" };
  }

  // All wild positions must actually be wild cards (Joker or rank 2)
  for (const pos of m.wildPositions) {
    const c = cards[pos];
    if (!c || !isWild(c)) return { ok: false, reason: "Wild position must contain a wild card (Joker or 2)" };
  }

  return { ok: true };
}

export type RunValidationOptions = {
  // allow K-A-2 adjacency; Ace can be high or low
  allowAceWrap?: boolean; // default true
};

export function validateRun(m: RunMeld, options?: RunValidationOptions): { ok: true } | { ok: false; reason: string } {
  const { allowAceWrap = true } = options ?? {};

  const n = m.cards.length;
  if (n < 4) return { ok: false, reason: "Run must have at least 4 cards" };

  // No consecutive wilds anywhere
  for (let i = 1; i < n; i++) {
    const prevWild = m.wildPositions.includes(i - 1);
    const currWild = m.wildPositions.includes(i);
    if (prevWild && currWild) return { ok: false, reason: "No consecutive wilds allowed in runs" };
  }

  // All wild positions must be wilds
  for (const pos of m.wildPositions) {
    const c = m.cards[pos];
    if (!c || !isWild(c)) return { ok: false, reason: "Wild position must contain a wild card (Joker or 2)" };
  }

  // Gather natural ranks and ensure suit consistency and no duplicates among naturals
  const naturalRanks: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!m.wildPositions.includes(i)) {
      const c = m.cards[i];
      if (!c.rank || !c.suit) return { ok: false, reason: "Natural cards must have rank and suit" };
      if (c.suit !== m.suit) return { ok: false, reason: "All natural cards in a run must match the run suit" };
      naturalRanks.push(rankToValue(c.rank));
    }
  }

  // No duplicate natural ranks allowed in a single run
  const set = new Set(naturalRanks);
  if (set.size !== naturalRanks.length) {
    return { ok: false, reason: "Runs cannot contain duplicate ranks (even across duplicate physical cards)" };
  }

  const wildCount = m.wildPositions.length;
  const naturalCount = n - wildCount;
  if (wildCount > naturalCount) return { ok: false, reason: "Too many wilds in run (must be <= natural count)" };

  // Validate sequence continuity with wilds filling gaps. Ace can be high or low, and K-A-2 allowed, but no repeats.
  const assignedValues = inferRunValues(m, { allowAceWrap });
  if (!assignedValues.ok) return assignedValues;

  // Max length 14 (2..A loop)
  if (n > 14) return { ok: false, reason: "Run cannot exceed 14 cards" };

  return { ok: true };
}

function rankToValue(rank: NonNullable<Card["rank"]>): number {
  if (rank === "A") return 14; // represent Ace high by default
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return rank as number; // 2..10
}

function valueToRank(value: number): NonNullable<Card["rank"]> {
  if (value === 14) return "A";
  if (value === 13) return "K";
  if (value === 12) return "Q";
  if (value === 11) return "J";
  return value as any;
}

function normalizeSequence(values: number[]): number[] {
  // Returns a copy
  return values.slice().sort((a, b) => a - b);
}

function nextValue(value: number, allowWrap: boolean): number {
  if (value === 14) return allowWrap ? 2 : 15; // sentinel 15 if no wrap
  return value + 1;
}

function prevValue(value: number, allowWrap: boolean): number {
  if (value === 2) return allowWrap ? 14 : 1; // sentinel 1 if no wrap
  return value - 1;
}

export function inferRunValues(
  m: RunMeld,
  { allowAceWrap = true }: RunValidationOptions
): { ok: true; values: number[] } | { ok: false; reason: string } {
  const n = m.cards.length;
  // Extract known natural positions and their numeric values
  const fixed: Array<{ idx: number; value: number }> = [];
  for (let i = 0; i < n; i++) {
    if (!m.wildPositions.includes(i)) {
      const c = m.cards[i];
      const v = rankToValue(c.rank!);
      fixed.push({ idx: i, value: v });
    }
  }
  if (fixed.length === 0) {
    // A run must have at least one natural to establish suit, but this check is elsewhere
  }

  // Ensure fixed values can be arranged into a single chain with gaps filled by wilds
  // Approach: dynamic assignment scanning left->right and right->left to force consistency
  const values: number[] = new Array(n).fill(0);
  for (const { idx, value } of fixed) values[idx] = value;

  // Fill forward from first natural
  const firstNaturalIdx = fixed.length ? fixed[0].idx : 0;
  let lastVal = fixed.length ? fixed[0].value : 0;
  for (let i = firstNaturalIdx - 1; i >= 0; i--) {
    // going left, decreasing values
    const next = prevValue(values[i + 1] || lastVal, allowAceWrap);
    if (next === 1) return { ok: false, reason: "Run sequence invalid without wrap" };
    values[i] = next;
  }
  // Fill forward to the right
  for (let i = firstNaturalIdx + 1; i < n; i++) {
    const prev = values[i - 1] || lastVal;
    const next = nextValue(prev, allowAceWrap);
    if (next === 15) return { ok: false, reason: "Run sequence invalid without wrap" };
    values[i] = next;
  }

  // Now adjust to match all fixed positions exactly by possibly choosing an offset that aligns
  // Because we allowed wrapping, we must check that assigned values at fixed indices equal fixed values modulo wrap semantics
  const rotateAttempts = 14; // maximum distinct positions in loop
  let aligned = false;
  for (let rot = 0; rot < rotateAttempts; rot++) {
    if (fixed.every(({ idx, value }) => values[idx] === value)) {
      aligned = true;
      break;
    }
    // rotate entire sequence by +1 (wrap considering 14-length loop)
    for (let i = 0; i < n; i++) {
      values[i] = nextValue(values[i], true);
    }
  }
  if (!aligned) {
    return { ok: false, reason: "Natural cards cannot align into a single continuous sequence" };
  }

  // Check that naturals are strictly increasing without duplicates within the chosen sequence
  for (let i = 1; i < n; i++) {
    if (values[i] === values[i - 1]) {
      return { ok: false, reason: "Runs cannot repeat a rank" };
    }
  }

  return { ok: true, values };
}

export type HandRequirement =
  | { sets: number; runs: number; runMinLength?: number }
  | { sets: number; runs: number; runMinLength?: number };

export function getHandRequirement(index: 1 | 2 | 3 | 4 | 5 | 6 | 7): HandRequirement {
  switch (index) {
    case 1:
      return { sets: 2, runs: 0 };
    case 2:
      return { sets: 1, runs: 1 };
    case 3:
      return { sets: 0, runs: 2 };
    case 4:
      return { sets: 2, runs: 1 };
    case 5:
      return { sets: 1, runs: 2 };
    case 6:
      return { sets: 3, runs: 0 };
    case 7:
      return { sets: 1, runs: 1, runMinLength: 7 };
  }
}

export function validateMeld(m: Meld): { ok: true } | { ok: false; reason: string } {
  if (m.type === "set") return validateSet(m);
  return validateRun(m, { allowAceWrap: true });
}