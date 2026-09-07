// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { authenticatedUrl, getAppPath, normalizeEntityUrl } from '@mochi/web'

export type AttachmentVariant = '' | 'thumbnail' | 'preview'

// The address of an attachment's bytes: this app's own route, in the forum it
// is being viewed in. Never the `url` fields a remote forum's answer carries -
// those name a path another server chose, and the viewer's token goes on the
// result.
export function attachmentUrl(forumId: string, attachmentId: string, variant: AttachmentVariant = '', server?: string): string {
  const suffix = variant ? `/${variant}` : ''
  const query = server ? `?server=${encodeURIComponent(server)}` : ''
  return authenticatedUrl(normalizeEntityUrl(`${getAppPath()}/${forumId}/-/attachments/${attachmentId}${suffix}${query}`))
}
