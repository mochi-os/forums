import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Main,
  cn,
  Badge,
  Card,
  CardContent,
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
  const posts: Post[] = forumsData?.data?.posts || []

  // Create forum mutation
  const createForumMutation = useMutation({
    mutationFn: (name: string) => forumsApi.create({ name }),
    onSuccess: () => {
      toast.success('Forum created successfully!')
      queryClient.invalidateQueries({ queryKey: ['forums', 'list'] })
    },
    onError: (error) => {
      toast.error('Failed to create forum')
      console.error('Create forum error:', error)
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
    navigate({
      to: `/thread/${postId}`,
    })
  }

  const handleForumSelect = (forumId: string | null) => {
    setSelectedForumId(forumId)
  }

  // Get forum name by id
  const getForumName = (forumId: string): string => {
    const forum = forums.find((f) => f.id === forumId)
    return forum?.name || 'Unknown Forum'
  }

  // Filter posts based on selected forum and search term
  const filteredPosts = posts.filter((post) => {
    const matchesForum = !selectedForumId || post.forum === selectedForumId
    const matchesSearch =
      !searchTerm.trim() ||
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.body.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesForum && matchesSearch
  })

  // Calculate post count per forum
  const getPostCount = (forumId: string): number => {
    return posts.filter((p) => p.forum === forumId).length
  }

  return (
    <Main>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Forums</h1>
            <p className="text-muted-foreground">
              Share progress, ask for help, and learn from the community
            </p>
          </div>
          <CreateForumDialog onCreate={handleCreateForum} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Forums Sidebar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                My Forums
              </h2>
              <Badge variant="secondary" className="text-xs">
                {forums.length}
              </Badge>
            </div>

            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-2 pr-4">
                {/* All Forums option */}
                <button
                  onClick={() => handleForumSelect(null)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    selectedForumId === null
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-purple-500">
                    <Hash className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">All Forums</p>
                    <p
                      className={cn(
                        'text-xs',
                        selectedForumId === null
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      )}
                    >
                      {posts.length} posts
                    </p>
                  </div>
                </button>

                {/* Individual forums */}
                {forums.map((forum) => (
                  <button
                    key={forum.id}
                    onClick={() => handleForumSelect(forum.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                      selectedForumId === forum.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs">
                        {forum.name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{forum.name}</p>
                      <div
                        className={cn(
                          'flex items-center gap-2 text-xs',
                          selectedForumId === forum.id
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        )}
                      >
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {forum.members}
                        </span>
                        <span>•</span>
                        <span>{getPostCount(forum.id)} posts</span>
                      </div>
                    </div>
                    {forum.role === '' && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0.5"
                      >
                        Owner
                      </Badge>
                    )}
                  </button>
                ))}

                {forums.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No forums yet</p>
                    <p className="text-xs">Create one to get started</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Posts List */}
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {selectedForumId && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() =>
                    navigate({ to: `/new-thread?forum=${selectedForumId}` })
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Post
                </Button>
              )}
            </div>

            {/* Selected forum header */}
            {selectedForumId && (
              <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getForumName(selectedForumId)
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">
                          {getForumName(selectedForumId)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {getPostCount(selectedForumId)} posts •{' '}
                          {
                            forums.find((f) => f.id === selectedForumId)
                              ?.members
                          }{' '}
                          members
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Posts */}
            <div className="space-y-4">
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => (
                  <Card
                    key={post.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                    onClick={() => handlePostSelect(post.id)}
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-3">
                        {/* Forum tag (only show when viewing all forums) */}
                        {!selectedForumId && (
                          <Badge variant="secondary" className="w-fit text-xs">
                            <Hash className="h-3 w-3 mr-1" />
                            {getForumName(post.forum)}
                          </Badge>
                        )}

                        {/* Title */}
                        <h3 className="text-lg font-semibold leading-tight hover:text-primary transition-colors">
                          {post.title}
                        </h3>

                        {/* Body excerpt */}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {post.body}
                        </p>

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
                              <p className="text-xs text-muted-foreground">
                                {post.created_local}
                              </p>
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
                ))
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-2">No posts yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {selectedForumId
                        ? 'Be the first to start a conversation in this forum'
                        : 'Subscribe to forums or create your own to see posts'}
                    </p>
                    {selectedForumId && (
                      <Button
                        onClick={() =>
                          navigate({
                            to: `/new-thread?forum=${selectedForumId}`,
                          })
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Post
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </Main>
  )
}
