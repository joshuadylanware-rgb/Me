import { createStandardDeal } from "./deck.js";
import { handPoints } from "./scoring.js";
import {
  Card,
  DiscardPile,
  PlayerState,
  TableState,
  UndealtPile,
  HandRequirementIndex,
  Meld,
} from "./types.js";
import { getHandRequirement, validateMeld } from "./rules.js";

export function createTable(playerNames: string[]): TableState {
  if (playerNames.length < 3 || playerNames.length > 6) {
    throw new Error("Game supports 3 to 6 players");
  }
  const deck = createStandardDeal();
  const players: PlayerState[] = playerNames.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    seatIndex: i,
    hand: [],
    melds: [],
    hasGoneDown: false,
    currentHand: 1,
    score: 0,
    meClaimsUsed: 0,
  }));

  const state: TableState = {
    players,
    dealerSeat: 0,
    activeSeat: 1 % players.length,
    phase: "deal",
    discard: { deadCards: [] },
    undealt: { remaining: deck },
    roundNumber: 1,
    timers: {
      analyzeMs: 15000,
      drawWindowMs: 15000,
      playWindowMs: 30000,
    },
  };
  return state;
}

export function startRound(state: TableState) {
  // Deal 11 cards each, one at a time starting left of dealer, ending with dealer
  const numPlayers = state.players.length;
  for (let c = 0; c < 11; c++) {
    for (let offset = 1; offset <= numPlayers; offset++) {
      const seat = (state.dealerSeat + offset) % numPlayers;
      const card = drawHot(state);
      state.players[seat].hand.push(card);
    }
  }
  // Place top undealt as Hot; then flip to create initial Cold after analyze phase handled by caller/UI
  updateHot(state);
  state.phase = "analyze";
}

export function flipFirstCold(state: TableState) {
  // Move hot to cold to create discard pile
  ensureHot(state);
  const hot = state.undealt.hotCard!;
  state.undealt.hotCard = undefined;
  state.discard.coldCard = hot;
  updateHot(state);
  state.phase = "play";
  state.activeSeat = (state.dealerSeat + 1) % state.players.length;
}

export function claimColdViaMe(state: TableState, claimantSeat: number) {
  const player = state.players[claimantSeat];
  if (player.meClaimsUsed >= 3) throw new Error("Me! limit reached");
  if (!state.discard.coldCard) throw new Error("No cold card to claim");
  // Take cold
  player.hand.push(state.discard.coldCard);
  // Cold becomes dead
  if (state.discard.coldCard) state.discard.deadCards.push(state.discard.coldCard);
  state.discard.coldCard = undefined;
  // Must also take hot
  ensureHot(state);
  player.hand.push(state.undealt.hotCard!);
  state.undealt.hotCard = undefined;
  updateHot(state);
  player.meClaimsUsed += 1;
}

export function activeDrawsCold(state: TableState) {
  const active = state.players[state.activeSeat];
  if (!state.discard.coldCard) throw new Error("No cold card to draw");
  active.hand.push(state.discard.coldCard);
  // Move previous cold to dead (we treat taken cold as moving off the pile; the previous cold underneath is already dead)
  if (state.discard.coldCard) state.discard.deadCards.push(state.discard.coldCard);
  state.discard.coldCard = undefined;
}

export function activeDrawsHot(state: TableState) {
  const active = state.players[state.activeSeat];
  ensureHot(state);
  active.hand.push(state.undealt.hotCard!);
  state.undealt.hotCard = undefined;
  updateHot(state);
}

