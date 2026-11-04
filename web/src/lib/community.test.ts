// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import { communityHandle, communityServer, forumServer } from './community'

// Two communities can share a title, so their server goes beside it.
describe('community naming', () => {
  it("gives a community's server from its handle, else its address", () => {
    expect(communityServer('test@lemmy.ml')).toBe('lemmy.ml')
    expect(communityServer(undefined, 'https://sh.itjust.works/c/test')).toBe(
      'sh.itjust.works'
    )
    expect(communityServer(undefined, '1Vg5EKW2KiMjy9xkUVmPAf2GCJcm')).toBe(
      undefined
    )
    expect(communityHandle('test@lemmy.ml')).toBe('!test@lemmy.ml')
    expect(communityHandle('')).toBe(undefined)
  })

  it('shows a server beside a community, never beside a forum of ours', () => {
    expect(
      forumServer({ id: 'https://lemmy.ml/c/test', handle: 'test@lemmy.ml' })
    ).toBe('lemmy.ml')
    expect(forumServer({ id: 'https://sh.itjust.works/c/test' })).toBe(
      'sh.itjust.works'
    )
    expect(
      forumServer({ id: '1Vg5EKW2KiMjy9xkUVmPAf2GCJcm', handle: '' })
    ).toBe(undefined)
    // Published as a group, ours has an address, but is still named by its id.
    expect(
      forumServer({
        id: '1Vg5EKW2KiMjy9xkUVmPAf2GCJcm',
        address: 'https://here.example/~f1',
      } as { id: string; handle?: string })
    ).toBe(undefined)
  })
})
