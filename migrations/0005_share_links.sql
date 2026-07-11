-- SPDX-License-Identifier: Apache-2.0
-- #377 — short-URL redirect service for the current-view URL.
-- Anonymous creation is allowed (rate-limited in the route), so `created_by`
-- is nullable. `target_url` is the fully-qualified planetarium URL to redirect
-- to; validated at write-time to belong to the Worker's own origin so nothing
-- here can be used as an open-redirect.

CREATE TABLE share_links (
  code        TEXT PRIMARY KEY,          -- 6-char base62
  target_url  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,          -- epoch ms
  created_by  INTEGER,                   -- nullable — anonymous callers permitted
  hit_count   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_share_links_created_at ON share_links(created_at);
