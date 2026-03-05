
export type Shape = 'triangle' | 'circle' | 'square' | 'wild';

export interface Card {
  id: string;
  shape: Shape;
}

export type GameStatus = 'waiting' | 'playing' | 'roulette' | 'gameover';

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isAlive: boolean;
  chambers: boolean[]; // 6 chambers, true means bullet
  currentChamber: number;
  isReady: boolean;
}

export interface GameState {
  id: string;
  players: Player[];
  status: GameStatus;
  currentTurn: string; // Player ID
  targetShape: Shape | null;
  lastPlay: {
    playerId: string;
    cards: Card[];
    claimedCount: number;
  } | null;
  history: string[];
  winner: string | null;
  roulettePlayerId: string | null;
}

export type ServerMessage = 
  | { type: 'INIT'; state: GameState; playerId: string }
  | { type: 'UPDATE'; state: GameState }
  | { type: 'ERROR'; message: string }
  | { type: 'ROULETTE_RESULT'; playerId: string; survived: boolean; chamber: number };

export type ClientMessage =
  | { type: 'JOIN'; name: string; roomId?: string }
  | { type: 'READY' }
  | { type: 'PLAY_CARDS'; cardIds: string[]; claimedShape: Shape }
  | { type: 'CHALLENGE' }
  | { type: 'SPIN_ROULETTE' };
