/**
 * Collaborative Document Editor Integration
 * 
 * This module provides the backend integration for collaborative document editing
 * using Y.js, WebRTC, and your existing session management system.
 */

const { v4: uuidv4 } = require('uuid');
const AppError = require('../util/appError');
const catchAsync = require('../util/catchAsync');

/**
 * Document collaboration controller
 * Handles document sessions, user permissions, and document persistence
 */
class DocumentCollaborationController {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> session data
    this.documentRooms = new Map(); // documentId -> room data
    this.userSessions = new Map(); // userId -> active sessions
    this.WS_BASE = process.env.WS_BASE_URL || `ws://localhost:8000`;
    this.API_BASE = process.env.API_BASE_URL || `http://localhost:8000`;
  }

  /**
   * Create a collaborative document session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createDocumentSession = catchAsync(async (req, res, next) => {
    const { document_name, document_type = 'text', max_editors, is_public = false } = req.body;
    const userId = req.user?.id || 'anonymous'; // Handle non-authenticated users

    if (!document_name) {
      return next(new AppError('Missing required fields: document_name', 400));
    }

    // Generate unique document ID and session
    const documentId = `doc_${Date.now()}_${uuidv4().split('-')[0]}`;
    const sessionId = `session_${Date.now()}_${uuidv4().split('-')[0]}`;
    
    // Create session data
    const sessionData = {
      sessionId,
      documentId,
      document_name,
      document_type,
      creator_id: userId,
      max_editors: max_editors || 'unlimited',
      is_public,
      created_at: new Date().toISOString(),
      participants: new Set([userId]),
      websocket_room: documentId,
      status: 'active'
    };

    // Store session
    this.activeSessions.set(sessionId, sessionData);
    this.documentRooms.set(documentId, sessionData);

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(sessionId);


    res.status(201).json({
      status: 'success',
      data: {
        sessionId,
        documentId,
        document_name,
        document_type,
        max_editors: sessionData.max_editors,
        websocket_url: `${this.WS_BASE}/yjs-ws?room=${documentId}`,
        rest_api_url: `${this.API_BASE}/api/collab/document/${sessionId}`,
        created_at: sessionData.created_at,
        creator_id: userId,
        participants_count: 1
      }
    });
  });

  /**
   * Join an existing document session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  joinDocumentSession = catchAsync(async (req, res, next) => {
    const { sessionId } = req.params;
    const userId = req.user?.id || 'anonymous';

    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return next(new AppError(`Session with ID ${sessionId} not found`, 404));
    }

    // Check participant limits
    if (session.max_editors !== 'unlimited' && 
        session.participants.size >= parseInt(session.max_editors)) {
      return next(new AppError('Session is full. Maximum participants reached.', 403));
    }

    // Check if already a participant
    if (session.participants.has(userId)) {
      return res.status(200).json({
        status: 'success',
        message: 'Already joined',
        data: {
          sessionId: session.sessionId,
          documentId: session.documentId,
          document_name: session.document_name,
          websocket_url: `${this.WS_BASE}/yjs-ws?room=${session.documentId}`,
          participants_count: session.participants.size
        }
      });
    }

    // Add user to session
    session.participants.add(userId);
    
    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(sessionId);


    res.status(200).json({
      status: 'success',
      data: {
        sessionId: session.sessionId,
        documentId: session.documentId,
        document_name: session.document_name,
        document_type: session.document_type,
        websocket_url: `${this.WS_BASE}/yjs-ws?room=${session.documentId}`,
        participants_count: session.participants.size,
        max_editors: session.max_editors
      }
    });
  });

  /**
   * Get document session info
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getDocumentSession = catchAsync(async (req, res, next) => {
    const { sessionId } = req.params;
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return next(new AppError(`Session with ID ${sessionId} not found`, 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        sessionId: session.sessionId,
        documentId: session.documentId,
        document_name: session.document_name,
        document_type: session.document_type,
        creator_id: session.creator_id,
        max_editors: session.max_editors,
        is_public: session.is_public,
        created_at: session.created_at,
        participants_count: session.participants.size,
        websocket_url: `${this.WS_BASE}/yjs-ws?room=${session.documentId}`,
        status: session.status
      }
    });
  });

  /**
   * Leave document session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  leaveDocumentSession = catchAsync(async (req, res, next) => {
    const { sessionId } = req.params;
    const userId = req.user?.id || 'anonymous';

    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return next(new AppError(`Session with ID ${sessionId} not found`, 404));
    }

    // Remove user from session
    session.participants.delete(userId);

    // Remove from user sessions
    if (this.userSessions.has(userId)) {
      this.userSessions.get(userId).delete(sessionId);
    }


    // If no participants left and not the creator, mark as inactive
    if (session.participants.size === 0 && session.creator_id !== userId) {
      session.status = 'inactive';
    }

    res.status(200).json({
      status: 'success',
      message: 'Left document session successfully',
      data: {
        sessionId,
        remaining_participants: session.participants.size
      }
    });
  });

  /**
   * List active document sessions for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getUserDocumentSessions = catchAsync(async (req, res, next) => {
    const userId = req.user?.id || 'anonymous';
    const userSessionIds = this.userSessions.get(userId) || new Set();

    const sessions = Array.from(userSessionIds)
      .map(sessionId => this.activeSessions.get(sessionId))
      .filter(session => session && session.status === 'active')
      .map(session => ({
        sessionId: session.sessionId,
        documentId: session.documentId,
        document_name: session.document_name,
        document_type: session.document_type,
        created_at: session.created_at,
        participants_count: session.participants.size,
        is_creator: session.creator_id === userId,
        websocket_url: `${this.WS_BASE}/yjs-ws?room=${session.documentId}`
      }));

    res.status(200).json({
      status: 'success',
      data: {
        sessions,
        total_count: sessions.length
      }
    });
  });

  /**
   * Get all active document sessions (admin/public)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllDocumentSessions = catchAsync(async (req, res, next) => {
    const sessions = Array.from(this.activeSessions.values())
      .filter(session => session.status === 'active' && session.is_public)
      .map(session => ({
        sessionId: session.sessionId,
        documentId: session.documentId,
        document_name: session.document_name,
        document_type: session.document_type,
        created_at: session.created_at,
        participants_count: session.participants.size,
        max_editors: session.max_editors
      }));

    res.status(200).json({
      status: 'success',
      data: {
        sessions,
        total_count: sessions.length
      }
    });
  });

  /**
   * Get collaboration statistics
   */
  getStats() {
    return {
      active_sessions: this.activeSessions.size,
      active_documents: this.documentRooms.size,
      total_users: this.userSessions.size,
      sessions_by_type: this.getSessionsByType()
    };
  }

  /**
   * Get sessions grouped by document type
   */
  getSessionsByType() {
    const typeCount = {};
    this.activeSessions.forEach(session => {
      const type = session.document_type;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    return typeCount;
  }
}

module.exports = DocumentCollaborationController;
