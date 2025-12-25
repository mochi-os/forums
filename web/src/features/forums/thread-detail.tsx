import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Main,
  Button,
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

interface ThreadDetailProps {
  server?: string
}

export function ThreadDetail({ server }: ThreadDetailProps) {
  const navigate = useNavigate()
  const { forum = '', post: postId = '' } = useParams({ strict: false }) as { forum?: string; post?: string }
  const [commentBody, setCommentBody] = useState('')
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyingToComment, setReplyingToComment] = useState<string | null>(null)
  const [commentReplyBody, setCommentReplyBody] = useState('')

  // Sync forum and post to sidebar context
  const { setForum, setPost } = useSidebarContext()
  useEffect(() => {
    setForum(forum || null)
    return () => setForum(null)
  }, [forum, setForum])

  // Queries
  const { data: postData, isLoading, isError } = usePostDetail(forum, postId, server)

  // Sync post title to sidebar
  useEffect(() => {
    const title = postData?.data?.post?.title || null
    setPost(postId || null, title)
    return () => setPost(null, null)
  }, [postId, postData?.data?.post?.title, setPost])

  usePageTitle(postData?.data?.post?.title ?? 'Thread')

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
    createCommentMutation.mutate({ body: commentBody }, {
      onSuccess: () => {
        setCommentBody('')
        setShowReplyForm(false)
      },
    })
  }

  const handleCommentReplySubmit = (parentId: string) => {
    if (!commentReplyBody.trim()) {
      toast.error('Please enter a reply')
      return
    }
    createCommentMutation.mutate({ body: commentReplyBody, parent: parentId }, {
      onSuccess: () => {
        setCommentReplyBody('')
        setReplyingToComment(null)
      },
    })
  }

  const handleBack = () => {
    // Navigate back to the forum
    navigate({ to: '/', search: forum ? { forum } : undefined })
  }

  if (isLoading) {
    return (
      <Main>
        <div className="text-center py-12 text-muted-foreground">
          Loading post...
        </div>
      </Main>
    )
  }

  if (isError || !postData?.data?.post) {
    return (
      <Main fixed>
        <div className="flex-1 overflow-y-auto">
          <Button
            variant="ghost"
            className="mb-6 h-auto px-0 text-muted-foreground hover:text-foreground"
            onClick={handleBack}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back to forum
          </Button>
          <EmptyThreadState onBack={handleBack} />
        </div>
      </Main>
    )
  }

  const { post, comments = [], can_vote, can_comment, member, forum: forumData } = postData.data
  const commentCount = comments.length
  const currentUserId = member?.id

  // Check if user can edit/delete post (author with comment access, or forum manager)
  const isPostAuthor = currentUserId === post.member
  const isForumManager = forumData?.can_manage === true
  const canEditPost = isForumManager || (can_comment && isPostAuthor)

  // Helper to check if user can edit a comment (author with comment access, or manager)
  const canEditComment = (commentMember: string) => {
    return isForumManager || (can_comment && currentUserId === commentMember)
  }

  const handleEditPost = (data: { title: string; body: string; order: string[]; attachments: File[] }) => {
    editPostMutation.mutate(data, {
      onSuccess: () => setEditPostDialogOpen(false),
    })
  }

  return (
    <Main fixed>
      <div className="flex-1 overflow-y-auto">
        {/* Post Content with Voting */}
        <div className="space-y-4">
          <ThreadContent
            post={post}
            attachments={post.attachments}
            server={server}
            onVote={(vote) => votePostMutation.mutate(vote)}
            isVotePending={votePostMutation.isPending}
            canVote={can_vote}
            canReply={can_comment}
            onReply={() => setShowReplyForm(true)}
            canEdit={canEditPost}
            onEdit={() => setEditPostDialogOpen(true)}
            onDelete={() => deletePostMutation.mutate(postId)}
          />

          {/* Divider */}
          <div className="mt-6 pt-4 border-t border-border/60">
            {/* Reply Form - shown above comments */}
            {showReplyForm && (
              <div className="flex items-end gap-2 mb-4">
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
            )}

            {/* Comments List */}
            {commentCount > 0 ? (
              <div className="divide-y-0">
                {comments.map((comment) => (
                  <ThreadComment
                    key={comment.id}
                    comment={comment}
                    onVote={(commentId, vote) => voteCommentMutation.mutate({ commentId, vote })}
                    canVote={can_vote}
                    votePendingId={voteCommentMutation.isPending ? voteCommentMutation.variables?.commentId ?? null : null}
                    canReply={can_comment}
                    onReply={(commentId) => {
                      setReplyingToComment(commentId)
                      setCommentReplyBody('')
                    }}
                    replyingToId={replyingToComment}
                    replyValue={commentReplyBody}
                    onReplyChange={setCommentReplyBody}
                    onReplySubmit={handleCommentReplySubmit}
                    onReplyCancel={() => setReplyingToComment(null)}
                    isReplyPending={createCommentMutation.isPending}
                    canEdit={canEditComment}
                    onEdit={(commentId, body) => editCommentMutation.mutate({ commentId, body })}
                    onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
                    editPendingId={editCommentMutation.isPending ? editCommentMutation.variables?.commentId ?? null : null}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
