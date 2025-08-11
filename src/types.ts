export type Suit = "Clubs" | "Diamonds" | "Hearts" | "Spades";

export type Rank =
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  id: string; // unique per physical card instance
  suit?: Suit; // undefined for Jokers
  rank?: Rank; // undefined for Jokers
  isJoker: boolean;
  fromDeckId: 1 | 2; // which of the two physical decks
}

export type Naturalness = "natural" | "wild";

export interface ScoredCard extends Card {
  points: number; // 2=25, 3-9=5, 10/J/Q/K=10, A=20, Joker=50
}

export type MeldType = "set" | "run";

export interface SetMeld {
  id: string;
  type: "set";
  rank: Exclude<Rank, 2>; // cannot make a set of natural 2s
  cards: Card[]; // includes wilds marked in wildPositions
  wildPositions: number[]; // indices of wild cards within cards
}

export interface RunMeld {
  id: string;
  type: "run";
  suit: Suit; // suit for all natural cards
  // ordered lowest->highest logical sequence (may start at 2 or A-low)
  cards: Card[];
  wildPositions: number[];
}

export type Meld = SetMeld | RunMeld;

export type HandRequirementIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PlayerState {
  id: string;
  name: string;
  seatIndex: number;
  hand: Card[];
  melds: Meld[]; // only melds they have gone down with or extended on their own
  hasGoneDown: boolean;
  currentHand: HandRequirementIndex; // 1..7
  score: number; // accumulated points (lower is better)
  meClaimsUsed: number; // per-round counter, max 3
}

export interface DiscardPile {
  coldCard?: Card; // top visible discard
  deadCards: Card[]; // all below the cold card
}

export interface UndealtPile {
  hotCard?: Card; // top of face-down deck
  remaining: Card[]; // rest of face-down deck, hotCard is last element logically
}

export type Phase = "deal" | "analyze" | "play" | "round_end" | "game_end";

export interface TableState {
  players: PlayerState[];
  dealerSeat: number; // index into players
  activeSeat: number; // index into players whose turn it is
  phase: Phase;
  discard: DiscardPile;
  undealt: UndealtPile;
  roundNumber: number;
  // configuration
  timers: {
    analyzeMs: number; // default 15000
    drawWindowMs: number; // default 15000
    playWindowMs: number; // default 30000
  };
}

export interface DealConfig {
  numberOfDecks: 2 | 3; // default 2; allow 3 for potential variants/testing
  includeJokers: boolean; // must be true for this game
  numJokers: number; // must be 4 in standard rules
}