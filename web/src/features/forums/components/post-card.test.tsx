// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Post } from '@/api/types/posts'
import { PostCard } from './post-card'

// The card's link to its post is a router link; outside a router it renders
// as a plain anchor.
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  Link: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <a className={className}>{children}</a>,
  // Share builds the post's address through the router.
  useRouter: () => ({
    buildLocation: ({ params }: { params: { post: string } }) => ({
      publicHref: '/forums/f/' + params.post,
    }),
    history: { createHref: (href: string) => href },
  }),
}))

const post: Post = {
  id: 'p1',
  forum: 'https://lemmy.ml/c/test',
  member: 'https://lemmy.ml/u/someone',
  name: 'Someone',
  title: 'A title',
  body: 'Text',
  comments: 0,
  up: 0,
  down: 0,
  created: 1_700_000_000,
  updated: 1_700_000_000,
}

function renderCard(
  forumServer?: string,
  onSelect = vi.fn(),
  isLoggedIn = true
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider i18n={i18n}>
        <PostCard
          post={post}
          forumName='test'
          forumServer={forumServer}
          showForumBadge
          onSelect={onSelect}
          isLoggedIn={isLoggedIn}
        />
      </I18nProvider>
    </QueryClientProvider>
  )
}

// Two communities can share a title, so a post in a list names its
// community's server beside the community's name.
describe('PostCard forum badge', () => {
  it("names a community's server beside its name", () => {
    renderCard('lemmy.ml')
    expect(screen.getByText('lemmy.ml')).toBeInTheDocument()
  })

  it('names a forum of ours by its name alone', () => {
    renderCard()
    expect(screen.queryByText('lemmy.ml')).toBeNull()
  })
})

describe('PostCard share', () => {
  it('has a Share button, even for a visitor on a post with no activity', () => {
    renderCard(undefined, vi.fn(), false)
    expect(screen.getByLabelText('Share')).toBeInTheDocument()
  })

  it('shares without opening the post', () => {
    const onSelect = vi.fn()
    renderCard(undefined, onSelect)
    fireEvent.click(screen.getByLabelText('Share'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
