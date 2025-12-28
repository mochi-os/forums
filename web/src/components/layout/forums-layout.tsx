import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { APP_ROUTES } from '@/config/routes'
import {
  AuthenticatedLayout,
  type SidebarData,
  type NavItem,
  type NavSubItem,
} from '@mochi/common'
import {
  FileText,
  Hash,
  MessageSquare,
  Plus,
  Search,
} from 'lucide-react'
import type { Forum } from '@/api/types/forums'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  useCreatePost,
  useCreateForum,
  forumsKeys,
} from '@/hooks/use-forums-queries'
import { CreateForumDialog } from '@/features/forums/components/create-forum-dialog'
import { CreatePostDialog } from '@/features/forums/components/create-post-dialog'

function ForumsLayoutInner() {
  const { data } = useForumsList()
  const forums = useMemo(() => data?.data?.forums ?? [], [data?.data?.forums])
  const queryClient = useQueryClient()

  const {
    forum,
    post,
    postTitle,
    postDialogOpen,
    postDialogForum,
    closePostDialog,
    forumDialogOpen,
    openForumDialog,
    closeForumDialog,
  } = useSidebarContext()

  // Find forums for dialog
  const dialogForum = useMemo(() => {
    if (!postDialogForum) return null
    return forums.find((f) => f.id === postDialogForum || f.fingerprint === postDialogForum) ?? null
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

  // Create forum mutation
  const createForumMutation = useCreateForum()

  const handleCreateForum = useCallback(
    (data: { name: string }) => {
      createForumMutation.mutate(
        { name: data.name },
        {
          onSuccess: () => {
            closeForumDialog()
            queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
          },
        }
      )
    },
    [createForumMutation, closeForumDialog, queryClient]
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

      // Current post title
      if (isCurrentForum && postTitle && post) {
        subItems.push({
          title: postTitle,
          icon: FileText,
          url: `/${forumUrl}/${post}`,
        })
      }

      // NavCollapsible when there are sub-items, NavLink otherwise
      if (subItems.length > 0) {
        return {
          title: f.name,
          url: `/${forumUrl}`,
          icon: Hash,
          items: subItems,
          open: isCurrentForum,
        }
      }

      return {
        title: f.name,
        url: `/${forumUrl}`,
        icon: Hash,
      }
    })

    // Build "All forums" item
    const allForumsItem: NavItem = {
      title: 'All forums',
      url: APP_ROUTES.HOME,
      icon: MessageSquare,
    }

    // Build bottom items
    const bottomItems: NavItem[] = [
      { title: 'Search for forums', url: APP_ROUTES.SEARCH, icon: Search },
      { title: 'New forum', icon: Plus, onClick: openForumDialog },
    ]

    const groups: SidebarData['navGroups'] = [
      {
        title: '',
        items: [allForumsItem, ...forumItems],
      },
      {
        title: '',
        separator: true,
        items: bottomItems,
      },
    ]

    return { navGroups: groups }
  }, [forums, forum, post, postTitle, openForumDialog])

  return (
    <>
      <AuthenticatedLayout sidebarData={sidebarData} />

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
        onCreate={handleCreateForum}
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
