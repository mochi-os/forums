import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import {
  Main,
  Button,
  Card,
  CardContent,
  usePageTitle,
} from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  usePostDetail,
  useVotePost,
  useVoteComment,
  useCreateComment,
} from '@/hooks/use-forums-queries'
import { EmptyThreadState } from './components/thread/empty-thread-state'
import { ThreadContent } from './components/thread/thread-content'
import { ThreadComment } from './components/thread/thread-comment'
import { ThreadReplyForm } from './components/thread/thread-reply-form'

export function ThreadDetail() {
  const navigate = useNavigate()
  const { forum = '', thread = '' } = useParams({ strict: false }) as { forum?: string; thread?: string }
  const [commentBody, setCommentBody] = useState('')

  // Sync forum to sidebar context
  const { setForum } = useSidebarContext()
  useEffect(() => {
    setForum(forum || null)
    return () => setForum(null)
  }, [forum, setForum])

  // Queries
  const { data: postData, isLoading } = usePostDetail(forum, thread)

  usePageTitle(postData?.data?.post?.title ? `${postData.data.post.title} - Mochi` : 'Thread - Mochi')

  // Mutations
  const votePostMutation = useVotePost(forum, thread)
  const voteCommentMutation = useVoteComment(forum, thread)
  const createCommentMutation = useCreateComment(forum, thread)

  const handleCommentSubmit = () => {
    if (!commentBody.trim()) {
      toast.error('Please enter a comment')
      return
    }
    createCommentMutation.mutate(commentBody, {
      onSuccess: () => setCommentBody(''),
    })
  }

  const handleBack = () => {
    // Navigate back to the forum
    navigate({ to: '/', search: forum ? { forum } : undefined })
  }

  if (isLoading) {
    return (
      <Main fixed>
        <div className="text-center py-12 text-muted-foreground">
          Loading post...
        </div>
      </Main>
    )
  }

  if (!postData) {
    return (
      <Main fixed>
        <Button
          variant="ghost"
          className="mb-6 h-auto px-0 text-muted-foreground hover:text-foreground"
          onClick={handleBack}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to forum
        </Button>
        <EmptyThreadState onBack={handleBack} />
      </Main>
    )
  }

  const { post, comments, can_vote, member } = postData.data
  const commentCount = comments.length

  return (
    <Main fixed>
      <Button
        variant="ghost"
        className="mb-4 h-auto px-0 text-muted-foreground hover:text-foreground"
        onClick={handleBack}
      >
        <ArrowLeft className="mr-2 size-4" />
        Back to forum
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
                    comment={comment}
                    isOwner={comment.member === post.member}
                    onVote={(vote) => voteCommentMutation.mutate({ commentId: comment.id, vote })}
                    canVote={can_vote}
                    isPending={voteCommentMutation.variables?.commentId === comment.id && voteCommentMutation.isPending}
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
