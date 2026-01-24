import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AuthenticatedLayout,
  type SidebarData,
  type NavItem,
  type NavSubItem,
  SearchEntityDialog,
} from '@mochi/common'
import {
  FileText,
  Hash,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Gavel,
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
  useForumRecommendations,
} from '@/hooks/use-forums-queries'
import { CreateForumDialog } from '@/features/forums/components/create-forum-dialog'
import { CreatePostDialog } from '@/features/forums/components/create-post-dialog'
import { forumsApi } from '@/api/forums'
import endpoints from '@/api/endpoints'
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
  // Recommendations for the search dialog
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    isError: isRecommendationsError,
  } = useForumRecommendations()
  const recommendations = recommendationsData?.data?.forums ?? []

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

  // Set of subscribed forum IDs for search dialog
  const subscribedForumIds = useMemo(
    () => new Set(forums.flatMap((f) => [f.id, f.fingerprint].filter(Boolean))),
    [forums]
  )

  // Handle subscribe from search dialog
  const handleSubscribe = useCallback(async (forumId: string) => {
    await forumsApi.subscribe(forumId)
    queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
  }, [queryClient])

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

      // Settings link for forum managers only
      if (isCurrentForum && f.can_manage) {
        subItems.push({
          title: 'Settings',
          icon: Settings,
          url: `/${forumUrl}/settings`,
        })
      }
      // Moderation link for managers and moderators
      if (isCurrentForum && (f.can_manage || f.can_moderate)) {
        subItems.push({
          title: 'Moderation',
          icon: Gavel,
          url: `/${forumUrl}/moderation`,
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

    const allForumsItem: NavItem = {
      title: 'All forums',
      url: '/',
      icon: MessageSquare,
    }

    // Build bottom items
    const bottomItems: NavItem[] = [
      { title: 'Find forums', icon: Search, onClick: openSearchDialog },
      { title: 'Create forum', icon: Plus, onClick: openForumDialog },
    ]

    const groups: SidebarData['navGroups'] = [
      {
        title: 'Forums',
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
      <SearchEntityDialog
        open={searchDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeSearchDialog()
        }}
        onSubscribe={handleSubscribe}
        subscribedIds={subscribedForumIds}
        entityClass="forum"
        searchEndpoint={endpoints.forums.search}
        icon={Hash}
        iconClassName="bg-blue-500/10 text-blue-600"
        title="Find forums"
        placeholder="Search by name, ID, fingerprint, or URL..."
        emptyMessage="No forums found"
        recommendations={recommendations}
        isLoadingRecommendations={isLoadingRecommendations}
        isRecommendationsError={isRecommendationsError}
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
