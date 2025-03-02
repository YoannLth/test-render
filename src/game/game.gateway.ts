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
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);
  private playerSockets: Map<string, string> = new Map(); // playerId -> socketId

  constructor(private readonly gameService: GameService) {}

  @SubscribeMessage('createGame')
  handleCreateGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: string; username: string },
  ) {
    try {
      // Store the player ID in the socket for later reference
      client.data.playerId = data.id;
      
      const gameState = this.gameService.createGame({
        id: data.id,
        username: data.username,
        cards: [],
        isAlive: true,
        turnsToPlay: 1
      });
      
      client.join(gameState.id);

      // If the game has started, send initial hand
      if (gameState.status === 'playing') {
        const game = this.gameService.getGame(gameState.id);
        const player = game.players.find(p => p.id === data.id);
        if (player) {
          client.emit('updateHand', player.cards);
        }
      }

      // Broadcast the game state
      this.server.to(gameState.id).emit('gameStateUpdate', gameState);
      
      return { success: true, gameState };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; player: { id: string; username: string } },
  ) {
    try {
      // Store the player ID in the socket for later reference
      client.data.playerId = data.player.id;
      
      const gameState = this.gameService.joinGame(data.gameId, {
        ...data.player,
        cards: [],
        isAlive: true,
        turnsToPlay: 1
      });
      client.join(data.gameId);

      // If the game has started, send initial hands to all players
      if (gameState.status === 'playing') {
        const game = this.gameService.getGame(data.gameId);
        game.players.forEach(player => {
          const playerSocket = this.getSocketByPlayerId(player.id);
          if (playerSocket) {
            playerSocket.emit('updateHand', player.cards);
          }
        });
      }

      // Broadcast the game state to all players in the game
      this.server.to(data.gameId).emit('gameStateUpdate', gameState);
      
      return { success: true, gameState };
    } catch (error) {
      return { error: error.message };
    }
  }

  private getSocketByPlayerId(playerId: string): Socket | undefined {
    for (const [id, socket] of this.server.sockets.sockets.entries()) {
      if (socket.data.playerId === playerId) {
        return socket;
      }
    }
    return undefined;
  }

  @SubscribeMessage('makeMove')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; move: GameMove }
  ) {
    try {
      this.logger.log(`Processing move in game ${data.gameId}:`, data.move);
      const gameState = this.gameService.makeMove(data.gameId, data.move);
      const game = this.gameService.getGame(data.gameId);
      
      // First broadcast the game state update to all players in the room
      this.server.to(data.gameId).emit('gameStateUpdate', gameState);

      // Then send individual hand updates to each player
      game.players.forEach(player => {
        const playerSocket = this.getSocketByPlayerId(player.id);
        if (playerSocket) {
          const hand = this.gameService.getPlayerHand(data.gameId, player.id);
          playerSocket.emit('updateHand', hand);
        }
      });
      
      return { success: true, gameState };
    } catch (error) {
      this.logger.error('Error processing move:', error);
      return { error: error.message };
    }
  }

  @SubscribeMessage('disconnect')
  handleDisconnect(@ConnectedSocket() client: Socket) {
    // We don't need this anymore since we store playerId in socket.data
    this.logger.debug(`Socket ${client.id} disconnected`);
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
      this.playerSockets.set(player.id, client.id);
      
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

      // First broadcast the game state update to all players in the room
      const gameState = this.gameService.getGameStateForPlayer(data.gameId, data.fromPlayerId);
      this.server.to(data.gameId).emit('gameStateUpdate', gameState);

      // Then send individual hand updates to affected players
      game.players.forEach(player => {
        const playerSocket = this.getSocketByPlayerId(player.id);
        if (playerSocket) {
          const hand = this.gameService.getPlayerHand(data.gameId, player.id);
          playerSocket.emit('updateHand', hand);
        }
      });

      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }
} 