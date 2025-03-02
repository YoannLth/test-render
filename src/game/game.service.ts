import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Card, GameState, Player, GameMove, CardType, CatType, PublicGameState, PublicPlayer, PublicGameAction, GameAction } from './game.interface';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private games: Map<string, GameState> = new Map();

  // Convert private game state to public game state
  private toPublicGameState(gameState: GameState, playerId?: string): PublicGameState {
    this.logger.debug(`Converting game ${gameState.id} to public state for player ${playerId}`);
    return {
      id: gameState.id,
      players: gameState.players.map(player => this.toPublicPlayer(player, player.id === playerId)),
      deckSize: gameState.deck.length,
      discardPile: gameState.discardPile,
      currentTurn: gameState.currentTurn,
      status: gameState.status,
      turnDirection: gameState.turnDirection,
      lastAction: gameState.lastAction ? this.toPublicGameAction(gameState.lastAction) : undefined,
      winner: gameState.winner ? this.toPublicPlayer(gameState.winner, gameState.winner.id === playerId) : undefined
    };
  }

  // Convert private player state to public player state
  private toPublicPlayer(player: Player, isCurrentPlayer: boolean): PublicPlayer {
    return {
      id: player.id,
      username: player.username,
      cardCount: player.cards.length,
      isAlive: player.isAlive,
      turnsToPlay: player.turnsToPlay
    };
  }

  // Convert private game action to public game action
  private toPublicGameAction(action: GameAction): PublicGameAction {
    return {
      type: action.type,
      playerId: action.playerId,
      cardType: action.card?.type,
      targetPlayerId: action.targetPlayerId
    };
  }

  private createDeck(playerCount: number): Card[] {
    this.logger.debug(`Creating deck for ${playerCount} players`);
    const deck: Card[] = [];
    
    // Add Defuse cards (6 cards)
    for (let i = 0; i < 6; i++) {
      deck.push({ id: uuidv4(), type: CardType.DEFUSE });
    }
    this.logger.debug('Added 6 Defuse cards');

    // Add Nope cards (5 cards)
    for (let i = 0; i < 5; i++) {
      deck.push({ id: uuidv4(), type: CardType.NOPE });
    }

    // Add Attack cards (4 cards)
    for (let i = 0; i < 4; i++) {
      deck.push({ id: uuidv4(), type: CardType.ATTACK });
    }

    // Add Skip cards (4 cards)
    for (let i = 0; i < 4; i++) {
      deck.push({ id: uuidv4(), type: CardType.SKIP });
    }

    // Add See the Future cards (5 cards)
    for (let i = 0; i < 5; i++) {
      deck.push({ id: uuidv4(), type: CardType.SEE_THE_FUTURE });
    }

    // Add Shuffle cards (4 cards)
    for (let i = 0; i < 4; i++) {
      deck.push({ id: uuidv4(), type: CardType.SHUFFLE });
    }

    // Add Favor cards (4 cards)
    for (let i = 0; i < 4; i++) {
      deck.push({ id: uuidv4(), type: CardType.FAVOR });
    }

    // Add Cat cards (4 of each type)
    Object.values(CatType).forEach(catType => {
      for (let i = 0; i < 4; i++) {
        deck.push({ id: uuidv4(), type: CardType.CAT, catType });
      }
    });

    this.logger.debug(`Initial deck size before exploding kittens: ${deck.length} cards`);
    return this.shuffleDeck(deck);
  }

  private shuffleDeck(deck: Card[]): Card[] {
    this.logger.debug('Shuffling deck');
    return [...deck].sort(() => Math.random() - 0.5);
  }

  private debugPlayerCards: CardType[] = [
    CardType.DEFUSE,
    CardType.ATTACK,
    CardType.SKIP,
    CardType.SKIP,
    CardType.SKIP,
    CardType.SHUFFLE,
    CardType.SEE_THE_FUTURE,
    CardType.SEE_THE_FUTURE,
    CardType.SEE_THE_FUTURE,
    CardType.SEE_THE_FUTURE,
    CardType.SEE_THE_FUTURE,
    CardType.SEE_THE_FUTURE
  ];

  private debugDeckCards: CardType[] = [
    CardType.EXPLODING_KITTEN,
    CardType.DEFUSE,
    CardType.ATTACK,
    CardType.SKIP,
    CardType.SHUFFLE,
    CardType.SEE_THE_FUTURE,
    CardType.NOPE,
  ];

  private useDebugCards: boolean = true;

  private dealCards(deck: Card[], players: Player[]): { deck: Card[], players: Player[] } {
    this.logger.debug(`Dealing cards to ${players.length} players`);
    const updatedPlayers = [...players];
    const updatedDeck = [...deck];

    updatedPlayers.forEach(player => {
      this.logger.debug(`Dealing cards to player ${player.username} (${player.id})`);
      // Add 1 Defuse card
      const defuseCard = { id: uuidv4(), type: CardType.DEFUSE };
      player.cards = [defuseCard];
      this.logger.debug(`Added Defuse card to player ${player.username}`);

      // Add 7 random cards
      for (let i = 0; i < 7; i++) {
        const randomIndex = Math.floor(Math.random() * updatedDeck.length);
        const card = updatedDeck.splice(randomIndex, 1)[0];
        player.cards.push(card);
      }
      this.logger.debug(`Player ${player.username} now has ${player.cards.length} cards`);

      if (this.useDebugCards) {
        const debugPlayerCards = this.debugPlayerCards.map(cardType => ({ id: uuidv4(), type: cardType }));
        player.cards = debugPlayerCards;
      }
    });

    // Add Exploding Kittens after dealing (number of players - 1)
    for (let i = 0; i < players.length - 1; i++) {
      updatedDeck.push({ id: uuidv4(), type: CardType.EXPLODING_KITTEN });
    }
    this.logger.debug(`Added ${players.length - 1} Exploding Kittens to the deck`);

    // Shuffle the deck again after adding exploding kittens
    let finalDeck = this.shuffleDeck(updatedDeck);

    if (this.useDebugCards) {
      const debugDeckCards = this.debugDeckCards.map(cardType => ({ id: uuidv4(), type: cardType }));
      finalDeck = debugDeckCards;
    }

    this.logger.debug(`Final deck size after dealing and adding kittens: ${finalDeck.length}`);

    return { deck: finalDeck, players: updatedPlayers };
  }

  createGame(player: Player): PublicGameState {
    this.logger.log(`Creating new game for player ${player.username} (${player.id})`);
    const gameState: GameState = {
      id: uuidv4(),
      players: [{
        ...player,
        cards: [],
        isAlive: true,
        turnsToPlay: 1
      }],
      deck: [],
      discardPile: [],
      currentTurn: player.id,
      status: 'waiting',
      turnDirection: 'clockwise'
    };

    this.games.set(gameState.id, gameState);
    this.logger.log(`Game ${gameState.id} created successfully`);
    return this.toPublicGameState(gameState, player.id);
  }

  joinGame(gameId: string, player: Player): PublicGameState {
    this.logger.log(`Player ${player.username} (${player.id}) attempting to join game ${gameId}`);
    const game = this.games.get(gameId);
    
    if (!game) {
      this.logger.error(`Game ${gameId} not found`);
      throw new Error('Game not found');
    }

    if (game.players.length >= 10) {
      this.logger.warn(`Game ${gameId} is full (${game.players.length} players)`);
      throw new Error('Game is full');
    }

    if (game.status !== 'waiting') {
      this.logger.warn(`Game ${gameId} has already started`);
      throw new Error('Game has already started');
    }

    const newPlayer = {
      ...player,
      cards: [],
      isAlive: true,
      turnsToPlay: 1
    };

    game.players.push(newPlayer);
    this.logger.log(`Player ${player.username} joined game ${gameId}. Total players: ${game.players.length}`);

    // If we have at least 3 players, start the game
    if (game.players.length >= 3) {
      this.logger.log(`Starting game ${gameId} with ${game.players.length} players`);
      game.status = 'playing';
      game.deck = this.createDeck(game.players.length);
      const { deck, players } = this.dealCards(game.deck, game.players);
      game.deck = deck;
      game.players = players;
      this.logger.log(`Game ${gameId} started successfully`);
    }

    this.games.set(gameId, game);
    return this.toPublicGameState(game, player.id);
  }

  makeMove(gameId: string, move: GameMove): PublicGameState {
    this.logger.log(`Processing move in game ${gameId}:`, move);
    const game = this.games.get(gameId);
    
    if (!game) {
      this.logger.error(`Game ${gameId} not found`);
      throw new Error('Game not found');
    }

    if (game.status !== 'playing') {
      this.logger.error(`Game ${gameId} is not in playing state (current: ${game.status})`);
      throw new Error('Game is not in playing state');
    }

    const currentPlayer = game.players.find(p => p.id === game.currentTurn);
    if (!currentPlayer || !currentPlayer.isAlive) {
      this.logger.error(`Invalid current player in game ${gameId}. Player: ${JSON.stringify(currentPlayer)}`);
      throw new Error('Current player is not valid');
    }

    if (move.playerId !== game.currentTurn) {
      this.logger.error(`Not player's turn. Expected: ${game.currentTurn}, Got: ${move.playerId}`);
      throw new Error('Not your turn');
    }

    this.logger.debug(`Processing ${move.type} move for player ${currentPlayer.username}`);
    const result = this.processMove(game, move);
    return this.toPublicGameState(result, move.playerId);
  }

  private processMove(game: GameState, move: GameMove): GameState {
    switch (move.type) {
      case 'PLAY_CARD':
        return this.handlePlayCard(game, move);
      case 'DRAW_CARD':
        return this.handleDrawCard(game, move);
      case 'DEFUSE_KITTEN':
        return this.handleDefuseKitten(game, move);
      case 'NOPE':
        return this.handleNope(game, move);
      default:
        this.logger.error(`Invalid move type: ${move.type}`);
        throw new Error('Invalid move type');
    }
  }

  private handlePlayCard(game: GameState, move: GameMove): GameState {
    this.logger.debug(`Player ${move.playerId} attempting to play card ${move.cardId}`);
    
    if (!move.cardId) {
      this.logger.error('Card ID is required for PLAY_CARD move');
      throw new Error('Card ID is required');
    }
    
    const player = game.players.find(p => p.id === move.playerId);
    if (!player) {
      this.logger.error(`Player ${move.playerId} not found in game ${game.id}`);
      throw new Error('Player not found');
    }

    const cardIndex = player.cards.findIndex(c => c.id === move.cardId);
    if (cardIndex === -1) {
      this.logger.error(`Card ${move.cardId} not found in player ${player.username}'s hand`);
      throw new Error('Card not found in player hand');
    }

    const card = player.cards[cardIndex];
    this.logger.debug(`Player ${player.username} playing ${card.type} card`);
    
    player.cards.splice(cardIndex, 1);
    game.discardPile.push(card);

    // Save the action for potential Nope cards
    game.lastAction = {
      type: 'PLAY_CARD',
      playerId: move.playerId,
      card: card,
      targetPlayerId: move.targetPlayerId
    };
    this.logger.debug(`Last action saved: ${JSON.stringify(game.lastAction)}`);

    switch (card.type) {
      case CardType.ATTACK:
        let turnsToPlay = 2;
        if (player.turnsToPlay === 1) {
          turnsToPlay = 2; // classic case
        } else {
          let turnsNeededToPlay = player.turnsToPlay; // cumulate the attack cards
          turnsToPlay = turnsNeededToPlay + 2;
        }
        const nextPlayer = this.getNextPlayer(game);
        nextPlayer.turnsToPlay = turnsToPlay;
        this.logger.debug(`Attack card played. Next player ${nextPlayer.username} now has ${nextPlayer.turnsToPlay} turns`);
        this.endTurn(game, true);
        break;

      case CardType.SKIP:
        this.logger.debug(`Skip card played by ${player.username}`);
        this.endTurn(game);
        break;

      case CardType.SEE_THE_FUTURE:
        game.topThreeCards = game.deck.slice(0, 3);
        this.logger.debug(`See the Future card played. Top 3 cards revealed to ${player.username}`);
        break;

      case CardType.SHUFFLE:
        this.logger.debug(`Shuffle card played. Shuffling deck...`);
        game.deck = this.shuffleDeck(game.deck);
        break;

      case CardType.FAVOR:
        if (!move.targetPlayerId) {
          this.logger.error('Target player is required for Favor card');
          throw new Error('Target player is required for Favor card');
        }
        const targetPlayer = game.players.find(p => p.id === move.targetPlayerId);
        if (!targetPlayer || !targetPlayer.isAlive) {
          this.logger.error(`Target player ${move.targetPlayerId} not found or not alive`);
          throw new Error('Target player not found or not alive');
        }
        if (targetPlayer.cards.length === 0) {
          this.logger.error(`Target player ${targetPlayer.username} has no cards`);
          throw new Error('Target player has no cards');
        }
        
        const randomIndex = Math.floor(Math.random() * targetPlayer.cards.length);
        const selectedCard = targetPlayer.cards.splice(randomIndex, 1)[0];
        player.cards.push(selectedCard);
        this.logger.debug(`Favor card: ${player.username} received ${selectedCard.type} from ${targetPlayer.username}`);
        break;

      case CardType.CAT:
        if (!move.targetPlayerId) throw new Error('Target player is required for Cat card pair');
        const catTargetPlayer = game.players.find(p => p.id === move.targetPlayerId);
        if (!catTargetPlayer || !catTargetPlayer.isAlive) throw new Error('Target player not found or not alive');
        if (catTargetPlayer.cards.length === 0) throw new Error('Target player has no cards');
        
        // For cat cards, we expect two consecutive moves with the same cat type
        const lastCatCard = game.discardPile[game.discardPile.length - 2];
        if (lastCatCard?.type === CardType.CAT && lastCatCard.catType === card.catType) {
          // Cat pair completed, steal a random card
          const randomIdx = Math.floor(Math.random() * catTargetPlayer.cards.length);
          const stolenCard = catTargetPlayer.cards.splice(randomIdx, 1)[0];
          player.cards.push(stolenCard);
        }
        break;
    }

    this.logger.debug(`Card play completed successfully`);
    return game;
  }

  private handleDrawCard(game: GameState, move: GameMove): GameState {
    const player = game.players.find(p => p.id === move.playerId);
    if (!player) {
      this.logger.error(`Player ${move.playerId} not found in game ${game.id}`);
      throw new Error('Player not found');
    }
    
    this.logger.debug(`Player ${player.username} drawing a card`);
    
    const drawnCard = game.deck.shift();
    if (!drawnCard) {
      throw new Error('No cards left in deck');
    }

    // Save the action for potential Nope cards
    game.lastAction = {
      type: 'DRAW_CARD',
      playerId: move.playerId,
      card: drawnCard
    };

    if (drawnCard.type === CardType.EXPLODING_KITTEN) {
      // Check if player has a defuse card
      const defuseIndex = player.cards.findIndex(c => c.type === CardType.DEFUSE);
      if (defuseIndex === -1) {
        // No defuse card, player explodes
        player.isAlive = false;
        game.discardPile.push(drawnCard);
        this.checkGameEnd(game);
        this.endTurn(game);
      } else {
        // Has defuse card, remove it and wait for player to place the kitten
        const defuseCard = player.cards.splice(defuseIndex, 1)[0];
        game.discardPile.push(defuseCard);
        game.explodingKittenPosition = -1; // Mark that we're waiting for defuse placement
      }
    } else {
      player.cards.push(drawnCard);
      this.endTurn(game);
    }

    return game;
  }

  private handleDefuseKitten(game: GameState, move: GameMove): GameState {
    if (game.explodingKittenPosition === undefined) {
      throw new Error('No exploding kitten to defuse');
    }

    if (move.targetPosition === undefined || 
        move.targetPosition < 0 || 
        move.targetPosition > game.deck.length) {
      throw new Error('Invalid position for exploding kitten');
    }

    // Get the last drawn exploding kitten
    const lastAction = game.lastAction;
    if (!lastAction || lastAction.type !== 'DRAW_CARD' || !lastAction.card || 
        lastAction.card.type !== CardType.EXPLODING_KITTEN) {
      throw new Error('No exploding kitten to defuse');
    }

    // Insert the exploding kitten back into the deck at the specified position
    game.deck.splice(move.targetPosition, 0, lastAction.card);
    game.explodingKittenPosition = undefined;
    
    // Update the last action to reflect the defuse
    game.lastAction = {
      type: 'DEFUSE_KITTEN',
      playerId: move.playerId,
      card: lastAction.card
    };
    
    this.endTurn(game);

    return game;
  }

  private handleNope(game: GameState, move: GameMove): GameState {
    if (!game.lastAction) throw new Error('No action to nope');
    
    const player = game.players.find(p => p.id === move.playerId);
    if (!player) throw new Error('Player not found');

    const nopeIndex = player.cards.findIndex(c => c.type === CardType.NOPE);
    if (nopeIndex === -1) throw new Error('No nope card found');

    // Remove the nope card
    player.cards.splice(nopeIndex, 1);
    game.discardPile.push({ id: uuidv4(), type: CardType.NOPE });

    // Reverse the last action
    // This would need specific handling for each action type
    
    return game;
  }

  private endTurn(game: GameState, superSkip: boolean = false): void {
    const currentPlayer = game.players.find(p => p.id === game.currentTurn);
    if (!currentPlayer) throw new Error('Current player not found');

    if (superSkip) {
      currentPlayer.turnsToPlay = 0;
    } else {
      currentPlayer.turnsToPlay--;
    }

    if (currentPlayer.turnsToPlay <= 0) {
      currentPlayer.turnsToPlay = 1;
      game.currentTurn = this.getNextPlayer(game).id;
    }
  }

  private getNextPlayer(game: GameState): Player {
    const currentIndex = game.players.findIndex(p => p.id === game.currentTurn);
    const direction = game.turnDirection === 'clockwise' ? 1 : -1;
    
    let nextIndex = currentIndex;
    do {
      nextIndex = (nextIndex + direction + game.players.length) % game.players.length;
    } while (!game.players[nextIndex].isAlive && nextIndex !== currentIndex);
    
    return game.players[nextIndex];
  }

  private checkGameEnd(game: GameState): void {
    const alivePlayers = game.players.filter(p => p.isAlive);
    if (alivePlayers.length === 1) {
      game.status = 'finished';
      game.winner = alivePlayers[0];
    }
  }

  getGame(gameId: string): GameState {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    return game;
  }

  deleteGame(gameId: string): void {
    this.games.delete(gameId);
  }

  // Get game state for a specific player
  getGameStateForPlayer(gameId: string, playerId: string): PublicGameState {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    return this.toPublicGameState(game, playerId);
  }

  // Get player's hand
  getPlayerHand(gameId: string, playerId: string): Card[] {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    return [...player.cards];
  }

  // Get top three cards (for See the Future card)
  getTopThreeCards(gameId: string, playerId: string): Card[] | undefined {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    if (game.currentTurn !== playerId) {
      throw new Error('Not your turn');
    }
    
    return game.topThreeCards ? [...game.topThreeCards] : undefined;
  }
} 