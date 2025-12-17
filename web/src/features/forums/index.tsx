import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Main,
  Input,
} from '@mochi/common'
import { forumsApi } from '@/api/forums'
import {
  Search,
  Loader2,
} from 'lucide-react'
import { CreateForumDialog } from './components/create-forum-dialog'
import { CreatePostDialog } from './components/create-post-dialog'
import { ForumDirectory } from './components/forum-directory'
import { ForumOverview } from './components/forum-overview'
import type { Forum, DirectoryEntry, Post } from '@/api/types/forums'

export function Forums() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedForumId, setSelectedForumId] = useState<string | null>(null)
  const [subscribingForumId, setSubscribingForumId] = useState<string | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
  }

  // Fetch list of forums (also includes posts)
  const { data: forumsData, isLoading: _isLoading } = useQuery({
    queryKey: ['forums', 'list'],
    queryFn: () => forumsApi.list(),
  })

  const forums: Forum[] = forumsData?.data?.forums || []
  const allPosts: Post[] = forumsData?.data?.posts || []

  // Search forums globally
  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ['forums', 'search', debouncedSearchTerm],
    queryFn: () => forumsApi.search({ search: debouncedSearchTerm }),
    enabled: debouncedSearchTerm.trim().length > 0,
  })

  const searchResults: DirectoryEntry[] = searchData?.data?.results || []

  // Fetch specific forum details when selected
  const { data: forumDetailData, isLoading: isLoadingForum } = useQuery({
    queryKey: ['forums', 'detail', selectedForumId],
    queryFn: () => {
      console.log('[Forums] Fetching forum detail for:', selectedForumId)
      return forumsApi.view(selectedForumId!)
    },
    enabled: !!selectedForumId,
    staleTime: 0, 
  })

  const selectedForum = selectedForumId ? forumDetailData?.data?.forum : null
  const selectedForumPosts = forumDetailData?.data?.posts || []

  // Create Forum Mutation
  const createForumMutation = useMutation({
    mutationFn: forumsApi.create,
    onSuccess: (data) => {
      toast.success('Forum created successfully!')
      queryClient.invalidateQueries({ queryKey: ['forums', 'list'] })
      setSelectedForumId(data.data.id)
    },
    onError: (error) => {
      toast.error('Failed to create forum')
      console.error(error)
    },
  })

  // Create Post Mutation
  const createPostMutation = useMutation({
    mutationFn: forumsApi.createPost,
    onSuccess: () => {
      toast.success('Post created successfully!')
      queryClient.invalidateQueries({ queryKey: ['forums', 'list'] })
      if (selectedForumId) {
        queryClient.invalidateQueries({ queryKey: ['forums', 'detail', selectedForumId] })
      }
    },
    onError: (error) => {
      toast.error('Failed to create post')
      console.error(error)
    },
  })

  // Subscribe Mutation
  const subscribeMutation = useMutation({
    mutationFn: (forumId: string) => {
      setSubscribingForumId(forumId)
      return forumsApi.subscribe(forumId)
    },
    onSuccess: (data, _forumId) => {
      if (data.data.already_subscribed) {
        toast.info('You are already subscribed to this forum')
      } else {
        toast.success('Subscribed successfully!')
        queryClient.invalidateQueries({ queryKey: ['forums', 'list'] })
      }
      setSubscribingForumId(null)
    },
    onError: (error) => {
      toast.error('Failed to subscribe')
      console.error(error)
      setSubscribingForumId(null)
    },
  })

  // Unsubscribe Mutation
  const unsubscribeMutation = useMutation({
    mutationFn: (forumId: string) => forumsApi.unsubscribe(forumId),
    onSuccess: () => {
      toast.success('Unsubscribed successfully')
      setSelectedForumId(null) // Go back to all forums
      queryClient.invalidateQueries({ queryKey: ['forums', 'list'] })
    },
    onError: (error) => {
      toast.error('Failed to unsubscribe')
      console.error(error)
    },
  })

  const handleCreateForum = (data: { name: string }) => {
    createForumMutation.mutate(data)
  }

  const handleCreatePost = (data: { title: string; body: string; attachments?: File[] }) => {
    if (!selectedForumId) return
    createPostMutation.mutate({
      forum: selectedForumId,
      ...data,
    })
  }

  const handlePostSelect = (forumId: string, postId: string) => {
    navigate({
      to: '/thread/$forumId/$threadId',
      params: { forumId, threadId: postId },
    })
  }

  const handleSubscribe = (forumId: string) => {
    subscribeMutation.mutate(forumId)
  }

  const handleUnsubscribe = (forumId: string) => {
    unsubscribeMutation.mutate(forumId)
  }

  // Helper to get forum name from ID
  const getForumName = (id: string) => {
    const forum = forums.find((f) => f.id === id)
    return forum ? forum.name : 'Unknown'
  }

  const postsToDisplay = useMemo(() => {
    // If a forum is selected, show its posts (fetched from detail endpoint)
    if (selectedForumId) {
       // If loading specifically this forum, return empty or wait
       // But usually we might want to show skeleton. Current UI handles loading state.
       return selectedForumPosts
    }
    
    // Otherwise show all posts from the list endpoint, with forum names added
    return allPosts.map(post => ({
      ...post,
      forumName: getForumName(post.forum)
    }))
  }, [selectedForumId, selectedForumPosts, allPosts, getForumName])


  return (
    <Main className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-4">
          <div className="space-y-1">
             <h1 className="text-2xl font-bold tracking-tight">Forums</h1>
             <p className="text-sm text-muted-foreground hidden lg:block">
               Share progress, ask for help, and learn from the community
             </p>
          </div>
          <div className="relative max-w-md flex-1 md:ml-auto">
             <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
             <Input
               placeholder="Search forums globally..."
               value={searchTerm}
               onChange={(e) => handleSearchChange(e.target.value)}
               className="pl-9 h-10 w-full"
             />
             {isSearching && (
               <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
             )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedForumId && selectedForum && ['', 'administrator', 'poster'].includes(selectedForum.role) && (
            <CreatePostDialog
              forumId={selectedForumId}
              forumName={selectedForum?.name || 'Forum'}
              onCreate={handleCreatePost}
              isPending={createPostMutation.isPending}
              triggerVariant="icon"
            />
          )}
          <CreateForumDialog onCreate={handleCreateForum} />
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* Forum Directory Sidebar */}
        <div className="h-[calc(100vh-5rem)] lg:sticky lg:top-4">
          <ForumDirectory
            forums={forums}
            posts={allPosts}
            searchTerm={searchTerm}
            selectedForumId={selectedForumId}
            onSelectForum={setSelectedForumId}
            searchResults={searchResults}
            onSubscribe={handleSubscribe}
            isSubscribing={subscribeMutation.isPending}
            subscribingForumId={subscribingForumId}
          />
        </div>

        {/* Content Area */}
        <section className="min-w-0 space-y-6">
          {isLoadingForum && selectedForumId ? (
            <div className="flex h-40 items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-sm">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
              onUnsubscribe={handleUnsubscribe}
              isUnsubscribing={unsubscribeMutation.isPending}
            />
          )}
        </section>
      </div>
    </Main>
  )
}
