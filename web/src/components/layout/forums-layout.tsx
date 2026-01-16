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
} from 'lucide-react'
import type { Forum } from '@/api/types/forums'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  useCreatePost,
  useCreateForum,
  forumsKeys,
  selectPosts,
  useForumDetail,
} from '@/hooks/use-forums-queries'
import { CreateForumDialog } from '@/features/forums/components/create-forum-dialog'
import { CreatePostDialog } from '@/features/forums/components/create-post-dialog'
import { SearchForumsDialog } from '@/features/forums/components/search-forums-dialog'
import type { Post } from '@/api/types/forums'

function ForumsLayoutInner() {
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
    searchDialogOpen,
    openSearchDialog,
    closeSearchDialog,
  } = useSidebarContext()

  const { data } = useForumsList()
  // Fetch details for the current forum to populate sidebar with all its posts
  const { data: detailData } = useForumDetail(forum)

  const forums = useMemo(() => data?.data?.forums ?? [], [data?.data?.forums])
  const allPosts = useMemo(() => {
    const listPosts = selectPosts(data)
    const detailPosts = detailData?.data?.posts || []
    
    // Merge posts ensuring uniqueness by ID
    const map = new Map<string, Post>()
    listPosts.forEach((p) => map.set(p.id, p))
    detailPosts.forEach((p) => map.set(p.id, p))
    
    return Array.from(map.values())
  }, [data, detailData])

  const queryClient = useQueryClient()

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

      // Get posts for this forum
      const forumPosts = allPosts.filter((p) => p.forum === f.id)
      const listedPostIds = new Set(forumPosts.map((p) => p.id))

      // Add all known posts
      forumPosts.forEach((p) => {
        subItems.push({
          title: p.title,
          icon: FileText,
          url: `/${forumUrl}/${p.id}`,
        })
      })

      // If current post is not in the list (e.g. loaded individually), add it
      if (
        isCurrentForum &&
        postTitle &&
        post &&
        !listedPostIds.has(post)
      ) {
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
      { title: 'New forum', icon: Plus, onClick: openForumDialog, variant: 'primary' },
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
  }, [forums, forum, post, postTitle, openForumDialog, openSearchDialog])

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

      {/* Search Forums Dialog - controlled from sidebar */}
      <SearchForumsDialog
        open={searchDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeSearchDialog()
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
