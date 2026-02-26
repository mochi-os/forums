import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  PageHeader,
  Main,
  cn,
  getErrorMessage,
  toast,
  usePageTitle,
  EmptyState,
  Skeleton,
  GeneralError,
  formatTimestamp,
} from '@mochi/common'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  MessageSquare,
  Flag,
  History,
  Users,
} from 'lucide-react'

import forumsApi from '@/api/forums'
import type { Post, ViewPostComment } from '@/api/types/posts'
import type { Report, ModerationLogEntry, Restriction } from '@/api/types/moderation'
import { useSidebarContext } from '@/context/sidebar-context'
import { PostAttachments } from '@/features/forums/components/thread/post-attachments'

type TabId = 'queue' | 'reports' | 'log' | 'restrictions'

type ModerationSearch = {
  tab?: TabId
}

export const Route = createFileRoute('/_authenticated/$forum_/moderation')({
  validateSearch: (search: Record<string, unknown>): ModerationSearch => ({
    tab:
      search.tab === 'queue' ||
      search.tab === 'reports' ||
      search.tab === 'log' ||
      search.tab === 'restrictions'
        ? search.tab
        : undefined,
  }),
  component: ModerationPage,
})

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'queue', label: 'Queue', icon: <Clock className='h-4 w-4' /> },
  { id: 'reports', label: 'Reports', icon: <Flag className='h-4 w-4' /> },
  { id: 'restrictions', label: 'Restrictions', icon: <Users className='h-4 w-4' /> },
  { id: 'log', label: 'Log', icon: <History className='h-4 w-4' /> },
]

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error
  return new Error(fallback)
}

function ModerationPage() {
  const params = Route.useParams()
  const forumId = 'forum' in params ? params.forum : ''
  const navigate = useNavigate()
  const navigateModeration = Route.useNavigate()
  const { tab } = Route.useSearch()
  const activeTab = tab ?? 'queue'
  const goBackToForum = () => navigate({ to: '/$forum', params: { forum: forumId } })

  const setActiveTab = (newTab: TabId) => {
    void navigateModeration({ search: { tab: newTab }, replace: true })
  }

  usePageTitle('Moderation')

  // Register with sidebar context
  const { setForum } = useSidebarContext()
  useEffect(() => {
    setForum(forumId)
    return () => setForum(null)
  }, [forumId, setForum])

  return (
    <>
      <PageHeader title='Moderation' back={{ label: 'Back to forum', onFallback: goBackToForum }} />
      <Main className='space-y-6'>
        {/* Tabs */}
        <div className='flex gap-1 border-b'>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                '-mb-px border-b-2',
                activeTab === t.id
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className='pt-2'>
          {activeTab === 'queue' && <QueueTab forumId={forumId} />}
          {activeTab === 'reports' && <ReportsTab forumId={forumId} />}
          {activeTab === 'log' && <LogTab forumId={forumId} />}
          {activeTab === 'restrictions' && <RestrictionsTab forumId={forumId} />}
        </div>
      </Main>
    </>
  )
}

interface QueueTabProps {
  forumId: string
}

