require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

require('./firebase');
const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shop');
const ekeyRoutes = require('./routes/ekey');
const toolsRoutes = require('./routes/tools');
const topupRoutes = require('./routes/topup');
const adminRoutes = require('./routes/admin');
const { requireAdminSecret } = require('./middleware/auth');
const { generalLimiter, authLimiter, moneyLimiter, adminLimiter } = require('./middleware/rateLimits');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
const origins = String(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, cb) {
    if (!origin || origins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS denied'));
  },
  credentials: false,
}));
app.use(express.json({ limit: '200kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(generalLimiter);

app.get('/health', (req, res) => res.json({ ok: true, service: 'random19k-api' }));
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', shopRoutes);
app.use('/api/ekey', moneyLimiter, ekeyRoutes);
app.use('/api/tools', moneyLimiter, toolsRoutes);
app.use('/api/topup', moneyLimiter, topupRoutes);
app.use('/api/admin', adminLimiter, requireAdminSecret, adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
