/**
 * Collaborative Document Editor Integration
 * 
 * This module provides the backend integration for collaborative document editing
 * using Y.js, WebRTC, and your existing session management system.
 */

const { v4: uuidv4 } = require('uuid');
const AppError = require('../util/appError');
const catchAsync = require('../util/catchAsync');
const { supabaseAdmin } = require('../util/supabaseClient');

/**
 * Document collaboration controller
 * Handles document sessions, user permissions, and document persistence
 */
class DocumentCollaborationController {
  constructor() {
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
      session_id: sessionId,
      document_id: documentId,
      document_name,
      document_type,
      creator_id: userId,
      max_editors: max_editors || 'unlimited',
      is_public,
      created_at: new Date().toISOString(),
      participants: [userId],
      websocket_room: documentId,
      status: 'active'
    };

    // Insert into Supabase
    const { data, error } = await supabaseAdmin
      .from('document_sessions')
      .insert(sessionData);

    if (error) {
      console.error('Error creating session:', error);
      return next(new AppError('Failed to create document session', 500));
    }

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

    // Get session from Supabase
    const { data: session, error } = await supabaseAdmin
      .from('document_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error || !session) {
      return next(new AppError(`Session with ID ${sessionId} not found`, 404));
    }

    // Check participant limits
    if (session.max_editors !== 'unlimited' && 
        session.participants.length >= parseInt(session.max_editors)) {
      return next(new AppError('Session is full. Maximum participants reached.', 403));
    }

    // Check if already a participant
    if (session.participants.includes(userId)) {
      return res.status(200).json({
        status: 'success',
        message: 'Already joined',
        data: {
          sessionId: session.session_id,
          documentId: session.document_id,
          document_name: session.document_name,
          websocket_url: `${this.WS_BASE}/yjs-ws?room=${session.document_id}`,
          participants_count: session.participants.length
        }
      });
    }

    // Add user to session
    session.participants.push(userId);

    // Update in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('document_sessions')
      .update({ participants: session.participants })
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return next(new AppError('Failed to join session', 500));
    }

    res.status(200).json({
      status: 'success',
      data: {
        sessionId: session.session_id,
        documentId: session.document_id,
        document_name: session.document_name,
        document_type: session.document_type,
        websocket_url: `${this.WS_BASE}/yjs-ws?room=${session.document_id}`,
        participants_count: session.participants.length,
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

    const { data: session, error } = await supabaseAdmin
      .from('document_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error || !session) {
      return next(new AppError(`Session with ID ${sessionId} not found`, 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        sessionId: session.session_id,
        documentId: session.document_id,
        document_name: session.document_name,
        document_type: session.document_type,
        creator_id: session.creator_id,
        max_editors: session.max_editors,
        is_public: session.is_public,
        created_at: session.created_at,
        participants_count: session.participants.length,
        websocket_url: `${this.WS_BASE}/yjs-ws?room=${session.document_id}`,
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

    const { data: session, error } = await supabaseAdmin
      .from('document_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error || !session) {
      return next(new AppError(`Session with ID ${sessionId} not found`, 404));
    }

    // Remove user from session
    session.participants = session.participants.filter(id => id !== userId);

    // Update in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('document_sessions')
      .update({ participants: session.participants })
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return next(new AppError('Failed to leave session', 500));
    }

    res.status(200).json({
      status: 'success',
      message: 'Left document session successfully',
      data: {
        sessionId,
        remaining_participants: session.participants.length
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

    const { data: sessions, error } = await supabaseAdmin
      .from('document_sessions')
      .select('*')
      .contains('participants', [userId])
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching user sessions:', error);
      return next(new AppError('Failed to fetch user sessions', 500));
    }

    const formattedSessions = sessions.map(session => ({
      sessionId: session.session_id,
      documentId: session.document_id,
      document_name: session.document_name,
      document_type: session.document_type,
      created_at: session.created_at,
      participants_count: session.participants.length,
      is_creator: session.creator_id === userId,
      websocket_url: `${this.WS_BASE}/yjs-ws?room=${session.document_id}`
    }));

    res.status(200).json({
      status: 'success',
      data: {
        sessions: formattedSessions,
        total_count: formattedSessions.length
      }
    });
  });

  /**
   * Get all active document sessions (admin/public)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAllDocumentSessions = catchAsync(async (req, res, next) => {
    const { data: sessions, error } = await supabaseAdmin
      .from('document_sessions')
      .select('*')
      .eq('status', 'active')
      .eq('is_public', true);

    if (error) {
      console.error('Error fetching public sessions:', error);
      return next(new AppError('Failed to fetch public sessions', 500));
    }

    const formattedSessions = sessions.map(session => ({
      sessionId: session.session_id,
      documentId: session.document_id,
      document_name: session.document_name,
      document_type: session.document_type,
      created_at: session.created_at,
      participants_count: session.participants.length,
      max_editors: session.max_editors
    }));

    res.status(200).json({
      status: 'success',
      data: {
        sessions: formattedSessions,
        total_count: formattedSessions.length
      }
    });
  });

  /**
   * Get collaboration statistics
   */
  getStats = catchAsync(async () => {
    const { data: sessions, error } = await supabaseAdmin
      .from('document_sessions')
      .select('*');

    if (error) {
      console.error('Error fetching stats:', error);
      return { active_sessions: 0, active_documents: 0, total_users: 0, sessions_by_type: {} };
    }

    const activeSessions = sessions.filter(s => s.status === 'active');
    const typeCount = {};
    activeSessions.forEach(session => {
      const type = session.document_type;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    const allUsers = new Set();
    sessions.forEach(session => {
      session.participants.forEach(user => allUsers.add(user));
    });

    return {
      active_sessions: activeSessions.length,
      active_documents: activeSessions.length,
      total_users: allUsers.size,
      sessions_by_type: typeCount
    };
  });
}

module.exports = DocumentCollaborationController;
