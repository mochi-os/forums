// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useRef, useState, useEffect } from 'react'
import { useLingui } from '@lingui/react/macro'
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
  GeneralError,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useImageObjectUrls,
  MentionTextarea,
  useAuthStore,
  useListAutoAnimate,
  findCommentTextInTree,
  cn,
  removePendingFile,
  ComposerAttachments,
  SendShortcutHint,
  dropActiveClass,
  offlineBlocked,
  useComposerDrop,
  useDiscardGuard,
} from '@mochi/web'
import { Loader2, Paperclip, Send, X } from 'lucide-react'
import forumsApi from '@/api/forums'
import { forumPostEditOriginalFromPost } from '@/features/forums/edit-compare'
import { mergePendingFiles } from '@/features/forums/utils'
import type { Tag } from '@/api/types/posts'
import { useSidebarContext } from '@/context/sidebar-context'
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
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const commentFilePreviewUrls = useImageObjectUrls(commentFiles)
  const commentFileRef = useRef<HTMLInputElement>(null)
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [commentFailed, setCommentFailed] = useState(false)
  // The create-comment mutation is shared with every reply form in the thread,
  // so its isPending cannot stand in for "this form is sending".
  const [isSendingComment, setIsSendingComment] = useState(false)
  useEffect(() => {
    if (!showReplyForm) {
      if (commentFiles.length > 0) setCommentFiles([])
      if (commentBody) setCommentBody('')
      if (commentFailed) setCommentFailed(false)
    }
    // Only the open/closed flip matters here; the values are read fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReplyForm])

  const addCommentFiles = useCallback((incoming: File[]) => {
    setCommentFailed(false)
    setCommentFiles((prev) => mergePendingFiles(prev, incoming))
  }, [])

  // Editing the draft after a failure means the red attachments and the Retry
  // button no longer describe what is in the box.
  const handleCommentBodyChange = useCallback((value: string) => {
    setCommentBody(value)
    setCommentFailed(false)
  }, [])
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
    error: postError,
    refetch: refetchPost,
  } = usePostDetail(forum, postId, server)

  const [commentsListRef] = useListAutoAnimate<HTMLDivElement>({
    disabled: isLoading,
  })

  // Sync post title to sidebar
  useEffect(() => {
    const title = postData?.data?.post?.title || null
    setPost(postId || null, title)
    return () => setPost(null, null)
  }, [postId, postData?.data?.post?.title, setPost])

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

  const { isDragActive, dropzoneProps } = useComposerDrop({
    onFiles: addCommentFiles,
    disabled: isSendingComment,
  })

  const { requestClose: requestCloseReplyForm, discardDialog } = useDiscardGuard({
    hasText: commentBody.trim().length > 0,
    hasFiles: commentFiles.length > 0,
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

  const handleCommentSubmit = () => {
    if (!commentBody.trim() || isSendingComment) {
      if (!commentBody.trim()) toast.error(t`Please enter a comment`)
      return
    }
    if (offlineBlocked()) return
    setCommentFailed(false)
    setIsSendingComment(true)
    createCommentMutation.mutate(
      { body: commentBody, files: commentFiles.length > 0 ? commentFiles : undefined },
      {
        onSettled: () => setIsSendingComment(false),
        onSuccess: () => {
          setCommentBody('')
          setCommentFiles([])
          setShowReplyForm(false)
        },
        // Keep the form open with its draft and attachments so Retry can send
        // exactly what failed.
        onError: () => setCommentFailed(true),
      }
    )
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
                forumName={forumData?.name}
                showForumBadge={fromAllForums}
                onVote={(vote) => votePostMutation.mutate(vote)}
                isVotePending={votePostMutation.isPending}
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
                  <div
                    className={cn(
                      'mb-4 space-y-2',
                      isDragActive && dropActiveClass
                    )}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') requestCloseReplyForm()
                    }}
                    {...dropzoneProps}
                  >
                    <MentionTextarea
                      className='placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
                      value={commentBody}
                      onValueChange={handleCommentBodyChange}
                      onSearchPeople={(q) =>
                        forumsApi.searchMembers(forum, q)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          if (commentBody.trim()) {
                            handleCommentSubmit()
                          }
                        } else if (e.key === 'Escape') {
                          requestCloseReplyForm()
                        }
                      }}
                      rows={3}
                      autoFocus
                      disabled={isSendingComment}
                    />
                    <ComposerAttachments
                      files={commentFiles}
                      previewUrls={commentFilePreviewUrls}
                      state={
                        isSendingComment
                          ? 'uploading'
                          : commentFailed
                            ? 'error'
                            : 'idle'
                      }
                      onRemove={(file) =>
                        setCommentFiles((prev) => removePendingFile(prev, file))
                      }
                      // Retry sends the draft, so it is only offered while
                      // there is one.
                      onRetry={
                        commentBody.trim() ? handleCommentSubmit : undefined
                      }
                    />
                    <div className='flex items-center justify-end gap-2'>
                      <SendShortcutHint />
                      <input
                        ref={commentFileRef}
                        type='file'
                        multiple
                        onChange={(e) => { if (e.target.files) { addCommentFiles(Array.from(e.target.files)) } e.target.value = '' }}
                        className='hidden'
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type='button' variant='ghost' size='icon' className='size-8' onClick={() => commentFileRef.current?.click()} disabled={isSendingComment} aria-label={t`Attach reply files`}>
                            <Paperclip className='size-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t`Attach reply files`}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type='button'
                            size='icon'
                            variant='ghost'
                            className='size-8'
                            onClick={requestCloseReplyForm}
                            aria-label={t`Cancel reply`}
                            disabled={isSendingComment}
                          >
                            <X className='size-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t`Cancel reply`}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size='icon'
                            className='size-8'
                            disabled={
                              !commentBody.trim() || isSendingComment
                            }
                            onClick={handleCommentSubmit}
                            aria-label={t`Submit reply`}
                          >
                            {isSendingComment ? (
                              <Loader2 className='size-4 animate-spin' />
                            ) : (
                              <Send className='size-4' />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t`Submit reply`}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {/* Comments List */}
                {commentCount > 0 ? (
                  <div className='divide-y-0' ref={commentsListRef}>
                    {comments.map((comment) => (
                      <ThreadComment
                        key={comment.id}
                        comment={comment}
                        onSearchPeople={(q) =>
                          forumsApi.searchMembers(forum, q)
                        }
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
                        onReply={handleStartReply}
                        replyingToId={replyingToComment}
                        replyValue={commentReplyBody}
                        onReplyChange={setCommentReplyBody}
                        onReplySubmit={handleCommentReplySubmit}
                        onReplyCancel={cancelReply}
                        onReplyFilesChange={setReplyFileCount}
                        canEdit={canEditComment}
                        onEdit={(commentId, body) =>
                          editCommentMutation.mutate({
                            commentId,
                            body,
                            originalBody:
                              findCommentTextInTree(comments, commentId, {
                                getId: (c) => c.id,
                                getText: (c) => c.body,
                                getChildren: (c) => c.children,
                              }) ?? '',
                          })
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

        {discardDialog}
        {replySwitchDialog}
      </Main>
    </>
  )
}
