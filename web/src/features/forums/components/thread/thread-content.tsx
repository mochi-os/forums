import {
  cn,
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button
} from '@mochi/common'
import { ThumbsUp, ThumbsDown, Share2 } from 'lucide-react'
import { threadStatusStyles } from '../../status'
import { PostAttachments } from './post-attachments'
import type { Post, Attachment } from '@/api/types/posts'

interface ThreadContentProps {
  post: Post
  attachments?: Attachment[]
  onVote: (vote: 'up' | 'down') => void
  isVotePending: boolean
}

export function ThreadContent({ post, attachments, onVote, isVotePending }: ThreadContentProps) {
  const status = threadStatusStyles['open']
  const StatusIcon = status.icon

  return (
    <div className="space-y-4">
      {/* Header: Status, Actions */}
      <div className="flex items-start justify-between gap-3">
        <Badge
          variant='outline'
          className={cn(
            'border px-2 py-0.5 text-[11px]',
            status.className
          )}
        >
          <StatusIcon className='mr-1 size-3' />
          {status.label}
        </Badge>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant='ghost' size='sm' className='h-8 text-muted-foreground hover:text-foreground'>
            <Share2 className='mr-1.5 size-3.5' />
            Share
          </Button>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-xl font-semibold leading-tight text-foreground">
        {post.title}
      </h1>

      {/* Author & Meta Line */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Avatar className="size-6">
          <AvatarImage src="" alt={post.name} />
          <AvatarFallback className="text-[10px]">
            {post.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-foreground">{post.name}</span>
        <span>•</span>
        <span>{post.created_local}</span>
      </div>

      {/* Post Body */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <p className="text-foreground leading-relaxed whitespace-pre-wrap m-0">
          {post.body}
        </p>
      </div>

      {/* Attachments */}
      <PostAttachments attachments={attachments || post.attachments || []} />

      {/* Vote buttons - minimal style matching theme */}
      <div className="flex items-center gap-3 pt-2 text-muted-foreground">
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 text-sm transition-colors',
            'hover:text-foreground',
            isVotePending && 'opacity-50 pointer-events-none'
          )}
          onClick={() => onVote('up')}
          disabled={isVotePending}
        >
          <ThumbsUp className="size-4" />
          <span>{post.up}</span>
        </button>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 text-sm transition-colors',
            'hover:text-foreground',
            isVotePending && 'opacity-50 pointer-events-none'
          )}
          onClick={() => onVote('down')}
          disabled={isVotePending}
        >
          <ThumbsDown className="size-4" />
          <span>{post.down}</span>
        </button>
      </div>
    </div>
  )
}
