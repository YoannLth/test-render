import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LobbyService } from './lobby.service';
import { LobbyUser } from './lobby.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly lobbyService: LobbyService) {}

  handleConnection(@ConnectedSocket() client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // TODO: Remove user from any lobbies they're in
  }

  @SubscribeMessage('createLobby')
  handleCreateLobby(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { name: string; maxUsers?: number },
  ) {
    const lobby = this.lobbyService.createLobby(data.name, data.maxUsers);
    client.join(lobby.id);
    this.server.emit('lobbyList', this.lobbyService.getAllLobbies());
    return lobby;
  }

  @SubscribeMessage('joinLobby')
  handleJoinLobby(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lobbyId: string; user: LobbyUser },
  ) {
    try {
      const user = { ...data.user, socketId: client.id };
      const lobby = this.lobbyService.joinLobby(data.lobbyId, user);
      client.join(lobby.id);
      
      // Notify all clients in the lobby that a new user has joined
      this.server.to(lobby.id).emit('userJoined', { lobby, user });
      this.server.emit('lobbyList', this.lobbyService.getAllLobbies());
      
      return lobby;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('leaveLobby')
  handleLeaveLobby(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lobbyId: string; userId: string },
  ) {
    try {
      const lobby = this.lobbyService.leaveLobby(data.lobbyId, data.userId);
      client.leave(lobby.id);
      
      // Notify all clients in the lobby that a user has left
      this.server.to(lobby.id).emit('userLeft', { lobby, userId: data.userId });
      this.server.emit('lobbyList', this.lobbyService.getAllLobbies());
      
      return lobby;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('getLobbyList')
  handleGetLobbyList() {
    return this.lobbyService.getAllLobbies();
  }
} 