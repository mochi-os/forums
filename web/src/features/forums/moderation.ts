// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Pure helpers for the moderation UI, kept out of the route component so the
// enum→label mapping, the target resolution and the bulk-action runner can be
// unit-tested without rendering the page.

import type { ModerationLogEntry } from '@/api/types/moderation'

// Map a recorded moderation `action` (remove/restore/approve/lock/unlock/pin/
// unpin/restrict/unrestrict/resolve_report — see log_moderation in forums.star)
// to a translated label; an unrecognised value falls back to a humanised form
// of the raw enum rather than rendering it as `snake_case`.
export function moderationActionLabel(
  action: string,
  labels: Record<string, string>
): string {
  return labels[action] ?? action.replace(/_/g, ' ')
}

// Who a log entry was about. The backend already resolves `author_name` from
// the members table (for user restrictions the target IS the subject, so
// author_name carries the target's name). When no name resolved, fall back to
// the raw id — never `target.slice(0, 8)`, which renders a meaningless 8-char
// prefix that reads like a fingerprint but is not one.
export function moderationTargetName(
  entry: Pick<ModerationLogEntry, 'author_name' | 'author' | 'target'>
): string {
  return entry.author_name || entry.author || entry.target
}

// A raw entity id has no client-side name to resolve to, so display it
// middle-truncated (recognisable as a full-id reference) rather than showing
// an arbitrary head-slice. Names pass through untouched.
export function truncateMiddle(value: string, head = 8, tail = 4): string {
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

export interface BulkResult {
  succeeded: number
  failed: number
}

// Run an async action over every item, continuing past a per-item failure so
// one bad row can't strand the rest, and report how many of each there were.
export async function runBulk<T>(
  items: Iterable<T>,
  fn: (item: T) => Promise<unknown>
): Promise<BulkResult> {
  let succeeded = 0
  let failed = 0
  for (const item of items) {
    try {
      await fn(item)
      succeeded++
    } catch {
      failed++
    }
  }
  return { succeeded, failed }
}

// The rate-limit window has a 60s server minimum; clamp before sending so a
// smaller value (typed straight into the field) can neither be saved nor shown.
export const LIMIT_WINDOW_MINIMUM = 60

export function clampLimitWindow(value: number): number {
  if (!Number.isFinite(value)) return LIMIT_WINDOW_MINIMUM
  return Math.max(LIMIT_WINDOW_MINIMUM, value)
}
