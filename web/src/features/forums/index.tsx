import { useMemo, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Main, usePageTitle } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import {
  useForumsList,
  useForumDetail,
  useCreatePost,
  useSubscribeForum,
  useUnsubscribeForum,
  selectForums,
  selectPosts,
} from '@/hooks/use-forums-queries'
import { CreatePostDialog } from './components/create-post-dialog'
import { ForumOverview } from './components/forum-overview'
import { APP_ROUTES } from '@/config/routes'

export function Forums() {
  usePageTitle('Forums - Mochi')
  const navigate = useNavigate()

  // Get forum from URL query param
  const search = useSearch({ strict: false }) as { forum?: string }
  const forumFromUrl = search.forum ?? null

  // Sidebar context for state sync
  const {
    setForum,
    setSubscription,
    subscribeHandler,
    unsubscribeHandler,
  } = useSidebarContext()

  // Sync URL forum param to sidebar context
  useEffect(() => {
    setForum(forumFromUrl)
  }, [forumFromUrl, setForum])

  // Queries
  const { data: forumsData } = useForumsList()
  const forums = selectForums(forumsData)
  const allPosts = selectPosts(forumsData)

  const { data: forumDetailData, isLoading: isLoadingForum } = useForumDetail(forumFromUrl)
  const selectedForum = forumFromUrl ? forumDetailData?.data?.forum : null
  const selectedForumPosts = (forumDetailData?.data?.posts || []).filter(p => 'title' in p && p.title)

  // Mutations
  const createPostMutation = useCreatePost(forumFromUrl)
  const subscribeMutation = useSubscribeForum()
  const unsubscribeMutation = useUnsubscribeForum(() => {
    // Navigate back to all forums after unsubscribe
    navigate({ to: APP_ROUTES.HOME })
  })

  // Register subscribe/unsubscribe handlers with sidebar
  useEffect(() => {
    if (forumFromUrl) {
      subscribeHandler.current = () => subscribeMutation.mutate(forumFromUrl)
      unsubscribeHandler.current = () => unsubscribeMutation.mutate(forumFromUrl)

      // Update subscription state for sidebar
      const forum = forums.find(f => f.id === forumFromUrl)
      setSubscription({
        remote: !forum, // If not in our forums list, it's remote
        subscribed: !!forum,
        can_unsubscribe: !!forum && !forum.can_manage,
      })
    } else {
      subscribeHandler.current = null
      unsubscribeHandler.current = null
      setSubscription(null)
    }

    return () => {
      subscribeHandler.current = null
      unsubscribeHandler.current = null
    }
  }, [forumFromUrl, forums, subscribeMutation, unsubscribeMutation, subscribeHandler, unsubscribeHandler, setSubscription])

  const handleCreatePost = (data: { title: string; body: string; attachments?: File[] }) => {
    if (!forumFromUrl) return
    createPostMutation.mutate({
      forum: forumFromUrl,
      ...data,
    })
  }

  const handlePostSelect = (forum: string, thread: string) => {
    navigate({
      to: '/thread/$forum/$thread',
      params: { forum, thread },
    })
  }

  const handleUnsubscribe = (forum: string) => {
    unsubscribeMutation.mutate(forum)
  }

  const postsToDisplay = useMemo(() => {
    // If a forum is selected, show its posts (fetched from detail endpoint)
    if (forumFromUrl) {
      return selectedForumPosts
    }

    // Otherwise show all posts from the list endpoint, with forum names added
    return allPosts.map(post => {
      const forum = forums.find((f) => f.id === post.forum)
      return {
        ...post,
        forumName: forum?.name ?? 'Unknown',
      }
    })
  }, [forumFromUrl, selectedForumPosts, allPosts, forums])

  return (
    <Main fixed className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {selectedForum?.name ?? 'All forums'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedForum
              ? `${postsToDisplay.length} post${postsToDisplay.length !== 1 ? 's' : ''}`
              : 'Share progress, ask for help, and learn from the community'}
          </p>
        </div>
        {forumFromUrl && selectedForum?.can_post && (
          <CreatePostDialog
            forumId={forumFromUrl}
            forumName={selectedForum?.name || 'Forum'}
            onCreate={handleCreatePost}
            isPending={createPostMutation.isPending}
            isSuccess={createPostMutation.isSuccess}
            triggerVariant="icon"
          />
        )}
      </div>

      {/* Content */}
      {isLoadingForum && forumFromUrl ? (
        <div className="flex h-40 items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm">Loading forum...</p>
          </div>
        </div>
      ) : (
        <ForumOverview
          forum={selectedForum || null}
          posts={postsToDisplay}
          onSelectPost={handlePostSelect}
          onCreatePost={handleCreatePost}
          isCreatingPost={createPostMutation.isPending}
          isPostCreated={createPostMutation.isSuccess}
          onUnsubscribe={handleUnsubscribe}
          isUnsubscribing={unsubscribeMutation.isPending}
        />
      )}
    </Main>
  )
}
