import {
  Card,
  CardContent,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
} from '@mochi/common'
import {
  MessageSquare,
  FileEdit,
  Loader2,
  UserMinus,
} from 'lucide-react'
import type { Forum, Post } from '@/api/types/forums'
import { getMemberCount } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { PostCard } from './post-card'
import { CreatePostDialog } from './create-post-dialog'
import { MembersDialog } from './members-dialog'

interface ForumOverviewProps {
  forum: Forum | null
  posts: Post[]
  onSelectPost: (forumId: string, postId: string) => void
  onCreatePost: (data: { forum: string; title: string; body: string; attachments?: File[] }) => void
  isCreatingPost?: boolean
  onUnsubscribe?: (forumId: string) => void
  isUnsubscribing?: boolean
}

export function ForumOverview({ 
  forum, 
  posts, 
  onSelectPost, 
  onCreatePost, 
  isCreatingPost = false, 
  onUnsubscribe, 
  isUnsubscribing = false 
}: ForumOverviewProps) {
  if (!forum) {
    // All forums view - use forumName from post object (set by parent)
    return (
      <div className="space-y-6">
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              forumName={post.forumName || 'Unknown'}
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
                  {forum.role === '' && (
                    <>
                      Owned by <span className="font-medium">You</span> ·{' '}
                    </>
                  )}
                  Last active{' '}
                  {new Date(forum.updated * 1000).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {getMemberCount(forum.members)} subscribers
              </Badge>
              {forum.role === '' ? (
                <Badge variant="secondary" className="text-xs">
                  Owner
                </Badge>
              ) : onUnsubscribe && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                  onClick={() => onUnsubscribe(forum.id)}
                  disabled={isUnsubscribing}
                >
                  {isUnsubscribing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <UserMinus className="size-3" />
                  )}
                  Unsubscribe
                </Button>
              )}
              {['', 'administrator'].includes(forum.role) && (
                <MembersDialog forumId={forum.id} forumName={forum.name} />
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-6 flex flex-wrap gap-4 border-t pt-6">
            <div className="flex flex-col gap-1 pr-6 border-r">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Posts</p>
                <p className="text-2xl font-bold tracking-tight">{posts.length}</p>
            </div>
            <div className="flex flex-col gap-1 pr-6 border-r">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Members</p>
                <p className="text-2xl font-bold tracking-tight">{getMemberCount(forum.members)}</p>
            </div>
            <div className="flex flex-col gap-1 pr-6 border-r">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comments</p>
                <p className="text-2xl font-bold tracking-tight">
                  {posts.reduce((acc, p) => acc + getCommentCount(p.comments), 0)}
                </p>
            </div>
            <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Votes</p>
                <p className="text-2xl font-bold tracking-tight">
                  {posts.reduce((acc, p) => acc + p.up + p.down, 0)}
                </p>
            </div>
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
              {['', 'administrator', 'poster'].includes(forum.role)
                ? 'Be the first to start a conversation'
                : 'Check back later for new content'}
            </p>
            {['', 'administrator', 'poster'].includes(forum.role) && (
              <div className="mt-2">
                <CreatePostDialog
                  forumId={forum.id}
                  forumName={forum.name}
                  onCreate={onCreatePost}
                  isPending={isCreatingPost}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
