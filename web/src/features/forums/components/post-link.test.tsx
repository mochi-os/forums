// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { linkImage, PostLink } from './post-link'

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

// A Lemmy image post's link is the image itself: shown as the picture, as its
// network shows it, never as a card naming its address.
describe('an image link', () => {
  const image = 'https://lemmy.example/pictrs/image/abc.jpeg'

  it('shows as the image, linking to it, and not its address', () => {
    render(
      <PostLink
        post={{
          url: image,
          thumbnail: 'https://lemmy.example/pictrs/image/small.jpeg',
        }}
      />
    )
    const link = screen.getByTestId('post-link')
    expect(link).toHaveAttribute('href', image)
    expect(link.querySelector('img')).toHaveAttribute('src', image)
    expect(screen.queryByText(image)).toBeNull()
  })

  it("shows the network's smaller copy in a list", () => {
    render(
      <PostLink
        post={{
          url: image,
          thumbnail: 'https://lemmy.example/pictrs/image/small.jpeg',
        }}
        compact
      />
    )
    expect(
      screen.getByTestId('post-link').querySelector('img')
    ).toHaveAttribute('src', 'https://lemmy.example/pictrs/image/small.jpeg')
    expect(screen.queryByText(image)).toBeNull()
  })

  it("is known by its file, by Lemmy's image proxy, or by the type its network gave", () => {
    expect(linkImage({ url: image })).toBe(true)
    expect(
      linkImage({
        url: 'https://lemmy.example/api/v3/image_proxy?url=https%3A%2F%2Fthere.example%2Fa.png',
      })
    ).toBe(true)
    expect(
      linkImage({
        url: 'https://there.example/picture',
        embed: JSON.stringify({ type: 'image/webp' }),
      })
    ).toBe(true)
    expect(linkImage({ url: 'https://there.example/story' })).toBe(false)
    expect(
      linkImage({
        url: 'https://there.example/share?url=https%3A%2F%2Fthere.example%2Fa.png',
      })
    ).toBe(false)
    expect(
      linkImage({
        url: 'https://there.example/a.png',
        embed: JSON.stringify({ type: 'text/html' }),
      })
    ).toBe(false)
  })
})
