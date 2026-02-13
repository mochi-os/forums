import { useCallback, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Hash } from 'lucide-react'
import { FindEntityPage } from '@mochi/common'
import { useForumsInfo, forumsKeys } from '@/hooks/use-forums-queries'
import forumsApi from '@/api/forums'
import endpoints from '@/api/endpoints'

export const Route = createFileRoute('/_authenticated/find')({
  component: FindForumsPage,
})

function FindForumsPage() {
  const { data } = useForumsInfo()
  const queryClient = useQueryClient()

  const forums = useMemo(() => data?.data?.forums ?? [], [data?.data?.forums])

  // Recommendations query
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    isError: isRecommendationsError,
  } = useQuery({
    queryKey: forumsKeys.recommendations(),
    queryFn: () => forumsApi.getRecommendations(),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const recommendations = recommendationsData?.data?.forums ?? []

  const subscribedForumIds = useMemo(
    () => new Set(
      forums.flatMap((f) => [f.id, f.fingerprint].filter((x): x is string => !!x))
    ),
    [forums]
  )

  const handleSubscribe = useCallback(
    async (forumId: string) => {
      await forumsApi.subscribeForum(forumId)
      queryClient.invalidateQueries({ queryKey: forumsKeys.all })
    },
    [queryClient]
  )

  return (
    <FindEntityPage
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
  )
}
