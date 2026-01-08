import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogTrigger,
  Button,
  Input,
  ScrollArea,
  toast,
} from '@mochi/common'
import { Search, Hash, Loader2 } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { forumsApi } from '@/api/forums'
import type { DirectoryEntry } from '@/api/types/forums'
import { useForumsList } from '@/hooks/use-forums-queries'

interface SearchForumsDialogProps {
  hideTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SearchForumsDialog({
  hideTrigger,
  open,
  onOpenChange,
}: SearchForumsDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 500)

  const { data: forumsData } = useForumsList()
  const subscribedForumIds = new Set(
    forumsData?.data?.forums?.map((f) => f.fingerprint || f.id) || []
  )

  // Search query with debounce
  const { data, isLoading, isError } = useQuery({
    queryKey: ['forums', 'search', debouncedSearch],
    queryFn: () => forumsApi.search({ search: debouncedSearch }),
    enabled: debouncedSearch.length > 0,
  })

  const results = data?.data?.results || []

  const handleSubscribe = async (forum: DirectoryEntry) => {
    try {
      await forumsApi.subscribe(forum.fingerprint)
      toast.success(`Subscribed to ${forum.name}`)
      onOpenChange?.(false)
    } catch (error) {
      console.error('Failed to subscribe:', error)
      toast.error('Failed to subscribe to forum')
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && (
        <ResponsiveDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Search className="size-4" />
            Search forums
          </Button>
        </ResponsiveDialogTrigger>
      )}
      <ResponsiveDialogContent className="flex max-h-[85vh] flex-col sm:max-w-[600px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Search forums</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Search for public forums to subscribe to
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex flex-col gap-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search forums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Results */}
          <ScrollArea className="flex-1 pr-4" style={{ maxHeight: '400px' }}>
            {isLoading && debouncedSearch && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground size-6 animate-spin" />
              </div>
            )}

            {isError && (
              <div className="text-muted-foreground py-8 text-center text-sm">
                Failed to search forums
              </div>
            )}

            {!isLoading && !isError && debouncedSearch && results.length === 0 && (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No forums found
              </div>
            )}

            {!debouncedSearch && (
              <div className="text-muted-foreground py-8 text-center text-sm">
                Start typing to search for forums
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((forum) => {
                  const isSubscribed = subscribedForumIds.has(
                    forum.fingerprint || forum.id
                  )

                  return (
                    <div
                      key={forum.fingerprint || forum.id}
                      className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Hash className="text-muted-foreground size-5" />
                        <div>
                          <div className="font-medium">{forum.name}</div>
                          {/* <div className="text-muted-foreground text-xs">
                            {forum.location || 'Unknown location'}
                          </div> */}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isSubscribed ? 'outline' : 'default'}
                        disabled={isSubscribed}
                        onClick={() => handleSubscribe(forum)}
                      >
                        {isSubscribed ? 'Subscribed' : 'Subscribe'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
