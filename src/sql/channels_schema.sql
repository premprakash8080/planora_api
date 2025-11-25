-- ==========================================================
-- CHANNELS (Slack-style chat channels)
-- ==========================================================
CREATE TABLE channels (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('direct', 'group', 'public', 'private') NOT NULL DEFAULT 'group',
    created_by BIGINT NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    firestore_path VARCHAR(500), -- Firestore collection path for this channel
    last_message_at TIMESTAMP NULL, -- Last message timestamp for sorting
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes
CREATE INDEX idx_channels_type ON channels(type);
CREATE INDEX idx_channels_created_by ON channels(created_by);
CREATE INDEX idx_channels_is_archived ON channels(is_archived);
CREATE INDEX idx_channels_last_message_at ON channels(last_message_at);
CREATE INDEX idx_channels_created_at ON channels(created_at);

-- ==========================================================
-- CHANNEL MEMBERS (Many-to-Many relationship)
-- ==========================================================
CREATE TABLE channel_members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    channel_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role ENUM('owner', 'admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP NULL, -- Last time user read messages in this channel
    unread_count INT DEFAULT 0, -- Cached unread message count
    is_muted BOOLEAN DEFAULT FALSE, -- User muted notifications for this channel
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (channel_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes
CREATE INDEX idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX idx_channel_members_last_read_at ON channel_members(last_read_at);
CREATE INDEX idx_channel_members_unread_count ON channel_members(unread_count);

-- ==========================================================
-- CHANNEL MESSAGE READS (Track read receipts)
-- ==========================================================
CREATE TABLE channel_message_reads (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    channel_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    firestore_message_id VARCHAR(255) NOT NULL, -- Firestore message document ID
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (channel_id, user_id, firestore_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes
CREATE INDEX idx_channel_message_reads_channel_id ON channel_message_reads(channel_id);
CREATE INDEX idx_channel_message_reads_user_id ON channel_message_reads(user_id);
CREATE INDEX idx_channel_message_reads_firestore_message_id ON channel_message_reads(firestore_message_id);
CREATE INDEX idx_channel_message_reads_read_at ON channel_message_reads(read_at);

