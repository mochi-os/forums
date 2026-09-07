// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { describe, expect, it, vi } from 'vitest'
import {
  clampLimitWindow,
  moderationActionLabel,
  moderationTargetName,
  runBulk,
  truncateMiddle,
} from './moderation'

describe('moderationActionLabel', () => {
  const labels = { remove: 'Removed', restrict: 'Restricted' }

  it('maps a known action to its label', () => {
    expect(moderationActionLabel('remove', labels)).toBe('Removed')
    expect(moderationActionLabel('restrict', labels)).toBe('Restricted')
  })

  it('humanises an unknown action instead of rendering the raw enum', () => {
    // Negative control: the old code interpolated the raw enum, so this would
    // read "resolve_report".
    expect(moderationActionLabel('resolve_report', labels)).toBe('resolve report')
  })
})

describe('moderationTargetName', () => {
  it('prefers the server-resolved name', () => {
    expect(
      moderationTargetName({ author_name: 'Alice', author: 'a-id', target: 't-id' })
    ).toBe('Alice')
  })

  it('falls back to the full id, never a slice(0, 8)', () => {
    const target = '1sfEACmTnQhBVgquGhaCs8Jw4SXKF9XY2apnUwJ63duq2QSxh5'
    // Negative control: the old code rendered target.slice(0, 8) = "1sfEACmT".
    expect(moderationTargetName({ target })).toBe(target)
    expect(moderationTargetName({ target })).not.toBe(target.slice(0, 8))
  })
})

describe('truncateMiddle', () => {
  it('keeps short values whole', () => {
    expect(truncateMiddle('Alice')).toBe('Alice')
  })

  it('middle-ellipsises a long id', () => {
    const id = '1sfEACmTnQhBVgquGhaCs8Jw4SXKF9XY2apnUwJ63duq2QSxh5'
    expect(truncateMiddle(id)).toBe('1sfEACmT…Sxh5')
  })
})

describe('runBulk', () => {
  it('continues past a per-item failure and reports both counts', async () => {
    const seen: number[] = []
    const result = await runBulk([1, 2, 3, 4], async (n) => {
      seen.push(n)
      if (n === 2 || n === 4) throw new Error('boom')
    })
    // Negative control: a plain for-await-of loop would stop at 2, never
    // reaching 3 or 4.
    expect(seen).toEqual([1, 2, 3, 4])
    expect(result).toEqual({ succeeded: 2, failed: 2 })
  })

  it('reports all succeeded when nothing throws', async () => {
    const fn = vi.fn(async () => {})
    const result = await runBulk(['a', 'b'], fn)
    expect(result).toEqual({ succeeded: 2, failed: 0 })
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('clampLimitWindow', () => {
  it('raises values below the 60s minimum', () => {
    // Negative control: the raw value 30 would have been saved before the clamp.
    expect(clampLimitWindow(30)).toBe(60)
    expect(clampLimitWindow(0)).toBe(60)
  })

  it('leaves values at or above the minimum alone', () => {
    expect(clampLimitWindow(60)).toBe(60)
    expect(clampLimitWindow(3600)).toBe(3600)
  })

  it('treats NaN as the minimum', () => {
    expect(clampLimitWindow(NaN)).toBe(60)
  })
})
