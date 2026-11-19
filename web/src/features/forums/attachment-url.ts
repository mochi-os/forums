// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import {
  authenticatedUrl,
  getAppPath,
  normalizeEntityUrl,
  path,
  tryPath,
} from '@mochi/web'
import { forumPath } from '@/lib/forum-path'

export type AttachmentVariant = '' | 'thumbnail' | 'medium' | 'preview'

// The address of an attachment's bytes: this app's own route, in the forum it
// is being viewed in. Never the `url` fields a remote forum's answer carries -
// those name a path another server chose, and the viewer's token goes on the
// result. The attachment's id can come from that server too, so it goes in as
// one encoded segment; one that cannot be a segment gives no address, and the
// attachment is left out rather than fetched from another path.
export function attachmentUrl(
  forumId: string,
  attachmentId: string,
  variant: AttachmentVariant = '',
  server?: string
): string | undefined {
  const suffix = variant ? `/${variant}` : ''
  const query = server ? `?server=${encodeURIComponent(server)}` : ''
  const address = tryPath(
    () =>
      `${getAppPath()}/${path`${forumPath(forumId)}/-/attachments/${attachmentId}`}${suffix}${query}`
  )
  return address && authenticatedUrl(normalizeEntityUrl(address))
}
