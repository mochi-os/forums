// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useRef, useState, useEffect } from 'react'
import { useLingui } from '@lingui/react/macro'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  toast,
  getErrorMessage,
  Card,
  CardContent,
  PageHeader,
  GeneralError,
  CommentBox,
  useAuthStore,
  useListAutoAnimate,
  findCommentTextInTree,
  countCommentTree,
  useDiscardGuard,
} from '@mochi/web'
import forumsApi from '@/api/forums'
import { forumPostEditOriginalFromPost } from '@/features/forums/edit-compare'
import type { Tag } from '@/api/types/posts'
import { useForumWebsocket } from '@/hooks/use-forum-websocket'
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
import { ForumBanner } from './components/forum-banner'
import { EditPostDialog } from './components/edit-post-dialog'
import { ReportDialog } from './components/report-dialog'
import { EmptyThreadState } from './components/thread/empty-thread-state'
import { ThreadComment } from './components/thread/thread-comment'
import { AttachmentComments } from './components/thread/attachment-comments'
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
  const { t } = useLingui()
  const navigate = useNavigate()
  const isLoggedIn = useAuthStore((state) => state.isAuthenticated)
  const { forum: urlForum = '', post: postId = '' } = useParams({
    strict: false,
  }) as {
    forum?: string
    post?: string
  }
  // Use forumOverride if provided (from domain context), otherwise use URL param
  const forum = forumOverride || urlForum
  const [commentBody, setCommentBody] = useState('')
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)
  // The comment box owns its files and reports their count; the discard guard
  // reads it. The create-comment mutation is shared with every reply form in
  // the thread, so its isPending cannot stand in for "this form is sending".
  const [commentFileCount, setCommentFileCount] = useState(0)
  const [isSendingComment, setIsSendingComment] = useState(false)
  useEffect(() => {
    if (!showReplyForm) {
      setCommentFileCount(0)
      if (commentBody) setCommentBody('')
    }
    // Only the open/closed flip matters here; the values are read fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReplyForm])
  const [replyingToComment, setReplyingToComment] = useState<string | null>(
    null
  )
  const [commentReplyBody, setCommentReplyBody] = useState('')
  const [replyFileCount, setReplyFileCount] = useState(0)
  const pendingReplyTarget = useRef<string | null>(null)

  const startReply = useCallback((commentId: string) => {
    setReplyingToComment(commentId)
    setReplyFileCount(0)
    const selected = window.getSelection()?.toString().trim()
    if (selected) {
      const quoted = selected.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n'
      setCommentReplyBody(quoted)
    } else {
      setCommentReplyBody('')
    }
  }, [])

  const cancelReply = useCallback(() => {
    setReplyingToComment(null)
    setCommentReplyBody('')
    setReplyFileCount(0)
  }, [])

  const [reportPostDialogOpen, setReportPostDialogOpen] = useState(false)
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null)

  // Queries
  const {
    data: postData,
    isLoading,
    error: postError,
    refetch: refetchPost,
  } = usePostDetail(forum, postId, server)

  // The gallery fills this with "open the lightbox on this attachment,
  // comments showing"; an anchored comment's image chip calls it.
  const lightboxOpener = useRef<((attachmentId: string) => void) | null>(null)
  const [commentsListRef] = useListAutoAnimate<HTMLDivElement>({
    disabled: isLoading,
  })

  usePageTitle(postData?.data?.post?.title ?? t`Thread`)

  // Real-time updates via WebSocket
  useForumWebsocket(postData?.data?.forum?.fingerprint, postData?.data?.member?.id)

  const forumTitle = postData?.data?.forum?.name || t`Forum`
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

  const { requestClose: requestCloseReplyForm, discardDialog } = useDiscardGuard({
    hasText: commentBody.trim().length > 0,
    hasFiles: commentFileCount > 0,
    onDiscard: () => setShowReplyForm(false),
    locked: isSendingComment,
  })

  // Opening another comment's reply box throws the current draft away, so it
  // asks first, exactly like closing the box does. The guard lives here rather
  // than in the comment because the comment being replied to is not the one
  // whose Reply button was clicked.
  const { requestClose: requestReplySwitch, discardDialog: replySwitchDialog } =
    useDiscardGuard({
      hasText: commentReplyBody.trim().length > 0,
      hasFiles: replyFileCount > 0,
      onDiscard: () => {
        const next = pendingReplyTarget.current
        pendingReplyTarget.current = null
        if (next) startReply(next)
        else cancelReply()
      },
    })

  const handleStartReply = useCallback(
    (commentId: string) => {
      if (replyingToComment && replyingToComment !== commentId) {
        pendingReplyTarget.current = commentId
        requestReplySwitch()
        return
      }
      startReply(commentId)
    },
    [replyingToComment, requestReplySwitch, startReply]
  )

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
      toast.error(getErrorMessage(error, t`Failed to add tag`))
      throw error
    }
  }, [forum, postId, postData?.data?.post?.tags, t])

  const handleInterestUp = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum, qid, 'up')
        toast.success(t`Interest boosted`)
      } catch (error) {
        toast.error(getErrorMessage(error, t`Failed to adjust interest`))
      }
    },
    [forum, t]
  )

  const handleInterestDown = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum, qid, 'down')
        toast.success(t`Interest reduced`)
      } catch (error) {
        toast.error(getErrorMessage(error, t`Failed to adjust interest`))
      }
    },
    [forum, t]
  )

  const handleInterestRemove = useCallback(
    async (qid: string) => {
      try {
        await forumsApi.adjustTagInterest(forum, qid, 'remove')
        toast.success(t`Interest removed`)
      } catch (error) {
        toast.error(getErrorMessage(error, t`Failed to remove interest`))
      }
    },
    [forum, t]
  )

  // Rejects on failure so the box keeps its draft and attachments for Retry.
  const handleCommentSubmit = async (body: string, files?: File[]) => {
    setIsSendingComment(true)
    try {
      await createCommentMutation.mutateAsync({ body, files })
      setCommentBody('')
      setShowReplyForm(false)
    } finally {
      setIsSendingComment(false)
    }
  }

  const handleCommentReplySubmit = async (parentId: string, files?: File[]) => {
    if (!commentReplyBody.trim()) {
      toast.error(t`Please enter a reply`)
      return
    }
    // mutateAsync so the thread can keep the failed reply staged for a retry;
    // the mutation's own onError has already reported it.
    await createCommentMutation.mutateAsync({
      body: commentReplyBody,
      parent: parentId,
      files,
    })
    setCommentReplyBody('')
    setReplyingToComment(null)
  }

  const handleBack = () => {
    void goBackToForumContext()
  }

  if (isLoading) {
    return (
      <>
        <PageHeader
          title={forumTitle}
          back={{ label: t`Back to forum`, onFallback: goBackToForumContext }}
        />
        <ThreadDetailSkeleton />
      </>
    )
  }

  if (postError) {
    return (
      <>
        <PageHeader
          title={forumTitle}
          back={{ label: t`Back to forum`, onFallback: goBackToForumContext }}
        />
        <Main className="space-y-4">
          <GeneralError
            error={postError}
            minimal
            mode='inline'
            reset={() => {
              void refetchPost()
            }}
          />
        </Main>
      </>
    )
  }

  if (!postData?.data?.post) {
    return (
      <>
        <PageHeader
          title={forumTitle}
          back={{ label: t`Back to forum`, onFallback: goBackToForumContext }}
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
    captions: Record<string, string>
  }) => {
    editPostMutation.mutate(
      {
        ...data,
        original: forumPostEditOriginalFromPost(post),
      },
      {
        onSuccess: () => setEditPostDialogOpen(false),
      }
    )
  }

  const handleMuteAuthor = async (userId: string) => {
    try {
      await forumsApi.restrictUser({ forum, user: userId, type: 'muted' })
      toast.success(t`User muted`)
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to mute user`))
    }
  }

  const handleBanAuthor = async (userId: string) => {
    try {
      await forumsApi.restrictUser({ forum, user: userId, type: 'banned' })
      toast.success(t`User banned`)
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to ban user`))
    }
  }

  // Everything a comment needs to reply, vote, edit, delete and moderate,
  // built once: the inline thread and the lightbox's comments panel both
  // render the SAME ThreadComment with these, so the panel is the post's
  // thread scoped to an image, not a second thread with fewer powers.
  const commentProps = {
    server,
    onOpenAttachment: (attachmentId: string) => lightboxOpener.current?.(attachmentId),
    onSearchPeople: (q: string) => forumsApi.searchMembers(forum, q),
    onVote: (commentId: string, vote: 'up' | 'down' | '') =>
      voteCommentMutation.mutate({ commentId, vote }),
    canVote: can_vote,
    canReply: can_comment,
    onReply: handleStartReply,
    replyingToId: replyingToComment,
    replyValue: commentReplyBody,
    onReplyChange: setCommentReplyBody,
    onReplySubmit: handleCommentReplySubmit,
    replyProgress: createCommentMutation.progress,
    onReplyCancel: cancelReply,
    onReplyFilesChange: setReplyFileCount,
    canEdit: canEditComment,
    onEdit: (commentId: string, body: string) =>
      editCommentMutation.mutate({
        commentId,
        body,
        originalBody:
          findCommentTextInTree(comments, commentId, {
            getId: (c) => c.id,
            getText: (c) => c.body,
            getChildren: (c) => c.children,
          }) ?? '',
      }),
    onDelete: (commentId: string) => deleteCommentMutation.mutate(commentId),
    canModerate: can_moderate || isForumManager,
    onRemove: (commentId: string) => removeCommentMutation.mutate({ commentId }),
    onRestore: (commentId: string) => restoreCommentMutation.mutate(commentId),
    onApprove: (commentId: string) => approveCommentMutation.mutate(commentId),
    onMuteAuthor: (can_moderate || isForumManager) ? (userId: string) => void handleMuteAuthor(userId) : undefined,
    onBanAuthor: (can_moderate || isForumManager) ? (userId: string) => void handleBanAuthor(userId) : undefined,
    onReport: can_vote ? (commentId: string) => setReportingCommentId(commentId) : undefined,
    currentUserId,
  }
  return (
    <>
      <PageHeader
        title={forumTitle}
        back={{ label: t`Back to forum`, onFallback: goBackToForumContext }}
      />
      <Main className="space-y-4">
        {forumData?.banner_html && (
          <ForumBanner bannerHtml={forumData.banner_html} forumId={forum} />
        )}
        {/* Single post */}
        <Card className="gap-0 py-0 md:py-0 shadow-md">
          <CardContent className="p-4">
            <div className='space-y-4'>
              <ThreadContent
                post={{ ...post, tags: localTags ?? post.tags }}
                attachments={post.attachments}
                server={server}
                commentCount={(attachmentId) =>
                  countCommentTree(
                    comments.filter((comment) => comment.attachment === attachmentId),
                    (comment) => comment.children
                  )
                }
                renderComments={(attachmentId) => (
                  <AttachmentComments
                    comments={comments}
                    attachmentId={attachmentId}
                    commentProps={commentProps}
                    canComment={can_comment && !post.locked}
                    onAddComment={(body, files, attachment) =>
                      createCommentMutation.mutateAsync({ body, files, attachment })
                    }
                  />
                )}
                openerRef={lightboxOpener}
                forumName={forumData?.name}
                showForumBadge={fromAllForums}
                onVote={(vote) => votePostMutation.mutate(vote)}
                canVote={can_vote}
                canReply={can_comment && !post.locked}
                onReply={() => setShowReplyForm(true)}
                canTag={isForumManager || can_moderate || isPostAuthor}
                isLoggedIn={isLoggedIn}
                onTagAdded={handleTagAdded}
                onInterestUp={handleInterestUp}
                onInterestDown={handleInterestDown}
                onInterestRemove={handleInterestRemove}
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
                  <CommentBox
                    kind='reply'
                    className='mb-4'
                    value={commentBody}
                    onValueChange={setCommentBody}
                    onSubmit={handleCommentSubmit}
                    onClose={requestCloseReplyForm}
                    onFilesChange={setCommentFileCount}
                    onSearchPeople={(q) => forumsApi.searchMembers(forum, q)}
                    progress={createCommentMutation.progress}
                    rows={3}
                    autoFocus
                  />
                )}

                {/* Comments List */}
                {commentCount > 0 ? (
                  <div className='divide-y-0' ref={commentsListRef}>
                    {comments.map((comment) => (
                      <ThreadComment
                        key={comment.id}
                        comment={comment}
                        {...commentProps}
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
          isError={editPostMutation.isError}
          progress={editPostMutation.progress}
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

        {discardDialog}
        {replySwitchDialog}
      </Main>
    </>
  )
}
