// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
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

function renderCard(forumServer?: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider i18n={i18n}>
        <PostCard
          post={post}
          forumName='test'
          forumServer={forumServer}
          showForumBadge
          onSelect={vi.fn()}
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
