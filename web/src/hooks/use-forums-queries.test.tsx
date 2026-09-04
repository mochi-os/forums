// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import forumsApi from '@/api/forums'
import { useForumMembership } from './use-forums-queries'

vi.mock('@/api/forums', () => ({
  default: {
    getForumsInfo: vi.fn(async () => ({
      data: { entity: false, forums: [{ id: 'f1', name: 'Held' }], settings: { sort: 'top' } },
    })),
    listForums: vi.fn(async () => ({ data: { forums: [], posts: [] } })),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useForumMembership', () => {
  it('answers from the information query, never the post listing', async () => {
    const held = renderHook(() => useForumMembership('f1'), { wrapper })
    await waitFor(() => expect(held.result.current.isLoading).toBe(false))
    expect(held.result.current.isSubscribed).toBe(true)
    expect(held.result.current.defaultSort).toBe('top')

    const foreign = renderHook(() => useForumMembership('f2'), { wrapper })
    await waitFor(() => expect(foreign.result.current.isLoading).toBe(false))
    expect(foreign.result.current.isSubscribed).toBe(false)

    expect(forumsApi.getForumsInfo).toHaveBeenCalled()
    expect(forumsApi.listForums).not.toHaveBeenCalled()
  })
})
