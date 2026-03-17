import { useCallback, useMemo } from 'react'
import {
  AuthenticatedLayout,
  type SidebarData,
  type NavItem,
  type NavSubItem,
} from '@mochi/web'
import {
  Hash,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  Gavel,
  Search,
} from 'lucide-react'
import type { Forum } from '@/api/types/forums'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsInfo,
  useForumInfo,
  useCreatePost,
} from '@/hooks/use-forums-queries'
import { CreateForumDialog } from '@/features/forums/components/create-forum-dialog'
import { CreatePostDialog } from '@/features/forums/components/create-post-dialog'

function ForumsLayoutInner() {
  const {
    forum,
    postDialogOpen,
    postDialogForum,
    closePostDialog,
    forumDialogOpen,
    openForumDialog,
    closeForumDialog,
  } = useSidebarContext()

  // Use lightweight info endpoint for forum list (no P2P calls)
  const {
    data,
    isLoading,
    error: forumsInfoError,
    refetch: refetchForumsInfo,
  } = useForumsInfo()
  // Fetch current forum permissions (at most 1 P2P call)
  const {
    data: currentForumInfo,
    error: currentForumInfoError,
    isLoading: isLoadingCurrentForumInfo,
    refetch: refetchCurrentForumInfo,
  } = useForumInfo(forum)
  const forums = useMemo(() => data?.data?.forums ?? [], [data?.data?.forums])

  // Find forums for dialog
  const dialogForum = useMemo(() => {
    if (!postDialogForum) return null
    return (
      forums.find(
        (f) => f.id === postDialogForum || f.fingerprint === postDialogForum
      ) ?? null
    )
  }, [forums, postDialogForum])

  // Create post mutation
  const createPostMutation = useCreatePost(postDialogForum)

  const handleCreatePost = useCallback(
    (data: {
      forum: string
      title: string
      body: string
      attachments?: File[]
    }) => {
      createPostMutation.mutate(data)
    },
    [createPostMutation]
  )

  // Build sidebar data
  const sidebarData: SidebarData = useMemo(() => {
    // Sort forums alphabetically
    const sortedForums = [...forums].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )

    // Build forum items - use fingerprint for shorter URLs
    const forumItems = sortedForums.map((f: Forum) => {
      const isCurrentForum = forum === f.id || forum === f.fingerprint
      const forumUrl = f.fingerprint ?? f.id
      const subItems: NavSubItem[] = []

      // Build manage items - use currentForumInfo for permissions (handles P2P for subscribed forums)
      const manageItems: { title: string; icon: typeof Settings | typeof Gavel; url: string }[] = []
      const hasResolvedCurrentPermissions = Boolean(currentForumInfo?.data?.permissions)
      const hasCurrentPermissionsError = isCurrentForum && !!currentForumInfoError
      const canManage = isCurrentForum
        ? hasResolvedCurrentPermissions &&
          !isLoadingCurrentForumInfo &&
          !hasCurrentPermissionsError &&
          (currentForumInfo?.data?.permissions.manage ?? false)
        : f.can_manage
      const canModerate = isCurrentForum
        ? hasResolvedCurrentPermissions &&
          !isLoadingCurrentForumInfo &&
          !hasCurrentPermissionsError &&
          (currentForumInfo?.data?.permissions.moderate ?? false)
        : f.can_moderate

      // Settings link for forum managers only
      if (isCurrentForum && canManage) {
        manageItems.push({
          title: 'Settings',
          icon: Settings,
          url: `/${forumUrl}/settings`,
        })
      }
      // Moderation link for managers and moderators
      if (isCurrentForum && (canManage || canModerate)) {
        manageItems.push({
          title: 'Moderation',
          icon: Gavel,
          url: `/${forumUrl}/moderation`,
        })
      }

      if (isCurrentForum && hasCurrentPermissionsError) {
        subItems.push({
          title: 'Manage',
          items: [
            {
              title: 'Retry permissions load',
              icon: RefreshCw,
              onClick: () => {
                void refetchCurrentForumInfo()
              },
              className: 'text-destructive',
            },
          ],
        } as NavSubItem)
      }

      // Group manage items under "Manage" section if there are any
      if (manageItems.length > 0) {
        subItems.push({
          title: 'Manage',
          items: manageItems,
        } as NavSubItem)
      }

      // NavCollapsible when there are sub-items, NavLink otherwise
      if (subItems.length > 0) {
        return {
          title: f.name,
          url: `/${forumUrl}`,
          icon: Hash,
          items: subItems,
        }
      }

      return {
        title: f.name,
        url: `/${forumUrl}`,
        icon: Hash,
      }
    })

    const allForumsItem: NavItem = {
      title: 'All forums',
      url: '/',
      icon: MessageSquare,
    }

    // Build action items (moved to bottom)
    const actionItems: NavItem[] = [
      { title: 'Find forums', icon: Search, url: '/find' },
      {
        title: 'Create forum',
        icon: Plus,
        onClick: openForumDialog,
      },
    ]

    const groups: SidebarData['navGroups'] = [
      {
        title: 'Forums',
        items: forumsInfoError
          ? [
            allForumsItem,
            {
              title: 'Retry forums load',
              icon: RefreshCw,
              onClick: () => {
                void refetchForumsInfo()
              },
              className: 'text-destructive',
            },
          ]
          : [allForumsItem, ...forumItems],
      },
      {
        title: '',
        items: actionItems,
        separator: true,
      },
    ]

    return { navGroups: groups }
  }, [
    forums,
    forum,
    openForumDialog,
    currentForumInfo,
    currentForumInfoError,
    isLoadingCurrentForumInfo,
    forumsInfoError,
    refetchForumsInfo,
    refetchCurrentForumInfo,
  ])

  return (
    <>
      <AuthenticatedLayout
        sidebarData={sidebarData}
        isLoadingSidebar={isLoading && forums.length === 0}
      />

      {/* Create Post Dialog - controlled from sidebar */}
      {dialogForum && (
        <CreatePostDialog
          forumId={dialogForum.id}
          forumName={dialogForum.name}
          onCreate={handleCreatePost}
          isPending={createPostMutation.isPending}
          isSuccess={createPostMutation.isSuccess}
          open={postDialogOpen}
          onOpenChange={(open) => {
            if (!open) closePostDialog()
          }}
          hideTrigger
        />
      )}

      {/* Create Forum Dialog - controlled from sidebar */}
      <CreateForumDialog
        open={forumDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeForumDialog()
        }}
        hideTrigger
      />
    </>
  )
}

export function ForumsLayout() {
  return (
    <SidebarProvider>
      <ForumsLayoutInner />
    </SidebarProvider>
  )
}
