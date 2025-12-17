import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  Main,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@mochi/common'
import { forumsApi } from '@/api/forums'
import { EmptyThreadState } from './components/thread/empty-thread-state'
import { ThreadContent } from './components/thread/thread-content'
import { ThreadComment, ThreadCommentType } from './components/thread/thread-comment'
import { ThreadReplyForm } from './components/thread/thread-reply-form'

export function ThreadDetail() {
  const navigate = useNavigate()
  const { threadId } = useParams({ strict: false }) as { threadId: string }
  const queryClient = useQueryClient()
  const [commentBody, setCommentBody] = useState('')

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
      <Main>
        <div className='text-center py-12 text-muted-foreground'>
          Loading post...
        </div>
      </Main>
    )
  }

  if (!postData) {
    return (
      <Main>
        <Button
          variant='ghost'
          className='mb-6 h-auto px-0 text-muted-foreground hover:text-foreground'
          onClick={() => navigate({ to: '/' })}
        >
          <ArrowLeft className='mr-2 size-4' />
          Back to threads
        </Button>
        <EmptyThreadState onBack={() => navigate({ to: '/' })} />
      </Main>
    )
  }

  const { post, comments } = postData.data
  const commentCount = comments.length

  return (
    <Main>
        <Button
          variant='ghost'
          className='mb-6 h-auto px-0 text-muted-foreground hover:text-foreground'
          onClick={() => navigate({ to: '/' })}
        >
          <ArrowLeft className='mr-2 size-4' />
          Back to threads
        </Button>

        <div className='grid gap-6'>
          <div className='space-y-6'>
            <ThreadContent 
              post={post} 
              onVote={(vote) => votePostMutation.mutate(vote)} 
              isVotePending={votePostMutation.isPending} 
            />

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
                    comment={comment as unknown as ThreadCommentType}
                    isOwner={comment.member === post.member}
                    onVote={(vote) => voteCommentMutation.mutate({ commentId: comment.id, vote })}
                  />
                ))}
              </CardContent>
            </Card>

            <ThreadReplyForm 
              value={commentBody}
              onChange={setCommentBody}
              onSubmit={handleCommentSubmit}
              isPending={createCommentMutation.isPending}
            />
          </div>
        </div>
    </Main>
  )
}
