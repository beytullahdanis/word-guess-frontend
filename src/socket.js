import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3002';
console.log('Connecting to server:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['polling', 'websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000
});

// Bağlantı durumunu izle
socket.on('connect', () => {
  console.log('Socket.IO bağlantısı başarılı:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO bağlantı hatası:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Socket.IO bağlantısı kesildi:', reason);
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Socket.IO yeniden bağlandı, deneme:', attemptNumber);
});

socket.on('reconnect_error', (error) => {
  console.error('Socket.IO yeniden bağlanma hatası:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Socket.IO yeniden bağlanma başarısız oldu');
});

// Otomatik bağlantıyı başlat
socket.connect();

export default socket; 