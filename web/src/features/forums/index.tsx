import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Main } from '@mochi/common'
import { forumsApi } from '@/api/forums'
import { ForumsHeader } from './components/forums-header'
import { ForumsTabs } from './components/forums-tabs'

export function Forums() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  // Fetch list of forums (also includes posts from subscribed forums)
  const { data: forumsData } = useQuery({
    queryKey: ['forums', 'list'],
    queryFn: () => forumsApi.list(),
  })

  // Get posts from the list response
  const posts = forumsData?.data?.posts || []

  // Create forum mutation
  const createForumMutation = useMutation({
    mutationFn: (name: string) => forumsApi.create({ name }),
    onSuccess: () => {
      toast.success('Forum created successfully!')
      queryClient.invalidateQueries({ queryKey: ['forums', 'list'] })
    },
    onError: (error) => {
      toast.error('Failed to create forum')
      console.error('Create forum error:', error)
    },
  })

  const handleCreateForum = (input: { name: string; memberAccess: string; allowSearch: boolean }) => {
    if (!input.name.trim()) {
      toast.error('Please enter a forum name')
      return
    }
    createForumMutation.mutate(input.name)
  }

  const handleThreadSelect = (threadId: string) => {
    navigate({
      to: `/thread/${threadId}`,
    })
  }

  // Convert Post[] to ForumThread[] for compatibility with existing components
  const threads = posts.map((post) => ({
    id: post.id,
    category: 'General', // Not in API, using default
    title: post.title,
    excerpt: post.body.substring(0, 150) + (post.body.length > 150 ? '...' : ''),
    content: post.body,
    author: {
      name: post.name,
      role: 'Member',
    },
    postedAt: post.created_local,
    tags: [], // Not in API
    status: 'open' as const,
    replyCount: post.comments,
    viewCount: 0, // Not in API
    participants: 0, // Not in API
    watchers: 0, // Not in API
    lastActivity: post.created_local,
    comments: [],
  }))

  // Filter threads based on search term
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredThreads = normalizedSearch
    ? threads.filter(t => 
        t.title.toLowerCase().includes(normalizedSearch) ||
        t.excerpt.toLowerCase().includes(normalizedSearch)
      )
    : threads

  return (
    <>
      <Main>
        <ForumsHeader
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onCreateForum={handleCreateForum}
        />

        <ForumsTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          allThreads={filteredThreads}
          trendingThreads={[]}
          unansweredThreads={filteredThreads.filter(t => t.replyCount === 0)}
          onSelectThread={handleThreadSelect}
          normalizedSearch={normalizedSearch}
        />
      </Main>
    </>
  )
}
