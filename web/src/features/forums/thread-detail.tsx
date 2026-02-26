import { useCallback, useRef, useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Main,
  Button,
  usePageTitle,
  toast,
  getErrorMessage,
  Card,
  CardContent,
  PageHeader,
} from '@mochi/common'
import { Paperclip, Send, X } from 'lucide-react'
import forumsApi from '@/api/forums'
import type { Tag } from '@/api/types/posts'
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
  useRemovePost,
  useRestorePost,
  useLockPost,
  useUnlockPost,
  usePinPost,
  useUnpinPost,
  useRemoveComment,
  useRestoreComment,
  useApproveComment,
  useReportPost,
  useReportComment,
} from '@/hooks/use-forums-queries'
import { EditPostDialog } from './components/edit-post-dialog'
import { ReportDialog } from './components/report-dialog'
import { EmptyThreadState } from './components/thread/empty-thread-state'
import { ThreadComment } from './components/thread/thread-comment'
import { ThreadContent } from './components/thread/thread-content'
import { ThreadDetailSkeleton } from './components/thread/thread-detail-skeleton'

interface ThreadDetailProps {
  server?: string
  forumOverride?: string
  inDomainContext?: boolean
  fromAllForums?: boolean
}

export function ThreadDetail({
  server,
  forumOverride,
  inDomainContext: _inDomainContext = false,
  fromAllForums = false,
}: ThreadDetailProps) {
  const navigate = useNavigate()
  const { forum: urlForum = '', post: postId = '' } = useParams({
    strict: false,
  }) as {
    forum?: string
    post?: string
  }
  // Use forumOverride if provided (from domain context), otherwise use URL param
  const forum = forumOverride || urlForum
  const [commentBody, setCommentBody] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const commentFileRef = useRef<HTMLInputElement>(null)
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyingToComment, setReplyingToComment] = useState<string | null>(
    null
  )
  const [commentReplyBody, setCommentReplyBody] = useState('')
  const [reportPostDialogOpen, setReportPostDialogOpen] = useState(false)
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null)

  // Sync forum and post to sidebar context
  const { setForum, setPost } = useSidebarContext()
  useEffect(() => {
    setForum(forum || null)
    return () => setForum(null)
  }, [forum, setForum])

  // Queries
  const {
    data: postData,
    isLoading,
    isError,
  } = usePostDetail(forum, postId, server)

  // Sync post title to sidebar
  useEffect(() => {
    const title = postData?.data?.post?.title || null
    setPost(postId || null, title)
    return () => setPost(null, null)
  }, [postId, postData?.data?.post?.title, setPost])

  usePageTitle(postData?.data?.post?.title ?? 'Thread')

  const forumTitle = postData?.data?.forum?.name || 'Forum'
  const goBackToForumContext = () => {
    if (fromAllForums || !forum) {
      return navigate({ to: '/' })
    }
    return navigate({ to: '/$forum', params: { forum } })
  }

  // Mutations
  const votePostMutation = useVotePost(forum, postId)
  const voteCommentMutation = useVoteComment(forum, postId)
  const createCommentMutation = useCreateComment(forum, postId)
  const editPostMutation = useEditPost(forum, postId)
  const deletePostMutation = useDeletePost(forum, () => {
    // Navigate back to previous forum context after deletion.
    void goBackToForumContext()
  })
  const editCommentMutation = useEditComment(forum, postId)
  const deleteCommentMutation = useDeleteComment(forum, postId)
  // Post moderation mutations
  const removePostMutation = useRemovePost(forum, postId)
  const restorePostMutation = useRestorePost(forum, postId)
  const lockPostMutation = useLockPost(forum, postId)
  const unlockPostMutation = useUnlockPost(forum, postId)
  const pinPostMutation = usePinPost(forum, postId)
  const unpinPostMutation = useUnpinPost(forum, postId)
  // Comment moderation mutations
  const removeCommentMutation = useRemoveComment(forum, postId)
  const restoreCommentMutation = useRestoreComment(forum, postId)
  const approveCommentMutation = useApproveComment(forum, postId)
  // Report mutations
  const reportPostMutation = useReportPost(forum, postId)
  const reportCommentMutation = useReportComment(forum, postId)

  // Tag state (local optimistic updates since post detail isn't using react-query for tags)
  const [localTags, setLocalTags] = useState<Tag[] | null>(null)

  // Reset local tags when post changes
  useEffect(() => {
    setLocalTags(null)
  }, [postId])

  const handleTagAdded = useCallback(async (label: string) => {
    try {
      const tag = await forumsApi.addPostTag(forum, postId, label)
      setLocalTags((prev) => {
        const current = prev ?? postData?.data?.post?.tags ?? []
        return [...current, tag]
      })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to add tag'))
      throw error
    }
  }, [forum, postId, postData?.data?.post?.tags])

  const handleTagRemoved = useCallback(async (tagId: string) => {
    try {
      await forumsApi.removePostTag(forum, postId, tagId)
      setLocalTags((prev) => {
        const current = prev ?? postData?.data?.post?.tags ?? []
        return current.filter((t) => t.id !== tagId)
      })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to remove tag'))
    }
  }, [forum, postId, postData?.data?.post?.tags])

  const handleInterestUp = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum, qid, 'up')
        toast.success('Interest boosted')
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to adjust interest'))
      }
    },
    [forum]
  )

  const handleInterestDown = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum, qid, 'down')
        toast.success('Interest reduced')
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to adjust interest'))
      }
    },
    [forum]
  )

  const handleCommentSubmit = () => {
    if (!commentBody.trim()) {
      toast.error('Please enter a comment')
      return
    }
    createCommentMutation.mutate(
      { body: commentBody, files: commentFiles.length > 0 ? commentFiles : undefined },
      {
        onSuccess: () => {
          setCommentBody('')
          setCommentFiles([])
          setShowReplyForm(false)
        },
      }
    )
  }

  const handleCommentReplySubmit = (parentId: string, files?: File[]) => {
    if (!commentReplyBody.trim()) {
      toast.error('Please enter a reply')
      return
    }
    createCommentMutation.mutate(
      { body: commentReplyBody, parent: parentId, files },
      {
        onSuccess: () => {
          setCommentReplyBody('')
          setReplyingToComment(null)
        },
      }
    )
  }

  const handleBack = () => {
    void goBackToForumContext()
  }

  if (isLoading) {
    return (
      <>
        <PageHeader
          title={forumTitle}
          back={{ label: 'Back to forum', onFallback: goBackToForumContext }}
        />
        <ThreadDetailSkeleton />
      </>
    )
  }

  if (isError || !postData?.data?.post) {
    return (
      <>
        <PageHeader
          title={forumTitle}
          back={{ label: 'Back to forum', onFallback: goBackToForumContext }}
        />
        <Main className="space-y-4">
          <Card className="shadow-md">
            <CardContent className="py-12 text-center">
              <EmptyThreadState onBack={handleBack} />
            </CardContent>
          </Card>
        </Main>
      </>
    )
  }

  const {
    post,
    comments = [],
    can_vote,
    can_comment,
    can_moderate = false,
    member,
    forum: forumData,
  } = postData.data
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

  const handleEditPost = (data: {
    title: string
    body: string
    order: string[]
    attachments: File[]
  }) => {
    editPostMutation.mutate(data, {
      onSuccess: () => setEditPostDialogOpen(false),
    })
  }

  const handleMuteAuthor = async (userId: string) => {
    try {
      await forumsApi.restrictUser({ forum, user: userId, type: 'muted' })
      toast.success('User muted')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to mute user'))
    }
  }

  const handleBanAuthor = async (userId: string) => {
    try {
      await forumsApi.restrictUser({ forum, user: userId, type: 'banned' })
      toast.success('User banned')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to ban user'))
    }
  }

  return (
    <>
      <PageHeader
        title={forumTitle}
        back={{ label: 'Back to forum', onFallback: goBackToForumContext }}
      />
      <Main className="space-y-4">
        {/* Single post */}
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className='space-y-4'>
              <ThreadContent
                post={{ ...post, tags: localTags ?? post.tags }}
                attachments={post.attachments}
                server={server}
                forumName={forumData?.name}
                showForumBadge={fromAllForums}
                onVote={(vote) => votePostMutation.mutate(vote)}
                isVotePending={votePostMutation.isPending}
                canVote={can_vote}
                canReply={can_comment && !post.locked}
                onReply={() => setShowReplyForm(true)}
                canTag={isForumManager || can_moderate || isPostAuthor}
                onTagAdded={handleTagAdded}
                onTagRemoved={handleTagRemoved}
                onInterestUp={handleInterestUp}
                onInterestDown={handleInterestDown}
                canEdit={canEditPost}
                onEdit={() => setEditPostDialogOpen(true)}
                onDelete={() => deletePostMutation.mutate(postId)}
                canModerate={can_moderate || isForumManager}
                onRemove={() => removePostMutation.mutate(undefined)}
                onRestore={() => restorePostMutation.mutate()}
                onLock={() => lockPostMutation.mutate()}
                onUnlock={() => unlockPostMutation.mutate()}
                onPin={() => pinPostMutation.mutate()}
                onUnpin={() => unpinPostMutation.mutate()}
                onMuteAuthor={(can_moderate || isForumManager) ? () => void handleMuteAuthor(post.member) : undefined}
                onBanAuthor={(can_moderate || isForumManager) ? () => void handleBanAuthor(post.member) : undefined}
                onReport={can_vote && !isPostAuthor ? () => setReportPostDialogOpen(true) : undefined}
              />

              {/* Divider */}
              <div className='border-border/60 mt-6 border-t pt-4'>
                {/* Reply Form - shown above comments */}
                {showReplyForm && (
                  <div className='mb-4 space-y-2'>
                    <textarea
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
                    className='min-h-20 w-full rounded-md border px-3 py-2 text-sm'
                    rows={3}
                    autoFocus
                    disabled={createCommentMutation.isPending}
                  />
                  {commentFiles.length > 0 && (
                    <div className='flex flex-wrap gap-2'>
                      {commentFiles.map((file, i) => (
                        <div key={i} className='bg-muted relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs'>
                          {file.type.startsWith('image/') && (
                            <img src={URL.createObjectURL(file)} alt={file.name} className='h-8 w-8 rounded object-cover' />
                          )}
                          <Paperclip className='text-muted-foreground size-3 shrink-0' />
                          <span className='max-w-40 truncate'>{file.name}</span>
                          <button type='button' onClick={() => setCommentFiles((prev) => prev.filter((_, idx) => idx !== i))} className='text-muted-foreground hover:text-foreground ml-0.5'>
                            <X className='size-3.5' />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className='flex items-center justify-end gap-2'>
                    <input
                      ref={commentFileRef}
                      type='file'
                      multiple
                      onChange={(e) => { if (e.target.files) { const f = Array.from(e.target.files); setCommentFiles((prev) => [...prev, ...f]) } e.target.value = '' }}
                      className='hidden'
                    />
                    <Button type='button' variant='ghost' size='icon' className='size-8' onClick={() => commentFileRef.current?.click()}>
                      <Paperclip className='size-4' />
                    </Button>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-8'
                      onClick={() => setShowReplyForm(false)}
                      aria-label='Cancel reply'
                      disabled={createCommentMutation.isPending}
                    >
                      <X className='size-4' />
                    </Button>
                    <Button
                      size='icon'
                      className='size-8'
                      disabled={
                        !commentBody.trim() || createCommentMutation.isPending
                      }
                      onClick={handleCommentSubmit}
                      aria-label='Submit reply'
                    >
                      <Send className='size-4' />
                    </Button>
                  </div>
                </div>
              )}

                {/* Comments List */}
                {commentCount > 0 ? (
                  <div className='divide-y-0'>
                    {comments.map((comment) => (
                      <ThreadComment
                      key={comment.id}
                      comment={comment}
                      onVote={(commentId, vote) =>
                        voteCommentMutation.mutate({ commentId, vote })
                      }
                      canVote={can_vote}
                      votePendingId={
                        voteCommentMutation.isPending
                          ? (voteCommentMutation.variables?.commentId ?? null)
                          : null
                      }
                      canReply={can_comment}
                      onReply={(commentId) => {
                        setReplyingToComment(commentId)
                        const selected = window.getSelection()?.toString().trim()
                        if (selected) {
                          const quoted = selected.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n'
                          setCommentReplyBody(quoted)
                        } else {
                          setCommentReplyBody('')
                        }
                      }}
                      replyingToId={replyingToComment}
                      replyValue={commentReplyBody}
                      onReplyChange={setCommentReplyBody}
                      onReplySubmit={handleCommentReplySubmit}
                      onReplyCancel={() => setReplyingToComment(null)}
                      isReplyPending={createCommentMutation.isPending}
                      canEdit={canEditComment}
                      onEdit={(commentId, body) =>
                        editCommentMutation.mutate({ commentId, body })
                      }
                      onDelete={(commentId) =>
                        deleteCommentMutation.mutate(commentId)
                      }
                      editPendingId={
                        editCommentMutation.isPending
                          ? (editCommentMutation.variables?.commentId ?? null)
                          : null
                      }
                      canModerate={can_moderate || isForumManager}
                      onRemove={(commentId) =>
                        removeCommentMutation.mutate({ commentId })
                      }
                      onRestore={(commentId) =>
                        restoreCommentMutation.mutate(commentId)
                      }
                      onApprove={(commentId) =>
                        approveCommentMutation.mutate(commentId)
                      }
                      onMuteAuthor={(can_moderate || isForumManager) ? (userId) => void handleMuteAuthor(userId) : undefined}
                      onBanAuthor={(can_moderate || isForumManager) ? (userId) => void handleBanAuthor(userId) : undefined}
                      onReport={can_vote ? (commentId) => setReportingCommentId(commentId) : undefined}
                      currentUserId={currentUserId}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
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

        {/* Report Post Dialog */}
        <ReportDialog
          open={reportPostDialogOpen}
          onOpenChange={setReportPostDialogOpen}
          onSubmit={(reason, details) => {
            reportPostMutation.mutate(
              { reason, details },
              { onSuccess: () => setReportPostDialogOpen(false) }
            )
          }}
          isPending={reportPostMutation.isPending}
          contentType='post'
        />

        {/* Report Comment Dialog */}
        <ReportDialog
          open={!!reportingCommentId}
          onOpenChange={(open) => !open && setReportingCommentId(null)}
          onSubmit={(reason, details) => {
          if (reportingCommentId) {
            reportCommentMutation.mutate(
              { commentId: reportingCommentId, reason, details },
              { onSuccess: () => setReportingCommentId(null) }
            )
          }
        }}
          isPending={reportCommentMutation.isPending}
          contentType='comment'
        />
      </Main>
    </>
  )
}
