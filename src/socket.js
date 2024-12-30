import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3002';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['polling', 'websocket']
});

export default socket; 