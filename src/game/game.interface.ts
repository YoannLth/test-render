export enum CardType {
  EXPLODING_KITTEN = 'EXPLODING_KITTEN',
  DEFUSE = 'DEFUSE',
  NOPE = 'NOPE',
  ATTACK = 'ATTACK',
  SKIP = 'SKIP',
  SEE_THE_FUTURE = 'SEE_THE_FUTURE',
  SHUFFLE = 'SHUFFLE',
  FAVOR = 'FAVOR',
  CAT = 'CAT'
}

export enum CatType {
  TACO = 'TACO',
  RAINBOW = 'RAINBOW',
  POTATO = 'POTATO',
  BEARD = 'BEARD',
  MELON = 'MELON'
}

export interface Card {
  id: string;
  type: CardType;
  catType?: CatType;
}

// Private full game state (server-side only)
export interface GameState {
  id: string;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentTurn: string;
  status: 'waiting' | 'playing' | 'finished';
  turnDirection: 'clockwise' | 'counterclockwise';
  lastAction?: GameAction;
  explodingKittenPosition?: number;
  topThreeCards?: Card[];
  winner?: Player;
}

// Public game state (sent to clients)
export interface PublicGameState {
  id: string;
  players: PublicPlayer[];
  deckSize: number;
  discardPile: Card[];
  currentTurn: string;
  status: 'waiting' | 'playing' | 'finished';
  turnDirection: 'clockwise' | 'counterclockwise';
  lastAction?: PublicGameAction;
  winner?: PublicPlayer;
}

// Private player state (server-side only)
export interface Player {
  id: string;
  username: string;
  cards: Card[];
  isAlive: boolean;
  turnsToPlay: number;
}

// Public player state (sent to clients)
export interface PublicPlayer {
  id: string;
  username: string;
  cardCount: number;
  isAlive: boolean;
  turnsToPlay: number;
}

// Private game action (server-side only)
export interface GameAction {
  type: 'PLAY_CARD' | 'DRAW_CARD' | 'DEFUSE_KITTEN' | 'NOPE';
  playerId: string;
  card?: Card;
  targetPlayerId?: string;
}

// Public game action (sent to clients)
export interface PublicGameAction {
  type: 'PLAY_CARD' | 'DRAW_CARD' | 'DEFUSE_KITTEN' | 'NOPE';
  playerId: string;
  cardType?: CardType;
  targetPlayerId?: string;
}

export interface GameMove {
  type: 'PLAY_CARD' | 'DRAW_CARD' | 'DEFUSE_KITTEN' | 'NOPE';
  playerId: string;
  cardId?: string;
  targetPlayerId?: string;
  targetPosition?: number;
} 