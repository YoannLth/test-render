export interface LobbyUser {
  id: string;
  username: string;
  socketId: string;
}

export interface Lobby {
  id: string;
  name: string;
  users: LobbyUser[];
  maxUsers?: number;
} 