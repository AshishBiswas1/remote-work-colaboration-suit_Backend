const { supabase, supabaseAdmin } = require('../util/supabaseClient');
const catchAsync = require('../util/catchAsync');
const { spawn } = require('child_process');
const path = require('path');

// Get all sessions
exports.getAllSessions = catchAsync(async (req, res, next) => {
    const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return res.status(400).json({
            status: 'fail',
            message: error.message
        });
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
        return res.status(404).json({
            status: 'fail',
            message: 'Session not found'
        });
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
    const { session_token, ip_address, user_agent, expires_at } = req.body;

    // Validate required fields
    if (!session_token || !expires_at) {
        return res.status(400).json({
            status: 'fail',
            message: 'Please provide session_token and expires_at'
        });
    }

    const { data: session, error } = await supabase
        .from('sessions')
        .insert([{
            session_token,
            ip_address,
            user_agent,
            expires_at,
            is_active: true
        }])
        .select()
        .single();

    if (error) {
        return res.status(400).json({
            status: 'fail',
            message: error.message
        });
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
        return res.status(400).json({
            status: 'fail',
            message: error.message
        });
    }

    if (!session) {
        return res.status(404).json({
            status: 'fail',
            message: 'Session not found'
        });
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
        return res.status(400).json({
            status: 'fail',
            message: error.message
        });
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
        return res.status(400).json({
            status: 'fail',
            message: 'Please provide session_name and creator_id'
        });
    }

    // Generate unique session token
    const session_token = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

    // Create session in database (matching your table structure)
    const { data: session, error } = await supabase
        .from('sessions')
        .insert([{
            session_token,
            ip_address: req.ip || null,
            user_agent: req.get('User-Agent') || null,
            expires_at,
            is_active: true
        }])
        .select()
        .single();

    if (error) {
        return res.status(400).json({
            status: 'fail',
            message: error.message
        });
    }

    console.log(`🎯 Collaborative chat session created:`);
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Session Name: ${session_name}`);
    console.log(`   Creator: ${creator_id}`);
    console.log(`   Token: ${session_token}`);

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

        console.log(`🚀 Chat server started for session ${session.id}`);

        // Handle chat process events
        chatProcess.on('error', (error) => {
            console.error('Chat process error:', error);
        });

        chatProcess.on('exit', (code) => {
            console.log(`Chat process exited with code ${code}`);
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
                session_name,
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
