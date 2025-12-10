import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Main } from '@/components/layout/main'
import { forumThreads, type ForumThread } from './data'
import { ForumsHeader } from './components/forums-header'
import { ForumsTabs } from './components/forums-tabs'
import { memberAccessOptions } from './constants'

const matchesSearch = (thread: ForumThread, term: string) => {
  const normalized = term.toLowerCase()
  return (
    thread.title.toLowerCase().includes(normalized) ||
    thread.excerpt.toLowerCase().includes(normalized) ||
    thread.category.toLowerCase().includes(normalized) ||
    thread.tags.some((tag) => tag.toLowerCase().includes(normalized)) ||
    thread.memberPermission?.toLowerCase().includes(normalized)
  )
}

export function Forums() {
  const [activeTab, setActiveTab] = useState('all')
  const [threads, setThreads] = useState(forumThreads)
  const [threadSearchTerm, setThreadSearchTerm] = useState('')
  const navigate = useNavigate()

  const allThreads = threads
  const trendingThreads = useMemo(
    () => allThreads.filter((thread) => thread.replyCount >= 10 || thread.viewCount > 250),
    [allThreads]
  )
  const unansweredThreads = useMemo(
    () => allThreads.filter((thread) => thread.replyCount === 0),
    [allThreads]
  )

  const normalizedSearch = threadSearchTerm.trim()

  const filteredAllThreads = useMemo(() => {
    if (!normalizedSearch) return allThreads
    return allThreads.filter((thread) => matchesSearch(thread, normalizedSearch))
  }, [allThreads, normalizedSearch])

  const filteredTrendingThreads = useMemo(() => {
    if (!normalizedSearch) return trendingThreads
    return trendingThreads.filter((thread) => matchesSearch(thread, normalizedSearch))
  }, [trendingThreads, normalizedSearch])

  const filteredUnansweredThreads = useMemo(() => {
    if (!normalizedSearch) return unansweredThreads
    return unansweredThreads.filter((thread) => matchesSearch(thread, normalizedSearch))
  }, [unansweredThreads, normalizedSearch])

  const handleThreadSelect = (threadId: string) => {
    navigate({
      to: `/thread/${threadId}`,
    })
  }

  const handleCreateForum = ({
    name,
    memberAccess,
    allowSearch,
  }: {
    name: string
    memberAccess: string
    allowSearch: boolean
  }) => {
    if (!name.trim()) return

    const memberPermissionLabel =
      memberAccessOptions.find((option) => option.value === memberAccess)?.label ?? ''

    const newThread: ForumThread = {
      id: `forum-${Date.now()}`,
      category: 'Community',
      title: name.trim(),
      excerpt: `New forum created. New members may ${memberPermissionLabel.toLowerCase()}.`,
      content: memberPermissionLabel,
      author: {
        name: 'You',
        role: 'Admin',
      },
      postedAt: 'Just now',
      tags: ['community'],
      status: 'open',
      replyCount: 0,
      viewCount: 0,
      participants: 1,
      watchers: 1,
      lastActivity: 'Just now',
      comments: [],
      memberPermission: memberPermissionLabel,
      allowSearch,
    }

    setThreads((current) => [newThread, ...current])
  }

  return (
    <>


      <Main>
        <ForumsHeader
          searchTerm={threadSearchTerm}
          onSearchChange={setThreadSearchTerm}
          onCreateForum={handleCreateForum}
        />

        <ForumsTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          allThreads={filteredAllThreads}
          trendingThreads={filteredTrendingThreads}
          unansweredThreads={filteredUnansweredThreads}
          onSelectThread={handleThreadSelect}
          normalizedSearch={normalizedSearch}
        />
      </Main>
    </>
  )
}
