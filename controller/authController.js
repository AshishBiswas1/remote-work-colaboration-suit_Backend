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
    res.status(200)
        .cookie('jwt', data.session.access_token, {
            expires: new Date(data.session.expires_at * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        })
        .json({
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
                }
            }
        });
});

// Protect middleware - Check if user is logged in
exports.protect = catchAsync(async (req, res, next) => {
    // 1) Getting token and check if it's there
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return res.status(401).json({
            status: 'fail',
            message: 'You are not logged in! Please login to get access'
        });
    }

    // 2) Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({
            status: 'fail',
            message: 'You are not logged in! Please login to get access'
        });
    }

    // 3) Check if user still exists and is verified
    if (!user.email_confirmed_at) {
        return res.status(401).json({
            status: 'fail',
            message: 'Please verify your email before accessing this resource'
        });
    }

    // 4) Grant access to protected route
    req.user = user;
    next();
});

// Restrict to certain roles
exports.restrictTo = (...roles) => {
    return catchAsync(async (req, res, next) => {
        // Get user's role from custom users table
        const { data: userData, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', req.user.id)
            .single();
        
        // Default to 'user' role if query fails or no role found
        const userRole = (!error && userData && userData.role) ? userData.role : 'user';

        // Check if user's role is in the allowed roles
        if (!roles.includes(userRole)) {
            return res.status(403).json({
                status: 'fail',
                message: 'You don\'t have permission to perform this action'
            });
        }

        next();
    });
};

