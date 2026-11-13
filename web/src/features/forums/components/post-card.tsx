// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useMemo } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import {
  Card,
  CardContent,
  CommentShareButton,
  EntityAvatar,
  absoluteRouteUrl,
  PostTitleBar,
  cn,
  useFormat,
} from '@mochi/web'
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Clock,
  EyeOff,
  Lock,
  Pin,
} from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { forumPath } from '@/lib/forum-path'
import { postAssets } from '../author-assets'
import { sanitizeHtml } from '../utils'
import { PostLink } from './post-link'
import { PostTagsTooltip } from './post-tags'
import { SavedButton } from './saved-button'
import { SensitiveBadge, SensitiveCover } from './sensitive-cover'
import { PostAttachments } from './thread/post-attachments'

interface PostCardProps {
  post: Post
  forumName: string
  /** The server of a community on another network, beside its name. */
  forumServer?: string
  showForumBadge: boolean
  server?: string
  onSelect: (forumId: string, postId: string) => void
  onTagFilter?: (label: string) => void
  onInterestUp?: (qid: string) => void
  onInterestDown?: (qid: string) => void
  onInterestRemove?: (qid: string) => void
  isLoggedIn?: boolean
  variant?: 'card' | 'list-item'
  /**
   * One asset address per author across the list (`authorAssets`), so an
   * author's avatar and style are fetched once, not once per post.
   */
  avatars?: ReadonlyMap<string, string>
}

