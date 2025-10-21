const { supabase, supabaseAdmin } = require('../util/supabaseClient');
const catchAsync = require('../util/catchAsync');
const AppError = require('../util/appError');
const { spawn } = require('child_process');
const path = require('path');

// Get all sessions
exports.getAllSessions = catchAsync(async (req, res, next) => {
    const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return next(new AppError(error.message, 400));
    }

    res.status(200).json({
        status: 'success',
        results: sessions.length,
        data: {
            sessions
        }
    });
});

// Get single session by ID
exports.getSession = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        return next(new AppError('Session not found', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            session
        }
    });
});

// Create new session
exports.createSession = catchAsync(async (req, res, next) => {
    const { session_token, ip_address, user_agent, expires_at, session_name } = req.body;

    // Validate required fields
    if (!session_token || !expires_at) {
        return next(new AppError('Please provide session_token and expires_at', 400));
    }

    const { data: session, error } = await supabase
        .from('sessions')
        .insert([{
            user_id: req.user.id, // Must be provided since it's required in schema
            session_token,
            session_name,
            ip_address,
            user_agent,
            expires_at,
            is_active: true
        }])
        .select()
        .single();

    if (error) {
        return next(new AppError(error.message, 400));
    }

    res.status(201).json({
        status: 'success',
        message: 'Session created successfully',
        data: {
            session
        }
    });
});

// Update session by ID
exports.updateSession = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data: session, error } = await supabase
        .from('sessions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return next(new AppError(error.message, 400));
    }

    if (!session) {
        return next(new AppError('Session not found', 404));
    }

    res.status(200).json({
        status: 'success',
        message: 'Session updated successfully',
        data: {
            session
        }
    });
});

// Delete session by ID
exports.deleteSession = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id);

    if (error) {
        return next(new AppError(error.message, 400));
    }

    res.status(204).json({
        status: 'success',
        message: 'Session deleted successfully',
        data: null
    });
});

// Create collaborative chat session for multiple users
exports.userCreateSession = catchAsync(async (req, res, next) => {
    const { session_name, creator_id, max_participants } = req.body;

    // Validate required fields
    if (!session_name || !creator_id) {
        return next(new AppError('Please provide session_name and creator_id', 400));
    }

    // Generate unique session token
    const session_token = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

    // Create session in database (matching your table structure)
    const { data: session, error } = await supabase
        .from('sessions')
        .insert([{
            user_id: req.user.id,
            session_token,
            session_name,
            ip_address: req.ip || null,
            user_agent: req.get('User-Agent') || null,
            expires_at,
            is_active: true
        }])
        .select()
        .single();

    if (error) {
        return next(new AppError(error.message, 400));
    }


    // Start the chat feature server
    try {
        const chatFeaturePath = path.join(__dirname, 'chatFeature.js');
        const chatProcess = spawn('node', [chatFeaturePath], {
            stdio: 'inherit',
            env: { 
                ...process.env, 
                SESSION_ID: session.id,
                SESSION_TOKEN: session_token,
                SESSION_NAME: session_name,
                CREATOR_ID: creator_id,
                MAX_PARTICIPANTS: max_participants || 'unlimited'
            }
        });


        // Handle chat process events
        chatProcess.on('error', (error) => {
            console.error('Chat process error:', error);
        });

        chatProcess.on('exit', (code) => {
        });

    } catch (error) {
        console.error('Failed to start chat feature:', error);
    }

    res.status(201).json({
        status: 'success',
        message: 'Collaborative chat session created successfully',
        data: {
            session: {
                id: session.id,
                session_token: session_token,
                session_name: session_name,
                creator_id,
                max_participants: max_participants || 'unlimited',
                chat_server_port: 8080,
                expires_at,
                ip_address: session.ip_address,
                user_agent: session.user_agent,
                is_active: session.is_active,
                created_at: session.created_at
            }
        }
    });
});

// Generate shareable session link
exports.generateSessionLink = catchAsync(async (req, res, next) => {
    const { sessionId } = req.params;
    const { expiresInHours = 24, maxUses = null } = req.body;

    // Validate session exists
    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (sessionError || !session) {
        return next(new AppError('Session not found', 404));
    }

    // Check if user has permission to generate link (session creator or admin)
    if (session.user_id !== req.user.id) {
        return next(new AppError('You do not have permission to generate a link for this session', 403));
    }

    // Check if session is still active
    if (!session.is_active || new Date(session.expires_at) < new Date()) {
        return next(new AppError('Cannot generate link for expired or inactive session', 400));
    }

    // Generate unique invitation token
    const inviteToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000)).toISOString();

    // Try to update the session with invitation details
    // If columns don't exist, we'll create a simple invitation system
    const { data: invitation, error: inviteError } = await supabase
        .from('sessions')
        .update({
            updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

    if (inviteError) {
        return next(new AppError('Failed to access session', 500));
    }

    // Generate the shareable link (store invitation data in token for now)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const invitationData = {
        sessionId,
        token: inviteToken,
        expiresAt,
        maxUses,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
    };
    
    // Encode invitation data in the token (in production, use JWT or store in Redis/database)
    const encodedData = Buffer.from(JSON.stringify(invitationData)).toString('base64');
    const shareableLink = `${baseUrl}/join-session?invitation=${encodedData}`;


    res.status(200).json({
        status: 'success',
        message: 'Shareable session link generated successfully',
        data: {
            shareableLink,
            inviteToken,
            sessionId,
            expiresAt,
            maxUses: maxUses || 'unlimited',
            currentUses: 0,
            sessionName: session.session_name || 'Collaborative Session',
            createdBy: req.user.id
        }
    });
});

// Join session using shareable link
exports.joinSessionByLink = catchAsync(async (req, res, next) => {
    const { invitation } = req.query;
    const { sessionId } = req.params;

    if (!invitation) {
        return next(new AppError('Invitation data is required', 400));
    }

    // Decode invitation data
    let invitationData;
    try {
        const decodedData = Buffer.from(invitation, 'base64').toString('utf-8');
        invitationData = JSON.parse(decodedData);
    } catch (error) {
        return next(new AppError('Invalid invitation format', 400));
    }

    // Validate invitation data
    if (invitationData.sessionId !== sessionId) {
        return next(new AppError('Invalid session invitation', 400));
    }

    // Check if invitation has expired
    if (new Date(invitationData.expiresAt) < new Date()) {
        return next(new AppError('Invitation link has expired', 400));
    }

    // Validate session exists and is active
    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (sessionError || !session) {
        return next(new AppError('Session not found', 404));
    }

    // Check if session is still active
    if (!session.is_active) {
        return next(new AppError('Session is no longer active', 400));
    }

    // Check if session has expired
    if (new Date(session.expires_at) < new Date()) {
        return next(new AppError('Session has expired', 400));
    }


    res.status(200).json({
        status: 'success',
        message: 'Successfully joined session',
        data: {
            session: {
                id: session.id,
                session_token: session.session_token,
                session_name: session.session_name || 'Collaborative Session',
                creator_id: session.user_id,
                chat_server_port: 8080,
                websocket_url: `ws://localhost:8000/session/${sessionId}`,
                expires_at: session.expires_at,
                is_active: session.is_active,
                joined_at: new Date().toISOString(),
                invitation_used: {
                    token: invitationData.token,
                    created_by: invitationData.createdBy,
                    expires_at: invitationData.expiresAt
                }
            }
        }
    });
});
