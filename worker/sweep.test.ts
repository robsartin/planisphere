/* SPDX-License-Identifier: Apache-2.0 */
import { beforeEach, describe, expect, it } from "vitest";
import worker from "./index";
import { resetDb, testEnv } from "./test-helpers";
import { deleteExpiredMagicLinks, deleteExpiredSessions } from "./db";

/**
 * Tests for the background cleanup of expired magic_links and sessions.
 * Rows that hit their expires_at are already rejected at read time; these
 * sweeps delete them so D1 doesn't grow unboundedly.
 */

const MINUTE_MS = 60_000;

beforeEach(async () => {
  await resetDb();
});

async function insertMagicLinkRow(
  token: string,
  email: string,
  createdAt: number,
  expiresAt: number,
  usedAt: number | null = null,
): Promise<void> {
  await testEnv.DB.prepare(
    "INSERT INTO magic_links (token, email, created_at, used_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(token, email, createdAt, usedAt, expiresAt)
    .run();
}

async function insertSessionRow(
  id: string,
  userId: number,
  createdAt: number,
  expiresAt: number,
): Promise<void> {
  await testEnv.DB.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, userId, createdAt, expiresAt)
    .run();
}

async function countRows(table: "magic_links" | "sessions"): Promise<number> {
  const row = await testEnv.DB.prepare(`SELECT COUNT(*) as n FROM ${table}`).first<{
    n: number;
  }>();
  return row?.n ?? 0;
}

describe("deleteExpiredMagicLinks", () => {
  it("removes rows whose expires_at is in the past", async () => {
    const now = Date.now();
    await insertMagicLinkRow("expired-1", "a@example.com", now - 30 * MINUTE_MS, now - MINUTE_MS);
    await insertMagicLinkRow("expired-2", "b@example.com", now - 20 * MINUTE_MS, now - MINUTE_MS);
    await insertMagicLinkRow("fresh", "c@example.com", now, now + 15 * MINUTE_MS);

    const deleted = await deleteExpiredMagicLinks(testEnv.DB);
    expect(deleted).toBe(2);
    expect(await countRows("magic_links")).toBe(1);
  });

  it("also removes used rows even if their expires_at is still in the future", async () => {
    // A used token is never reusable — no reason to keep it.
    const now = Date.now();
    await insertMagicLinkRow(
      "used",
      "a@example.com",
      now - 5 * MINUTE_MS,
      now + 30 * MINUTE_MS,
      now - MINUTE_MS,
    );
    await insertMagicLinkRow("fresh", "b@example.com", now, now + 30 * MINUTE_MS);

    const deleted = await deleteExpiredMagicLinks(testEnv.DB);
    expect(deleted).toBe(1);
    expect(await countRows("magic_links")).toBe(1);
  });

  it("is a no-op when nothing is expired", async () => {
    const now = Date.now();
    await insertMagicLinkRow("fresh", "a@example.com", now, now + 30 * MINUTE_MS);
    const deleted = await deleteExpiredMagicLinks(testEnv.DB);
    expect(deleted).toBe(0);
    expect(await countRows("magic_links")).toBe(1);
  });
});

describe("deleteExpiredSessions", () => {
  it("removes sessions whose expires_at is in the past", async () => {
    const now = Date.now();
    // Need a user row for the FK.
    await testEnv.DB.prepare(
      "INSERT INTO users (email, tier, created_at) VALUES ('u@example.com', 'free', ?)",
    )
      .bind(now)
      .run();
    const user = await testEnv.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind("u@example.com")
      .first<{ id: number }>();
    const uid = user!.id;

    await insertSessionRow("old-1", uid, now - 31 * 24 * 60 * MINUTE_MS, now - MINUTE_MS);
    await insertSessionRow("old-2", uid, now - 60 * 24 * 60 * MINUTE_MS, now - 5 * MINUTE_MS);
    await insertSessionRow("live", uid, now, now + 30 * 24 * 60 * MINUTE_MS);

    const deleted = await deleteExpiredSessions(testEnv.DB);
    expect(deleted).toBe(2);
    expect(await countRows("sessions")).toBe(1);
  });

  it("is a no-op when nothing is expired", async () => {
    const now = Date.now();
    await testEnv.DB.prepare(
      "INSERT INTO users (email, tier, created_at) VALUES ('v@example.com', 'free', ?)",
    )
      .bind(now)
      .run();
    const user = await testEnv.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind("v@example.com")
      .first<{ id: number }>();
    await insertSessionRow("live", user!.id, now, now + MINUTE_MS);
    const deleted = await deleteExpiredSessions(testEnv.DB);
    expect(deleted).toBe(0);
    expect(await countRows("sessions")).toBe(1);
  });
});

describe("worker.scheduled handler", () => {
  it("runs both sweeps when invoked", async () => {
    const now = Date.now();
    await insertMagicLinkRow("expired", "a@example.com", now - MINUTE_MS, now - 1);
    await testEnv.DB.prepare(
      "INSERT INTO users (email, tier, created_at) VALUES ('w@example.com', 'free', ?)",
    )
      .bind(now)
      .run();
    const user = await testEnv.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind("w@example.com")
      .first<{ id: number }>();
    await insertSessionRow("expired-s", user!.id, now - MINUTE_MS, now - 1);

    if (!worker.scheduled) throw new Error("worker has no scheduled handler");
    const event = { cron: "0 * * * *", scheduledTime: now, type: "scheduled" };
    await worker.scheduled(
      event as unknown as ScheduledController,
      testEnv,
      {} as unknown as ExecutionContext,
    );

    expect(await countRows("magic_links")).toBe(0);
    expect(await countRows("sessions")).toBe(0);
  });
});
