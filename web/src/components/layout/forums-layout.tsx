import { useCallback, useMemo } from 'react'
import { useLocation } from '@tanstack/react-router'
import { AuthenticatedLayout, type SidebarData, type NavItem, type NavSubItem } from '@mochi/common'
import { Hash, MessageSquare, Plus, Search, SquarePen, UserMinus, Users } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { useForumsList, useCreatePost, useCreateForum, forumsKeys } from '@/hooks/use-forums-queries'
import { APP_ROUTES } from '@/config/routes'
import { CreatePostDialog } from '@/features/forums/components/create-post-dialog'
import { CreateForumDialog } from '@/features/forums/components/create-forum-dialog'
import type { Forum } from '@/api/types/forums'

function ForumsLayoutInner() {
  const { data } = useForumsList()
  const forums = useMemo(() => data?.data?.forums ?? [], [data?.data?.forums])
  const queryClient = useQueryClient()
  const pathname = useLocation({ select: (location) => location.pathname })

  const {
    forum,
    post_dialog_open,
    post_dialog_forum,
    openPostDialog,
    closePostDialog,
    forum_dialog_open,
    openForumDialog,
    closeForumDialog,
    subscription,
    subscribeHandler,
    unsubscribeHandler,
  } = useSidebarContext()

  // Find forums for dialog
  const dialogForum = useMemo(() => {
    if (!post_dialog_forum) return null
    return forums.find((f) => f.id === post_dialog_forum) ?? null
  }, [forums, post_dialog_forum])

  // Create post mutation
  const createPostMutation = useCreatePost(post_dialog_forum)

  const handleCreatePost = useCallback(
    (data: { forum: string; title: string; body: string; attachments?: File[] }) => {
      createPostMutation.mutate(data)
    },
    [createPostMutation]
  )

  // Create forum mutation
  const createForumMutation = useCreateForum()

  const handleCreateForum = useCallback(
    (data: { name: string; access: string }) => {
      createForumMutation.mutate(
        { name: data.name, access: data.access as 'view' | 'vote' | 'comment' | 'post' },
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

    // Build forum items
    const forumItems = sortedForums.map((f: Forum) => {
      const isCurrentForum = forum === f.id
      const subItems: NavSubItem[] = []

      // New post for forums where user can post
      if (f.can_post) {
        subItems.push({
          title: 'New post',
          icon: SquarePen,
          onClick: () => openPostDialog(f.id),
        })
      }

      // Manage members for forum owners
      if (f.can_manage) {
        subItems.push({
          title: 'Manage members',
          icon: Users,
          // For now, clicking navigates to forum - could open dialog in future
          onClick: () => {
            // TODO: Could open members dialog directly
          },
        })
      }

      // Unsubscribe for non-owned current forums
      if (isCurrentForum && !f.can_manage && subscription?.can_unsubscribe && unsubscribeHandler.current) {
        const handler = unsubscribeHandler.current
        subItems.push({
          title: 'Unsubscribe',
          icon: UserMinus,
          onClick: () => handler(),
        })
      }

      // NavCollapsible when there are sub-items, NavLink otherwise
      if (subItems.length > 0) {
        return {
          title: f.name,
          url: `/?forum=${f.id}`,
          icon: Hash,
          items: subItems,
          open: isCurrentForum,
        }
      }

      return {
        title: f.name,
        url: `/?forum=${f.id}`,
        icon: Hash,
      }
    })

    // Build "All forums" item
    const isOnHome = pathname === '/' || pathname === ''
    const ownedForums = forums.filter((f) => f.can_manage)

    const allForumsItem: NavItem = ownedForums.length > 0
      ? {
          title: 'All forums',
          url: APP_ROUTES.HOME,
          icon: MessageSquare,
          items: [
            {
              title: 'New forum',
              icon: Plus,
              onClick: openForumDialog,
            },
          ],
          open: !forum && isOnHome,
        }
      : {
          title: 'All forums',
          url: APP_ROUTES.HOME,
          icon: MessageSquare,
        }

    // Build bottom items
    const bottomItems: NavItem[] = [
      { title: 'Search', url: APP_ROUTES.SEARCH, icon: Search },
    ]

    // Add subscribe action when viewing remote unsubscribed forum
    if (subscription?.remote && !subscription?.subscribed && subscribeHandler.current) {
      const handler = subscribeHandler.current
      bottomItems.push({
        title: 'Subscribe to forum',
        icon: Plus,
        onClick: () => handler(),
      })
    }

    bottomItems.push({
      title: 'New forum',
      icon: Plus,
      onClick: openForumDialog,
    })

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
  }, [
    forums,
    forum,
    pathname,
    openPostDialog,
    openForumDialog,
    subscription,
    subscribeHandler,
    unsubscribeHandler,
  ])

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
          open={post_dialog_open}
          onOpenChange={(open) => {
            if (!open) closePostDialog()
          }}
          hideTrigger
        />
      )}

      {/* Create Forum Dialog - controlled from sidebar */}
      <CreateForumDialog
        onCreate={handleCreateForum}
        open={forum_dialog_open}
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
