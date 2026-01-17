// localStorage utilities for forums app - stores last visited forum per browser
// null means "All Forums" view, a forum ID means a specific forum

const STORAGE_KEY = 'mochi-forums-last'
const SESSION_KEY = 'mochi-forums-session-started'

// Special value to indicate "All Forums" view
const ALL_FORUMS = 'all'

// Store last visited forum (null for "All Forums" view)
export function setLastForum(forumId: string | null): void {
  try {
    localStorage.setItem(STORAGE_KEY, forumId ?? ALL_FORUMS)
  } catch {
    // Silently fail - localStorage may be unavailable
  }
}

// Get last visited forum (null means "All Forums" view)
export function getLastForum(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === null || value === ALL_FORUMS) {
      return null
    }
    return value
  } catch {
    return null
  }
}

// Clear last forum
export function clearLastForum(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently fail
  }
}

// Check if this is the first navigation to the index this session
// Used to only auto-redirect on initial app entry, not subsequent navigations
export function shouldRedirectToLastForum(): boolean {
  try {
    // If session already started, don't redirect
    if (sessionStorage.getItem(SESSION_KEY)) {
      return false
    }
    // Mark session as started
    sessionStorage.setItem(SESSION_KEY, '1')
    return true
  } catch {
    return false
  }
}
