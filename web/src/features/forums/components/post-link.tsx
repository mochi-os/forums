// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
//
// The link a post carries, as a card: its host, what the page says of itself
// where the server could read it, and its picture. The whole card opens the
// link; a card is a link to somewhere else, so it never routes inside Mochi.
import { ExternalLink } from 'lucide-react'
import { cn } from '@mochi/web'
import { postEmbed, type Post } from '@/api/types/posts'

function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function webLink(url: string | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined
}

export function PostLink({
  post,
  compact = false,
  className,
}: {
  post: Pick<Post, 'url' | 'thumbnail' | 'embed'>
  /** The card's list form: one line, a small picture. */
  compact?: boolean
  className?: string
}) {
  const href = webLink(post.url)
  if (!href) return null
  const embed = postEmbed(post)
  const image = webLink(post.thumbnail)
  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'bg-muted/30 hover:bg-hover flex gap-3 rounded-lg border p-2 text-sm no-underline',
        compact ? 'items-center' : 'items-start',
        className
      )}
      data-testid='post-link'
    >
      {image && (
        <img
          src={image}
          alt=''
          className={cn(
            'shrink-0 rounded object-cover',
            compact ? 'size-12' : 'size-24'
          )}
        />
      )}
      <span className='min-w-0 flex-1'>
        <span className='text-muted-foreground flex items-center gap-1 text-xs'>
          <ExternalLink className='size-3 shrink-0' />
          <span className='truncate'>{embed.site || linkHost(href)}</span>
        </span>
        {embed.title && (
          <span className='text-foreground block truncate font-medium'>
            {embed.title}
          </span>
        )}
        {!compact && embed.description && (
          <span className='text-muted-foreground line-clamp-2 block text-xs'>
            {embed.description}
          </span>
        )}
        {!embed.title && (
          <span className='text-foreground block truncate'>{href}</span>
        )}
      </span>
    </a>
  )
}
