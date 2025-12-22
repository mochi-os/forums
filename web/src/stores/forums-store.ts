import { create } from 'zustand'
import type { DirectoryEntry } from '@/api/types/forums'

// UI state for the forums feature
interface ForumsUIState {
  // Selected forum
  selectedForumId: string | null
  setSelectedForumId: (id: string | null) => void

  // Search
  searchTerm: string
  setSearchTerm: (term: string) => void
  clearSearch: () => void

  // Cache for remote forums (from search results, not yet subscribed)
  remoteForumsCache: Record<string, DirectoryEntry>
  cacheRemoteForum: (forum: DirectoryEntry) => void
  getCachedRemoteForum: (forumId: string) => DirectoryEntry | undefined
  clearRemoteForumsCache: () => void

  // View preferences
  viewMode: 'all' | 'owned'
  setViewMode: (mode: 'all' | 'owned') => void

  // Reset all UI state
  reset: () => void
}

const initialState = {
  selectedForumId: null,
  searchTerm: '',
  remoteForumsCache: {},
  viewMode: 'all' as const,
}

export const useForumsStore = create<ForumsUIState>()((set, get) => ({
  ...initialState,

  // Selected forum
  setSelectedForumId: (id) => set({ selectedForumId: id }),

  // Search
  setSearchTerm: (term) => set({ searchTerm: term }),
  clearSearch: () => set({ searchTerm: '' }),

  // Remote forums cache
  cacheRemoteForum: (forum) => {
    set((state) => ({
      remoteForumsCache: { ...state.remoteForumsCache, [forum.id]: forum },
    }))
  },

  getCachedRemoteForum: (forumId) => {
    return get().remoteForumsCache[forumId]
  },

  clearRemoteForumsCache: () => set({ remoteForumsCache: {} }),

  // View preferences
  setViewMode: (mode) => set({ viewMode: mode }),

  // Reset
  reset: () => set(initialState),
}))

// Selector hooks for common use cases
export const useSelectedForumId = () => useForumsStore((state) => state.selectedForumId)
export const useSearchTerm = () => useForumsStore((state) => state.searchTerm)
export const useViewMode = () => useForumsStore((state) => state.viewMode)
