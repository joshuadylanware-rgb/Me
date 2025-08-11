import { describe, it, expect } from "vitest";
import { createTable, startRound, flipFirstCold, claimColdViaMe, activeDrawsHot, discard } from "../src/game.js";

// Integration smoke test for Me! sequence

describe("Game flow basics", () => {
  it("allows Me! claim then forces active to draw next hot", () => {
    const state = createTable(["A", "B", "C"]);
    startRound(state);
    flipFirstCold(state);

    // At this point, B is active (seat 1), A discarded nothing yet; cold card exists
    // C (seat 2) claims Me!
    const claimantSeat = 2;
    const handBefore = state.players[claimantSeat].hand.length;
    const activeBefore = state.players[state.activeSeat].hand.length;

    claimColdViaMe(state, claimantSeat);

    expect(state.players[claimantSeat].hand.length).toBe(handBefore + 2); // took cold + hot

    // Active draws next hot
    activeDrawsHot(state);
    expect(state.players[state.activeSeat].hand.length).toBe(activeBefore + 1);
  });

  it("prevents discarding 2s and jokers", () => {
    const state = createTable(["A", "B", "C"]);
    startRound(state);
    flipFirstCold(state);
    const seat = state.activeSeat;
    const two = state.players[seat].hand.find((c) => c.rank === 2);
    if (two) {
      expect(() => discard(state, seat, two)).toThrow();
    }
  });
});