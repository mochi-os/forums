import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

type SubscriptionState = {
  isRemote: boolean
  isSubscribed: boolean
  canUnsubscribe: boolean
}

type SidebarContextValue = {
  // Current forum tracking
  forum: string | null
  setForum: (id: string | null) => void

  // Current post tracking
  post: string | null
  postTitle: string | null
  setPost: (id: string | null, title: string | null) => void

  // New post dialog
  postDialogOpen: boolean
  postDialogForum: string | null
  openPostDialog: (forum: string) => void
  closePostDialog: () => void

  // New forum dialog
  forumDialogOpen: boolean
  openForumDialog: () => void
  closeForumDialog: () => void

  // Subscription state and handlers for current forum
  subscription: SubscriptionState | null
  setSubscription: (state: SubscriptionState | null) => void
  subscribeHandler: React.MutableRefObject<(() => void) | null>
  unsubscribeHandler: React.MutableRefObject<(() => void) | null>
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [forum, setForum] = useState<string | null>(null)
  const [post, setPostId] = useState<string | null>(null)
  const [postTitle, setPostTitle] = useState<string | null>(null)
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [postDialogForum, setPostDialogForum] = useState<string | null>(null)
  const [forumDialogOpen, setForumDialogOpen] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null)
  const subscribeHandler = useRef<(() => void) | null>(null)
  const unsubscribeHandler = useRef<(() => void) | null>(null)

  const setPost = useCallback((id: string | null, title: string | null) => {
    setPostId(id)
    setPostTitle(title)
  }, [])

  const openPostDialog = useCallback((targetForum: string) => {
    setPostDialogForum(targetForum)
    setPostDialogOpen(true)
  }, [])

  const closePostDialog = useCallback(() => {
    setPostDialogOpen(false)
    setPostDialogForum(null)
  }, [])

  const openForumDialog = useCallback(() => {
    setForumDialogOpen(true)
  }, [])

  const closeForumDialog = useCallback(() => {
    setForumDialogOpen(false)
  }, [])

  return (
    <SidebarContext.Provider value={{
      forum,
      setForum,
      post,
      postTitle,
      setPost,
      postDialogOpen,
      postDialogForum,
      openPostDialog,
      closePostDialog,
      forumDialogOpen,
      openForumDialog,
      closeForumDialog,
      subscription,
      setSubscription,
      subscribeHandler,
      unsubscribeHandler,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarContext() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarProvider')
  }
  return context
}
