-- SPDX-License-Identifier: Apache-2.0
-- Phase 2 milestone 2D: per-user rich-text notebooks.
-- Document shape is tiptap JSON (ADR 013), stored as a TEXT column.

CREATE TABLE notebooks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- List view is sorted by most-recently-updated, scoped to a user.
CREATE INDEX idx_notebooks_user_updated ON notebooks(user_id, updated_at DESC);
