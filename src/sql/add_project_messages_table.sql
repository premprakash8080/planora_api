-- Migration: Add project_messages table
-- Date: 2025-01-XX

CREATE TABLE IF NOT EXISTS project_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes for performance
CREATE INDEX idx_project_messages_project_id ON project_messages(project_id);
CREATE INDEX idx_project_messages_author_id ON project_messages(author_id);
CREATE INDEX idx_project_messages_created_at ON project_messages(created_at);
CREATE INDEX idx_project_messages_pinned ON project_messages(pinned);
CREATE INDEX idx_project_messages_project_created ON project_messages(project_id, created_at);

