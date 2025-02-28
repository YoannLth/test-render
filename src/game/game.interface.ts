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
  BEARD = 'BEARD',
  POTATO = 'POTATO',
  MELON = 'MELON'
}

export interface Card {
  id: string;
  type: CardType;
  catType?: CatType; // Only for CAT cards
}

export interface Player {
  id: string;
  username: string;
  socketId: string;
  cards: Card[];
  isAlive: boolean;
  turnsToPlay: number; // For handling Attack card effects
}

export interface GameState {
  id: string;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentTurn: string; // player id
  status: 'waiting' | 'playing' | 'finished';
  winner?: Player;
  turnDirection: 'clockwise' | 'counter-clockwise';
  lastAction?: GameAction;
  topThreeCards?: Card[]; // For See the Future card
  explodingKittenPosition?: number; // Position where defused kitten was placed
}

export interface GameAction {
  type: 'PLAY_CARD' | 'DRAW_CARD' | 'DEFUSE_KITTEN' | 'NOPE';
  playerId: string;
  card?: Card;
  targetPlayerId?: string;
  targetPosition?: number; // For placing Exploding Kitten back in deck
}

export interface GameMove {
  type: 'PLAY_CARD' | 'DRAW_CARD' | 'DEFUSE_KITTEN' | 'NOPE';
  playerId: string;
  cardId?: string;
  targetPlayerId?: string;
  targetPosition?: number;
} 