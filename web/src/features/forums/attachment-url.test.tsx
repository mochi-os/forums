// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Attachment } from '@/api/types/posts'
import { PostAttachments } from './components/thread/post-attachments'
import { CommentAttachments } from './components/comment-attachments'

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
    AttachmentGallery: ({ attachments, getUrl, getThumbnailUrl, getPreviewUrl }: GalleryProps) => (
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
  return ['data-url', 'data-thumbnail', 'data-preview'].map((name) => item!.getAttribute(name) ?? '')
}

describe('attachment addresses', () => {
  it('post gallery builds every variant from the app route, ignoring the supplied urls', () => {
    const { container } = render(<PostAttachments attachments={[remote]} forumId='f1' server='peer.example' />)
    const [url, thumbnail, preview] = addresses(container)
    expect(url).toContain('/f1/-/attachments/a1?server=peer.example')
    expect(thumbnail).toContain('/f1/-/attachments/a1/thumbnail?server=peer.example')
    expect(preview).toContain('/f1/-/attachments/a1/preview?server=peer.example')
    for (const address of [url, thumbnail, preview]) {
      expect(address).not.toContain('delete')
      expect(address).not.toContain('evil.example')
    }
  })

  it('comment gallery does the same', () => {
    const { container } = render(<CommentAttachments attachments={[remote]} forumId='f1' />)
    const [url, thumbnail] = addresses(container)
    expect(url).toContain('/f1/-/attachments/a1')
    expect(thumbnail).toContain('/f1/-/attachments/a1/thumbnail')
    expect(url).not.toContain('delete')
    expect(thumbnail).not.toContain('delete')
  })
})
