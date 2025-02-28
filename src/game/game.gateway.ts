import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { Player, GameMove, Card } from './game.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) {}

  @SubscribeMessage('createGame')
  handleCreateGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() player: Omit<Player, 'socketId' | 'cards' | 'isAlive' | 'turnsToPlay'>,
  ) {
    try {
      const fullPlayer: Player = {
        ...player,
        socketId: client.id,
        cards: [],
        isAlive: true,
        turnsToPlay: 1
      };
      const game = this.gameService.createGame(fullPlayer);
      client.join(game.id);
      return game;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; player: Omit<Player, 'socketId' | 'cards' | 'isAlive' | 'turnsToPlay'> },
  ) {
    try {
      const fullPlayer: Player = {
        ...data.player,
        socketId: client.id,
        cards: [],
        isAlive: true,
        turnsToPlay: 1
      };
      const game = this.gameService.joinGame(data.gameId, fullPlayer);
      client.join(game.id);
      
      // Notify all players in the game that a new player has joined
      this.server.to(game.id).emit('gameStarted', game);
      return game;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('makeMove')
  handleMakeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; move: GameMove },
  ) {
    try {
      const game = this.gameService.makeMove(data.gameId, data.move);
      
      // Broadcast the updated game state to all players in the game
      this.server.to(game.id).emit('gameStateUpdated', game);

      // If the game is finished, notify all players
      if (game.status === 'finished') {
        this.server.to(game.id).emit('gameFinished', {
          winner: game.winner,
          finalState: game,
        });
      }

      return game;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; playerId: string },
  ) {
    try {
      const game = this.gameService.getGame(data.gameId);
      client.leave(game.id);
      
      // Notify other players that a player has left
      this.server.to(game.id).emit('playerLeft', {
        gameId: game.id,
        playerId: data.playerId,
      });
      
      // Clean up the game
      this.gameService.deleteGame(data.gameId);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('rejoinGame')
  handleRejoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; playerId: string; username: string },
  ) {
    try {
      const game = this.gameService.getGame(data.gameId);
      
      // Check if the player was in this game
      const player = game.players.find(p => p.id === data.playerId);
      if (!player) {
        throw new Error('Player not found in this game');
      }

      // Update the player's socket ID
      player.socketId = client.id;
      
      // Join the socket room
      client.join(game.id);
      
      // Send the current game state back to the player
      client.emit('rejoinGameSuccess', game);
      
      return game;
    } catch (error) {
      client.emit('rejoinGameError');
      return { error: error.message };
    }
  }

  @SubscribeMessage('seeTheFuture')
  handleSeeTheFuture(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; playerId: string },
  ) {
    try {
      const game = this.gameService.getGame(data.gameId);
      if (game.topThreeCards) {
        client.emit('seeTheFutureResult', game.topThreeCards);
      }
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('giveCard')
  handleGiveCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; fromPlayerId: string; toPlayerId: string; cardId: string },
  ) {
    try {
      const game = this.gameService.getGame(data.gameId);
      const fromPlayer = game.players.find(p => p.id === data.fromPlayerId);
      const toPlayer = game.players.find(p => p.id === data.toPlayerId);
      
      if (!fromPlayer || !toPlayer) {
        throw new Error('Player not found');
      }

      const cardIndex = fromPlayer.cards.findIndex(c => c.id === data.cardId);
      if (cardIndex === -1) {
        throw new Error('Card not found');
      }

      const card = fromPlayer.cards.splice(cardIndex, 1)[0];
      toPlayer.cards.push(card);

      // Notify players about the card transfer
      this.server.to(game.id).emit('gameStateUpdated', game);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }
} 