// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { handleServerError } from '@mochi/web'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import forumsApi from '@/api/forums'
import {
  useFollowPost,
  useLockPost,
  usePinPost,
  useSetForumNotification,
  useUnlockPost,
  useUnpinPost,
  useVoteComment,
  useVotePost,
} from './use-forums-queries'

vi.mock('@/api/forums', () => ({
  default: {
    setNotification: vi.fn(),
    followPost: vi.fn(),
    lockPost: vi.fn(),
    unlockPost: vi.fn(),
    pinPost: vi.fn(),
    unpinPost: vi.fn(),
    votePost: vi.fn(),
    voteComment: vi.fn(),
  },
}))
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  handleServerError: vi.fn(),
}))

// A notification tick and Follow change on the click, and go back if the
// server refuses. Each request here waits until the test answers it.
let refuse: (error: unknown) => void
// Every request still waiting, oldest first, for tests that click twice.
let pending: Array<{ accept: () => void; refuse: (error: unknown) => void }>
beforeEach(() => {
  pending = []
  vi.mocked(handleServerError).mockClear()
  vi.mocked(forumsApi.votePost).mockClear()
  const waiting = () =>
    new Promise<never>((resolve, reject) => {
      refuse = reject
      pending.push({
        accept: () => resolve(undefined as never),
        refuse: reject,
      })
    })
  vi.mocked(forumsApi.setNotification).mockImplementation(waiting)
  vi.mocked(forumsApi.followPost).mockImplementation(waiting)
  vi.mocked(forumsApi.lockPost).mockImplementation(waiting)
  vi.mocked(forumsApi.unlockPost).mockImplementation(waiting)
  vi.mocked(forumsApi.pinPost).mockImplementation(waiting)
  vi.mocked(forumsApi.unpinPost).mockImplementation(waiting)
  vi.mocked(forumsApi.votePost).mockImplementation(waiting)
  vi.mocked(forumsApi.voteComment).mockImplementation(waiting)
})

function mount<T>(hook: () => T, seed: (client: QueryClient) => void) {
  const client = new QueryClient()
  seed(client)
  const view = renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </I18nProvider>
    ),
  })
  return { client, view }
}

describe('useSetForumNotification', () => {
  const key = ['forums', 'notifications', 'f1']

  it('ticks at once and unticks when refused', async () => {
    const { client, view } = mount(
      () => useSetForumNotification('f1'),
      (c) =>
        c.setQueryData(key, {
          data: { post: false, reply: false, comment: false },
        })
    )
    const post = () =>
      client.getQueryData<{ data: { post: boolean } }>(key)?.data.post

    act(() => view.result.current.mutate({ kind: 'post', enabled: true }))
    await waitFor(() => expect(post()).toBe(true))

    act(() => refuse(new Error('refused')))
    await waitFor(() => expect(view.result.current.isError).toBe(true))
    expect(post()).toBe(false)
  })
})

describe('useFollowPost', () => {
  // The post is cached under the server it came from, after the post id.
  const key = ['forums', 'post', 'f1', 'p1', undefined]

  it('follows at once and unfollows when refused', async () => {
    const { client, view } = mount(
      () => useFollowPost('f1', 'p1'),
      (c) => c.setQueryData(key, { data: { following: false } })
    )
    const following = () =>
      client.getQueryData<{ data: { following: boolean } }>(key)?.data.following

    act(() => view.result.current.mutate(true))
    await waitFor(() => expect(following()).toBe(true))

    act(() => refuse(new Error('refused')))
    await waitFor(() => expect(view.result.current.isError).toBe(true))
    expect(following()).toBe(false)
  })
})

