import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BellPlus,
  Share2,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  cn,
  Search,
  NotificationsDropdown,
  Button,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Textarea,
  Header,
  Main,
} from '@mochi/common'
import { forumsApi } from '@/api/forums'
import { threadStatusStyles } from './status'

export function ThreadDetail() {
  const navigate = useNavigate()
  const { threadId } = useParams({ strict: false }) as { threadId: string }
  const queryClient = useQueryClient()
  const [commentBody, setCommentBody] = useState('')

  // Note: We need the forumId to view the post. For now, we'll get it from route params
  // This may need refactoring if forumId isn't available in route
  const { forumId = '' } = useParams({ strict: false }) as { forumId?: string; threadId: string }

  // Fetch post data
  const { data: postData, isLoading } = useQuery({
    queryKey: ['forums', 'post', forumId, threadId],
    queryFn: () => forumsApi.viewPost({ forum: forumId, post: threadId }),
    enabled: !!forumId && !!threadId,
  })

  // Vote on post mutation
  const votePostMutation = useMutation({
    mutationFn: (vote: 'up' | 'down') =>
      forumsApi.votePost({ forum: postData!.data.forum.id, post: threadId, vote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'post', forumId, threadId] })
      toast.success('Vote recorded')
    },
    onError: () => {
      toast.error('Failed to vote on post')
    },
  })

  // Vote on comment mutation
  const voteCommentMutation = useMutation({
    mutationFn: ({ commentId, vote }: { commentId: string; vote: 'up' | 'down' }) =>
      forumsApi.voteComment({ 
        forum: postData!.data.forum.id, 
        post: threadId, 
        comment: commentId, 
        vote 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'post', forumId, threadId] })
      toast.success('Vote recorded')
    },
    onError: () => {
      toast.error('Failed to vote on comment')
    },
  })

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (body: string) =>
      forumsApi.createComment({
        forum: postData!.data.forum.id,
        post: threadId,
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'post', forumId, threadId] })
      setCommentBody('')
      toast.success('Comment posted')
    },
    onError: () => {
      toast.error('Failed to post comment')
    },
  })

  const handleCommentSubmit = () => {
    if (!commentBody.trim()) {
      toast.error('Please enter a comment')
      return
    }
    createCommentMutation.mutate(commentBody)
  }

  if (isLoading) {
    return (
      <>
        <Header>
          <Search />
          <div className='ms-auto flex items-center space-x-4'>
            <NotificationsDropdown />
          </div>
        </Header>
        <Main>
          <div className='text-center py-12 text-muted-foreground'>
            Loading post...
          </div>
        </Main>
      </>
    )
  }

  if (!postData) {
    return (
      <>
        <Header>
          <Search />
          <div className='ms-auto flex items-center space-x-4'>
            <NotificationsDropdown />
          </div>
        </Header>
        <Main>
          <Button
            variant='ghost'
            className='mb-6 h-auto px-0 text-muted-foreground hover:text-foreground'
            onClick={() =>
              navigate({
                to: '/',
              })
            }
          >
            <ArrowLeft className='mr-2 size-4' />
            Back to threads
          </Button>
          <EmptyThreadState
            onBack={() =>
              navigate({
                to: '/',
              })
            }
          />
        </Main>
      </>
    )
  }

  const { post, comments } = postData.data
  const status = threadStatusStyles['open'] // API doesn't provide status, default to open
  const StatusIcon = status.icon
  const commentCount = comments.length

  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <NotificationsDropdown />
        </div>
      </Header>

      <Main>
        <Button
          variant='ghost'
          className='mb-6 h-auto px-0 text-muted-foreground hover:text-foreground'
          onClick={() =>
            navigate({
              to: '/',
            })
          }
        >
          <ArrowLeft className='mr-2 size-4' />
          Back to threads
        </Button>

        <div className='grid gap-6'>
          <div className='space-y-6'>
            <Card>
              <CardHeader className='gap-4 border-b border-border/40 pb-4'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge
                    variant='outline'
                    className={cn(
                      'border px-2 py-1 text-[11px]',
                      status.className
                    )}
                  >
                    <StatusIcon className='mr-1 size-3' />
                    {status.label}
                  </Badge>
                </div>
                <div className='flex flex-col gap-2'>
                  <CardTitle className='text-2xl'>{post.title}</CardTitle>
                  <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                    <span>
                      Posted&nbsp;
                      <span className='font-semibold text-foreground'>{post.created_local}</span>
                    </span>
                    <span>•</span>
                    <span>
                      Author&nbsp;
                      <span className='font-semibold text-foreground'>
                        {post.name}
                      </span>
                    </span>
                  </div>
                </div>
                <div className='flex flex-wrap items-center gap-3 text-sm text-muted-foreground'>
                  <div className='flex items-center gap-2'>
                    <Avatar className='size-10'>
                      <AvatarImage src='' alt={post.name} />
                      <AvatarFallback>
                        {post.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className='font-semibold text-foreground'>
                        {post.name}
                      </p>
                      <p>Member</p>
                    </div>
                  </div>
                </div>
                <div className='flex flex-wrap gap-3 items-center'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => votePostMutation.mutate('up')}
                    disabled={votePostMutation.isPending}
                  >
                    <ThumbsUp className='mr-1 size-4' />
                    {post.up}
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => votePostMutation.mutate('down')}
                    disabled={votePostMutation.isPending}
                  >
                    <ThumbsDown className='mr-1 size-4' />
                    {post.down}
                  </Button>
                  <Button variant='secondary' size='sm'>
                    <BellPlus className='mr-2 size-4' />
                    Follow thread
                  </Button>
                  <Button variant='ghost' size='sm' className='text-muted-foreground'>
                    <Share2 className='mr-2 size-4' />
                    Share
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-xl'>
                  Discussion ({commentCount})
                </CardTitle>
                <CardDescription>
                  {commentCount > 0
                    ? 'Latest replies from the community'
                    : 'No replies yet — start the thread!'}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-5'>
                {comments.map((comment) => (
                  <ThreadComment
                    key={comment.id}
                    comment={comment}
                    isOwner={comment.member === post.member}
                    onVote={(vote: 'up' | 'down') => voteCommentMutation.mutate({ commentId: comment.id, vote })}
                  />
                ))}
              </CardContent>
            </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Leave a reply</CardTitle>
                 <CardDescription>
                   Share tips, provide resources, or log your own observation.
                 </CardDescription>
               </CardHeader>
               <CardContent className='space-y-4'>
                 <Textarea
                   placeholder='Add to the conversation...'
                   className='min-h-[160px]'
                   value={commentBody}
                   onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommentBody(e.target.value)}
                 />
                 <div className='flex justify-end gap-3'>
                   <Button 
                     size='sm'
                     onClick={handleCommentSubmit}
                     disabled={createCommentMutation.isPending || !commentBody.trim()}
                   >
                     {createCommentMutation.isPending ? 'Posting...' : 'Post reply'}
                   </Button>
                 </div>
               </CardContent>
             </Card>
          </div>
        </div>
      </Main>
    </>
  )
}

