import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { env } from '../config/env.js';

let io: SocketServer;

export function initSocketServer(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join:show', (showId: number) => {
      const room = `show:${showId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined ${room}`);
    });

    socket.on('leave:show', (showId: number) => {
      const room = `show:${showId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left ${room}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

export function emitSeatUpdate(
  showId: number,
  seats: Array<{ seatId: number; status: string; heldUntil: Date | null }>
) {
  if (!io) return;
  const room = `show:${showId}`;
  io.to(room).emit('seat:update', { showId, seats });
}

export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
