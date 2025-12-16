import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Main,
  cn,
  Badge,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  AvatarFallback,
  Input,
  Button,
  ScrollArea,
} from '@mochi/common'
import { forumsApi } from '@/api/forums'
import {
  MessageSquare,
  Users,
  ChevronRight,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Search,
  Hash,
  Clock,
  Rss,
  FileEdit,
} from 'lucide-react'
import { CreateForumDialog } from './components/create-forum-dialog'
import type { Forum } from '@/api/types/forums'

interface Post {
  id: string
  forum: string
  member: string
  name: string
  title: string
  body: string
  comments: number
  up: number
  down: number
  created: number
  updated: number
  created_local: string
  attachments?: unknown[]
}

// ============================================================================
// ForumListItem Component (matching FeedListItem style)
// ============================================================================

interface ForumListItemProps {
  forum: Forum
  isActive: boolean
  postCount: number
  onSelect: (forumId: string) => void
}

function ForumListItem({ forum, isActive, postCount, onSelect }: ForumListItemProps) {
  const handleActivate = () => onSelect(forum.id)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleActivate()
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className={cn(
        'group w-full overflow-hidden rounded-xl border p-3 text-start transition-all duration-200',
        'hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm',
        isActive && 'border-primary bg-primary/5 shadow-sm'
      )}
    >
      {/* Header Row: Icon + Name + Owner Badge */}
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            'shrink-0 rounded-lg bg-primary/10 p-1.5 transition-colors',
            'group-hover:bg-primary/20'
          )}
        >
          <Hash className="size-3.5 text-primary" />
        </div>

        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {forum.name}
        </span>

        {forum.role === '' && (
          <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">
            Owner
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {postCount} posts in this forum
      </p>

      {/* Footer Row: Stats */}
      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex shrink-0 items-center gap-1">
            <Users className="size-3" />
            <span className="font-medium">{forum.members}</span>
            <span>members</span>
          </span>

          <span className="flex min-w-0 items-center gap-1">
            <Clock className="size-3 shrink-0" />
            <span className="truncate">{formatDate(forum.updated)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ForumDirectory Component (matching FeedDirectory style)
// ============================================================================

interface ForumDirectoryProps {
  forums: Forum[]
  posts: Post[]
  searchTerm: string
  onSearchTermChange: (value: string) => void
  selectedForumId: string | null
  onSelectForum: (forumId: string | null) => void
}

function ForumDirectory({
  forums,
  posts,
  searchTerm,
  onSearchTermChange,
  selectedForumId,
  onSelectForum,
}: ForumDirectoryProps) {
  const getPostCount = (forumId: string) => posts.filter((p) => p.forum === forumId).length

  const filteredForums = searchTerm.trim()
    ? forums.filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : forums

  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden shadow-md">
      <CardHeader className="shrink-0 space-y-3 border-b pb-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Forums directory</p>
          <p className="text-xs text-muted-foreground">
            Search, subscribe, or jump into any forum.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search forums or tags"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="space-y-2 p-3">
            {/* All Forums option */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectForum(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectForum(null)
                }
              }}
              className={cn(
                'group w-full overflow-hidden rounded-xl border p-3 text-start transition-all duration-200',
                'hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm',
                selectedForumId === null && 'border-primary bg-primary/5 shadow-sm'
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    'shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 p-1.5'
                  )}
                >
                  <Rss className="size-3.5 text-white" />
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  All Forums
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px] font-medium">
                  {posts.length} posts
                </Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                View posts from all your subscribed forums
              </p>
            </div>

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

// ============================================================================
// PostCard Component
// ============================================================================

interface PostCardProps {
  post: Post
  forumName: string
  showForumBadge: boolean
  onSelect: (postId: string) => void
}

function PostCard({ post, forumName, showForumBadge, onSelect }: PostCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
      onClick={() => onSelect(post.id)}
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-3">
          {/* Forum tag (only show when viewing all forums) */}
          {showForumBadge && (
            <Badge variant="secondary" className="w-fit text-xs">
              <Hash className="h-3 w-3 mr-1" />
              {forumName}
            </Badge>
          )}

          {/* Title */}
          <h3 className="text-lg font-semibold leading-tight hover:text-primary transition-colors">
            {post.title}
          </h3>

          {/* Body excerpt */}
          <p className="text-sm text-muted-foreground line-clamp-2">{post.body}</p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {post.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{post.name}</p>
                <p className="text-xs text-muted-foreground">{post.created_local}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                <span>{post.comments}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-4 w-4" />
                <span>{post.up}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsDown className="h-4 w-4" />
                <span>{post.down}</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// ForumOverview Component (matching FeedOverview style)
// ============================================================================

interface ForumOverviewProps {
  forum: Forum | null
  posts: Post[]
  onSelectPost: (postId: string) => void
  onNewPost: () => void
}

function ForumOverview({ forum, posts, onSelectPost, onNewPost }: ForumOverviewProps) {
  const getForumName = (forumId: string) => forum?.id === forumId ? forum.name : 'Unknown'

  if (!forum) {
    // All forums view
    return (
      <div className="space-y-6">
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              forumName={getForumName(post.forum)}
              showForumBadge={true}
              onSelect={onSelectPost}
            />
          ))
        ) : (
          <Card className="shadow-md">
            <CardContent className="flex flex-col items-center justify-center space-y-3 p-12 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <MessageSquare className="size-10 text-primary" />
              </div>
              <p className="text-sm font-semibold">No posts yet</p>
              <p className="text-sm text-muted-foreground">
                Subscribe to forums or create your own to see posts
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Selected forum view with header
  return (
    <div className="space-y-6">
      {/* Forum Header Card */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {forum.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{forum.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Owned by <span className="font-medium">You</span> · Last active{' '}
                  {new Date(forum.updated * 1000).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {forum.members} subscribers
              </Badge>
              {forum.role === '' && (
                <Badge variant="secondary" className="text-xs">
                  Owner
                </Badge>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total posts</p>
                <p className="text-2xl font-bold">{posts.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Active members</p>
                <p className="text-2xl font-bold">{forum.members}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Comments</p>
                <p className="text-2xl font-bold">
                  {posts.reduce((acc, p) => acc + p.comments, 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total votes</p>
                <p className="text-2xl font-bold">
                  {posts.reduce((acc, p) => acc + p.up + p.down, 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Posts */}
      {posts.length > 0 ? (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            forumName={forum.name}
            showForumBadge={false}
            onSelect={onSelectPost}
          />
        ))
      ) : (
        <Card className="shadow-md">
          <CardContent className="flex flex-col items-center justify-center space-y-3 p-12 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <FileEdit className="size-10 text-primary" />
            </div>
            <p className="text-sm font-semibold">No posts in this forum yet</p>
            <p className="text-sm text-muted-foreground">
              Be the first to start a conversation
            </p>
            <Button onClick={onNewPost} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Create First Post
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// Main Forums Component
// ============================================================================

export function Forums() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedForumId, setSelectedForumId] = useState<string | null>(null)

  // Fetch list of forums (also includes posts)
  const { data: forumsData, isLoading } = useQuery({
    queryKey: ['forums', 'list'],
    queryFn: () => forumsApi.list(),
  })

  const forums: Forum[] = forumsData?.data?.forums || []
  const allPosts: Post[] = forumsData?.data?.posts || []

  // Create forum mutation
  const createForumMutation = useMutation({
    mutationFn: (name: string) => forumsApi.create({ name }),
    onSuccess: () => {
      toast.success('Forum created successfully!')
      queryClient.invalidateQueries({ queryKey: ['forums', 'list'] })
    },
    onError: () => {
      toast.error('Failed to create forum')
    },
  })

  const handleCreateForum = (input: {
    name: string
    memberAccess: string
    allowSearch: boolean
  }) => {
    if (!input.name.trim()) {
      toast.error('Please enter a forum name')
      return
    }
    createForumMutation.mutate(input.name)
  }

  const handlePostSelect = (postId: string) => {
    navigate({ to: `/thread/${postId}` })
  }

  const handleNewPost = () => {
    if (selectedForumId) {
      navigate({ to: `/new-thread?forum=${selectedForumId}` })
    }
  }

  // Derived state
  const selectedForum = useMemo(
    () => forums.find((f) => f.id === selectedForumId) ?? null,
    [forums, selectedForumId]
  )

  const filteredPosts = useMemo(() => {
    if (!selectedForumId) return allPosts
    return allPosts.filter((p) => p.forum === selectedForumId)
  }, [allPosts, selectedForumId])

  // For "All Forums" view, we need forum names
  const getForumName = (forumId: string) => {
    const forum = forums.find((f) => f.id === forumId)
    return forum?.name || 'Unknown Forum'
  }

  return (
    <Main className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Forums</h1>
          <p className="text-sm text-muted-foreground">
            Share progress, ask for help, and learn from the community
          </p>
          {isLoading && (
            <p className="text-xs text-muted-foreground">Syncing forums...</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedForumId && selectedForum?.role === '' && (
            <Button variant="outline" size="sm" onClick={handleNewPost}>
              <FileEdit className="h-4 w-4 mr-2" />
              New post
            </Button>
          )}
          <CreateForumDialog onCreate={handleCreateForum} />
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* Forum Directory Sidebar */}
        <div className="h-[calc(100vh-12rem)] lg:sticky lg:top-4">
          <ForumDirectory
            forums={forums}
            posts={allPosts}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            selectedForumId={selectedForumId}
            onSelectForum={setSelectedForumId}
          />
        </div>

        {/* Content Area */}
        <section className="min-w-0 space-y-6">
          {selectedForum || selectedForumId === null ? (
            <ForumOverview
              forum={selectedForum}
              posts={selectedForumId === null ? allPosts.map(p => ({ ...p, forumName: getForumName(p.forum) })) : filteredPosts}
              onSelectPost={handlePostSelect}
              onNewPost={handleNewPost}
            />
          ) : (
            <Card className="shadow-md">
              <CardContent className="flex flex-col items-center justify-center space-y-3 p-12 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Hash className="size-10 text-primary" />
                </div>
                <p className="text-sm font-semibold">Select a forum</p>
                <p className="text-sm text-muted-foreground">
                  Choose a forum from the directory to view its posts
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </Main>
  )
}
