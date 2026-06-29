// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, Hash } from 'lucide-react'
import {
  Button,
  GeneralError,
  Input,
  toast,
  toastAction,
  getErrorMessage,
  callWithServerFallback,
} from '@mochi/web'
import forumsApi from '@/api/forums'
import type { DirectoryEntry } from '@/api/types/forums'
import { forumsKeys } from '@/hooks/use-forums-queries'

interface InlineForumSearchProps {
  subscribedIds: Set<string>
  onRefresh?: () => void
}

export function InlineForumSearch({
  subscribedIds,
  onRefresh,
}: InlineForumSearchProps) {
  const { t } = useLingui()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<DirectoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<Error | null>(null)
  const [pendingForumId, setPendingForumId] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const runSearch = useCallback(async (query: string) => {
    if (query.length === 0) {
      setResults([])
      setSearchError(null)
      return
    }

    setIsLoading(true)
    setSearchError(null)
    try {
      const response = await forumsApi.searchForums({ search: query })
      setResults(response.data.results ?? [])
    } catch (error) {
      setResults([])
      setSearchError(
        new Error(getErrorMessage(error, t`Failed to search forums`))
      )
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setResults([])
      setSearchError(null)
      return
    }

    void runSearch(debouncedQuery)
  }, [debouncedQuery, runSearch])

  const retrySearch = useCallback(() => {
    void runSearch(debouncedQuery)
  }, [debouncedQuery, runSearch])

  const handleSubscribe = async (forum: DirectoryEntry) => {
    setPendingForumId(forum.id)
    try {
      const data = await toastAction(
        callWithServerFallback(
          (location) => forumsApi.subscribeForum(forum.id, location),
          forum.location || undefined,
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
        toast.success(t`Subscribed`)
      }
      void queryClient.invalidateQueries({ queryKey: forumsKeys.all })
      onRefresh?.()
      void navigate({ to: '/$forum', params: { forum: forum.id } })
    } catch {
      // toast already shown
    } finally {
      setPendingForumId(null)
    }
  }

  const showResults = debouncedQuery.length > 0
  const showLoading = isLoading && debouncedQuery.length > 0

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative mb-4">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={t`Search for forums...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 ps-9"
          autoFocus
        />
      </div>

      {showLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && showResults && searchError && (
        <GeneralError
          error={searchError}
          minimal
          mode='inline'
          reset={retrySearch}
        />
      )}

      {!isLoading && showResults && !searchError && results.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          <Trans>No forums found</Trans>
        </p>
      )}

      {!isLoading && !searchError && results.length > 0 && (
        <div className="divide-border divide-y rounded-lg border">
          {results
            .filter((forum) => !forum.subscribed && !subscribedIds.has(forum.id) && !subscribedIds.has(forum.fingerprint))
            .map((forum) => {
              const isPending = pendingForumId === forum.id

              return (
                <div
                  key={forum.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-hover"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Hash className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col text-start">
                      <span className="truncate text-sm font-medium">{forum.name}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {forum.fingerprint_hyphens}
                      </span>
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
      )}
    </div>
  )
}
