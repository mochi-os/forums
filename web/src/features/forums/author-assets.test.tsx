// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// An author's avatar route names one of their posts or comments, so a thread
// that built each row's own address fetched the same picture and style once
// per row: a 500-comment thread by one author sent a thousand requests and ran
// out of the forum's budget for calls to that author's server.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '@/api/types/posts'
import { authorAssets } from './author-assets'
import { ForumOverview } from './components/forum-overview'
import { PostCard } from './components/post-card'
import {
  ThreadComment,
  type ThreadCommentType,
} from './components/thread/thread-comment'

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}))

function post(id: string, member: string, extra: Partial<Post> = {}): Post {
  return {
    id,
    forum: 'f1',
    member,
    name: member,
    title: `Title ${id}`,
    body: '',
    comments: 0,
    up: 0,
    down: 0,
    created: 1_700_000_000,
    updated: 1_700_000_000,
    ...extra,
  }
}

function comment(
  id: string,
  member: string,
  children: ThreadCommentType[] = [],
  status: ThreadCommentType['status'] = 'approved'
): ThreadCommentType {
  return {
    id,
    forum: 'f1',
    post: 'p1',
    parent: '',
    member,
    name: member,
    body: `Body ${id}`,
    up: 0,
    down: 0,
    created: 1_700_000_000,
    children,
    can_vote: true,
    can_comment: true,
    status,
  }
}

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    </QueryClientProvider>
  )
}

const sources = (name: string) =>
  screen
    .getAllByAltText(`Avatar for ${name}`)
    .map((img) => img.getAttribute('src'))

beforeEach(() => {
  i18n.load('en', {})
  i18n.activate('en')
})

describe('authorAssets', () => {
  it('puts the post first and gives each commenter their first comment', () => {
    const found = authorAssets(
      [post('p1', 'ann', { fingerprint: 'fp1' })],
      [comment('c1', 'ann'), comment('c2', 'bob', [comment('c3', 'cat')])]
    )
    expect(found.get('ann')).toBe('/fp1/-/p1/asset')
    expect(found.get('bob')).toBe('/f1/-/p1/c2/asset')
    expect(found.get('cat')).toBe('/f1/-/p1/c3/asset')
  })

  it('never lets a pending or removed row stand in for its author', () => {
    const found = authorAssets(
      [post('p1', 'ann', { status: 'pending' })],
      [
        comment('c1', 'ann', [], 'removed'),
        comment('c2', 'ann'),
        comment('c3', 'bob', [], 'pending'),
      ]
    )
    expect(found.get('ann')).toBe('/f1/-/p1/c2/asset')
    expect(found.has('bob')).toBe(false)
  })
})

describe('ThreadComment avatars', () => {
  // 50 comments by two people, nested five deep.
  function thread(): ThreadCommentType {
    let reply: ThreadCommentType[] = []
    for (let depth = 0; depth < 5; depth++) {
      const replies: ThreadCommentType[] = []
      for (let n = 0; n < 10; n++) {
        const id = `c${depth}-${n}`
        replies.push(comment(id, n % 2 ? 'bob' : 'ann', n === 0 ? reply : []))
      }
      reply = replies
    }
    return comment('c-root', 'ann', reply)
  }

  it('fetches each author once, however many comments and levels', () => {
    const root = thread()
    const avatars = authorAssets([], [root])
    wrap(<ThreadComment comment={root} onVote={vi.fn()} avatars={avatars} />)
    expect(new Set(sources('ann'))).toEqual(
      new Set(['/f1/-/p1/c-root/asset/avatar'])
    )
    expect(new Set(sources('bob'))).toEqual(
      // Replies come before the next sibling, so Bob's first is the deepest.
      new Set(['/f1/-/p1/c0-1/asset/avatar'])
    )
    expect(sources('ann').length + sources('bob').length).toBe(51)
  })

  it('keeps its own address for an author with no comment that may stand in', () => {
    const root = comment('c1', 'ann', [comment('c2', 'cat', [], 'pending')])
    wrap(
      <ThreadComment
        comment={root}
        onVote={vi.fn()}
        avatars={authorAssets([], [root])}
      />
    )
    expect(sources('cat')).toEqual(['/f1/-/p1/c2/asset/avatar'])
  })
})

describe('post lists', () => {
  it('draws a card from the list map when it has one', () => {
    wrap(
      <PostCard
        post={post('p2', 'ann')}
        forumName='Forum'
        showForumBadge={false}
        onSelect={vi.fn()}
        avatars={new Map([['ann', '/f1/-/p1/asset']])}
      />
    )
    expect(sources('ann')).toEqual(['/f1/-/p1/asset/avatar'])
  })

  it('shares one address per author across the cards of a forum and of all forums', () => {
    const posts = [
      post('p1', 'ann'),
      post('p2', 'bob'),
      post('p3', 'ann'),
      post('p4', 'bob'),
      post('p5', 'ann'),
    ]
    for (const forum of [undefined, { id: 'f1', name: 'Forum' }]) {
      const view = wrap(
        <ForumOverview
          forum={forum as Parameters<typeof ForumOverview>[0]['forum']}
          posts={posts}
          onSelectPost={vi.fn()}
          onCreatePost={vi.fn()}
        />
      )
      expect(new Set(sources('ann'))).toEqual(
        new Set(['/f1/-/p1/asset/avatar'])
      )
      expect(new Set(sources('bob'))).toEqual(
        new Set(['/f1/-/p2/asset/avatar'])
      )
      view.unmount()
    }
  })
})
