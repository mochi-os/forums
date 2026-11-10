// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '@/api/types/posts'
import {
  postsKey,
  seedPosts,
  useInfinitePosts,
  type PostsSeed,
} from './use-infinite-posts'

const { viewForum } = vi.hoisted(() => ({ viewForum: vi.fn() }))

vi.mock('@/api/forums', () => ({ default: { viewForum } }))

function post(id: string): Post {
  return { id, title: id } as Post
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

interface Props {
  sort: string
  seed?: PostsSeed
}

function mount(queries: QueryClient, initialProps: Props) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>{children}</QueryClientProvider>
  )
  const hook = renderHook(
    (props: Props) => useInfinitePosts({ forum: 'f1', ...props }),
    { wrapper, initialProps }
  )
  const ids = () => hook.result.current.posts.map((item) => item.id)
  return { hook, ids }
}

// Long enough for a mount-time fetch to have been started, were one coming.
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

beforeEach(() => {
  viewForum.mockReset()
  viewForum.mockResolvedValue({
    data: { posts: [post('fresh')], hasMore: false },
  })
})

describe('a first page seeded by the route loader', () => {
  it('is shown without asking for it again', async () => {
    const queries = client()
    const seed = seedPosts(
      queries,
      { forum: 'f1', sort: 'new' },
      { posts: [post('seeded')], hasMore: false },
      Date.now()
    )
    expect(seed).toBeDefined()

    const { ids } = mount(queries, { sort: 'new', seed })
    expect(ids()).toEqual(['seeded'])
    await settle()

    expect(viewForum).not.toHaveBeenCalled()
    expect(ids()).toEqual(['seeded'])
  })

  it('is asked for again on a later mount: a return shows what has changed', async () => {
    const queries = client()
    const seed = seedPosts(
      queries,
      { forum: 'f1', sort: 'new' },
      { posts: [post('seeded')], hasMore: false },
      Date.now()
    )
    const first = mount(queries, { sort: 'new', seed })
    await settle()
    first.hook.unmount()
    expect(viewForum).not.toHaveBeenCalled()

    // The router shows its cached loader data, seed and all, on a return.
    const again = mount(queries, { sort: 'new', seed })
    await waitFor(() => expect(again.ids()).toEqual(['fresh']))
    expect(viewForum).toHaveBeenCalledTimes(1)
  })

  it('does not stand for a list asked for another way', async () => {
    const queries = client()
    const seed = seedPosts(
      queries,
      { forum: 'f1', sort: 'new' },
      { posts: [post('seeded')], hasMore: false },
      Date.now()
    )
    // The list in the order the page asks for is cached from earlier.
    queries.setQueryData(postsKey({ forum: 'f1', sort: 'hot' }), {
      pages: [{ posts: [post('old')], hasMore: false }],
      pageParams: [undefined],
    })

    const { ids } = mount(queries, { sort: 'hot', seed })

    await waitFor(() => expect(ids()).toEqual(['fresh']))
    expect(viewForum).toHaveBeenCalledTimes(1)
    expect(viewForum).toHaveBeenCalledWith(
      expect.objectContaining({ forum: 'f1', sort: 'hot' })
    )
  })

  it('leaves a list holding further pages alone', () => {
    const queries = client()
    const key = postsKey({ forum: 'f1', sort: 'new' })
    const held = {
      pages: [
        { posts: [post('a')], hasMore: true, nextCursor: 5 },
        { posts: [post('b')], hasMore: false },
      ],
      pageParams: [undefined, 5],
    }
    queries.setQueryData(key, held)

    const seed = seedPosts(
      queries,
      { forum: 'f1', sort: 'new' },
      { posts: [post('seeded')], hasMore: false },
      Date.now()
    )

    expect(seed).toBeUndefined()
    expect(queries.getQueryData(key)).toEqual(held)
  })
})

