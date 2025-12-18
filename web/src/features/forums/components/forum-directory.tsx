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
} from '@mochi/common'
import * as React from 'react'
import {
  Globe,
  Hash,
  Loader2,
  UserPlus,
} from 'lucide-react'
import type { Forum, DirectoryEntry, Post } from '@/api/types/forums'
import { ForumListItem } from './forum-list-item'

interface ForumDirectoryProps {
  forums: Forum[]
  posts: Post[]
  searchTerm: string
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
  selectedForumId,
  onSelectForum,
  searchResults,
  onSubscribe,
  isSubscribing,
  subscribingForumId,
}: ForumDirectoryProps) {
  const getPostCount = (forumId: string) => posts.filter((p) => p.forum === forumId).length

  // Check if a search result is already subscribed
  const isSubscribed = (forumId: string) => forums.some((f) => f.id === forumId)

  const filteredForums = searchTerm.trim()
    ? forums.filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : forums

  // Filter for Owned forums
  const ownedForums = filteredForums.filter(f => f.role === '' || f.role === 'administrator')

  const isOwnedForum = (id: string | null) => {
    if (!id) return false
    const forum = forums.find(f => f.id === id)
    return forum ? (forum.role === '' || forum.role === 'administrator') : false
  }

  // State for the active tab
  const [tabValue, setTabValue] = React.useState('all')

  // Effect to switch to 'all' tab if a non-owned forum is selected (as it's not visible in 'my')
  React.useEffect(() => {
    if (selectedForumId && !isOwnedForum(selectedForumId)) {
      setTabValue('all')
    }
  }, [selectedForumId, forums]) // Dependency on forums to ensure isOwnedForum check is accurate

  // Show search results when searching and results exist
  const showSearchResults = searchTerm.trim().length > 0 && searchResults.length > 0

  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden shadow-md">
      <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="space-y-2 p-3">
            {/* Search Results Section */}
            {showSearchResults && (
              <>
                <div className="flex items-center gap-2 px-1 pb-2">
                  <Globe className="size-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Global search results ({searchResults.length})
                  </span>
                </div>
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="group w-full overflow-hidden rounded-xl border p-3 transition-all duration-200 hover:border-primary/50 hover:bg-accent/50"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="shrink-0 rounded-lg bg-primary/10 p-1.5">
                          <Hash className="size-3.5 text-primary" />
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {result.name}
                        </span>
                      </div>
                      {isSubscribed(result.id) ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Subscribed
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 gap-1 text-xs"
                          onClick={() => onSubscribe(result.id)}
                          disabled={isSubscribing && subscribingForumId === result.id}
                        >
                          {isSubscribing && subscribingForumId === result.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <UserPlus className="size-3" />
                          )}
                          Subscribe
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ID: {result.fingerprint}
                    </p>
                  </div>
                ))}
                <div className="my-2 border-t border-border/50" />
              </>
            )}

            {/* Tabs for All vs My Forums */}
            <Tabs
              value={tabValue}
              onValueChange={(v) => {
                setTabValue(v)
                if (v === 'all') {
                   // When switching to All Forums, generally we might want to keep selection
                   // unless the user specifically implies they want the "All" view (Global).
                   // But since this is a tab list, usually maintaining state is better.
                } else {
                  // If switching to 'my' and current selection is not owned, select the first owned forum
                  // to prevent showing an empty details pane or invalid state
                  if (selectedForumId && !isOwnedForum(selectedForumId)) {
                    const firstOwned = ownedForums[0]
                    if (firstOwned) {
                      onSelectForum(firstOwned.id)
                    } else {
                      // If no owned forums, maybe deselect?
                      onSelectForum(null)
                    }
                  } else if (!selectedForumId && ownedForums.length > 0) {
                      // If nothing selected, select first owned
                      onSelectForum(ownedForums[0].id)
                  }
                }
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all" className="gap-2">
                  <span>All Forums</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {filteredForums.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="my" className="gap-2">
                  <span>My Forums</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {ownedForums.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-2 space-y-2">
                 {filteredForums.length > 0 ? (
                  filteredForums.map((forum) => (
                    <ForumListItem
                      key={forum.id}
                      forum={forum}
                      isActive={selectedForumId === forum.id}
                      postCount={getPostCount(forum.id)}
                      onSelect={onSelectForum}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <p>No forums found</p>
                    <p className="text-xs">Join some forums to see them here</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="my" className="mt-2 space-y-2">
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
                  <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <p>No owned forums</p>
                    <p className="text-xs">Create a forum to see it here</p>
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
