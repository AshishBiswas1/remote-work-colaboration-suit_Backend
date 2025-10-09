const { supabase, supabaseAdmin } = require('../util/supabaseClient');
const catchAsync = require('../util/catchAsync');
const AppError = require('../util/appError');

// Get all users
exports.getAllUsers = catchAsync(async (req, res, next) => {
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return next(new AppError(error.message, 400));
    }

    res.status(200).json({
        status: 'success',
        results: users.length,
        data: {
            users
        }
    });
});

// Get single user by ID
exports.getUser = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !user) {
        return res.status(404).json({
            status: 'fail',
            message: 'User not found'
        });
    }

    res.status(200).json({
        status: 'success',
        data: {
            user
        }
    });
});

// Create new user
exports.createUser = catchAsync(async (req, res, next) => {
    const { id, full_name, avatar_url, role } = req.body;

    // Validate required fields
    if (!id || !full_name) {
        return res.status(400).json({
            status: 'fail',
            message: 'Please provide user ID and full name'
        });
    }

    const { data: user, error } = await supabase
        .from('users')
        .insert([{
            id,
            full_name,
            avatar_url,
            role: role || 'user'
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
        message: 'User created successfully',
        data: {
            user
        }
    });
});

// Update user by ID
exports.updateUser = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error || !user) {
        return res.status(404).json({
            status: 'fail',
            message: 'User not found or update failed'
        });
    }

    res.status(200).json({
        status: 'success',
        message: 'User updated successfully',
        data: {
            user
        }
    });
});

// Delete user by ID
exports.deleteUser = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('users')
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
        message: 'User deleted successfully',
        data: null
    });
});
