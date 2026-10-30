import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let io: Server | null = null;

export function initSocketIO(httpServer: HttpServer): Server {
  const allowedOrigins = env.FRONTEND_URL.split(',').map((u) => u.trim());

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, 'Socket.IO client connected');

    // Allow clients to join district alert rooms (e.g. "district:IN-DL-CENTRAL")
    socket.on('join:district', (districtId: string) => {
      socket.join(`district:${districtId}`);
      logger.info({ socketId: socket.id, districtId }, 'Client joined district channel');
    });

    // Authority EOC Operations Channel
    socket.on('join:eoc', (districtId: string) => {
      socket.join(`eoc:${districtId}`);
      logger.info({ socketId: socket.id, districtId }, 'Staff joined EOC real-time room');
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Socket.IO client disconnected');
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO is not initialized yet. Call initSocketIO first.');
  }
  return io;
}
