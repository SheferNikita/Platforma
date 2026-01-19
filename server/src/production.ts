import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import contentRoutes from './routes/content';
import studentsRoutes from './routes/students';
import paymentsRoutes from './routes/payments';
import productsRoutes from './routes/products';
import metricsRoutes from './routes/metrics';
import emailRoutes from './routes/email';
import publicRoutes from './routes/public';
import uploadsRoutes from './routes/uploads';
import webhooksRoutes from './routes/webhooks';

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/webhooks', webhooksRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const buildPath = path.join(process.cwd(), 'build');
app.use(express.static(buildPath));

app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(buildPath, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running on port ${PORT}`);
});
