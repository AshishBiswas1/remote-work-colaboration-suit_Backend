const { supabase, supabaseAdmin } = require('../util/supabaseClient');
const catchAsync = require('../util/catchAsync');

// User Signup Function
exports.signup = catchAsync(async (req, res, next) => {
    const { email, password, passwordConfirm, name } = req.body;

    // Validate required fields
    if (!email || !password || !passwordConfirm || !name) {
        return res.status(400).json({
            status: 'fail',
            message: 'Please provide email, password, password confirmation, and full name'
        });
    }

    // Check if passwords match
    if (password !== passwordConfirm) {
        return res.status(400).json({
            status: 'fail',
            message: 'Password and password confirmation do not match'
        });
    }

    // Sign up user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name
            }
        }
    });

    if (error) {
        return res.status(400).json({
            status: 'fail',
            message: error.message
        });
    }

    // Success response
    res.status(201).json({
        status: 'success',
        message: 'User created successfully. Please check your email for verification.',
        data: {
            user: {
                id: data.user.id,
                email: data.user.email,
                full_name: data.user.user_metadata.full_name
            }
        }
    });
});

// User Login Function
exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
        return res.status(400).json({
            status: 'fail',
            message: 'Please provide email and password'
        });
    }

    // Sign in user with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return res.status(401).json({
            status: 'fail',
            message: error.message
        });
    }

    // Check if user is verified
    if (!data.user.email_confirmed_at) {
        return res.status(401).json({
            status: 'fail',
            message: 'Please verify your email before logging in'
        });
    }

    // Success response
    res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
            user: {
                id: data.user.id,
                email: data.user.email,
                full_name: data.user.user_metadata.full_name,
                email_verified: !!data.user.email_confirmed_at
            },
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
                expires_in: data.session.expires_in
            }
        }
    });
});
