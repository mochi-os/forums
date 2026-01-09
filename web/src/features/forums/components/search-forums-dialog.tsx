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
  cn,
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
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      shouldCloseOnInteractOutside={false}
    >
      {!hideTrigger && (
        <ResponsiveDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Search className="size-4" />
            Search forums
          </Button>
        </ResponsiveDialogTrigger>
      )}
      <ResponsiveDialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[600px] overflow-hidden border-none shadow-2xl">
        <ResponsiveDialogHeader className="border-b px-4 py-4 bg-muted/30">
          <ResponsiveDialogTitle className="text-xl font-semibold tracking-tight">
            Search forums
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs">
            Search for public forums to subscribe to
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="p-4 border-b bg-background">
          {/* Search Input */}
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search forums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 pr-4 bg-muted/10 h-[400px] overflow-y-scroll">
          {isLoading && debouncedSearch && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="text-primary size-8 animate-spin" />
              <p className="text-sm text-muted-foreground">Searching...</p>
            </div>
          )}

          {isError && (
             <div className="h-full flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
               <p className="text-sm font-medium">Failed to search forums</p>
             </div>
          )}

          {!isLoading && !isError && debouncedSearch && results.length === 0 && (
            <div className="py-12 text-center">
              <div className="bg-muted/50 rounded-full p-4 w-fit mx-auto mb-3">
                <Hash className="text-muted-foreground size-8" />
              </div>
              <h3 className="font-semibold text-sm">No forums found</h3>
            </div>
          )}

          {!debouncedSearch && (
            <div className="h-full flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Search className="size-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Start typing to search</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="p-2 space-y-1">
              {results.map((forum: any) => {
                const isSubscribed = subscribedForumIds.has(
                  forum.fingerprint || forum.id
                )

                return (
                  <div
                    key={forum.fingerprint || forum.id}
                    className="group flex items-center justify-between p-3 rounded-lg hover:bg-background hover:shadow-sm border border-transparent hover:border-border transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex items-center justify-center size-10 rounded-full bg-blue-500/10 text-blue-600 shrink-0">
                        <Hash className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-sm leading-none mb-1">{forum.name}</div>
                        {/* <div className="text-muted-foreground text-xs truncate opacity-80">
                          {forum.location || 'Public Forum'}
                        </div> */}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isSubscribed ? 'outline' : 'secondary'}
                      disabled={isSubscribed}
                      onClick={() => handleSubscribe(forum)}
                      className={cn(
                        "h-8 px-4 rounded-full transition-all",
                        isSubscribed ? "opacity-50" : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      {isSubscribed ? 'Subscribed' : 'Subscribe'}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
