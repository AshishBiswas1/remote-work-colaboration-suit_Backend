-- Chat Messages Table
-- Stores all chat messages with user information and timestamps
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT,
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Message Read Receipts Table
-- Tracks which users have read which messages
CREATE TABLE IF NOT EXISTS message_read_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Create indexes for read receipts
CREATE INDEX IF NOT EXISTS idx_read_receipts_message_id ON message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_user_id ON message_read_receipts(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_messages
-- Users can read messages from rooms they have access to
CREATE POLICY "Users can read chat messages" ON chat_messages
    FOR SELECT
    USING (true); -- Adjust based on your session access logic

-- Users can insert their own messages
CREATE POLICY "Users can insert their own messages" ON chat_messages
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own messages
CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can soft delete their own messages
CREATE POLICY "Users can delete their own messages" ON chat_messages
    FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for message_read_receipts
-- Users can read all read receipts
CREATE POLICY "Users can read receipts" ON message_read_receipts
    FOR SELECT
    USING (true);

-- Users can insert their own read receipts
CREATE POLICY "Users can insert their own read receipts" ON message_read_receipts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE
    ON chat_messages FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE chat_messages IS 'Stores real-time chat messages for collaboration sessions';
COMMENT ON TABLE message_read_receipts IS 'Tracks message read status for each user';
COMMENT ON COLUMN chat_messages.room_id IS 'Session ID or room identifier for the chat';
COMMENT ON COLUMN chat_messages.is_deleted IS 'Soft delete flag - true if message was deleted by user';
