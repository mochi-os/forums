// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { useAuthStore } from '@mochi/web'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Forum } from '@/api/types/forums'
import type { Post } from '@/api/types/posts'
import { seedPosts } from '@/hooks/use-infinite-posts'
import { EntityForumPage } from './entity-forum-page'

const state = vi.hoisted(() => ({ viewForum: vi.fn() }))

vi.mock('@/api/forums', () => ({
  default: {
    viewForum: state.viewForum,
    clearNotifications: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}))

// The reader's default sort is Hot.
vi.mock('@/hooks/use-forums-queries', () => {
  const mutation = () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
  })
  return {
    forumsKeys: { all: ['forums'] },
    useForumMembership: () => ({
      isSubscribed: true,
      defaultSort: 'hot',
      isLoading: false,
    }),
    useCreatePost: mutation,
    useSubscribeForum: mutation,
    useUnsubscribeForum: mutation,
    useSetForumSort: mutation,
  }
})

vi.mock('@/hooks/use-forum-websocket', () => ({ useForumWebsocket: vi.fn() }))
vi.mock('@/context/sidebar-context', () => ({
  useSidebarContext: () => ({ openPostDialog: vi.fn() }),
}))
vi.mock('@/components/options-menu', () => ({ OptionsMenu: () => null }))
vi.mock('../components/forum-overview', () => ({
  ForumOverview: ({ posts }: { posts: Post[] }) => (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.id}</li>
      ))}
    </ul>
  ),
}))

vi.mock('@mochi/web', async (original) => ({
  ...(await original<typeof import('@mochi/web')>()),
  PageHeader: ({
    title,
    description,
  }: {
    title: ReactNode
    description?: string
  }) => (
    <header>
      <h1>{title}</h1>
      {description && <p data-testid='header-description'>{description}</p>}
    </header>
  ),
  SortSelector: () => null,
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const forum = {
  id: 'f1',
  fingerprint: 'abcdefghi',
  name: 'Forum',
  members: 0,
  updated: 0,
} as Forum

beforeEach(() => {
  state.viewForum.mockReset()
  state.viewForum.mockResolvedValue({
    data: { posts: [{ id: 'fetched' }], hasMore: false },
  })
  useAuthStore.setState({ isAuthenticated: true })
  i18n.loadAndActivate({ locale: 'en', messages: {} })
})

describe('forum page', () => {
  it("opens in the reader's default sort with the first page its loader fetched", async () => {
    const queries = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    // The loader asked in the default sort, as the page will.
    const seed = seedPosts(
      queries,
      { forum: 'f1', sort: 'hot' },
      { posts: [{ id: 'seeded' } as Post], hasMore: false },
      Date.now()
    )

    render(
      <QueryClientProvider client={queries}>
        <I18nProvider i18n={i18n}>
          <EntityForumPage forum={forum} seed={seed} />
        </I18nProvider>
      </QueryClientProvider>
    )

    expect(await screen.findByText('seeded')).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(state.viewForum).not.toHaveBeenCalled()
  })

  // Two communities can share a title, so a community's page header gives its
  // handle in full; a forum of ours has none.
  it('names a community by its handle under its title, and a forum of ours by its title alone', async () => {
    const queries = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const community = {
      ...forum,
      id: 'https://lemmy.ml/c/test',
      fingerprint: 'mZxJ7b43h',
      name: 'test',
      account: 'l1',
      handle: 'test@lemmy.ml',
    } as Forum
    const { unmount } = render(
      <QueryClientProvider client={queries}>
        <I18nProvider i18n={i18n}>
          <EntityForumPage forum={community} />
        </I18nProvider>
      </QueryClientProvider>
    )
    expect((await screen.findByTestId('header-description')).textContent).toBe(
      '!test@lemmy.ml'
    )
    unmount()

    render(
      <QueryClientProvider client={queries}>
        <I18nProvider i18n={i18n}>
          <EntityForumPage forum={forum} />
        </I18nProvider>
      </QueryClientProvider>
    )
    expect(await screen.findByText('Forum')).toBeTruthy()
    expect(screen.queryByTestId('header-description')).toBeNull()
  })
})
