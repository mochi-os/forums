import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Main,
  cn,
  usePageTitle,
  AccessDialog,
  AccessList,
  type AccessLevel,
  type AccessRule,
  getErrorMessage,
  toast,
  Input,
} from '@mochi/common'
import { Loader2, Plus, Hash, Settings, Shield, Trash2, Pencil, Check, X } from 'lucide-react'

// Characters disallowed in forum names (matches backend validation)
const DISALLOWED_NAME_CHARS = /[<>\r\n\\;"'`]/
import { forumsApi } from '@/api/forums'
import { useSidebarContext } from '@/context/sidebar-context'
import { useForumsList } from '@/hooks/use-forums-queries'

type TabId = 'general' | 'access'

type SettingsSearch = {
  tab?: TabId
}

export const Route = createFileRoute('/_authenticated/$forum_/settings')({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    tab: (search.tab === 'general' || search.tab === 'access') ? search.tab : undefined,
  }),
  component: ForumSettingsPage,
})

interface ForumData {
  id: string
  name: string
  fingerprint: string
  can_manage: boolean
}

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'general', label: 'Settings', icon: <Settings className='h-4 w-4' /> },
  { id: 'access', label: 'Access', icon: <Shield className='h-4 w-4' /> },
]

// Access levels for forums (without manage)
const FORUMS_ACCESS_LEVELS: AccessLevel[] = [
  { value: 'post', label: 'Post, comment, vote, and view' },
  { value: 'comment', label: 'Comment, vote, and view' },
  { value: 'vote', label: 'Vote and view' },
  { value: 'view', label: 'View only' },
  { value: 'none', label: 'No access' },
]

