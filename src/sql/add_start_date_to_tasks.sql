-- Migration: Add start_date column to tasks table
-- Run this script to add the start_date column for timeline support

ALTER TABLE tasks
ADD COLUMN start_date DATE NULL AFTER completed;

-- Optional: backfill start_date with due_date when available
UPDATE tasks
SET start_date = COALESCE(start_date, due_date)
WHERE start_date IS NULL;


