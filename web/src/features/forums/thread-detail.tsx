import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, MessageSquare, Send, X } from 'lucide-react'
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
  useEditPost,
  useDeletePost,
  useEditComment,
  useDeleteComment,
} from '@/hooks/use-forums-queries'
import { EmptyThreadState } from './components/thread/empty-thread-state'
import { ThreadContent } from './components/thread/thread-content'
import { ThreadComment } from './components/thread/thread-comment'
import { EditPostDialog } from './components/edit-post-dialog'

export function ThreadDetail() {
  const navigate = useNavigate()
  const { forum = '', post: postId = '' } = useParams({ strict: false }) as { forum?: string; post?: string }
  const [commentBody, setCommentBody] = useState('')
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)

  // Sync forum to sidebar context
  const { setForum } = useSidebarContext()
  useEffect(() => {
    setForum(forum || null)
    return () => setForum(null)
  }, [forum, setForum])

  // Queries
  const { data: postData, isLoading } = usePostDetail(forum, postId)

  usePageTitle(postData?.data?.post?.title ? `${postData.data.post.title} - Mochi` : 'Thread - Mochi')

  // Mutations
  const votePostMutation = useVotePost(forum, postId)
  const voteCommentMutation = useVoteComment(forum, postId)
  const createCommentMutation = useCreateComment(forum, postId)
  const editPostMutation = useEditPost(forum, postId)
  const deletePostMutation = useDeletePost(forum, () => {
    // Navigate back to forum after deletion
    navigate({ to: '/', search: forum ? { forum } : undefined })
  })
  const editCommentMutation = useEditComment(forum, postId)
  const deleteCommentMutation = useDeleteComment(forum, postId)

  const handleCommentSubmit = () => {
    if (!commentBody.trim()) {
      toast.error('Please enter a comment')
      return
    }
    createCommentMutation.mutate(commentBody, {
      onSuccess: () => {
        setCommentBody('')
        setShowReplyForm(false)
      },
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

  const { post, comments, can_vote, member, forum: forumData } = postData.data
  const commentCount = comments.length
  const currentUserId = member?.id

  // Check if user can edit/delete post (author or forum manager)
  const isPostAuthor = currentUserId === post.member
  const isForumManager = forumData?.can_manage === true
  const canEditPost = isPostAuthor || isForumManager

  // Helper to check if user can edit a comment
  const canEditComment = (commentMember: string) => {
    return currentUserId === commentMember || isForumManager
  }

  const handleEditPost = (data: { title: string; body: string; order: string[]; attachments: File[] }) => {
    editPostMutation.mutate(data, {
      onSuccess: () => setEditPostDialogOpen(false),
    })
  }

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
            canEdit={canEditPost}
            onEdit={() => setEditPostDialogOpen(true)}
            onDelete={() => deletePostMutation.mutate(postId)}
            isDeletePending={deletePostMutation.isPending}
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
                    canEdit={canEditComment(comment.member)}
                    onEdit={(body) => editCommentMutation.mutate({ commentId: comment.id, body })}
                    onDelete={() => deleteCommentMutation.mutate(comment.id)}
                    isEditPending={editCommentMutation.variables?.commentId === comment.id && editCommentMutation.isPending}
                    isDeletePending={deleteCommentMutation.variables === comment.id && deleteCommentMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                No replies yet. Be the first to comment!
              </p>
            )}

            {/* Reply Button / Form */}
            {showReplyForm ? (
              <div className="flex items-end gap-2 pt-4">
                <textarea
                  placeholder="Write a reply..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      if (commentBody.trim()) {
                        handleCommentSubmit()
                      }
                    } else if (e.key === 'Escape') {
                      setShowReplyForm(false)
                    }
                  }}
                  className="flex-1 border rounded-md px-3 py-2 text-sm resize-none min-h-20"
                  rows={3}
                  autoFocus
                  disabled={createCommentMutation.isPending}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => setShowReplyForm(false)}
                  aria-label="Cancel reply"
                  disabled={createCommentMutation.isPending}
                >
                  <X className="size-4" />
                </Button>
                <Button
                  size="icon"
                  className="size-8"
                  disabled={!commentBody.trim() || createCommentMutation.isPending}
                  onClick={handleCommentSubmit}
                  aria-label="Submit reply"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReplyForm(true)}
                  className="gap-1.5"
                >
                  <MessageSquare className="size-3.5" />
                  Reply
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Post Dialog */}
      <EditPostDialog
        post={post}
        open={editPostDialogOpen}
        onOpenChange={setEditPostDialogOpen}
        onSave={handleEditPost}
        isPending={editPostMutation.isPending}
      />
    </Main>
  )
}
