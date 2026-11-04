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

const IMAGE = /\.(avif|gif|jpe?g|png|webp)$/i

/**
 * Whether a post's link is an image, as every Lemmy image post's is: by the
 * media type its network gave, else by its address - the file's own, or the
 * one Lemmy's image proxy carries in its url parameter.
 */
export function linkImage(post: Pick<Post, 'url' | 'embed'>): boolean {
  const href = webLink(post.url)
  if (!href) return false
  const type = postEmbed(post).type
  if (type) return type.startsWith('image/')
  try {
    const url = new URL(href)
    if (IMAGE.test(url.pathname)) return true
    const proxied = url.pathname.endsWith('/image_proxy')
      ? url.searchParams.get('url')
      : null
    return !!proxied && IMAGE.test(new URL(proxied).pathname)
  } catch {
    return false
  }
}

export function PostLink({
  post,
  compact = false,
  className,
}: {
  post: Pick<Post, 'url' | 'thumbnail' | 'embed'>
  /** The card's list form: one line, a small picture; for an image link, a
   *  smaller copy of the image. */
  compact?: boolean
  className?: string
}) {
  const href = webLink(post.url)
  if (!href) return null
  const embed = postEmbed(post)
  const image = webLink(post.thumbnail)
  // An image link is the post's picture: shown as itself, as its network
  // shows it, rather than as a card naming its address. A list shows the
  // network's smaller copy where it gave one.
  if (linkImage(post)) {
    return (
      <a
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        onClick={(e) => e.stopPropagation()}
        className={cn('block w-fit max-w-full', className)}
        data-testid='post-link'
      >
        <img
          src={compact ? (image ?? href) : href}
          alt={embed.title ?? ''}
          referrerPolicy='no-referrer'
          loading='lazy'
          className={cn(
            'rounded-lg',
            compact ? 'max-h-48 object-cover' : 'max-h-[70vh] object-contain'
          )}
        />
      </a>
    )
  }
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