describe('lock and pin', () => {
  const key = ['forums', 'post', 'f1', 'p1', undefined]
  type Flags = { locked?: boolean; pinned?: boolean }

  it.each([
    ['lock', useLockPost, 'locked', false],
    ['unlock', useUnlockPost, 'locked', true],
    ['pin', usePinPost, 'pinned', false],
    ['unpin', useUnpinPost, 'pinned', true],
  ] as const)(
    '%s shows on the post at once and goes back when refused',
    async (_name, hook, flag, before) => {
      const { client, view } = mount(
        () => hook('f1', 'p1'),
        (c) =>
          c.setQueryData(key, {
            data: { post: { id: 'p1', [flag]: before } },
          })
      )
      const value = () =>
        client.getQueryData<{ data: { post: Flags } }>(key)?.data.post[flag]

      act(() => view.result.current.mutate())
      await waitFor(() => expect(value()).toBe(!before))

      act(() => refuse(new Error('refused')))
      await waitFor(() => expect(view.result.current.isError).toBe(true))
      expect(value()).toBe(before)
    }
  )
})

describe('votes', () => {
  const key = ['forums', 'post', 'f1', 'p1', undefined]
  type Counts = { up: number; down: number; user_vote?: string }
  type Data = {
    data: {
      post: Counts
      comments: Array<Counts & { id: string; children: unknown[] }>
    }
  }
  const seed = (c: QueryClient) =>
    c.setQueryData<Data>(key, {
      data: {
        post: { up: 2, down: 1, user_vote: '' },
        comments: [
          {
            id: 'c1',
            up: 0,
            down: 0,
            user_vote: '',
            children: [
              { id: 'c2', up: 3, down: 0, user_vote: 'up', children: [] },
            ],
          },
        ],
      },
    })

  it('a post vote counts at once and goes back when refused', async () => {
    const { client, view } = mount(() => useVotePost('f1', 'p1'), seed)
    const post = () => client.getQueryData<Data>(key)?.data.post

    act(() => view.result.current.mutate('up'))
    await waitFor(() =>
      expect(post()).toEqual({ up: 3, down: 1, user_vote: 'up' })
    )

    act(() => refuse(new Error('refused')))
    await waitFor(() => expect(view.result.current.isError).toBe(true))
    expect(post()).toEqual({ up: 2, down: 1, user_vote: '' })
  })

  it('a reply vote counts at once and goes back when refused', async () => {
    const { client, view } = mount(() => useVoteComment('f1', 'p1'), seed)
    const reply = () =>
      client.getQueryData<Data>(key)?.data.comments[0].children[0]

    act(() => view.result.current.mutate({ commentId: 'c2', vote: 'down' }))
    await waitFor(() =>
      expect(reply()).toMatchObject({ up: 2, down: 1, user_vote: 'down' })
    )

    act(() => refuse(new Error('refused')))
    await waitFor(() => expect(view.result.current.isError).toBe(true))
    expect(reply()).toMatchObject({ up: 3, down: 0, user_vote: 'up' })
  })

  it('still sends a vote when another copy of the post has no post', async () => {
    const { client, view } = mount(
      () => useVotePost('f1', 'p1'),
      (c) => {
        seed(c)
        c.setQueryData(['forums', 'post', 'f1', 'p1', 'other'], { data: {} })
      }
    )
    act(() => view.result.current.mutate('up'))
    await waitFor(() => expect(forumsApi.votePost).toHaveBeenCalled())
    expect(client.getQueryData<Data>(key)?.data.post.up).toBe(3)
    expect(
      client.getQueryData(['forums', 'post', 'f1', 'p1', 'other'])
    ).toEqual({ data: {} })
  })

  it('a refused first vote keeps the second one still waiting', async () => {
    const { client, view } = mount(() => useVotePost('f1', 'p1'), seed)
    const post = () => client.getQueryData<Data>(key)?.data.post

    act(() => view.result.current.mutate('up'))
    await waitFor(() => expect(pending).toHaveLength(1))
    act(() => view.result.current.mutate('down'))
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(post()).toEqual({ up: 2, down: 2, user_vote: 'down' })

    act(() => pending[0].refuse(new Error('refused')))
    await waitFor(() => expect(handleServerError).toHaveBeenCalled())
    expect(post()).toEqual({ up: 2, down: 2, user_vote: 'down' })

    act(() => pending[1].refuse(new Error('refused')))
    await waitFor(() => expect(view.result.current.isError).toBe(true))
    expect(post()).toEqual({ up: 2, down: 1, user_vote: '' })
  })
})