// function ThreadStat({
//   icon: Icon,
//   label,
//   value,
// }: {
//   icon: ComponentType<{ className?: string }>
//   label: string
//   value: string
// }) {
//   return (
//     <div className='flex items-center justify-between rounded-lg border border-border/40 px-3 py-2'>
//       <div className='flex items-center gap-3 text-sm'>
//         <Icon className='size-4 text-muted-foreground' />
//         <span>{label}</span>
//       </div>
//       <span className='text-sm font-semibold'>{value}</span>
//     </div>
//   )
// }

function ThreadComment({
  comment,
  isOwner,
  onVote,
}: {
  comment: {
    id: string
    name: string
    body: string
    up: number
    down: number
    created_local: string
  }
  isOwner: boolean
  onVote: (vote: 'up' | 'down') => void
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card/80 p-4'
      )}
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <Avatar className='size-10'>
            <AvatarImage src='' alt={comment.name} />
            <AvatarFallback>
              {comment.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className='text-sm font-semibold text-foreground'>
              {comment.name}
            </p>
            <p className='text-xs text-muted-foreground'>
              Member
            </p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          {isOwner && <Badge variant='secondary'>Original poster</Badge>}
          <span>{comment.created_local}</span>
        </div>
      </div>
      <p className='mt-4 text-sm leading-6 text-muted-foreground'>
        {comment.body}
      </p>
      <div className='mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground'>
        <Button 
          variant='link' 
          size='sm' 
          className='h-auto px-0 text-primary'
          onClick={() => onVote('up')}
        >
          <ThumbsUp className='mr-1 size-3' />
          {comment.up}
        </Button>
        <Button 
          variant='link' 
          size='sm' 
          className='h-auto px-0 text-primary'
          onClick={() => onVote('down')}
        >
          <ThumbsDown className='mr-1 size-3' />
          {comment.down}
        </Button>
      </div>
    </div>
  )
}

function EmptyThreadState({ onBack }: { onBack: () => void }) {
  return (
    <div className='flex h-full flex-col items-center justify-center space-y-4 p-8 text-center'>
      <p className='text-lg font-semibold'>Thread not found</p>
      <p className='max-w-md text-sm text-muted-foreground'>
        The link you followed may be broken, or the thread may have been removed.
      </p>
      <Button onClick={onBack}>Back to threads</Button>
    </div>
  )
}
