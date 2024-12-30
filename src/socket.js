import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3002';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['polling', 'websocket'],
  withCredentials: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 60000,
  forceNew: true,
  path: '/socket.io'
});

// Bağlantı durumunu izle
socket.on('connect', () => {
  console.log('Socket.IO bağlantısı başarılı');
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO bağlantı hatası:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Socket.IO bağlantısı kesildi:', reason);
});

export default socket; 