function ForumSettingsPage() {
  const params = Route.useParams()
  const forumId = 'forum' in params ? params.forum : ''
  const navigate = useNavigate()
  const navigateSettings = Route.useNavigate()
  const { tab } = Route.useSearch()
  const activeTab = tab ?? 'general'

  const setActiveTab = (newTab: TabId) => {
    void navigateSettings({ search: { tab: newTab }, replace: true })
  }
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Get forum from list query
  const {
    data: forumsData,
    isLoading: isLoadingForums,
    refetch: refreshForums,
  } = useForumsList()
  const forums = useMemo(
    () => forumsData?.data?.forums ?? [],
    [forumsData?.data?.forums]
  )
  const forum = useMemo(
    () => forums.find((f) => f.id === forumId || f.fingerprint === forumId) ?? null,
    [forums, forumId]
  )
  // Cast to ForumData with required fields
  const selectedForum: ForumData | null = forum
    ? {
        id: forum.id,
        name: forum.name,
        fingerprint: forum.fingerprint,
        can_manage: forum.can_manage ?? false,
      }
    : null

  // Update page title when forum is loaded
  usePageTitle(
    selectedForum?.name ? `${selectedForum.name} settings` : 'Settings'
  )

  // Register with sidebar context to keep forum expanded in sidebar
  const { setForum } = useSidebarContext()
  useEffect(() => {
    setForum(forumId)
    return () => setForum(null)
  }, [forumId, setForum])

  const handleUnsubscribe = useCallback(async () => {
    if (!selectedForum || isUnsubscribing) return

    setIsUnsubscribing(true)
    try {
      await forumsApi.unsubscribe(selectedForum.id)
      toast.success('Unsubscribed')
      void refreshForums()
      void navigate({ to: '/' })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to unsubscribe'))
    } finally {
      setIsUnsubscribing(false)
    }
  }, [selectedForum, isUnsubscribing, refreshForums, navigate])

  const handleDelete = useCallback(async () => {
    if (!selectedForum || !selectedForum.can_manage || isDeleting) return

    setIsDeleting(true)
    try {
      await forumsApi.delete(selectedForum.id)
      toast.success('Forum deleted')
      void refreshForums()
      void navigate({ to: '/' })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete forum'))
    } finally {
      setIsDeleting(false)
    }
  }, [selectedForum, isDeleting, refreshForums, navigate])

  const handleRename = useCallback(async (name: string) => {
    if (!selectedForum || !selectedForum.can_manage) return

    try {
      await forumsApi.rename(selectedForum.id, name)
      void refreshForums()
      toast.success('Forum renamed')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to rename forum'))
      throw error
    }
  }, [selectedForum, refreshForums])

  // Can unsubscribe if subscribed and not the owner
  const canUnsubscribe = !!(selectedForum && !selectedForum.can_manage)

  if (isLoadingForums && !selectedForum) {
    return (
      <>
        <PageHeader title="Settings" />
        <Main>
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='text-muted-foreground size-6 animate-spin' />
          </div>
        </Main>
      </>
    )
  }

  if (!selectedForum) {
    return (
      <>
        <PageHeader title="Settings" />
        <Main>
          <Card>
            <CardContent className='py-12 text-center'>
              <Hash className='text-muted-foreground mx-auto mb-4 size-12' />
              <h2 className='text-lg font-semibold'>Forum not found</h2>
              <p className='text-muted-foreground mt-1 text-sm'>
                This forum may have been deleted or you don't have access to it.
              </p>
            </CardContent>
          </Card>
        </Main>
      </>
    )
  }

  return (
    <>
      <PageHeader title={selectedForum.name ? `${selectedForum.name} settings` : 'Settings'} />
      <Main className='space-y-6'>
        {/* Tabs - only show for owners */}
        {selectedForum.can_manage && (
          <div className='flex gap-1 border-b'>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                  '-mb-px border-b-2',
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        <div className='pt-2'>
          {activeTab === 'general' && (
            <GeneralTab
              forum={selectedForum}
              canUnsubscribe={canUnsubscribe}
              isUnsubscribing={isUnsubscribing}
              isDeleting={isDeleting}
              showDeleteDialog={showDeleteDialog}
              setShowDeleteDialog={setShowDeleteDialog}
              onUnsubscribe={handleUnsubscribe}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          )}
          {activeTab === 'access' && selectedForum.can_manage && (
            <AccessTab forumId={selectedForum.id} />
          )}
        </div>
      </Main>
    </>
  )
}

interface GeneralTabProps {
  forum: ForumData
  canUnsubscribe: boolean
  isUnsubscribing: boolean
  isDeleting: boolean
  showDeleteDialog: boolean
  setShowDeleteDialog: (show: boolean) => void
  onUnsubscribe: () => void
  onDelete: () => void
  onRename: (name: string) => Promise<void>
}

function GeneralTab({
  forum,
  canUnsubscribe,
  isUnsubscribing,
  isDeleting,
  showDeleteDialog,
  setShowDeleteDialog,
  onUnsubscribe,
  onDelete,
  onRename,
}: GeneralTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(forum.name)
  const [isRenaming, setIsRenaming] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const validateName = (name: string): string | null => {
    if (!name.trim()) return 'Forum name is required'
    if (name.length > 1000) return 'Name must be 1000 characters or less'
    if (DISALLOWED_NAME_CHARS.test(name)) return 'Name cannot contain < > \\ ; " \' or ` characters'
    return null
  }

  const handleStartEdit = () => {
    setEditName(forum.name)
    setNameError(null)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName(forum.name)
    setNameError(null)
  }

  const handleSaveEdit = async () => {
    const trimmedName = editName.trim()
    const error = validateName(trimmedName)
    if (error) {
      setNameError(error)
      return
    }
    if (trimmedName === forum.name) {
      setIsEditing(false)
      return
    }
    setIsRenaming(true)
    try {
      await onRename(trimmedName)
      setIsEditing(false)
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center'>
            <span className='text-muted-foreground'>Name:</span>
            {forum.can_manage && isEditing ? (
              <div className='flex flex-col gap-1'>
                <div className='flex items-center gap-2'>
                  <Input
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value)
                      setNameError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveEdit()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className='h-8'
                    disabled={isRenaming}
                    autoFocus
                  />
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => void handleSaveEdit()}
                    disabled={isRenaming}
                    className='h-8 w-8 p-0'
                  >
                    {isRenaming ? (
                      <Loader2 className='size-4 animate-spin' />
                    ) : (
                      <Check className='size-4' />
                    )}
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={handleCancelEdit}
                    disabled={isRenaming}
                    className='h-8 w-8 p-0'
                  >
                    <X className='size-4' />
                  </Button>
                </div>
                {nameError && (
                  <span className='text-sm text-destructive'>{nameError}</span>
                )}
              </div>
            ) : (
              <div className='flex items-center gap-2'>
                <span>{forum.name}</span>
                {forum.can_manage && (
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={handleStartEdit}
                    className='h-6 w-6 p-0'
                  >
                    <Pencil className='size-3' />
                  </Button>
                )}
              </div>
            )}

            <span className='text-muted-foreground'>Entity:</span>
            <span className='font-mono text-xs break-all'>{forum.id}</span>

            {forum.fingerprint && (
              <>
                <span className='text-muted-foreground'>Fingerprint:</span>
                <span className='font-mono text-xs break-all'>
                  {forum.fingerprint.match(/.{1,3}/g)?.join('-')}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {(canUnsubscribe || forum.can_manage) && (
        <Card>
          <CardContent className='space-y-4 pt-6'>
            {canUnsubscribe && (
              <div className='flex items-center justify-between'>
                <div>
                  <p className='font-medium'>Unsubscribe from forum</p>
                  <p className='text-muted-foreground text-sm'>
                    Remove this forum from your sidebar. You can resubscribe
                    later.
                  </p>
                </div>
                <Button
                  variant='outline'
                  onClick={onUnsubscribe}
                  disabled={isUnsubscribing}
                >
                  {isUnsubscribing ? (
                    <>
                      <Loader2 className='mr-2 size-4 animate-spin' />
                      Unsubscribing...
                    </>
                  ) : (
                    'Unsubscribe'
                  )}
                </Button>
              </div>
            )}

            {forum.can_manage && (
              <div className='flex items-center justify-between'>
                <div>
                  <p className='font-medium'>Delete forum</p>
                  <p className='text-muted-foreground text-sm'>
                    Permanently delete this forum and all its posts. This cannot
                    be undone.
                  </p>
                </div>
                <Button
                  variant='outline'
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className='size-4' />
                  Delete forum
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete forum?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{forum.name}" and all its posts and
              comments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface AccessTabProps {
  forumId: string
}

function AccessTab({ forumId }: AccessTabProps) {
  const [rules, setRules] = useState<AccessRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')

  // User search query
  const { data: userSearchData, isLoading: userSearchLoading } = useQuery({
    queryKey: ['users', 'search', userSearchQuery],
    queryFn: () => forumsApi.searchUsers(userSearchQuery),
    enabled: userSearchQuery.length >= 1,
  })

  // Groups query
  const { data: groupsData } = useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () => forumsApi.listGroups(),
  })

  const loadRules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await forumsApi.getAccess({ forum: forumId })
      // Transform backend response to AccessRule format
      const accessList = response.data?.access ?? []
      const transformedRules: AccessRule[] = accessList
        .filter((item) => item.level !== null || item.isOwner)
        .map((item) => ({
          subject: item.id,
          operation: item.level ?? '*',
          grant: 1,
          name: item.name,
          isOwner: item.isOwner,
        }))
      setRules(transformedRules)
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load access rules')
      )
    } finally {
      setIsLoading(false)
    }
  }, [forumId])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const handleAdd = async (
    subject: string,
    subjectName: string,
    level: string
  ) => {
    try {
      await forumsApi.setAccess({
        forum: forumId,
        user: subject,
        level: level as 'view' | 'vote' | 'comment' | 'post' | 'none',
      })
      toast.success(`Access set for ${subjectName}`)
      void loadRules()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to set access level'))
      throw error // Re-throw so the dialog knows it failed
    }
  }

  const handleRevoke = async (subject: string) => {
    try {
      await forumsApi.revokeAccess({ forum: forumId, user: subject })
      toast.success('Access removed')
      void loadRules()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to remove access'))
    }
  }

  const handleLevelChange = async (subject: string, newLevel: string) => {
    try {
      await forumsApi.setAccess({
        forum: forumId,
        user: subject,
        level: newLevel as 'view' | 'vote' | 'comment' | 'post' | 'none',
      })
      toast.success('Access level updated')
      void loadRules()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update access level'))
    }
  }

  return (
    <Card>
      <CardContent className='space-y-4 pt-6'>
        {/* Add access button - right aligned */}
        <div className='flex justify-end'>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Add
          </Button>
        </div>

        <AccessDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAdd={handleAdd}
          levels={FORUMS_ACCESS_LEVELS.filter((l) => l.value !== 'none')}
          defaultLevel='post'
          userSearchResults={userSearchData?.data?.results ?? []}
          userSearchLoading={userSearchLoading}
          onUserSearch={setUserSearchQuery}
          groups={groupsData?.data?.groups ?? []}
        />

        <AccessList
          rules={rules}
          levels={FORUMS_ACCESS_LEVELS}
          onLevelChange={handleLevelChange}
          onRevoke={handleRevoke}
          isLoading={isLoading}
          error={error}
        />
      </CardContent>
    </Card>
  )
}