export function playerGoesDown(state: TableState, seat: number, melds: Meld[]) {
  const player = state.players[seat];
  const req = getHandRequirement(player.currentHand as HandRequirementIndex);

  // Validate melds composition counts
  const setCount = melds.filter((m) => m.type === "set").length;
  const runCount = melds.filter((m) => m.type === "run").length;
  if (setCount !== req.sets || runCount !== req.runs) {
    throw new Error("Meld composition does not match current hand requirements");
  }
  // Special for hand 7: ensure at least one run has length >= 7
  if (player.currentHand === 7 && req.runMinLength) {
    const ok = melds.some((m) => m.type === "run" && m.cards.length >= req.runMinLength!);
    if (!ok) throw new Error("Hand 7 requires a run of at least 7");
  }

  // Validate each meld
  for (const m of melds) {
    const v = validateMeld(m);
    if (!v.ok) throw new Error(`Invalid meld: ${v.reason}`);
  }

  // Ensure all cards used are in hand, remove them from hand
  const usedIds = new Set(melds.flatMap((m) => m.cards.map((c) => c.id)));
  if (!meldCardsSubsetOfHand(player.hand, usedIds)) {
    throw new Error("Player does not possess all cards for melds");
  }
  player.hand = player.hand.filter((c) => !usedIds.has(c.id));

  // Save melds
  player.melds = melds;
  player.hasGoneDown = true;
}

function meldCardsSubsetOfHand(hand: Card[], used: Set<string>): boolean {
  const handIds = new Set(hand.map((c) => c.id));
  for (const id of used) if (!handIds.has(id)) return false;
  return true;
}

export function addToOtherPlayersMeld(state: TableState, seat: number, targetSeat: number, meldId: string, cards: Card[]) {
  if (seat === targetSeat) throw new Error("Use addToOwnMeld for own melds");
  const target = state.players[targetSeat];
  if (!target.hasGoneDown) throw new Error("Target player has not gone down");
  // Cannot play wilds or natural 2s on others' melds
  if (cards.some((c) => c.isJoker || c.rank === 2)) throw new Error("Cannot play wilds or natural 2s on other players' melds");

  const meld = target.melds.find((m) => m.id === meldId);
  if (!meld) throw new Error("Meld not found");

  // For simplicity, we validate by creating a new meld candidate with appended cards where possible
  const candidate = cloneMeldWithAdded(meld, cards);
  const v = validateMeld(candidate);
  if (!v.ok) throw new Error(`Invalid extension: ${v.reason}`);

  // Remove cards from player's hand
  const player = state.players[seat];
  const usedIds = new Set(cards.map((c) => c.id));
  if (!meldCardsSubsetOfHand(player.hand, usedIds)) throw new Error("Player does not possess all cards to add");
  player.hand = player.hand.filter((c) => !usedIds.has(c.id));

  // Commit extension
  target.melds = target.melds.map((m) => (m.id === meldId ? candidate : m));
}

export function addToOwnMeld(state: TableState, seat: number, meldId: string, cards: Card[]) {
  const player = state.players[seat];
  const meld = player.melds.find((m) => m.id === meldId);
  if (!meld) throw new Error("Meld not found");

  const candidate = cloneMeldWithAdded(meld, cards);
  const v = validateMeld(candidate);
  if (!v.ok) throw new Error(`Invalid extension: ${v.reason}`);

  // Remove cards from player's hand and commit
  const usedIds = new Set(cards.map((c) => c.id));
  if (!meldCardsSubsetOfHand(player.hand, usedIds)) throw new Error("Player does not possess all cards to add");
  player.hand = player.hand.filter((c) => !usedIds.has(c.id));
  player.melds = player.melds.map((m) => (m.id === meldId ? candidate : m));
}