export function PostCard({
  post,
  forumName,
  forumServer,
  showForumBadge,
  server,
  onSelect,
  onTagFilter,
  onInterestUp,
  onInterestDown,
  onInterestRemove,
  isLoggedIn = true,
  variant = 'card',
  avatars,
}: PostCardProps) {
  const { formatTimestamp } = useFormat()
  const router = useRouter()
  const assets = avatars?.get(post.member) ?? postAssets(post)
  const timestamp = formatTimestamp(post.created)
  // Sanitising HTML is not free; the card re-renders on hover/selection state,
  // so memoise on the raw markdown rather than re-running it every render.
  const sanitizedBody = useMemo(
    () => (post.body_markdown ? sanitizeHtml(post.body_markdown) : ''),
    [post.body_markdown]
  )

  const content = (
    <div className='relative space-y-3 p-4'>
      <PostTitleBar
        size='card'
        title={
          <h3>
            {/* The card's own onClick is mouse-only. This is the keyboard and
                screen-reader route into the post, and it takes the title as its
                name rather than the whole card's text. Propagation stops here so
                the card handler doesn't select a second time. */}
            <button
              type='button'
              className='focus-visible:ring-primary-foreground/70 cursor-pointer rounded-sm text-start outline-none focus-visible:ring-[3px]'
              onClick={(e) => {
                e.stopPropagation()
                onSelect(post.fingerprint ?? post.forum, post.id)
              }}
            >
              {post.title}
            </button>
          </h3>
        }
        trailing={
          <>
            {!!post.sensitive && <SensitiveBadge />}
            {post.status === 'pending' && (
              <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
                <Clock className='size-3' />
                <Trans>Pending</Trans>
              </span>
            )}
            {post.status === 'removed' && (
              <span className='bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'>
                <EyeOff className='size-3' />
                <Trans>Removed</Trans>
              </span>
            )}
            {!!post.locked && (
              <span className='bg-surface-2 text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'>
                <Lock className='size-3' />
              </span>
            )}
            {!!post.pinned && (
              <span className='bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'>
                <Pin className='size-3' />
              </span>
            )}
          </>
        }
        meta={
          // Three unbreakable units - forum, author, time - so a narrow card
          // wraps between them, never inside a name or a date (see the
          // matching note in ThreadContent).
          <span className='inline-flex flex-wrap items-center gap-x-1.5 gap-y-1'>
            {showForumBadge ? (
              <span className='whitespace-nowrap'>
                {forumName}
                {forumServer && (
                  <span className='opacity-70'> {forumServer}</span>
                )}{' '}
                ·{' '}
              </span>
            ) : null}
            <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
              <EntityAvatar
                src={`${assets}/avatar`}
                styleUrl={`${assets}/style`}
                seed={post.member}
                name={post.name}
                size='xs'
              />
              <span>{post.name}</span>
              <span> · </span>
            </span>
            <span className='whitespace-nowrap'>{timestamp}</span>
          </span>
        }
        metaClassName='opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100'
      />

      <SensitiveCover sensitive={!!post.sensitive}>
        <div className='space-y-3'>
          <PostLink post={post} compact />

          {/* Body */}
          {post.body_markdown ? (
            <div
              className='text-foreground line-clamp-2 max-w-none text-sm leading-normal [&_li]:my-0 [&_ol]:my-0 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:my-0 [&_ul]:my-0 [&_ul]:list-disc [&_ul]:ps-6'
              dangerouslySetInnerHTML={{ __html: sanitizedBody }}
            />
          ) : (
            <p className='text-foreground line-clamp-2 text-sm'>{post.body}</p>
          )}

          {/* Attachments */}
          <PostAttachments
            attachments={post.attachments || []}
            forumId={post.forum}
            server={server}
          />
        </div>
      </SensitiveCover>

      {/* Action buttons row - interactive. Always shown: Share is in it. */}
      <div className='text-muted-foreground flex items-center gap-4 text-xs md:gap-3'>
        {/* Tags */}
        {isLoggedIn && post.tags && post.tags.length > 0 && (
          <PostTagsTooltip
            tags={post.tags}
            onFilter={onTagFilter}
            onInterestUp={onInterestUp}
            onInterestDown={onInterestDown}
            onInterestRemove={onInterestRemove}
          />
        )}

        {/* Relevance match indicators */}
        {post.matches && post.matches.length > 0 && (
          <span className='inline-flex items-center gap-1'>
            {post.matches.map((m) => (
              <span
                key={m.qid}
                className='rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
              >
                {m.label || m.qid}
              </span>
            ))}
          </span>
        )}

        {/* Upvote count */}
        {(post.up > 0 || post.user_vote === 'up') && (
          <span className='inline-flex items-center gap-1'>
            {post.user_vote === 'up' ? (
              <span className='text-sm'>👍</span>
            ) : (
              <ThumbsUp className='size-4' />
            )}
            {post.up > 0 && post.up}
          </span>
        )}

        {/* Downvote count */}
        {(post.down > 0 || post.user_vote === 'down') && (
          <span className='inline-flex items-center gap-1'>
            {post.user_vote === 'down' ? (
              <span className='text-sm'>👎</span>
            ) : (
              <ThumbsDown className='size-4' />
            )}
            {post.down > 0 && post.down}
          </span>
        )}

        {/* Comments navigation link */}
        {getCommentCount(post.comments) > 0 && (
          <Link
            to='/$forum/$post'
            params={{ forum: forumPath(post.forum), post: post.id }}
            search={showForumBadge ? { from: 'all' } : undefined}
            className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors'
            onClick={(e) => e.stopPropagation()}
          >
            <MessageSquare className='size-3' />
            <span>{getCommentCount(post.comments)}</span>
          </Link>
        )}

        {/* Save for later */}
        {isLoggedIn && <SavedButton post={post} />}

        {/* Share, last in the row and revealed on card hover like a hollow
            bookmark, so appearing pushes nothing. The wrapper keeps the
            press from opening the post. */}
        <span
          className='inline-flex md:pointer-events-none md:max-w-0 md:overflow-hidden md:opacity-0 md:transition-all md:duration-200 md:group-focus-within/card:pointer-events-auto md:group-focus-within/card:max-w-8 md:group-focus-within/card:opacity-100 md:group-hover/card:pointer-events-auto md:group-hover/card:max-w-8 md:group-hover/card:opacity-100'
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <CommentShareButton
            getUrl={() =>
              absoluteRouteUrl(router, {
                to: '/$forum/$post',
                params: {
                  forum: forumPath(post.fingerprint ?? post.forum),
                  post: post.id,
                },
                search: server ? { server } : undefined,
              })
            }
            className='text-muted-foreground hover:text-foreground inline-flex items-center text-xs transition-colors [&>svg]:size-4'
          />
        </span>
      </div>
    </div>
  )

  if (variant === 'list-item') {
    return (
      <div
        className={cn(
          'group/card hover:bg-hover/50 cursor-pointer overflow-hidden transition-colors'
        )}
        onClick={() => onSelect(post.fingerprint ?? post.forum, post.id)}
      >
        {content}
      </div>
    )
  }

  return (
    <Card
      className='group/card hover:border-primary/30 cursor-pointer gap-0 overflow-hidden py-0 transition-all hover:shadow-md md:py-0'
      onClick={() => onSelect(post.fingerprint ?? post.forum, post.id)}
    >
      <CardContent className='p-0'>{content}</CardContent>
    </Card>
  )
}
