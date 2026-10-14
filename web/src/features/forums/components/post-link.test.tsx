// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PostLink } from './post-link'

describe('PostLink', () => {
  it('shows the card the server read, as a link to the page', () => {
    render(
      <PostLink
        post={{
          url: 'https://www.example.com/story?x=1',
          thumbnail: 'https://example.com/thumb.png',
          embed: JSON.stringify({
            title: 'Story',
            description: 'A story',
            site: 'Example',
          }),
        }}
      />
    )
    const card = screen.getByTestId('post-link')
    expect(card).toHaveAttribute('href', 'https://www.example.com/story?x=1')
    expect(card).toHaveAttribute('target', '_blank')
    expect(screen.getByText('Example')).toBeTruthy()
    expect(screen.getByText('Story')).toBeTruthy()
    expect(screen.getByText('A story')).toBeTruthy()
    expect(card.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/thumb.png'
    )
  })

  it('shows the host and the bare link where no card was read', () => {
    render(<PostLink post={{ url: 'https://www.example.com/story' }} compact />)
    expect(screen.getByText('example.com')).toBeTruthy()
    expect(screen.getByText('https://www.example.com/story')).toBeTruthy()
    expect(screen.getByTestId('post-link').querySelector('img')).toBeNull()
  })

  it('renders nothing for a post with no link or a link that is not a web one', () => {
    const { container } = render(
      <>
        <PostLink post={{ url: '' }} />
        <PostLink post={{ url: 'javascript:alert(1)' }} />
      </>
    )
    expect(container.querySelector('[data-testid="post-link"]')).toBeNull()
  })
})
