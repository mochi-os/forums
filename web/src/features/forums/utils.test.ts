// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

/* eslint-disable lingui/no-unlocalized-strings -- test fixtures, never shown */
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './utils'

describe('sanitizeHtml', () => {
  it('drops class, so remote HTML cannot reach the app\'s own overlay utilities', () => {
    const html = sanitizeHtml('<a href="https://evil.example" class="fixed inset-0 z-50 opacity-0">x</a>')
    expect(html).toContain('href="https://evil.example"')
    expect(html).not.toContain('class=')
  })

  it('drops id, so remote HTML cannot shadow the app\'s own anchors', () => {
    const html = sanitizeHtml('<div id="root">x</div>')
    expect(html).toContain('<div>x</div>')
    expect(html).not.toContain('id=')
  })

  it('keeps the table attributes a post needs', () => {
    const html = sanitizeHtml('<table><tr><td colspan="2">x</td></tr></table>')
    expect(html).toContain('colspan="2"')
  })

  it('forces rel="noopener noreferrer" on target="_blank" anchors, so remote HTML cannot keep opener', () => {
    const html = sanitizeHtml(
      '<a href="https://evil.example" target="_blank" rel="opener">x</a>'
    )
    expect(html).toContain('target="_blank"')
    // The author-supplied rel="opener" (reverse-tabnabbing) is overridden.
    const rel = html.match(/rel="([^"]*)"/)?.[1]
    expect(rel).toBe('noopener noreferrer')
  })

  it('forces referrerpolicy on images, so a posted pixel cannot collect readers', () => {
    const html = sanitizeHtml('<img src="https://attacker.example/pixel.gif" alt="x">')
    expect(html).toContain('referrerpolicy="no-referrer"')
  })

  it('overrides an author-supplied referrerpolicy rather than trusting it', () => {
    const html = sanitizeHtml(
      '<img src="https://attacker.example/pixel.gif" referrerpolicy="unsafe-url">'
    )
    expect(html).toContain('referrerpolicy="no-referrer"')
    expect(html).not.toContain('unsafe-url')
  })

  // Both attribute hooks share one entry point, so each has to come off by
  // identity. A bare removeHook pops a single entry and would leave the other
  // registered, changing what the next call does.
  it('applies both attribute hooks on a second call, so neither leaks or drops', () => {
    sanitizeHtml('<img src="https://attacker.example/one.gif">')
    const html = sanitizeHtml(
      '<a href="https://evil.example" target="_blank">x</a><img src="https://attacker.example/two.gif">'
    )
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('referrerpolicy="no-referrer"')
  })

  it('leaves rel alone on anchors that do not open a new tab', () => {
    const html = sanitizeHtml('<a href="https://example.com" rel="nofollow">x</a>')
    expect(html).toContain('rel="nofollow"')
  })
})
