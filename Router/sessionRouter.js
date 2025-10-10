const express = require('express');
const { 
    getAllSessions, 
    getSession, 
    createSession, 
    updateSession, 
    deleteSession,
    userCreateSession,
    generateSessionLink,
    joinSessionByLink
} = require('../controller/sessionController');

const {protect, restrictTo} = require('./../controller/authController');

const router = express.Router();

// Protected routes
router.use(protect);

// User chat session route (for members to create chat sessions)
router.post('/chat/create', restrictTo('admin', 'user'), userCreateSession);

// Shareable session link routes (for users to share and join sessions)
router.post('/:sessionId/generate-link', restrictTo('admin', 'user'), generateSessionLink);
router.get('/:sessionId/join', joinSessionByLink);

// Session CRUD routes (Admin only)
router.use(restrictTo('admin'));
router.route('/')
    .get(getAllSessions)
    .post(createSession);

router.route('/:id')
    .get(getSession)
    .patch(updateSession)
    .delete(deleteSession);

module.exports = router;
