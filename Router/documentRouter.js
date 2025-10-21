const express = require('express');
const DocumentCollaborationController = require('../controller/documentCollaboration');
const { protect, restrictTo } = require('../controller/authController');

const router = express.Router();

// Create single instance of the controller to maintain state
const docController = new DocumentCollaborationController();

/**
 * Document Collaboration Routes
 * 
 * These routes handle collaborative document editing sessions
 * integrated with Y.js WebRTC signaling server
 */

// Test route to verify document API is working
router.get('/test', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Document API is working',
        timestamp: new Date().toISOString()
    });
});

// Protect all routes - require authentication
// router.use(protect);

/**
 * POST /create - Create new collaborative document session
 * Body: { document_name, document_type?, max_editors?, is_public? }
 */
router.post('/create', (req, res, next) => {
    docController.createDocumentSession(req, res, next);
});

/**
 * POST /join/:sessionId - Join existing document session
 * Params: { sessionId }
 */
router.post('/join/:sessionId', (req, res, next) => {
    docController.joinDocumentSession(req, res, next);
});

/**
 * GET /:sessionId - Get document session details
 * Params: { sessionId }
 */
router.get('/:sessionId', (req, res, next) => {
    docController.getDocumentSession(req, res, next);
});

/**
 * DELETE /:sessionId/leave - Leave document session
 * Params: { sessionId }
 */
router.delete('/:sessionId/leave', (req, res, next) => {
    docController.leaveDocumentSession(req, res, next);
});

/**
 * GET /user/sessions - Get user's active document sessions
 */
router.get('/user/sessions', (req, res, next) => {
    docController.getUserDocumentSessions(req, res, next);
});

/**
 * GET /public/sessions - Get public document sessions
 */
router.get('/public/sessions', (req, res, next) => {
    docController.getAllDocumentSessions(req, res, next);
});

/**
 * GET /admin/stats - Get collaboration statistics (admin only)
 */
router.get('/admin/stats', restrictTo('admin'), async (req, res) => {
    try {
        const stats = await docController.getStats();
        res.status(200).json({
            status: 'success',
            data: {
                collaboration_stats: stats,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Error getting collaboration stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get collaboration statistics'
        });
    }
});

module.exports = { router, docController };