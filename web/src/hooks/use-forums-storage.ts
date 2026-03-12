// Shell storage utilities for forums app - stores last visited forum
// null means "All Forums" view, a forum ID means a specific forum

import { shellStorage } from '@mochi/common'

const STORAGE_KEY = 'mochi-forums-last'

// Special value to indicate "All Forums" view
const ALL_FORUMS = 'all'

// Store last visited forum (null for "All Forums" view)
export function setLastForum(forumId: string | null): void {
  shellStorage.setItem(STORAGE_KEY, forumId ?? ALL_FORUMS)
}

// Get last visited forum (null means "All Forums" view)
export async function getLastForum(): Promise<string | null> {
  const value = await shellStorage.getItem(STORAGE_KEY)
  if (value === null || value === ALL_FORUMS) {
    return null
  }
  return value
}

// Clear last forum
export function clearLastForum(): void {
  shellStorage.removeItem(STORAGE_KEY)
}
