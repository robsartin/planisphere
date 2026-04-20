-- SPDX-License-Identifier: Apache-2.0
-- Add a TTL to magic_links so unused tokens expire (15-minute default
-- enforced server-side; see worker/types.ts MAGIC_LINK_TTL_SECONDS).
-- Existing rows backfill to created_at + 15 minutes; any token older than
-- that is treated as expired immediately, which is the safe default.

ALTER TABLE magic_links ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;

UPDATE magic_links SET expires_at = created_at + (15 * 60 * 1000) WHERE expires_at = 0;

CREATE INDEX idx_magic_links_expires ON magic_links(expires_at);
