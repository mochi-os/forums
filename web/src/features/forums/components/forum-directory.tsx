import * as React from 'react'
import {
  Card,
  CardContent,
  ScrollArea,
  Button,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from '@mochi/common'
import { Loader2, UserPlus, Search, X } from 'lucide-react'
import type { Forum, DirectoryEntry, Post } from '@/api/types/forums'
import { ForumListItem } from './forum-list-item'

interface ForumDirectoryProps {
  forums: Forum[]
  posts: Post[]
  searchTerm: string
  onSearchChange: (value: string) => void
  isSearching: boolean
  selectedForumId: string | null
  onSelectForum: (forumId: string | null) => void
  searchResults: DirectoryEntry[]
  onSubscribe: (forumId: string) => void
  isSubscribing: boolean
  subscribingForumId: string | null
}

export function ForumDirectory({
  forums,
  posts,
  searchTerm,
  onSearchChange,
  isSearching,
  selectedForumId,
  onSelectForum,
  searchResults,
  onSubscribe,
  isSubscribing,
  subscribingForumId,
}: ForumDirectoryProps) {
  const getPostCount = (forumId: string) =>
    posts.filter((p) => p.forum === forumId).length

  // Check if a search result is already subscribed
  const isSubscribed = (forumId: string) => forums.some((f) => f.id === forumId)

  // Filter subscribed forums by search term (local filter)
  const filteredForums = searchTerm.trim()
    ? forums.filter((f) =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : forums

  // Filter for Owned/managed forums (local filter only)
  const ownedForums = React.useMemo(() => {
    const owned = forums.filter((f) => f.can_manage)
    if (searchTerm.trim()) {
      return owned.filter((f) =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    return owned
  }, [forums, searchTerm])

  // Memoize the set of owned forum IDs to prevent UI loops
  const ownedForumIds = React.useMemo(() => {
    return new Set(forums.filter((f) => f.can_manage).map((f) => f.id))
  }, [forums])

  const isOwnedForum = React.useCallback(
    (id: string | null) => {
      if (!id) return false
      return ownedForumIds.has(id)
    },
    [ownedForumIds]
  )

  // State for the active tab
  const [tabValue, setTabValue] = React.useState('all')

  // Effect to switch to 'all' tab if a non-owned forum is selected (as it's not visible in 'my')
  React.useEffect(() => {
    if (selectedForumId && !isOwnedForum(selectedForumId)) {
      setTabValue('all')
    }
  }, [selectedForumId, isOwnedForum])

  // Check if we're actively searching
  const isActiveSearch = searchTerm.trim().length > 0

  // Filter search results to only show those not already subscribed
  const unsubscribedSearchResults = searchResults.filter(
    (r) => !isSubscribed(r.id)
  )

  // Combined list for "All Forums" tab: subscribed forums + unsubscribed search results
  const allForumsCount =
    filteredForums.length +
    (isActiveSearch ? unsubscribedSearchResults.length : 0)

  return (
    <Card className='flex h-full min-w-0 flex-col overflow-hidden shadow-md'>
      {/* Search Bar Only */}
      <div className='flex-none p-3'>
        <label
          className={cn(
            'focus-within:ring-ring focus-within:ring-1 focus-within:outline-hidden',
            'border-border bg-muted/40 flex h-10 w-full items-center rounded-md border ps-3'
          )}
        >
          <Search size={15} className='me-2 stroke-slate-500' />
          <span className='sr-only'>Search forums</span>
          <input
            type='text'
            className='w-full flex-1 bg-inherit text-sm focus-visible:outline-hidden'
            placeholder='Search forums...'
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className='text-muted-foreground hover:text-foreground px-3'
            >
              <X className='size-4' />
            </button>
          )}
          {isSearching && (
            <Loader2 className='text-muted-foreground mx-2 size-4 animate-spin' />
          )}
        </label>
      </div>

      <CardContent className='min-h-0 flex-1 overflow-hidden p-0'>
        <ScrollArea className='h-full'>
          <div className='space-y-1 p-3 pt-0'>
            {/* Tabs for All vs My Forums */}
            <Tabs
              value={tabValue}
              onValueChange={(v) => {
                setTabValue(v)
                if (v === 'my') {
                  if (selectedForumId && !isOwnedForum(selectedForumId)) {
                    const firstOwned = ownedForums[0]
                    if (firstOwned) {
                      onSelectForum(firstOwned.id)
                    } else {
                      onSelectForum(null)
                    }
                  } else if (!selectedForumId && ownedForums.length > 0) {
                    onSelectForum(ownedForums[0].id)
                  }
                }
              }}
              className='w-full'
            >
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='all' className='gap-1.5 text-xs'>
                  <span>All Forums</span>
                  <Badge
                    variant='secondary'
                    className='px-1.5 py-0 text-[10px]'
                  >
                    {allForumsCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value='my' className='gap-1.5 text-xs'>
                  <span>My Forums</span>
                  <Badge
                    variant='secondary'
                    className='px-1.5 py-0 text-[10px]'
                  >
                    {ownedForums.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* All Forums Tab: Subscribed forums + Global search results */}
              <TabsContent value='all' className='mt-2 space-y-1'>
                {/* Show subscribed forums that match search */}
                {filteredForums.map((forum) => (
                  <ForumListItem
                    key={forum.id}
                    forum={forum}
                    isActive={selectedForumId === forum.id}
                    postCount={getPostCount(forum.id)}
                    onSelect={onSelectForum}
                  />
                ))}

                {/* Show discoverable (unsubscribed) search results */}
                {isActiveSearch &&
                  unsubscribedSearchResults.map((result) => (
                    <div
                      key={result.id}
                      className='group hover:bg-accent/50 flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors'
                    >
                      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
                        {result.name}
                      </span>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='h-7 shrink-0 gap-1 text-xs'
                        onClick={() => onSubscribe(result.id)}
                        disabled={
                          isSubscribing && subscribingForumId === result.id
                        }
                      >
                        {isSubscribing && subscribingForumId === result.id ? (
                          <Loader2 className='size-3 animate-spin' />
                        ) : (
                          <UserPlus className='size-3' />
                        )}
                        Subscribe
                      </Button>
                    </div>
                  ))}

                {/* Empty state */}
                {filteredForums.length === 0 &&
                  (!isActiveSearch ||
                    unsubscribedSearchResults.length === 0) && (
                    <div className='text-muted-foreground flex flex-col items-center justify-center space-y-2 rounded-lg border border-dashed p-6 text-center text-sm'>
                      <p>
                        {isActiveSearch ? 'No forums found' : 'No forums found'}
                      </p>
                      <p className='text-xs'>
                        {isActiveSearch
                          ? 'Try a different search term'
                          : 'Join some forums to see them here'}
                      </p>
                    </div>
                  )}
              </TabsContent>

              {/* My Forums Tab: Only owned forums, local filter */}
              <TabsContent value='my' className='mt-2 space-y-1'>
                {ownedForums.length > 0 ? (
                  ownedForums.map((forum) => (
                    <ForumListItem
                      key={forum.id}
                      forum={forum}
                      isActive={selectedForumId === forum.id}
                      postCount={getPostCount(forum.id)}
                      onSelect={onSelectForum}
                    />
                  ))
                ) : (
                  <div className='text-muted-foreground flex flex-col items-center justify-center space-y-2 rounded-lg border border-dashed p-6 text-center text-sm'>
                    <p>
                      {isActiveSearch
                        ? 'No matching forums'
                        : 'No owned forums'}
                    </p>
                    <p className='text-xs'>
                      {isActiveSearch
                        ? 'Try a different search term'
                        : 'Create a forum to see it here'}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
