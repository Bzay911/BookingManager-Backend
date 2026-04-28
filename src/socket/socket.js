import { Server } from 'socket.io';

let _io = null;

export const initSocket = (httpServer) => {
  _io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  _io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Frontend calls this immediately after connecting
    // passing their businessId so they join the right room
    socket.on('join:business', (businessId) => {
      socket.join(`business:${businessId}`);
      console.log(`Socket ${socket.id} joined room business:${businessId}`);
    });

    socket.on('leave:business', (businessId) => {
      socket.leave(`business:${businessId}`);
      console.log(`Socket ${socket.id} left room business:${businessId}`);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return _io;
};

export const getIO = () => {
  if (!_io) throw new Error('Socket.io not initialised — call initSocket first');
  return _io;
};