function cloneMeldWithAdded(meld: Meld, cards: Card[]): Meld {
  if (meld.type === "set") {
    // Add cards as natural where possible; wilds must be flagged externally by positions, but for additions to sets, wilds are allowed for own melds only; others' melds already disallowed
    const newCards = meld.cards.concat(cards);
    const newWildPositions = [...meld.wildPositions];
    for (let i = meld.cards.length; i < newCards.length; i++) {
      const c = newCards[i];
      if (c.isJoker || c.rank === 2) newWildPositions.push(i);
    }
    return {
      ...meld,
      cards: newCards,
      wildPositions: newWildPositions,
    };
  } else {
    // For run, we only allow appending at ends; to keep it simple, try both ends and keep a valid configuration
    const tryAppend = (left: boolean) => {
      const newCards = left ? cards.concat(meld.cards) : meld.cards.concat(cards);
      const baseOffset = left ? cards.length : 0;
      const newWildPositions = meld.wildPositions.map((p) => p + baseOffset);
      for (let i = 0; i < cards.length; i++) {
        const idx = left ? i : meld.cards.length + i;
        const c = newCards[idx];
        if (c.isJoker || c.rank === 2) newWildPositions.push(idx);
      }
      return { newCards, newWildPositions };
    };

    const leftTry = tryAppend(true);
    const leftCandidate: Meld = {
      ...meld,
      cards: leftTry.newCards,
      wildPositions: leftTry.newWildPositions,
    } as Meld;
    const leftValid = validateMeld(leftCandidate);
    if (leftValid.ok) return leftCandidate;

    const rightTry = tryAppend(false);
    const rightCandidate: Meld = {
      ...meld,
      cards: rightTry.newCards,
      wildPositions: rightTry.newWildPositions,
    } as Meld;
    const rightValid = validateMeld(rightCandidate);
    if (rightValid.ok) return rightCandidate;

    throw new Error("Cannot append cards to run at either end while preserving validity");
  }
}

export function discard(state: TableState, seat: number, card: Card) {
  // Cannot discard Jokers or 2s
  if (card.isJoker || card.rank === 2) throw new Error("Cannot discard Jokers or 2s");
  const player = state.players[seat];
  const idx = player.hand.findIndex((c) => c.id === card.id);
  if (idx < 0) throw new Error("Card not in hand");
  player.hand.splice(idx, 1);

  // Move previous cold to dead; place new cold
  if (state.discard.coldCard) state.discard.deadCards.push(state.discard.coldCard);
  state.discard.coldCard = card;
}

export function tryGoOutByEmptyHand(state: TableState, seat: number): boolean {
  const player = state.players[seat];
  if (player.hand.length === 0) {
    // Round ends
    endRound(state, seat);
    return true;
  }
  return false;
}

export function endRound(state: TableState, winnerSeat: number) {
  // Tally points for others
  for (const p of state.players) {
    if (p.seatIndex === winnerSeat) continue;
    p.score += handPoints(p.hand);
  }
  // Advance hands: players who did not go down do not advance
  for (const p of state.players) {
    if (p.hasGoneDown && p.currentHand < 7) p.currentHand = ((p.currentHand + 1) as HandRequirementIndex);
  }
  state.phase = "round_end";
}

export function prepareNextRound(state: TableState) {
  // Rotate dealer left
  state.dealerSeat = (state.dealerSeat + 1) % state.players.length;
  state.activeSeat = (state.dealerSeat + 1) % state.players.length;
  state.roundNumber += 1;

  // Reset per-round state
  const deck = createStandardDeal();
  state.undealt = { remaining: deck } as UndealtPile;
  state.discard = { deadCards: [] } as DiscardPile;
  for (const p of state.players) {
    p.hand = [];
    p.melds = [];
    p.hasGoneDown = false;
    p.meClaimsUsed = 0;
  }
  state.phase = "deal";
}

function ensureHot(state: TableState) {
  if (!state.undealt.hotCard) updateHot(state);
}
function updateHot(state: TableState) {
  if (!state.undealt.remaining.length) {
    reshuffleDeadIntoUndealt(state);
  }
  state.undealt.hotCard = state.undealt.remaining.pop();
}
function drawHot(state: TableState): Card {
  ensureHot(state);
  const c = state.undealt.hotCard!;
  state.undealt.hotCard = undefined;
  updateHot(state);
  return c;
}
function reshuffleDeadIntoUndealt(state: TableState) {
  // Keep current cold on discard; reshuffle dead into new remaining
  const toShuffle = state.discard.deadCards.splice(0);
  if (toShuffle.length === 0) throw new Error("No cards left to reshuffle");
  // Simple shuffle
  for (let i = toShuffle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
  }
  state.undealt.remaining = toShuffle;
}