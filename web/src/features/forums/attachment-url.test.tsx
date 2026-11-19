// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Attachment } from '@/api/types/posts'
import { CommentAttachments } from './components/comment-attachments'
import { PostAttachments } from './components/thread/post-attachments'

type GalleryProps = {
  attachments: Attachment[]
  getUrl: (att: Attachment) => string
  getThumbnailUrl?: (att: Attachment) => string
  getPreviewUrl?: (att: Attachment) => string
}

// The gallery is the library's; what matters here is the address each
// component hands it for every variant.
vi.mock('@mochi/web', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mochi/web')>()
  return {
    ...actual,
    AttachmentGallery: ({
      attachments,
      getUrl,
      getThumbnailUrl,
      getPreviewUrl,
    }: GalleryProps) => (
      <ul>
        {attachments.map((att) => (
          <li
            key={att.id}
            data-testid='attachment'
            data-url={getUrl(att)}
            data-thumbnail={getThumbnailUrl?.(att) ?? ''}
            data-preview={getPreviewUrl?.(att) ?? ''}
          />
        ))}
      </ul>
    ),
  }
})

// A remote forum owner's answer names addresses of their choosing. Each is a
// state-changing route on this app, and the viewer's token would ride along.
const remote = {
  id: 'a1',
  name: 'cat.png',
  size: 10,
  content_type: 'image/png',
  url: '/forums/f1/-/delete',
  thumbnail_url: '/forums/f1/-/post/delete',
  preview_url: 'https://evil.example/collect',
} as unknown as Attachment

function addresses(container: HTMLElement) {
  const item = container.querySelector('[data-testid="attachment"]')
  expect(item).not.toBeNull()
  return ['data-url', 'data-thumbnail', 'data-preview'].map(
    (name) => item!.getAttribute(name) ?? ''
  )
}

describe('attachment addresses', () => {
  it('post gallery builds every variant from the app route, ignoring the supplied urls', () => {
    const { container } = render(
      <PostAttachments
        attachments={[remote]}
        forumId='f1'
        server='peer.example'
      />
    )
    const [url, thumbnail, preview] = addresses(container)
    expect(url).toContain('/f1/-/attachments/a1?server=peer.example')
    expect(thumbnail).toContain(
      '/f1/-/attachments/a1/thumbnail?server=peer.example'
    )
    expect(preview).toContain(
      '/f1/-/attachments/a1/preview?server=peer.example'
    )
    for (const address of [url, thumbnail, preview]) {
      expect(address).not.toContain('delete')
      expect(address).not.toContain('evil.example')
    }
  })

  // The id can come from another server too: one that cannot be one path
  // segment would aim the request at another action, so its attachment is
  // left out, and one that can is encoded.
  it('post gallery encodes each id and leaves out one that cannot be a segment', () => {
    const { container } = render(
      <PostAttachments
        attachments={[
          { ...remote, id: 'a?b' },
          { ...remote, id: '../delete?x=' },
          { ...remote, id: 'x/delete' },
        ]}
        forumId='f1'
      />
    )
    const items = container.querySelectorAll('[data-testid="attachment"]')
    expect(items).toHaveLength(1)
    expect(addresses(container)).toEqual([
      '/f1/-/attachments/a%3Fb',
      '/f1/-/attachments/a%3Fb/thumbnail',
      '/f1/-/attachments/a%3Fb/preview',
    ])
  })

  it('comment gallery leaves out an attachment whose id cannot be a segment', () => {
    const { container } = render(
      <CommentAttachments
        attachments={[
          { ...remote, id: 'a1' },
          { ...remote, id: '../delete' },
        ]}
        forumId='f1'
      />
    )
    expect(
      container.querySelectorAll('[data-testid="attachment"]')
    ).toHaveLength(1)
    expect(addresses(container)[0]).toBe('/f1/-/attachments/a1')
  })

  it('comment gallery shows nothing when no attachment can be addressed', () => {
    const { container } = render(
      <CommentAttachments
        attachments={[
          { ...remote, id: '..' },
          { ...remote, id: 'x/y' },
        ]}
        forumId='f1'
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('comment gallery does the same', () => {
    const { container } = render(
      <CommentAttachments attachments={[remote]} forumId='f1' />
    )
    const [url, thumbnail] = addresses(container)
    expect(url).toContain('/f1/-/attachments/a1')
    expect(thumbnail).toContain('/f1/-/attachments/a1/thumbnail')
    expect(url).not.toContain('delete')
    expect(thumbnail).not.toContain('delete')
  })
})
