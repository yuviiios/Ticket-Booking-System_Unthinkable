import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import venueRoutes from './routes/venues.js';
import showRoutes from './routes/shows.js';
import holdRoutes from './routes/holds.js';
import { initSocketServer } from './realtime/socket.js';
import { startSweeper } from './jobs/sweeper.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: env.CLIENT_URL }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/holds', holdRoutes);

// Initialize Socket.IO
initSocketServer(httpServer);

// Start sweeper
startSweeper();

httpServer.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});
