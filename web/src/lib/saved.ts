// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// Saved posts are persisted server-side (the forums app's own per-user DB) so
// they survive reloads and sync across the user's devices. The mirror, the
// optimistic mutations and their rollback are the shared createSavedStore;
// what is forums-specific is the row shape — a post snapshot with the time it
// was saved — and the wording of the toasts. Call `loadSaved()` once after
// login to hydrate the mirror.
import { msg } from '@lingui/core/macro'
import { createSavedStore } from '@mochi/web'
import { savedApi, toSnapshot } from '@/api/saved'
import type { Post, SavedItem } from '@/api/types/posts'

const store = createSavedStore<SavedItem, Post>({
  eventName: 'forums:saved:changed',
  api: {
    list: async () => (await savedApi.list()).saved,
    add: (post) => savedApi.add(post),
    remove: (id) => savedApi.remove(id),
    clear: () => savedApi.clear(),
  },
  itemId: (item) => item.post.id,
  inputId: (post) => post.id,
  toItem: (post) => ({
    post: toSnapshot(post),
    created: Math.floor(Date.now() / 1000),
  }),
  messages: {
    saving: msg`Saving...`,
    saved: msg`Saved`,
    addFailed: msg`Failed to save post`,
    removing: msg`Removing...`,
    removed: msg`Removed from saved`,
    removeFailed: msg`Failed to remove saved post`,
    clearing: msg`Clearing saved posts...`,
    cleared: msg`Saved posts cleared`,
    clearFailed: msg`Failed to clear saved posts`,
  },
})

export const {
  getSaved,
  isSaved,
  loadSaved,
  toggleSaved,
  clearSaved,
  onSavedChange,
} = store
