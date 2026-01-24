import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, Hash, Check } from 'lucide-react'
import { cn, toast } from '@mochi/common'
import { Button } from '@mochi/common'
import { Input } from '@mochi/common'
import { forumsApi } from '@/api/forums'
import { forumsKeys } from '@/hooks/use-forums-queries'
import type { DirectoryEntry } from '@/api/types/forums'

interface InlineForumSearchProps {
  subscribedIds: Set<string>
}

export function InlineForumSearch({ subscribedIds }: InlineForumSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<DirectoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [subscribedThisSession, setSubscribedThisSession] = useState<Set<string>>(new Set())
  const [pendingForumId, setPendingForumId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setResults([])
      return
    }

    const search = async () => {
      setIsLoading(true)
      try {
        const response = await forumsApi.search({ search: debouncedQuery })
        setResults(response.data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    void search()
  }, [debouncedQuery])

  const handleSubscribe = async (forum: DirectoryEntry) => {
    setPendingForumId(forum.id)
    try {
      await forumsApi.subscribe(forum.id)
      setSubscribedThisSession((prev) => new Set(prev).add(forum.id))
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      toast.success('Subscribed', {
        description: `You are now subscribed to ${forum.name}.`,
      })
    } catch (error) {
      toast.error('Failed to subscribe', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setPendingForumId(null)
    }
  }

  const showResults = debouncedQuery.length > 0
  const showLoading = isLoading && debouncedQuery.length > 0

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Search Input */}
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

      {/* Results */}
      {showLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && showResults && results.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          No forums found
        </p>
      )}

      {!isLoading && results.length > 0 && (
        <div className="divide-border divide-y rounded-lg border">
          {results.map((forum) => {
            const isSubscribed = subscribedIds.has(forum.id) ||
                                 subscribedIds.has(forum.fingerprint) ||
                                 subscribedThisSession.has(forum.id)
            const isPending = pendingForumId === forum.id

            return (
              <div
                key={forum.id}
                className={cn(
                  'flex items-center justify-between gap-3 px-4 py-3 transition-colors',
                  !isSubscribed && 'hover:bg-muted/50'
                )}
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
                  variant={isSubscribed ? 'secondary' : 'default'}
                  onClick={() => handleSubscribe(forum)}
                  disabled={isSubscribed || isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isSubscribed ? (
                    <Check className="h-4 w-4" />
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
