import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, Hash } from 'lucide-react'
import {
  Button,
  GeneralError,
  Input,
  toast,
  getErrorMessage,
} from '@mochi/common'
import forumsApi from '@/api/forums'
import type { DirectoryEntry } from '@/api/types/forums'
import { forumsKeys } from '@/hooks/use-forums-queries'

interface InlineForumSearchProps {
  subscribedIds: Set<string>
  onRefresh?: () => void
}

export function InlineForumSearch({
  subscribedIds,
  onRefresh,
}: InlineForumSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<DirectoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<Error | null>(null)
  const [pendingForumId, setPendingForumId] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const runSearch = useCallback(async (query: string) => {
    if (query.length === 0) {
      setResults([])
      setSearchError(null)
      return
    }

    setIsLoading(true)
    setSearchError(null)
    try {
      const response = await forumsApi.searchForums({ search: query })
      setResults(response.data.results ?? [])
    } catch (error) {
      setResults([])
      setSearchError(
        error instanceof Error ? error : new Error('Failed to search forums')
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setResults([])
      setSearchError(null)
      return
    }

    void runSearch(debouncedQuery)
  }, [debouncedQuery, runSearch])

  const retrySearch = useCallback(() => {
    void runSearch(debouncedQuery)
  }, [debouncedQuery, runSearch])

  const handleSubscribe = async (forum: DirectoryEntry) => {
    setPendingForumId(forum.id)
    try {
      await forumsApi.subscribeForum(forum.id, forum.location || undefined)
      void queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      onRefresh?.()
      void navigate({ to: '/$forum', params: { forum: forum.id } })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to subscribe'))
      setPendingForumId(null)
    }
  }

  const showResults = debouncedQuery.length > 0
  const showLoading = isLoading && debouncedQuery.length > 0

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative mb-4">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search for forums..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 pl-9"
          autoFocus
        />
      </div>

      {showLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && showResults && searchError && (
        <GeneralError
          error={searchError}
          minimal
          mode='inline'
          reset={retrySearch}
        />
      )}

      {!isLoading && showResults && !searchError && results.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          No forums found
        </p>
      )}

      {!isLoading && !searchError && results.length > 0 && (
        <div className="divide-border divide-y rounded-lg border">
          {results
            .filter((forum) => !subscribedIds.has(forum.id) && !subscribedIds.has(forum.fingerprint))
            .map((forum) => {
              const isPending = pendingForumId === forum.id

              return (
                <div
                  key={forum.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                      <Hash className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col text-left">
                      <span className="truncate text-sm font-medium">{forum.name}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {forum.fingerprint_hyphens}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSubscribe(forum)}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
