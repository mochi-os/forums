// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  GeneralError,
  Skeleton,
  toast,
  toastAction,
  getErrorMessage,
  callWithServerFallback,
} from '@mochi/web'
import { Hash, Loader2 } from 'lucide-react'
import forumsApi from '@/api/forums'
import type { RecommendedForum } from '@/api/types/forums'
import { useQueryClient } from '@tanstack/react-query'
import { forumsKeys } from '@/hooks/use-forums-queries'

interface RecommendedForumsProps {
  subscribedIds: Set<string>
  onSubscribe?: () => void
}

export function RecommendedForums({
  subscribedIds,
  onSubscribe,
}: RecommendedForumsProps) {
  const { t } = useLingui()
  const [recommendations, setRecommendations] = useState<RecommendedForum[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await forumsApi.getRecommendations()
      setRecommendations(response.data.forums ?? [])
    } catch (loadError) {
      setRecommendations([])
      setError(
        new Error(getErrorMessage(loadError, t`Failed to load recommended forums`))
      )
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchRecommendations()
  }, [fetchRecommendations])

  const handleSubscribe = async (forum: RecommendedForum) => {
    setPendingId(forum.id)
    try {
      const data = await toastAction(
        callWithServerFallback(
          (server) => forumsApi.subscribeForum(forum.id, server),
          forum.server || undefined,
        ),
        {
          loading: t`Subscribing...`,
          success: false,
          error: (e) => getErrorMessage(e, t`Failed to subscribe`),
        }
      )
      if (data.data?.already_subscribed) {
        toast.info(t`You are already subscribed to this forum`)
      } else {
        toast.success(t`Subscribed to ${forum.name}`)
      }
      void queryClient.invalidateQueries({ queryKey: forumsKeys.all })
      onSubscribe?.()
      setRecommendations((prev) => prev.filter((f) => f.id !== forum.id))
    } catch {
      // toast already shown
    } finally {
      setPendingId(null)
    }
  }

  const filteredRecommendations = recommendations.filter(
    (rec) => !subscribedIds.has(rec.id) && !subscribedIds.has(rec.fingerprint)
  )

  if (isLoading) {
    return (
      <>
        <hr className="my-6 w-full max-w-md border-t" />
        <div className="w-full max-w-md">
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="divide-border divide-y rounded-lg border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <hr className="my-6 w-full max-w-md border-t" />
        <div className="w-full max-w-md">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
            <Trans>Recommended forums</Trans>
          </p>
          <GeneralError
            error={error}
            minimal
            mode='inline'
            reset={fetchRecommendations}
          />
        </div>
      </>
    )
  }

  if (filteredRecommendations.length === 0) {
    return null
  }

  return (
    <>
      <hr className="my-6 w-full max-w-md border-t" />
      <div className="w-full max-w-md">
        <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
          <Trans>Recommended forums</Trans>
        </p>
        <div className="divide-border divide-y rounded-lg border text-start">
          {filteredRecommendations.map((forum) => {
            const isPending = pendingId === forum.id

            return (
              <div
                key={forum.id}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-hover"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Hash className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{forum.name}</span>
                    {forum.blurb && (
                      <span className="text-muted-foreground truncate text-xs">
                        {forum.blurb}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSubscribe(forum)}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trans>Subscribe</Trans>
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
