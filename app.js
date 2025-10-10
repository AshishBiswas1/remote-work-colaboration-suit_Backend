const express = require('express');
const hpp = require('hpp');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: './Config.env' });

// Router
const userRouter = require('./Router/userRouter');
const sessionRouter = require('./Router/sessionRouter');
const { router: documentRouter } = require('./Router/documentRouter');
const chatRouter = require('./Router/chatRouter');

// Error handling
const { globalErrorHandler } = require('./controller/errorController');

const app = express();

// Environment variables
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

app.set('trust proxy', 1);

// CORS configuration
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5173/',
      'http://localhost:3000',
      'http://localhost:3000/',
      FRONTEND_ORIGIN.replace(/\/$/, ''), // Remove trailing slash
      FRONTEND_ORIGIN // Keep original
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  return res.sendStatus(204);
});

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Security middleware
app.use(hpp());
app.use(helmet());
app.use(cookieParser());
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Keep the service alive endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Welcome to Remote Work Collaboration Suite API',
        services: {
            api: 'http://localhost:8000',
            websocket: 'ws://localhost:8000/yjs-ws',
            chat: 'http://localhost:8080 (when session active)'
        }
    });
});

// WebRTC signaling server stats endpoint
app.get('/api/collab/webrtc/stats', (req, res) => {
    // This will be populated when the server starts
    const webrtcServer = req.app.get('webrtcServer');
    
    if (!webrtcServer) {
        return res.status(503).json({
            status: 'error',
            message: 'WebRTC signaling server not available'
        });
    }

    const stats = webrtcServer.getStats();
    
    res.status(200).json({
        status: 'success',
        data: {
            server_status: 'running',
            endpoint: 'ws://localhost:8000/yjs-ws',
            ...stats,
            timestamp: new Date().toISOString()
        }
    });
});

// Routes
app.use('/api/collab/user', userRouter);
app.use('/api/collab/session', sessionRouter);
app.use('/api/collab/document', documentRouter);
app.use('/api/collab/chat', chatRouter);

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;