describe('a seed the loader holds', () => {
  it('is not written into a list a page already shows', async () => {
    const queries = client()
    const { ids } = mount(queries, { sort: 'new' })
    await waitFor(() => expect(ids()).toEqual(['fresh']))

    const seed = seedPosts(
      queries,
      { forum: 'f1', sort: 'new' },
      { posts: [post('seeded')], hasMore: false },
      Date.now()
    )

    expect(seed).toBeUndefined()
    expect(ids()).toEqual(['fresh'])
  })

  it('is not written over a list fetched after it was asked for', () => {
    const queries = client()
    const key = postsKey({ forum: 'f1', sort: 'new' })
    const asked = Date.now() - 1000
    const held = {
      pages: [{ posts: [post('newer')], hasMore: false }],
      pageParams: [undefined],
    }
    queries.setQueryData(key, held)

    const seed = seedPosts(
      queries,
      { forum: 'f1', sort: 'new' },
      { posts: [post('seeded')], hasMore: false },
      asked
    )

    expect(seed).toBeUndefined()
    expect(queries.getQueryData(key)).toEqual(held)
  })

  it('dates a seed by when it was asked for, so a later answer can replace it', () => {
    const queries = client()
    const list = { forum: 'f1', sort: 'new' }
    seedPosts(
      queries,
      list,
      { posts: [post('earlier')], hasMore: false },
      Date.now() - 2000
    )

    const later = seedPosts(
      queries,
      list,
      { posts: [post('later')], hasMore: false },
      Date.now() - 1000
    )

    expect(later).toBeDefined()
  })

  it('is asked for again on mount when an event invalidated it since', async () => {
    const queries = client()
    const seed = seedPosts(
      queries,
      { forum: 'f1', sort: 'new' },
      { posts: [post('seeded')], hasMore: false },
      Date.now()
    )
    // A post event lands before the page mounts.
    await queries.invalidateQueries({ queryKey: ['forum-posts'] })

    const { ids } = mount(queries, { sort: 'new', seed })

    await waitFor(() => expect(ids()).toEqual(['fresh']))
    expect(viewForum).toHaveBeenCalledTimes(1)
  })
})

describe('a list not seeded by this navigation', () => {
  it('is asked for again on mount even when cached', async () => {
    const queries = client()
    queries.setQueryData(postsKey({ forum: 'f1', sort: 'new' }), {
      pages: [{ posts: [post('old')], hasMore: false }],
      pageParams: [undefined],
    })

    const { ids } = mount(queries, { sort: 'new' })

    await waitFor(() => expect(ids()).toEqual(['fresh']))
    expect(viewForum).toHaveBeenCalledTimes(1)
  })
})

describe('the page after the first', () => {
  type Asked = { before?: number; cursor?: string }

  /** The first page, then a second, as a server with or without cursor gives them. */
  function serve(first: Record<string, unknown>, second: Post[]) {
    viewForum.mockImplementation(async (asked: Asked) =>
      asked.before === undefined && asked.cursor === undefined
        ? {
            data: {
              posts: [post('pinned'), post('a'), post('b')],
              hasMore: true,
              ...first,
            },
          }
        : { data: { posts: second, hasMore: false } }
    )
  }

  async function next(sort: string) {
    const { hook, ids } = mount(client(), { sort })
    await waitFor(() => expect(ids()).toEqual(['pinned', 'a', 'b']))
    await act(() => hook.result.current.fetchNextPage())
    await waitFor(() => expect(viewForum).toHaveBeenCalledTimes(2))
    return { asked: viewForum.mock.calls[1][0] as Asked, ids }
  }

  it("resumes where the server's cursor says", async () => {
    serve({ nextCursor: 1790000000, cursor: '1790000000:b' }, [post('c')])
    const { asked } = await next('new')
    expect(asked.cursor).toBe('1790000000:b')
    expect(asked.before).toBeUndefined()
  })

  it('is asked by before of a server that sends no cursor', async () => {
    serve({ nextCursor: 1790000000 }, [post('c')])
    const { asked } = await next('new')
    expect(asked.before).toBe(1790000000)
    expect(asked.cursor).toBeUndefined()
  })

  it('shows a post an older server repeats once', async () => {
    // A server before the cursor sends a pinned post again on every page.
    serve({ nextCursor: 1790000000 }, [post('pinned'), post('c')])
    const { ids } = await next('new')
    await waitFor(() => expect(ids()).toEqual(['pinned', 'a', 'b', 'c']))
  })
})
