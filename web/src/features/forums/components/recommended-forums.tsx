import { useEffect, useState } from 'react'
import { Card, CardContent, Button, Skeleton, toast } from '@mochi/common'
import { Hash, Loader2 } from 'lucide-react'
import { forumsApi } from '@/api/forums'
import type { RecommendedForum } from '@/api/types/forums'
import { useQueryClient } from '@tanstack/react-query'
import { forumsKeys } from '@/hooks/use-forums-queries'

interface RecommendedForumsProps {
  onSubscribe?: () => void
}

export function RecommendedForums({ onSubscribe }: RecommendedForumsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedForum[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await forumsApi.recommendations()
        setRecommendations(response.data.forums ?? [])
      } catch {
        // Silently fail for recommendations
      } finally {
        setIsLoading(false)
      }
    }

    void fetchRecommendations()
  }, [])

  const handleSubscribe = async (forum: RecommendedForum) => {
    setPendingId(forum.id)
    try {
      await forumsApi.subscribe(forum.id)
      void queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      onSubscribe?.()
      toast.success(`Subscribed to ${forum.name}`)
      // Remove from list
      setRecommendations((prev) => prev.filter((f) => f.id !== forum.id))
    } catch (error) {
      toast.error('Failed to subscribe', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setPendingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-full">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (recommendations.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Recommended for you</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.slice(0, 6).map((forum) => (
          <Card key={forum.id} className="h-full flex flex-col hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Hash className="h-5 w-5" />
                </div>
                <Button
                  size="sm"
                  variant={pendingId === forum.id ? "ghost" : "default"}
                  className={pendingId === forum.id ? "pointer-events-none" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"}
                  onClick={() => handleSubscribe(forum)}
                  disabled={!!pendingId}
                >
                  {pendingId === forum.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </div>
              
              <div className="space-y-1 flex-1">
                <h4 className="font-semibold line-clamp-1" title={forum.name}>
                  {forum.name}
                </h4>
                {forum.blurb && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {forum.blurb}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
