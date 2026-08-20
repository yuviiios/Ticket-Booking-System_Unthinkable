import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import venueRoutes from './routes/venues.js';
import showRoutes from './routes/shows.js';

dotenv.config();

const app = express();

app.use(cors({ origin: env.CLIENT_URL }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/shows', showRoutes);

app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});
