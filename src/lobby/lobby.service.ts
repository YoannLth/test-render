import { Injectable } from '@nestjs/common';
import { Lobby, LobbyUser } from './lobby.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LobbyService {
  private lobbies: Map<string, Lobby> = new Map();

  createLobby(name: string, maxUsers?: number): Lobby {
    const lobby: Lobby = {
      id: uuidv4(),
      name,
      users: [],
      maxUsers,
    };
    this.lobbies.set(lobby.id, lobby);
    return lobby;
  }

  joinLobby(lobbyId: string, user: LobbyUser): Lobby {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error('Lobby not found');
    }

    if (lobby.maxUsers && lobby.users.length >= lobby.maxUsers) {
      throw new Error('Lobby is full');
    }

    if (lobby.users.find(u => u.id === user.id)) {
      throw new Error('User already in lobby');
    }

    lobby.users.push(user);
    this.lobbies.set(lobbyId, lobby);
    return lobby;
  }

  leaveLobby(lobbyId: string, userId: string): Lobby {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error('Lobby not found');
    }

    lobby.users = lobby.users.filter(user => user.id !== userId);
    this.lobbies.set(lobbyId, lobby);
    return lobby;
  }

  getLobby(lobbyId: string): Lobby {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error('Lobby not found');
    }
    return lobby;
  }

  getAllLobbies(): Lobby[] {
    return Array.from(this.lobbies.values());
  }

  deleteLobby(lobbyId: string): void {
    this.lobbies.delete(lobbyId);
  }
} 