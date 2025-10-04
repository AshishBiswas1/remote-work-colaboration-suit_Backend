const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './Config.env' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing required Supabase environment variables. Please check SUPABASE_URL and SUPABASE_ANON_KEY in Config.env');
}

// Create Supabase client for general use (with anon key)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});

// Create admin client for server-side operations (with service key)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

module.exports = {
    supabase,
    supabaseAdmin
};