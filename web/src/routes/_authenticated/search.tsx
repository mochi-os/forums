import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Header, Main, Input, Card, CardContent, usePageTitle } from '@mochi/common'
import { forumsApi } from '@/api/forums'
import type { DirectoryEntry, ProbeForumResponse } from '@/api/types/forums'
import { useForumsList, useSubscribeForum } from '@/hooks/use-forums-queries'
import { ForumGrid } from '@/features/forums/components/forum-grid'
import { useForumsStore, type CachedForum } from '@/stores/forums-store'
import { Loader2, Search as SearchIcon, Hash } from 'lucide-react'

const searchSchema = z.object({
  search: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/search')({
  validateSearch: searchSchema,
  component: SearchForumsPage,
})

const SEARCH_DEBOUNCE_MS = 500

// Check if input looks like a forum URL (contains /forums/ or /forums?)
const isForumUrl = (input: string): boolean => {
  return input.includes('/forums/') || input.includes('/forums?')
}

// Map probe response to DirectoryEntry format for display
const mapProbeToDirectoryEntry = (probe: ProbeForumResponse['data']): DirectoryEntry => ({
  id: probe.id,
  fingerprint: probe.fingerprint,
  fingerprint_hyphens: probe.fingerprint,
  name: probe.name || 'Remote Forum',
  class: probe.class,
  data: '',
  location: probe.server,
  created: 0,
  updated: 0,
})

function SearchForumsPage() {
  const { search } = Route.useSearch()
  const navigate = Route.useNavigate()

  const [searchTerm, setSearchTerm] = useState(search || '')
  const [searchResults, setSearchResults] = useState<(DirectoryEntry & { isSubscribed?: boolean })[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [subscribingId, setSubscribingId] = useState<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  // Store for caching remote forums
  const cacheRemoteForum = useForumsStore((state) => state.cacheRemoteForum)

  // Get list of subscribed forums to check subscription status
  const { data: forumsData, refetch: refetchForums } = useForumsList()
  const subscribedForums = forumsData?.data?.forums ?? []

  // Subscribe mutation
  const subscribeMutation = useSubscribeForum(() => {
    void refetchForums()
  })

  // Set page title
  usePageTitle('Search forums')

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const performSearch = useCallback(async (term: string) => {
    const trimmedSearch = term.trim()

    if (!trimmedSearch) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      // Check if input is a URL
      if (isForumUrl(trimmedSearch)) {
        // Probe remote forum by URL
        const response = await forumsApi.probe({ url: trimmedSearch })
        if (!mountedRef.current) return

        if (response.data) {
          const entry = mapProbeToDirectoryEntry(response.data)
          // Cache the probe result for later use when viewing the forum
          cacheRemoteForum(entry as CachedForum)
          setSearchResults([entry])
        } else {
          setSearchResults([])
        }
      } else {
        // Regular search (handles name, ID, and fingerprint on backend)
        const response = await forumsApi.search({ search: trimmedSearch })
        if (!mountedRef.current) return

        setSearchResults(response.data?.results ?? [])
      }
    } catch (error) {
      console.error('[SearchForums] Failed to search forums', error)
      setSearchResults([])
    } finally {
      if (mountedRef.current) {
        setIsSearching(false)
      }
    }
  }, [cacheRemoteForum])

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      void performSearch(searchTerm)
      void navigate({ search: { search: searchTerm || undefined }, replace: true })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchTerm, performSearch, navigate])

  // Mark search results as subscribed if they match a subscribed forum
  const resultsWithSubscription = searchResults.map((result) => ({
    ...result,
    isSubscribed: subscribedForums.some(
      (f) => f.id === result.id || f.fingerprint === result.fingerprint
    ),
  }))

  const handleSubscribe = useCallback(
    async (forumId: string) => {
      setSubscribingId(forumId)
      try {
        await subscribeMutation.mutateAsync(forumId)
      } finally {
        setSubscribingId(null)
      }
    },
    [subscribeMutation]
  )

  const hasResults = searchResults.length > 0
  const hasSearchTerm = searchTerm.trim().length > 0

  return (
    <>
      <Header>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <SearchIcon className="size-5" />
            <h1 className="text-lg font-semibold">Search forums</h1>
          </div>
          <p className="text-sm text-muted-foreground">Private forums may only be added by URL.</p>
        </div>
      </Header>
      <Main className="space-y-6">
        <div className="relative">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            placeholder="Forum name, ID, fingerprint, or URL..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        {isSearching ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Searching...</p>
            </div>
          </div>
        ) : hasSearchTerm && !hasResults ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Hash className="mx-auto mb-4 size-12 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No forums found</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search term or create a new forum.
              </p>
            </CardContent>
          </Card>
        ) : hasResults ? (
          <ForumGrid
            forums={resultsWithSubscription}
            onSubscribe={handleSubscribe}
            subscribingId={subscribingId}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <SearchIcon className="mx-auto mb-4 size-12 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Search for forums</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter a search term to find forums across the network.
              </p>
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}
