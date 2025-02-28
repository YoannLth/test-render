import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Card, GameState, Player, GameMove, CardType, CatType } from './game.interface';

@Injectable()
export class GameService {
  private games: Map<string, GameState> = new Map();

  private createDeck(playerCount: number): Card[] {
    const deck: Card[] = [];
    
    // Add Exploding Kittens (number of players - 1)
    for (let i = 0; i < playerCount - 1; i++) {
      deck.push({ id: uuidv4(), type: CardType.EXPLODING_KITTEN });
    }

    // Add Defuse cards (6 cards)
    for (let i = 0; i < 6; i++) {
      deck.push({ id: uuidv4(), type: CardType.DEFUSE });
    }

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

    // Shuffle the deck
    return this.shuffleDeck(deck);
  }

  private shuffleDeck(deck: Card[]): Card[] {
    return [...deck].sort(() => Math.random() - 0.5);
  }

  private dealCards(deck: Card[], players: Player[]): { deck: Card[], players: Player[] } {
    const updatedPlayers = [...players];
    const updatedDeck = [...deck];

    // Give each player 7 random cards and 1 Defuse card
    updatedPlayers.forEach(player => {
      // Add 1 Defuse card
      const defuseCard = { id: uuidv4(), type: CardType.DEFUSE };
      player.cards = [defuseCard];

      // Add 7 random cards
      for (let i = 0; i < 7; i++) {
        const randomIndex = Math.floor(Math.random() * updatedDeck.length);
        const card = updatedDeck.splice(randomIndex, 1)[0];
        player.cards.push(card);
      }
    });

    return { deck: updatedDeck, players: updatedPlayers };
  }

  createGame(player: Player): GameState {
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
    return gameState;
  }

  joinGame(gameId: string, player: Player): GameState {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    if (game.players.length >= 10) {
      throw new Error('Game is full');
    }

    if (game.status !== 'waiting') {
      throw new Error('Game has already started');
    }

    const newPlayer = {
      ...player,
      cards: [],
      isAlive: true,
      turnsToPlay: 1
    };

    game.players.push(newPlayer);

    // If we have at least 3 players, start the game
    if (game.players.length >= 3) {
      game.status = 'playing';
      game.deck = this.createDeck(game.players.length);
      const { deck, players } = this.dealCards(game.deck, game.players);
      game.deck = deck;
      game.players = players;
    }

    this.games.set(gameId, game);
    return game;
  }

  makeMove(gameId: string, move: GameMove): GameState {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'playing') {
      throw new Error('Game is not in playing state');
    }

    const currentPlayer = game.players.find(p => p.id === game.currentTurn);
    if (!currentPlayer || !currentPlayer.isAlive) {
      throw new Error('Current player is not valid');
    }

    if (move.playerId !== game.currentTurn) {
      throw new Error('Not your turn');
    }

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
        throw new Error('Invalid move type');
    }
  }

  private handlePlayCard(game: GameState, move: GameMove): GameState {
    if (!move.cardId) throw new Error('Card ID is required');
    
    const player = game.players.find(p => p.id === move.playerId);
    if (!player) throw new Error('Player not found');

    const cardIndex = player.cards.findIndex(c => c.id === move.cardId);
    if (cardIndex === -1) throw new Error('Card not found in player hand');

    const card = player.cards[cardIndex];
    player.cards.splice(cardIndex, 1);
    game.discardPile.push(card);

    // Save the action for potential Nope cards
    game.lastAction = {
      type: 'PLAY_CARD',
      playerId: move.playerId,
      card: card,
      targetPlayerId: move.targetPlayerId
    };

    switch (card.type) {
      case CardType.ATTACK:
        const nextPlayer = this.getNextPlayer(game);
        nextPlayer.turnsToPlay += 2;
        this.endTurn(game);
        break;

      case CardType.SKIP:
        this.endTurn(game);
        break;

      case CardType.SEE_THE_FUTURE:
        game.topThreeCards = game.deck.slice(0, 3);
        break;

      case CardType.SHUFFLE:
        game.deck = this.shuffleDeck(game.deck);
        break;

      case CardType.FAVOR:
        if (!move.targetPlayerId) throw new Error('Target player is required for Favor card');
        const targetPlayer = game.players.find(p => p.id === move.targetPlayerId);
        if (!targetPlayer || !targetPlayer.isAlive) throw new Error('Target player not found or not alive');
        if (targetPlayer.cards.length === 0) throw new Error('Target player has no cards');
        
        // Randomly select a card from target player's hand
        const randomIndex = Math.floor(Math.random() * targetPlayer.cards.length);
        const selectedCard = targetPlayer.cards.splice(randomIndex, 1)[0];
        player.cards.push(selectedCard);
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

    return game;
  }

  private handleDrawCard(game: GameState, move: GameMove): GameState {
    const player = game.players.find(p => p.id === move.playerId);
    if (!player) throw new Error('Player not found');

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

  private endTurn(game: GameState): void {
    const currentPlayer = game.players.find(p => p.id === game.currentTurn);
    if (!currentPlayer) throw new Error('Current player not found');

    currentPlayer.turnsToPlay--;

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
} 