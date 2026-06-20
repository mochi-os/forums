// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import { Bookmark } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Main,
  PageHeader,
  usePageTitle,
} from '@mochi/web'
import type { Post, SavedItem, SavedPostSnapshot } from '@/api/types/posts'
import {
  clearSaved,
  getSaved,
  loadSaved,
  onSavedChange,
} from '@/lib/saved'
import { PostCard } from '../components/post-card'

// Rebuild a Post-shaped object from the stored snapshot so the saved list can
// reuse the real PostCard (identical blue header / avatar / meta / layout).
// Fields not captured in the slim snapshot get harmless defaults.
function snapshotToPost(s: SavedPostSnapshot): Post {
  return {
    id: s.id,
    forum: s.forum,
    fingerprint: s.fingerprint,
    member: s.member,
    name: s.name,
    title: s.title,
    body: s.body,
    body_markdown: s.body_markdown,
    comments: 0,
    up: s.up,
    down: s.down,
    created: s.created,
    updated: s.created,
    forumName: s.forumName,
    tags: s.tags,
    attachments: s.attachments,
  }
}

export function SavedPage() {
  const { t } = useLingui()
  const navigate = useNavigate()
  usePageTitle(t`Saved`)
  const [saved, setSaved] = useState<SavedItem[]>(getSaved())
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    const unsubscribe = onSavedChange(() => setSaved(getSaved()))
    void loadSaved()
    return unsubscribe
  }, [])

  return (
    <>
      <PageHeader
        icon={<Bookmark className='size-4 md:size-5' />}
        title={t`Saved`}
        actions={
          saved.length > 0 ? (
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowClearConfirm(true)}
            >
              <Trans>Clear all</Trans>
            </Button>
          ) : undefined
        }
      />
      <Main>
        {saved.length === 0 ? (
          <div className='py-24'>
            <EmptyState
              icon={Bookmark}
              title={t`Nothing saved yet`}
              description={t`Tap the bookmark on any post to save it here for later.`}
            />
          </div>
        ) : (
          <div className='space-y-4'>
            {saved.map((item) => {
              const post = snapshotToPost(item.post)
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  forumName={post.forumName ?? ''}
                  showForumBadge={!!post.forumName}
                  isLoggedIn
                  onSelect={(forumId, postId) =>
                    navigate({
                      to: '/$forum/$post',
                      params: { forum: forumId, post: postId },
                    })
                  }
                />
              )
            })}
          </div>
        )}
      </Main>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title={<Trans>Clear all saved posts?</Trans>}
        desc={
          <Trans>
            This removes every post from your saved list. This cannot be undone.
          </Trans>
        }
        destructive
        confirmText={<Trans>Clear all</Trans>}
        handleConfirm={() => {
          clearSaved()
          setShowClearConfirm(false)
        }}
      />
    </>
  )
}
