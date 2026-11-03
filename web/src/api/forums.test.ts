// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  createAppClient: () => ({ get: vi.fn(), post, delete: vi.fn() }),
}))

import forumsApi from './forums'

// Adding, importing and joining communities wait on the account's server,
// which the server bounds and always answers: the client sets no limit of its
// own, so a slow step is not reported as failed while it finishes.
describe('forumsApi communities', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: {} })
  })

  it("addCommunities waits for the server's answer", async () => {
    await forumsApi.addCommunities('a1')
    expect(post.mock.calls[0][2]).toEqual({ timeout: 0 })
  })

  it("importCommunities waits for the server's answer", async () => {
    await forumsApi.importCommunities('a1')
    expect(post.mock.calls[0][2]).toEqual({ timeout: 0 })
  })

  it("joinCommunity waits for the server's answer", async () => {
    await forumsApi.joinCommunity('!tech@lemmy.example', 'a1')
    expect(post.mock.calls[0][2]).toEqual({ timeout: 0 })
  })
})
