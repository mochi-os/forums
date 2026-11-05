// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import endpoints from '@/api/endpoints'
import { forumPath, sha256 } from './forum-path'

const hex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

describe('sha256', () => {
  it('matches the standard digests, across a block boundary', () => {
    const encode = (text: string) => new TextEncoder().encode(text)
    expect(hex(sha256(encode('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
    expect(hex(sha256(encode('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expect(
      hex(
        sha256(
          encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')
        )
      )
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })
})

// A community's address cannot go in a URL path; its routes take the
// fingerprint the server derives from it. These are the server's own, read
// from a community forum's row.
describe('forumPath', () => {
  it('names a community by the fingerprint the server gives it', () => {
    expect(forumPath('https://lemmy.ml/c/test')).toBe('mZxJ7b43h')
    expect(forumPath('https://sh.itjust.works/c/test')).toBe('45zHwuPUP')
  })

  it('leaves a Mochi forum id or a fingerprint as it is', () => {
    const entity = '1Vg5EKW2KiMjy9xkUVmPAf2GCJcmX1cYKsfMG9nFbX3Bs8sEkV'
    expect(forumPath(entity)).toBe(entity)
    expect(forumPath('mZxJ7b43h')).toBe('mZxJ7b43h')
  })
})

describe('forum endpoints', () => {
  it("put a community's fingerprint in the path, never its address", () => {
    expect(endpoints.forums.posts('https://lemmy.ml/c/test')).toBe(
      '/mZxJ7b43h/-/posts'
    )
    expect(endpoints.forums.unsubscribe('https://lemmy.ml/c/test')).toBe(
      '/mZxJ7b43h/-/unsubscribe'
    )
  })
})
