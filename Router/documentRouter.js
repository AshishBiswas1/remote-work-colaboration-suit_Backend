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
router.post('/create', (req, res) => {
    docController.createDocumentSession(req, res);
});

/**
 * POST /join/:sessionId - Join existing document session
 * Params: { sessionId }
 */
router.post('/join/:sessionId', (req, res) => {
    docController.joinDocumentSession(req, res);
});

/**
 * GET /:sessionId - Get document session details
 * Params: { sessionId }
 */
router.get('/:sessionId', (req, res) => {
    docController.getDocumentSession(req, res);
});

/**
 * DELETE /:sessionId/leave - Leave document session
 * Params: { sessionId }
 */
router.delete('/:sessionId/leave', (req, res) => {
    docController.leaveDocumentSession(req, res);
});

/**
 * GET /user/sessions - Get user's active document sessions
 */
router.get('/user/sessions', (req, res) => {
    docController.getUserDocumentSessions(req, res);
});

/**
 * GET /public/sessions - Get public document sessions
 */
router.get('/public/sessions', (req, res) => {
    docController.getAllDocumentSessions(req, res);
});

/**
 * GET /admin/stats - Get collaboration statistics (admin only)
 */
router.get('/admin/stats', restrictTo('admin'), (req, res) => {
    try {
        const stats = docController.getStats();
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