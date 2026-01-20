import { Link } from '@tanstack/react-router'
import { Card, CardContent, LoadMoreTrigger } from '@mochi/common'
import { MessageSquare, FileEdit, Hash } from 'lucide-react'
import { type Forum, type Post } from '@/api/types/forums'
import { CreatePostDialog } from './create-post-dialog'
import { PostCard } from './post-card'

interface ForumOverviewProps {
  forum: Forum | null
  posts: Post[]
  server?: string
  onSelectPost: (forumId: string, postId: string) => void
  onCreatePost: (data: {
    forum: string
    title: string
    body: string
    attachments?: File[]
  }) => void
  isCreatingPost?: boolean
  isPostCreated?: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

export function ForumOverview({
  forum,
  posts,
  server,
  onSelectPost,
  onCreatePost,
  isCreatingPost = false,
  isPostCreated = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: ForumOverviewProps) {
  if (!forum) {
    // All forums view - group posts by forum
    const groupedPosts = posts.reduce(
      (acc, post) => {
        const forumId = post.forum
        if (!acc[forumId]) {
          acc[forumId] = {
            name: post.forumName || 'Unknown',
            posts: [],
          }
        }
        acc[forumId].posts.push(post)
        return acc
      },
      {} as Record<string, { name: string; posts: typeof posts }>
    )

    return (
      <div className='space-y-6'>
        {posts.length > 0 ? (
          Object.entries(groupedPosts).map(([forumId, group]) => (
            <Card key={forumId} className='group relative overflow-hidden'>
              <div className='text-muted-foreground flex items-center gap-2 px-4 text-sm'>
                <Link
                  to='/$forum'
                  params={{ forum: forumId }}
                  className='hover:text-foreground inline-flex items-center gap-1.5 transition-colors'
                >
                  <Hash className='size-3.5' />
                  <span className='font-medium'>{group.name}</span>
                </Link>
              </div>
              <div className='flex flex-col divide-y'>
                {group.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    forumName={group.name}
                    showForumBadge={false}
                    server={server}
                    onSelect={onSelectPost}
                    variant='list-item'
                  />
                ))}
              </div>
            </Card>
          ))
        ) : (
          <Card className='shadow-md'>
            <CardContent className='flex flex-col items-center justify-center space-y-3 p-12 text-center'>
              <div className='bg-primary/10 rounded-full p-4'>
                <MessageSquare className='text-primary size-10' />
              </div>
              <p className='text-sm font-semibold'>No posts yet</p>
              <p className='text-muted-foreground text-sm'>
                Subscribe to forums or create your own to see posts
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Selected forum view
  return (
    <div className='space-y-6'>
      {posts.length > 0 ? (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              forumName={forum.name}
              showForumBadge={false}
              server={server}
              onSelect={onSelectPost}
            />
          ))}
          {onLoadMore && (
            <LoadMoreTrigger
              hasMore={hasNextPage}
              isLoading={isFetchingNextPage}
              onLoadMore={onLoadMore}
            />
          )}
        </>
      ) : (
        <Card className='shadow-md'>
          <CardContent className='flex flex-col items-center justify-center space-y-3 p-12 text-center'>
            <div className='bg-primary/10 rounded-full p-4'>
              <FileEdit className='text-primary size-10' />
            </div>
            <p className='text-sm font-semibold'>No posts in this forum yet</p>
            {!forum.can_post && (
              <p className='text-muted-foreground text-sm'>
                Check back later for new content
              </p>
            )}
            {forum.can_post && (
              <div className='mt-2'>
                <CreatePostDialog
                  forumId={forum.id}
                  forumName={forum.name}
                  onCreate={onCreatePost}
                  isPending={isCreatingPost}
                  isSuccess={isPostCreated}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
