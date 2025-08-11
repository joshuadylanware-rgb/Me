# Me! — Rules Engine (TypeScript)

Authoritative rules/validation and core round flow for the card game "Me!".

Getting started
- npm i
- npm test

What’s included
- src/types.ts: core types for cards, melds, players, table
- src/deck.ts: two-deck + 4-joker deal and shuffle
- src/scoring.ts: per-card and hand scoring
- src/rules.ts: validation for Sets and Runs per confirmed rules, including:
  - Sets: size ≥ 3; no natural-2 sets; wilds ≤ naturals − 1; duplicates allowed
  - Runs: size ≥ 4 (Hand 7 min 7 when checked at Go Down); suit-locked; no duplicates; Ace high/low with K-A-2 allowed; wilds ≤ naturals; no consecutive wilds; max length 14
- src/game.ts: table creation, dealing, initial flip to Cold, Me! mechanic, add-to-melds, discard restrictions, round end and next round prep
- tests/*.spec.ts: unit and integration tests (Vitest)

Notes
- You cannot discard Jokers or 2s.
- 2s always score 25 in hand, regardless of intended use.
- Me! claim sequence: claimant takes Cold then current Hot; Active then draws next Hot.
- Players who did not Go Down do not advance their hand number after round end.

Next steps
- Implement timers and turn windows in a server loop or UI.
- Add wild replacement in own runs (on-card-drawn constraint) if needed by UI.
- Real-time table and priority resolution UI.