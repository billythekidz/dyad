-- Neural Memory Foundation Schema
-- Phase 1: Add columns and tables for neural memory architecture
-- This migration is ADDITIVE and BACKWARD COMPATIBLE - no breaking changes

-- ============================================================
-- 1. CREATE new tables (create before altering to avoid FK errors)
-- ============================================================

-- Conversation summaries table
CREATE TABLE `conversation_summaries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `chat_id` integer NOT NULL,
  `start_message_id` integer NOT NULL,
  `end_message_id` integer NOT NULL,
  `summary` text NOT NULL,
  `estimated_tokens` integer NOT NULL,
  `nmem_synced` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);-->statement-breakpoint

-- Chat memory configuration table
CREATE TABLE `chat_memory_config` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `chat_id` integer NOT NULL,
  `active_window_size` integer DEFAULT 30 NOT NULL,
  `active_window_token_budget` integer DEFAULT 40000 NOT NULL,
  `last_summarized_message_id` integer,
  `total_messages` integer DEFAULT 0 NOT NULL,
  `nmem_project_scope` text,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);-->statement-breakpoint

CREATE UNIQUE INDEX `chat_memory_config_chat_id_unique` ON `chat_memory_config` (`chat_id`);-->statement-breakpoint

-- Background sync queue table
CREATE TABLE `nmem_sync_queue` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `chat_id` integer NOT NULL,
  `message_id` integer NOT NULL,
  `operation` text NOT NULL CHECK(operation IN ('save_message', 'save_summary')),
  `payload` text NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `last_attempt` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);-->statement-breakpoint

-- ============================================================
-- 2. ALTER messages table - Add neural memory tracking columns
-- ============================================================

-- Memory tier: active (sent to Claude) | session (queryable) | archived (nmem only)
ALTER TABLE `messages` ADD `memory_tier` text DEFAULT 'active' NOT NULL CHECK(memory_tier IN ('active', 'session', 'archived'));-->statement-breakpoint

-- Track nmem sync status
ALTER TABLE `messages` ADD `nmem_synced` integer DEFAULT 0 NOT NULL;-->statement-breakpoint
ALTER TABLE `messages` ADD `nmem_synced_at` integer;-->statement-breakpoint

-- Cached token estimation (performance optimization)
ALTER TABLE `messages` ADD `estimated_tokens` integer;-->statement-breakpoint

-- Reference to conversation summary (if this message was summarized)
ALTER TABLE `messages` ADD `summary_id` integer REFERENCES conversation_summaries(id);-->statement-breakpoint

-- ============================================================
-- 3. CREATE indexes for performance
-- ============================================================

-- Fast retrieval of active window messages
CREATE INDEX `idx_messages_memory_tier` ON `messages`(`chat_id`, `memory_tier`, `created_at` DESC);-->statement-breakpoint

-- Find unsynced messages for background job
CREATE INDEX `idx_messages_nmem_synced` ON `messages`(`nmem_synced`) WHERE nmem_synced = 0;-->statement-breakpoint

-- Fast summary lookup by message range
CREATE INDEX `idx_summaries_chat` ON `conversation_summaries`(`chat_id`, `start_message_id`, `end_message_id`);-->statement-breakpoint

-- Fast sync queue retrieval for background processing
CREATE INDEX `idx_sync_queue_chat` ON `nmem_sync_queue`(`chat_id`, `created_at`);-->statement-breakpoint

-- Find failed sync operations for retry
CREATE INDEX `idx_sync_queue_attempts` ON `nmem_sync_queue`(`attempts`) WHERE attempts < 3;
