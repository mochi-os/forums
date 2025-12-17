import {
  Card,
  CardContent,
  ScrollArea,
  Button,
  Badge,
  cn,
} from '@mochi/common'
import {
  Globe,
  Hash,
  Loader2,
  UserPlus,
  Rss,
  Users,
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

            {/* All Forums option */}
            <button
              onClick={() => onSelectForum(null)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-all duration-200',
                'hover:border-primary/50 hover:bg-accent/50',
                selectedForumId === null 
                  ? 'border-primary bg-primary/5 text-foreground shadow-sm' 
                  : 'bg-card'
              )}
            >
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors',
                   selectedForumId === null ? 'bg-primary/10 text-primary' : 'bg-primary/10 text-primary group-hover:bg-primary/20'
                )}
              >
                <Rss className="size-3.5" />
              </div>
              <span className="flex-1 truncate text-sm font-semibold">All Forums</span>
              <Badge variant="secondary" className="ml-auto text-[10px] font-medium">
                {posts.length} posts
              </Badge>
            </button>

            {/* My Forums Header */}
            {forums.length > 0 && (
              <div className="flex items-center gap-2 px-1 pt-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  My forums ({filteredForums.length})
                </span>
              </div>
            )}

            {/* Individual forums */}
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
                <p className="text-xs">Create one or search for existing forums</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
