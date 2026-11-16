import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import configRoutes from './routes/config.js';
import registrationRoutes from './routes/registration.js';
import clinicFlowRoutes from './routes/clinicFlow.js';
import { requireAuth } from './middleware/auth.js';
import { query, h } from './db/query.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // logo is stored as a data URL

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api/auth', authRoutes);

// Public: login page shows the clinic name and logo before sign-in.
app.get('/api/app-info', h(async (req, res) => {
  const [c] = await query('SELECT TOP 1 ClinicName, AppName, Logo FROM ClinicMaster ORDER BY ClinicId');
  res.json(c || { ClinicName: 'Lakshmi Physio', AppName: 'Lakshmi Physio' });
}));

app.use('/api', requireAuth);
app.use('/api', configRoutes);
app.use('/api', registrationRoutes);
app.use('/api', clinicFlowRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => console.log(`Lakshmi Physio API on :${PORT}`));
