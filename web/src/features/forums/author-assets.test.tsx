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
import {
  authorAssets,
  commentAssets,
  moderationAssets,
  postAssets,
} from './author-assets'
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

// Ids the shape core gives them: a forum's fingerprint, a row's id from a
// short name, a Mochi identity.
const FORUM = 'forum0001'
const PERSON = '1sfEACmTnQhBVgquGhaCs8Jw4SXKF9XY2apnUwJ63duq2QSxh5'
const row = (name: string) => name.padEnd(32, '0')
// The asset address of a forum row: its forum, then the rows on the way.
const at = (...names: string[]) =>
  `/${FORUM}/-/${names.map(row).join('/')}/asset`

function post(id: string, member: string, extra: Partial<Post> = {}): Post {
  return {
    id: row(id),
    forum: FORUM,
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
    id: row(id),
    forum: FORUM,
    post: row('p1'),
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
      [post('p1', 'ann', { fingerprint: 'print0001' })],
      [comment('c1', 'ann'), comment('c2', 'bob', [comment('c3', 'cat')])]
    )
    expect(found.get('ann')).toBe(`/print0001/-/${row('p1')}/asset`)
    expect(found.get('bob')).toBe(at('p1', 'c2'))
    expect(found.get('cat')).toBe(at('p1', 'c3'))
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
    expect(found.get('ann')).toBe(at('p1', 'c2'))
    expect(found.has('bob')).toBe(false)
  })
})

describe('moderationAssets', () => {
  it('serves a Mochi member through the moderation proxy', () => {
    expect(moderationAssets(FORUM, PERSON)).toEqual({
      avatar: `/${FORUM}/-/moderation/${PERSON}/asset/avatar`,
      style: `/${FORUM}/-/moderation/${PERSON}/asset/style`,
    })
  })

  it('serves a person on another network named by one segment', () => {
    // The route proxies their network's avatar: a Bluesky DID and a Matrix
    // address each stand as one segment, encoded.
    expect(moderationAssets(FORUM, 'did:plc:abc123')?.avatar).toBe(
      `/${FORUM}/-/moderation/did%3Aplc%3Aabc123/asset/avatar`
    )
    expect(moderationAssets(FORUM, '@ann:matrix.org')?.style).toBe(
      `/${FORUM}/-/moderation/%40ann%3Amatrix.org/asset/style`
    )
  })

  it('asks no route for a person named by a web address on another network', () => {
    // THE POINT: an address in the path matches no action, so each row of a
    // restrictions list or log cost two failed requests.
    expect(moderationAssets(FORUM, 'https://lemmy.world/u/ann')).toBeNull()
  })

  it.each([
    ['a person who names an action', FORUM, 'access/set?target=x&x='],
    ['a person who climbs', FORUM, '../../-/blocks/add?target=x'],
    ['a forum that climbs', '..', PERSON],
    ['a forum that is no address', 'delete?x=', PERSON],
  ])('asks no route for %s', (_name, forum, person) => {
    expect(moderationAssets(forum, person)).toBeNull()
  })
})

// A remote forum's rows come from its server, and the style behind each avatar
// is fetched with the reader's token: a post whose id was `delete?x=` under
// the reader's own forum's fingerprint made opening that page delete it.
describe('rows from another server', () => {
  it.each([
    ['an id that names an action', { id: 'delete?x=' }],
    ['an id that climbs', { id: '../../-/saved/clear?' }],
    ['an id that is not a row id', { id: 'p1' }],
    ['a fingerprint of two dots', { fingerprint: '..' }],
    ['a fingerprint that names an action', { fingerprint: 'delete?x=' }],
    ['a forum that is no address', { forum: 'access?x=' }],
    ['no forum at all', { forum: undefined as unknown as string }],
  ])('give a post no address for %s', (_name, extra) => {
    expect(postAssets(post('p1', 'eve', extra))).toBeUndefined()
  })

  it.each([
    ['an id that climbs', { id: '../../-/delete?x=' }],
    ['a post that names an action', { post: 'delete?x=' }],
    ['a forum that is no address', { forum: '-' }],
  ])('give a comment no address for %s', (_name, extra) => {
    expect(commentAssets({ ...comment('c1', 'eve'), ...extra })).toBeUndefined()
  })

  it("names a community's forum by its fingerprint", () => {
    const address = postAssets(
      post('p1', 'ann', { forum: 'https://lemmy.ml/c/test' })
    )
    expect(address).toMatch(/^\/[0-9A-Za-z]{9}\/-\/[0-9a-z]{32}\/asset$/)
  })

  it('lets the next row stand in for an author whose first has no address', () => {
    const found = authorAssets(
      [post('p1', 'eve', { id: 'delete?x=' })],
      [comment('c1', 'eve')]
    )
    expect(found.get('eve')).toBe(at('p1', 'c1'))
  })

  it('draws initials for a comment that has no address', () => {
    const bad = { ...comment('c1', 'eve'), id: '../../-/delete?x=' }
    wrap(<ThreadComment comment={bad} onVote={vi.fn()} />)
    expect(screen.queryAllByAltText('Avatar for eve')).toEqual([])
    expect(screen.getByText('Body c1')).toBeTruthy()
  })
})

describe('ThreadComment image chip', () => {
  const chip = () =>
    screen.queryByRole('button', {
      name: 'View the image this comment is about',
    })

  it("is the forum's own attachment route, encoded, with the view's server", () => {
    wrap(
      <ThreadComment
        comment={{ ...comment('c1', 'ann'), attachment: 'a?b' }}
        onVote={vi.fn()}
        server='peer.example'
      />
    )
    expect(chip()?.querySelector('img')?.getAttribute('src')).toBe(
      `/${FORUM}/-/attachments/a%3Fb/thumbnail?server=peer.example`
    )
  })

  it('is left out for an attachment id that cannot be one path segment', () => {
    wrap(
      <ThreadComment
        comment={{ ...comment('c1', 'ann'), attachment: '../delete?x=' }}
        onVote={vi.fn()}
      />
    )
    expect(chip()).toBeNull()
    expect(screen.getByText('Body c1')).toBeTruthy()
  })
})

describe('ThreadComment avatars', () => {
  // 50 comments by two people, nested five deep.
  function thread(): ThreadCommentType {
    let reply: ThreadCommentType[] = []
    for (let depth = 0; depth < 5; depth++) {
      const replies: ThreadCommentType[] = []
      for (let n = 0; n < 10; n++) {
        const id = `c${depth}x${n}`
        replies.push(comment(id, n % 2 ? 'bob' : 'ann', n === 0 ? reply : []))
      }
      reply = replies
    }
    return comment('croot', 'ann', reply)
  }

  it('fetches each author once, however many comments and levels', () => {
    const root = thread()
    const avatars = authorAssets([], [root])
    wrap(<ThreadComment comment={root} onVote={vi.fn()} avatars={avatars} />)
    expect(new Set(sources('ann'))).toEqual(
      new Set([`${at('p1', 'croot')}/avatar`])
    )
    expect(new Set(sources('bob'))).toEqual(
      // Replies come before the next sibling, so Bob's first is the deepest.
      new Set([`${at('p1', 'c0x1')}/avatar`])
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
    expect(sources('cat')).toEqual([`${at('p1', 'c2')}/avatar`])
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
      expect(new Set(sources('ann'))).toEqual(new Set([`${at('p1')}/avatar`]))
      expect(new Set(sources('bob'))).toEqual(new Set([`${at('p2')}/avatar`]))
      view.unmount()
    }
  })
})