function QueueTab({ forumId }: QueueTabProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [pendingPosts, setPendingPosts] = useState<Post[]>([])
  const [pendingComments, setPendingComments] = useState<ViewPostComment[]>([])
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [selectedComments, setSelectedComments] = useState<Set<string>>(new Set())

  const loadQueue = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await forumsApi.getModerationQueue({ forum: forumId })
      setPendingPosts(response.data?.posts ?? [])
      setPendingComments(response.data?.comments ?? [])
      setSelectedPosts(new Set())
      setSelectedComments(new Set())
    } catch (error) {
      setLoadError(toError(error, 'Failed to load moderation queue'))
    } finally {
      setIsLoading(false)
    }
  }, [forumId])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  // Selection helpers
  const togglePostSelection = (postId: string) => {
    setSelectedPosts((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }
      return next
    })
  }

  const toggleCommentSelection = (commentId: string) => {
    setSelectedComments((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) {
        next.delete(commentId)
      } else {
        next.add(commentId)
      }
      return next
    })
  }

  const allPostsSelected = pendingPosts.length === 0 || selectedPosts.size === pendingPosts.length
  const allCommentsSelected = pendingComments.length === 0 || selectedComments.size === pendingComments.length
  const allSelected = allPostsSelected && allCommentsSelected && (pendingPosts.length > 0 || pendingComments.length > 0)
  const hasSelection = selectedPosts.size > 0 || selectedComments.size > 0

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedPosts(new Set())
      setSelectedComments(new Set())
    } else {
      setSelectedPosts(new Set(pendingPosts.map((p) => p.id)))
      setSelectedComments(new Set(pendingComments.map((c) => c.id)))
    }
  }

  // Bulk actions
  const handleBulkApprove = async () => {
    if (!hasSelection) return
    setActionInProgress('bulk')
    try {
      // Approve selected posts
      for (const postId of selectedPosts) {
        await forumsApi.approvePost({ forum: forumId, post: postId })
      }
      // Approve selected comments
      for (const comment of pendingComments.filter((c) => selectedComments.has(c.id))) {
        await forumsApi.approveComment({ forum: forumId, post: comment.post, comment: comment.id })
      }
      const count = selectedPosts.size + selectedComments.size
      toast.success(`Approved ${count} item${count !== 1 ? 's' : ''}`)
      void loadQueue()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to approve items'))
    } finally {
      setActionInProgress(null)
    }
  }

  const handleBulkReject = async () => {
    if (!hasSelection) return
    setActionInProgress('bulk')
    try {
      // Remove selected posts
      for (const postId of selectedPosts) {
        await forumsApi.removePost({ forum: forumId, post: postId, reason: 'Rejected' })
      }
      // Remove selected comments
      for (const comment of pendingComments.filter((c) => selectedComments.has(c.id))) {
        await forumsApi.removeComment({ forum: forumId, post: comment.post, comment: comment.id, reason: 'Rejected' })
      }
      const count = selectedPosts.size + selectedComments.size
      toast.success(`Rejected ${count} item${count !== 1 ? 's' : ''}`)
      void loadQueue()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to reject items'))
    } finally {
      setActionInProgress(null)
    }
  }

  // Get unique authors from selected items
  const getSelectedAuthors = () => {
    const authors = new Set<string>()
    for (const post of pendingPosts.filter((p) => selectedPosts.has(p.id))) {
      if (post.member) authors.add(post.member)
    }
    for (const comment of pendingComments.filter((c) => selectedComments.has(c.id))) {
      if (comment.member) authors.add(comment.member)
    }
    return authors
  }

  const handleBulkMute = async () => {
    const authors = getSelectedAuthors()
    if (authors.size === 0) return
    setActionInProgress('mute')
    try {
      for (const userId of authors) {
        await forumsApi.restrictUser({ forum: forumId, user: userId, type: 'muted' })
      }
      toast.success(`Muted ${authors.size} user${authors.size !== 1 ? 's' : ''}`)
      void loadQueue()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to mute users'))
    } finally {
      setActionInProgress(null)
    }
  }

  const handleBulkBan = async () => {
    const authors = getSelectedAuthors()
    if (authors.size === 0) return
    setActionInProgress('ban')
    try {
      for (const userId of authors) {
        await forumsApi.restrictUser({ forum: forumId, user: userId, type: 'banned' })
      }
      toast.success(`Banned ${authors.size} user${authors.size !== 1 ? 's' : ''}`)
      void loadQueue()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to ban users'))
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return (
      <div className='space-y-6'>
         <section> 
           <Skeleton className='h-5 w-32 mb-3' />
           <div className='divide-y rounded-lg border'>
             {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className='flex gap-4 p-4'>
                   <Skeleton className='h-4 w-4 rounded-sm mt-0.5' />
                   <div className='flex-1 space-y-2'>
                      <div className='flex justify-between'>
                         <Skeleton className='h-5 w-48' />
                         <Skeleton className='h-4 w-24' />
                      </div>
                      <Skeleton className='h-4 w-full' />
                      <Skeleton className='h-4 w-3/4' />
                   </div>
                </div>
             ))}
           </div>
         </section>
      </div>
    )
  }

  if (loadError) {
    return (
      <GeneralError
        error={loadError}
        minimal
        mode='inline'
        reset={() => {
          void loadQueue()
        }}
      />
    )
  }

  const hasItems = pendingPosts.length > 0 || pendingComments.length > 0

  if (!hasItems) {
    return (
      <div className='py-12'>
        <EmptyState
          icon={CheckCircle}
          title="Moderation queue is empty"
          description="All posts and comments have been reviewed"
        />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Pending posts */}
      {pendingPosts.length > 0 && (
        <section>
          <h2 className='text-muted-foreground mb-3 flex items-center gap-2 text-sm font-medium'>
            <FileText className='size-4' />
            Pending posts ({pendingPosts.length})
          </h2>
          <div className='divide-y rounded-lg border'>
            {pendingPosts.map((post) => (
              <div
                key={post.id}
                className={cn(
                  'flex gap-4 p-4',
                  selectedPosts.has(post.id) && 'bg-muted/50'
                )}
              >
                <div className='flex items-start pt-0.5'>
                  <Checkbox
                    checked={selectedPosts.has(post.id)}
                    onCheckedChange={() => togglePostSelection(post.id)}
                  />
                </div>
                <div className='min-w-0 flex-1 space-y-1'>
                  <div className='flex items-start justify-between gap-4'>
                    <h3 className='font-medium'>{post.title}</h3>
                    <span className='text-muted-foreground whitespace-nowrap text-xs'>
                      {post.name} · {formatTimestamp(post.created)}
                    </span>
                  </div>
                  <p className='text-muted-foreground line-clamp-2 text-sm'>
                    {post.body}
                  </p>
                  {post.attachments && post.attachments.length > 0 && (
                    <PostAttachments
                      attachments={post.attachments}
                      forumId={post.forum}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending comments */}
      {pendingComments.length > 0 && (
        <section>
          <h2 className='text-muted-foreground mb-3 flex items-center gap-2 text-sm font-medium'>
            <MessageSquare className='size-4' />
            Pending comments ({pendingComments.length})
          </h2>
          <div className='divide-y rounded-lg border'>
            {pendingComments.map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  'flex gap-4 p-4',
                  selectedComments.has(comment.id) && 'bg-muted/50'
                )}
              >
                <div className='flex items-start pt-0.5'>
                  <Checkbox
                    checked={selectedComments.has(comment.id)}
                    onCheckedChange={() => toggleCommentSelection(comment.id)}
                  />
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-start justify-between gap-4'>
                    <p className='line-clamp-3 text-sm'>{comment.body}</p>
                    <span className='text-muted-foreground whitespace-nowrap text-xs'>
                      {comment.name} · {formatTimestamp(comment.created)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bulk action toolbar */}
      <div className='bg-background sticky bottom-0 flex items-center gap-4 border-t py-4'>
        <Button
          variant='outline'
          size='sm'
          onClick={toggleSelectAll}
        >
          {allSelected ? 'Select none' : 'Select all'}
        </Button>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void handleBulkReject()}
            disabled={!hasSelection || !!actionInProgress}
          >
            {actionInProgress === 'bulk' ? (
              <Loader2 className='mr-1 size-4 animate-spin' />
            ) : (
              <XCircle className='mr-1 size-4' />
            )}
            Reject
          </Button>
          <Button
            size='sm'
            onClick={() => void handleBulkApprove()}
            disabled={!hasSelection || !!actionInProgress}
          >
            {actionInProgress === 'bulk' ? (
              <Loader2 className='mr-1 size-4 animate-spin' />
            ) : (
              <CheckCircle className='mr-1 size-4' />
            )}
            Approve
          </Button>
        </div>
        <div className='bg-border h-6 w-px' />
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void handleBulkMute()}
            disabled={!hasSelection || !!actionInProgress}
          >
            {actionInProgress === 'mute' ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              'Mute'
            )}
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void handleBulkBan()}
            disabled={!hasSelection || !!actionInProgress}
          >
            {actionInProgress === 'ban' ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              'Ban'
            )}
          </Button>
        </div>
        {hasSelection && (
          <span className='text-muted-foreground text-sm'>
            {selectedPosts.size + selectedComments.size} selected
          </span>
        )}
      </div>
    </div>
  )
}

interface ReportsTabProps {
  forumId: string
}

function ReportsTab({ forumId }: ReportsTabProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'all'>('pending')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await forumsApi.getReports({ forum: forumId, status: statusFilter })
      setReports(response.data?.reports ?? [])
    } catch (error) {
      setLoadError(toError(error, 'Failed to load reports'))
    } finally {
      setIsLoading(false)
    }
  }, [forumId, statusFilter])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const handleResolve = async (reportId: string, action: string) => {
    setActionInProgress(reportId)
    try {
      await forumsApi.resolveReport({ forum: forumId, report: reportId, action })
      toast.success('Report resolved')
      void loadReports()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to resolve report'))
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
         {/* Filter skeleton */}
         <div className='flex gap-2'>
            <Skeleton className='h-8 w-16' />
            <Skeleton className='h-8 w-20' />
            <Skeleton className='h-8 w-12' />
         </div>
         
         <Card>
            <CardContent className='divide-y pt-4'>
               {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className='py-4'>
                     <div className='flex justify-between gap-4'> 
                        <div className='flex-1 space-y-3'>
                           <div className='flex items-center gap-2'>
                              <Skeleton className='h-5 w-16 rounded-full' />
                              <Skeleton className='h-4 w-24' />
                              <Skeleton className='h-4 w-32' />
                           </div>
                           <div className='bg-muted/50 rounded-md p-3 space-y-2'>
                              <Skeleton className='h-5 w-48' />
                              <Skeleton className='h-4 w-full' />
                           </div>
                           <Skeleton className='h-4 w-32' />
                        </div>
                        <div className='flex gap-2'>
                            <Skeleton className='h-8 w-16' />
                            <Skeleton className='h-8 w-16' />
                        </div>
                     </div>
                  </div>
               ))}
            </CardContent>
         </Card>
      </div>
    )
  }

  if (loadError) {
    return (
      <GeneralError
        error={loadError}
        minimal
        mode='inline'
        reset={() => {
          void loadReports()
        }}
      />
    )
  }

  return (
    <div className='space-y-4'>
      {/* Filter */}
      <div className='flex gap-2'>
        {(['pending', 'resolved', 'all'] as const).map((status) => (
          <Button
            key={status}
            size='sm'
            variant={statusFilter === status ? 'default' : 'outline'}
            onClick={() => setStatusFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {reports.length === 0 ? (
        <div className='py-12'>
          <EmptyState
            icon={Flag}
            title="No reports"
            description={`No ${statusFilter} reports found`}
          />
        </div>
      ) : (
        <Card>
          <CardContent className='divide-y pt-4'>
            {reports.map((report) => (
              <div key={report.id} className='py-4 first:pt-0 last:pb-0'>
                <div className='flex items-start justify-between gap-4'>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2'>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          report.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        )}
                      >
                        {report.status}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        {report.type}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        by {report.author_name ?? 'Unknown'}
                      </span>
                    </div>
                    {/* Reported content */}
                    <div className='bg-muted/50 mt-2 rounded-md p-3'>
                      {report.content_title && (
                        <p className='font-medium'>{report.content_title}</p>
                      )}
                      {report.content_preview && (
                        <p className='text-muted-foreground mt-1 text-sm'>
                          {report.content_preview}
                        </p>
                      )}
                      {report.attachments && report.attachments.length > 0 && (
                        <div className='mt-2'>
                          <PostAttachments
                            attachments={report.attachments}
                            forumId={report.forum}
                          />
                        </div>
                      )}
                    </div>
                    {/* Report reason */}
                    <p className='mt-2 text-sm'>
                      <span className='font-medium'>Reason:</span> {formatReason(report.reason)}
                    </p>
                    {report.details && (
                      <p className='text-muted-foreground mt-1 text-sm'>
                        {report.details}
                      </p>
                    )}
                    <p className='text-muted-foreground mt-2 text-xs'>
                      Reported by {report.reporter_name ?? report.reporter}
                    </p>
                  </div>
                  {report.status === 'pending' && (
                    <div className='flex gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => void handleResolve(report.id, 'ignored')}
                        disabled={actionInProgress === report.id}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => void handleResolve(report.id, 'removed')}
                        disabled={actionInProgress === report.id}
                      >
                        {actionInProgress === report.id ? (
                          <Loader2 className='size-4 animate-spin' />
                        ) : (
                          'Remove'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface LogTabProps {
  forumId: string
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ')
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate: 'Hate speech',
  violence: 'Violence',
  misinformation: 'Misinformation',
  offtopic: 'Off-topic',
  other: 'Other',
}

function formatReason(reason: string): string {
  return REASON_LABELS[reason] ?? reason
}

function LogTab({ forumId }: LogTabProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [entries, setEntries] = useState<ModerationLogEntry[]>([])

  const loadLog = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await forumsApi.getModerationLog({ forum: forumId, limit: 50 })
      setEntries(response.data?.entries ?? [])
    } catch (error) {
      setLoadError(toError(error, 'Failed to load moderation log'))
    } finally {
      setIsLoading(false)
    }
  }, [forumId])

  useEffect(() => {
    void loadLog()
  }, [loadLog])

  if (isLoading) {
    return (
      <Card>
         <CardContent className='divide-y pt-4'>
            {Array.from({ length: 5 }).map((_, i) => (
               <div key={i} className='py-3 space-y-1'>
                  <div className='flex items-center gap-2'>
                     <Skeleton className='h-4 w-32' />
                     <Skeleton className='h-4 w-24' />
                     <Skeleton className='h-4 w-32' />
                  </div>
                  <Skeleton className='h-3 w-48' />
               </div>
            ))}
         </CardContent>
      </Card>
    )
  }

  if (loadError) {
    return (
      <GeneralError
        error={loadError}
        minimal
        mode='inline'
        reset={() => {
          void loadLog()
        }}
      />
    )
  }

  if (entries.length === 0) {
    return (
      <div className='py-12'>
        <EmptyState
          icon={History}
          title="No moderation activity"
          description="There are no moderation actions recorded yet"
        />
      </div>
    )
  }

  return (
    <Card>
      <CardContent className='divide-y pt-4'>
        {entries.map((entry) => {
          const date = new Date(entry.created * 1000)
          const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
          return (
            <div key={entry.id} className='py-3 first:pt-0 last:pb-0'>
              <p className='text-sm'>
                <span className='text-muted-foreground'>{timestamp}</span>{' '}
                {formatAction(entry.action)}{' '}
                <span className='font-medium'>
                  {entry.author_name ?? entry.author ?? entry.target.slice(0, 8)}
                </span>{' '}
                <span className='text-muted-foreground'>
                  · {entry.moderator_name ?? entry.moderator}
                </span>
              </p>
              {entry.reason && (
                <p className='text-muted-foreground mt-0.5 text-xs'>
                  Reason: {entry.reason}
                </p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

interface RestrictionsTabProps {
  forumId: string
}

function RestrictionsTab({ forumId }: RestrictionsTabProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  const loadRestrictions = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await forumsApi.getRestrictions({ forum: forumId })
      setRestrictions(response.data?.restrictions ?? [])
    } catch (error) {
      setLoadError(toError(error, 'Failed to load restrictions'))
    } finally {
      setIsLoading(false)
    }
  }, [forumId])

  useEffect(() => {
    void loadRestrictions()
  }, [loadRestrictions])

  const handleUnrestrict = async (userId: string) => {
    setActionInProgress(userId)
    try {
      await forumsApi.unrestrictUser({ forum: forumId, user: userId })
      toast.success('Restriction removed')
      void loadRestrictions()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to remove restriction'))
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return (
      <Card>
         <CardContent className='divide-y pt-4'>
            {Array.from({ length: 3 }).map((_, i) => (
               <div key={i} className='flex justify-between items-center py-3'>
                  <div className='flex items-center gap-2'>
                      <Skeleton className='h-8 w-8 rounded-full' />
                      <div className='space-y-1'>
                         <Skeleton className='h-4 w-32' />
                         <Skeleton className='h-3 w-24' />
                      </div>
                  </div>
                  <Skeleton className='h-8 w-24' />
               </div>
            ))}
         </CardContent>
      </Card>
    )
  }

  if (loadError) {
    return (
      <GeneralError
        error={loadError}
        minimal
        mode='inline'
        reset={() => {
          void loadRestrictions()
        }}
      />
    )
  }

  if (restrictions.length === 0) {
    return (
      <div className='py-12'>
        <EmptyState
          icon={Users}
          title="No restrictions"
          description="No users have been muted or banned"
        />
      </div>
    )
  }

  return (
    <Card>
      <CardContent className='divide-y pt-4'>
        {restrictions.map((restriction) => (
          <div
            key={restriction.user}
            className='flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0'
          >
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-2'>
                <span className='font-medium'>
                  {restriction.name ?? restriction.user}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    restriction.type === 'banned'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : restriction.type === 'muted'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                  )}
                >
                  {restriction.type}
                </span>
              </div>
              {restriction.reason && (
                <p className='text-muted-foreground mt-0.5 text-sm'>
                  {restriction.reason}
                </p>
              )}
              <p className='text-muted-foreground mt-1 text-xs'>
                By {restriction.moderator_name ?? restriction.moderator}
                {restriction.expires
                  ? ` · Expires ${new Date(restriction.expires * 1000).toLocaleDateString()}`
                  : ' · Permanent'}
              </p>
            </div>
            <Button
              size='sm'
              variant='outline'
              onClick={() => void handleUnrestrict(restriction.user)}
              disabled={actionInProgress === restriction.user}
            >
              {actionInProgress === restriction.user ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                'Remove'
              )}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
