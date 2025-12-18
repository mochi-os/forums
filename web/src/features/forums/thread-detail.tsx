import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import {
  Main,
  Button,
  Card,
  CardContent,
} from '@mochi/common'
import { forumsApi } from '@/api/forums'
import { EmptyThreadState } from './components/thread/empty-thread-state'
import { ThreadContent } from './components/thread/thread-content'
import { ThreadComment, type ThreadCommentType } from './components/thread/thread-comment'
import { ThreadReplyForm } from './components/thread/thread-reply-form'

export function ThreadDetail() {
  const navigate = useNavigate()
  const { threadId } = useParams({ strict: false }) as { threadId: string }
  const queryClient = useQueryClient()
  const [commentBody, setCommentBody] = useState('')
  const [votingCommentId, setVotingCommentId] = useState<string | null>(null)

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
    mutationFn: ({ commentId, vote }: { commentId: string; vote: 'up' | 'down' }) => {
      setVotingCommentId(commentId)
      return forumsApi.voteComment({ 
        forum: postData!.data.forum.id, 
        post: threadId, 
        comment: commentId, 
        vote 
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'post', forumId, threadId] })
      toast.success('Vote recorded')
      setVotingCommentId(null)
    },
    onError: () => {
      toast.error('Failed to vote on comment')
      setVotingCommentId(null)
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

  const { post, comments, role_voter, member } = postData.data
  const commentCount = comments.length

  return (
    <Main>
      <Button
        variant='ghost'
        className='mb-4 h-auto px-0 text-muted-foreground hover:text-foreground'
        onClick={() => navigate({ to: '/' })}
      >
        <ArrowLeft className='mr-2 size-4' />
        Back to threads
      </Button>

      {/* Unified Thread Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          {/* Post Content with Voting */}
          <ThreadContent 
            post={post}
            attachments={post.attachments}
            onVote={(vote) => votePostMutation.mutate(vote)} 
            isVotePending={votePostMutation.isPending} 
          />

          {/* Divider */}
          <div className="mt-6 pt-4 border-t border-border/60">
            {/* Comments Header */}
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                {commentCount} {commentCount === 1 ? 'Reply' : 'Replies'}
              </h2>
            </div>

            {/* Comments List */}
            {commentCount > 0 ? (
              <div className="divide-y-0">
                {comments.map((comment) => (
                  <ThreadComment
                    key={comment.id}
                    comment={comment as unknown as ThreadCommentType}
                    isOwner={comment.member === post.member}
                    onVote={(vote) => voteCommentMutation.mutate({ commentId: comment.id, vote })}
                    roleVoter={role_voter}
                    isPending={votingCommentId === comment.id && voteCommentMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                No replies yet. Be the first to comment!
              </p>
            )}

            {/* Reply Form */}
            <ThreadReplyForm 
              value={commentBody}
              onChange={setCommentBody}
              onSubmit={handleCommentSubmit}
              isPending={createCommentMutation.isPending}
              userName={member?.name}
            />
          </div>
        </CardContent>
      </Card>
    </Main>
  )
}
