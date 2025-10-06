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

const app = express();

// Environment variables
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

app.set('trust proxy', 1);

// CORS configuration
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
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
        message: 'Welcome to Remote Work Collaboration Suite API'
    });
});

// Routes
app.use('/api/collab/user', userRouter);
app.use('/api/collab/session', sessionRouter);

// Handle undefined routes
app.all('*', (req, res, next) => {
    const err = new Error(`Can't find ${req.originalUrl} on this server!`);
    err.status = 'fail';
    err.statusCode = 404;
    
    res.status(404).json({
        status: 'fail',
        message: err.message
    });
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 Error:', err.stack);
    
    const statusCode = err.statusCode || 500;
    const status = err.status || 'error';
    
    res.status(statusCode).json({
        status: status,
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

module.exports = app;
