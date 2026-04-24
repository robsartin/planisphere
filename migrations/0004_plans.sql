-- SPDX-License-Identifier: Apache-2.0
-- Phase 2 milestone 2E: Pro-gated curated monthly viewing plans.
-- Read-only from the Worker; content is seeded via scripts/seed-plans.mjs.

CREATE TABLE plans (
  slug          TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  month         TEXT NOT NULL,                    -- 'YYYY-MM'
  hemisphere    TEXT NOT NULL CHECK (hemisphere IN ('n','s','both')),
  summary       TEXT NOT NULL,
  body_md       TEXT NOT NULL,
  objects_json  TEXT NOT NULL,                    -- JSON array of LinkedEntity
  author        TEXT NOT NULL,
  published_at  INTEGER NOT NULL,                 -- epoch ms
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX idx_plans_month ON plans(month);
