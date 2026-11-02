// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ComponentType, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { useAuthStore } from '@mochi/web'
import { render, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { forumsInfoQueryOptions } from '@/hooks/use-forums-queries'
import { postsKey, useInfinitePosts } from '@/hooks/use-infinite-posts'
import { loadForum, Route } from './index'

const state = vi.hoisted(() => ({
  viewForum: vi.fn(),
  loaderData: undefined as unknown,
  mounts: 0,
}))

vi.mock('@/api/forums', () => ({ default: { viewForum: state.viewForum } }))

// The page itself is the forum page's own concern; here it only has to say
// when it mounts.
vi.mock('@/features/forums/pages', async () => {
  const { useEffect } = await import('react')
  return {
    EntityForumPage: ({ forum }: { forum: { id: string } }) => {
      useEffect(() => {
        state.mounts += 1
      }, [])
      return <div>{forum.id}</div>
    },
  }
})

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: object) => ({
    ...options,
    useLoaderData: () => state.loaderData,
  }),
  useRouter: () => ({ invalidate: vi.fn() }),
  useNavigate: () => vi.fn(),
}))

const ID = '1forumentityidentifierforumentityidentifier123'

function answer(posts: string[], sort?: string) {
  return {
    data: {
      forum: { id: ID, fingerprint: 'abcdefghi', name: 'Forum', sort },
      posts: posts.map((id) => ({ id })),
      can_manage: false,
      can_moderate: false,
      hasMore: false,
      nextCursor: null,
    },
  }
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

beforeEach(() => {
  state.viewForum.mockReset()
  state.viewForum.mockResolvedValue(answer(['p1', 'p2']))
  state.mounts = 0
  useAuthStore.setState({ isAuthenticated: true })
})

describe('forum loader', () => {
  it('asks for the posts as the page will, and holds the answer as its first page', async () => {
    const queries = client()

    const data = await loadForum({
      forum: 'abcdefghi',
      client: queries,
      cause: 'enter',
    })

    expect(state.viewForum).toHaveBeenCalledTimes(1)
    expect(state.viewForum).toHaveBeenCalledWith({
      forum: 'abcdefghi',
      server: undefined,
      limit: 20,
      sort: 'new',
    })
    const held = queries.getQueryData<{ pages: { posts: { id: string }[] }[] }>(
      postsKey({ forum: ID, sort: 'new' })
    )
    expect(held?.pages[0].posts.map((post) => post.id)).toEqual(['p1', 'p2'])
    expect(data.seed?.data).toBe(held)
  })

  it("asks in the forum's own sort, else the reader's default, from the information the layout holds", async () => {
    const queries = client()
    queries.setQueryData(forumsInfoQueryOptions().queryKey, {
      data: {
        entity: false,
        forums: [{ id: ID, fingerprint: 'abcdefghi', sort: 'top' }],
        settings: { sort: 'hot' },
      },
    })

    await loadForum({ forum: 'abcdefghi', client: queries, cause: 'enter' })
    await loadForum({ forum: 'otherforum', client: queries, cause: 'enter' })

    expect(state.viewForum.mock.calls.map(([params]) => params.sort)).toEqual([
      'top',
      'hot',
    ])
  })

  it('asks for the forum alone when the page opens in a sort that may be slow', async () => {
    const queries = client()
    queries.setQueryData(forumsInfoQueryOptions().queryKey, {
      data: { entity: false, forums: [], settings: { sort: 'ai' } },
    })

    const data = await loadForum({
      forum: 'abcdefghi',
      client: queries,
      cause: 'enter',
    })

    expect(state.viewForum).toHaveBeenCalledWith({
      forum: 'abcdefghi',
      server: undefined,
    })
    expect(data.seed).toBeUndefined()
  })

  it('asks only for the forum when the page refreshes itself, and leaves its list alone', async () => {
    const queries = client()
    const opened = await loadForum({
      forum: 'abcdefghi',
      client: queries,
      cause: 'enter',
    })
    state.viewForum.mockResolvedValue(answer(['p0', 'p1', 'p2']))

    const refreshed = await loadForum({
      forum: 'abcdefghi',
      client: queries,
      cause: 'stay',
    })

    expect(state.viewForum).toHaveBeenLastCalledWith({
      forum: 'abcdefghi',
      server: undefined,
    })
    expect(refreshed.seed).toBeUndefined()
    expect(queries.getQueryData(postsKey({ forum: ID, sort: 'new' }))).toBe(
      opened.seed?.data
    )
  })

  it('treats a move from one forum to another as a navigation', async () => {
    const queries = client()
    await loadForum({ forum: 'firstforum', client: queries, cause: 'enter' })

    const moved = await loadForum({
      forum: 'abcdefghi',
      client: queries,
      cause: 'stay',
    })

    expect(state.viewForum).toHaveBeenLastCalledWith(
      expect.objectContaining({ forum: 'abcdefghi', limit: 20, sort: 'new' })
    )
    expect(moved.seed).toBeDefined()
  })
})

describe('opening a forum', () => {
  it('asks for its first page of posts once', async () => {
    const queries = client()
    const data = await loadForum({
      forum: 'abcdefghi',
      client: queries,
      cause: 'enter',
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queries}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useInfinitePosts({
          forum: data.forum!.id,
          sort: 'new',
          server: data.server,
          seed: data.seed,
        }),
      { wrapper }
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(result.current.posts.map((post) => post.id)).toEqual(['p1', 'p2'])
    expect(state.viewForum).toHaveBeenCalledTimes(1)
  })
})

describe('forum page', () => {
  const Page = (Route as unknown as { component: ComponentType }).component
  const show = () => (
    <I18nProvider i18n={i18n}>
      <Page />
    </I18nProvider>
  )

  it('opens a fresh page for each forum, and keeps it while the forum stays', () => {
    i18n.loadAndActivate({ locale: 'en', messages: {} })
    state.loaderData = { forum: { id: 'a' }, server: undefined }
    const { rerender } = render(show())
    expect(state.mounts).toBe(1)

    // The loader refreshing the same forum keeps the page.
    state.loaderData = { forum: { id: 'a', sort: 'hot' }, server: undefined }
    rerender(show())
    expect(state.mounts).toBe(1)

    state.loaderData = { forum: { id: 'b' }, server: undefined }
    rerender(show())
    expect(state.mounts).toBe(2)
  })
})
