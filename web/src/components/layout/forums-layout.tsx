import { useCallback, useEffect, useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import {
  AuthenticatedLayout,
  type SidebarData,
  type NavItem,
  naturalCompare,
} from '@mochi/web'
import {
  Bookmark,
  Hash,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import type { Forum } from '@/api/types/forums'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsInfo,
  useCreatePost,
} from '@/hooks/use-forums-queries'
import { loadSaved } from '@/lib/saved'
import { CreateForumDialog } from '@/features/forums/components/create-forum-dialog'
import { CreatePostDialog } from '@/features/forums/components/create-post-dialog'

function ForumsLayoutInner() {
  const { t } = useLingui()
  const {
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
  const forums = useMemo(() => data?.data?.forums ?? [], [data?.data?.forums])

  // Hydrate the saved-posts mirror so bookmarks reflect server state
  useEffect(() => {
    void loadSaved()
  }, [])

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
      naturalCompare(a.name, b.name)
    )

    // Build forum items - use fingerprint for shorter URLs.
    // Per-forum management actions (Settings, Moderation) live in the page-level
    // ⋯ OptionsMenu, not the sidebar.
    const forumItems = sortedForums.map((f: Forum) => {
      const forumUrl = f.fingerprint ?? f.id

      return {
        title: f.name,
        url: `/${forumUrl}`,
        icon: Hash,
      }
    })

    const allForumsItem: NavItem = {
      title: t`All forums`,
      url: '/',
      icon: MessageSquare,
    }

    // Build action items (moved to bottom)
    const actionItems: NavItem[] = [
      { title: t`Saved`, icon: Bookmark, url: '/saved' },
      { title: t`Find forums`, icon: Search, url: '/find' },
      {
        title: t`Create forum`,
        icon: Plus,
        onClick: openForumDialog,
      },
    ]

    const groups: SidebarData['navGroups'] = [
      {
        title: t`Forums`,
        items: forumsInfoError
          ? [
            allForumsItem,
            {
              title: t`Retry forums load`,
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
    openForumDialog,
    forumsInfoError,
    refetchForumsInfo,
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
            if (!open) {
              closePostDialog()
              createPostMutation.reset()
            }
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
