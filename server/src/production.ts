import express from 'express';
import compression from 'compression';
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
import notificationsRoutes from './routes/notifications';

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: ['X-New-Token']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const buildPath = path.join(process.cwd(), 'build');

app.use('/assets', express.static(path.join(buildPath, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

app.use(express.static(buildPath, {
  maxAge: 0,
  etag: true,
}));

app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(buildPath, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running on port ${PORT}`);
});
