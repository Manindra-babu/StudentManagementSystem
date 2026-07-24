import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import prisma from './db';

// Load Env variables
dotenv.config();

// Routes Import
import authRoutes from './routes/auth';
import attendanceRoutes from './routes/attendance';
import adminRoutes from './routes/admin';
import lecturerRoutes from './routes/lecturer';
import studentRoutes from './routes/student';
import chatRoutes from './routes/chat';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 5000;

// Setup Middleware
app.use(cors());
app.use(express.json());

// Set Socket.io instance globally on Express app context
app.set('io', io);

// Mount API Router Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lecturer', lecturerRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/chat', chatRoutes);

// Health Check Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date(), uptime: process.uptime() });
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Serve Frontend Static Files in Production / Single-Port Deployments
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const altFrontendDistPath = path.resolve(__dirname, '../frontend/dist');
const finalDistPath = fs.existsSync(frontendDistPath) ? frontendDistPath : (fs.existsSync(altFrontendDistPath) ? altFrontendDistPath : null);

if (finalDistPath) {
  console.log(`Serving static frontend from: ${finalDistPath}`);
  app.use(express.static(finalDistPath));
  
  // SPA Fallback for client-side React routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(finalDistPath, 'index.html'));
    }
  });
}

// Socket.io Handlers for Real-time Classroom Portals
io.on('connection', (socket) => {
  console.log('Socket client connected:', socket.id);

  // Instructor joins session room to listen for check-ins
  socket.on('joinSession', (sessionId) => {
    socket.join(`session_${sessionId}`);
    console.log(`Socket ${socket.id} joined room session_${sessionId}`);
  });

  socket.on('leaveSession', (sessionId) => {
    socket.leave(`session_${sessionId}`);
    console.log(`Socket ${socket.id} left room session_${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket client disconnected:', socket.id);
  });
});

// Check DB Connection and start server
async function startServer() {
  try {
    await prisma.$connect();
    console.log('Database connection verified successfully via Prisma.');

    httpServer.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(` Academix SMS Web Application Running Successfully`);
      console.log(` Listening on PORT: ${PORT}`);
      console.log(` Local URL: http://localhost:${PORT}`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    process.exit(1);
  }
}

startServer();
