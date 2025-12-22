import {
  cn,
  FacelessAvatar,
  Badge,
} from '@mochi/common'
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'

// Comment interface aligned with ViewPostResponse.data.comments from API
export interface ThreadCommentType {
  id: string
  forum: string
  post: string
  parent: string
  member: string
  name: string
  body: string
  up: number
  down: number
  created: number
  created_local: string
  children: unknown[]
  can_vote: boolean
  can_comment: boolean
}

interface ThreadCommentProps {
  comment: ThreadCommentType
  isOwner: boolean
  onVote: (vote: 'up' | 'down') => void
  canVote?: boolean
  isPending?: boolean
}

export function ThreadComment({
  comment,
  isOwner,
  onVote,
  canVote = true,
  isPending = false,
}: ThreadCommentProps) {
  return (
    <div className="flex gap-3 py-4 border-t border-border/40 first:border-t-0">
      {/* Avatar */}
      <FacelessAvatar name={comment.name} size={32} className="shrink-0 text-xs" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className='flex flex-wrap items-center gap-2 text-sm'>
          <span className='font-semibold text-foreground'>
            {comment.name}
          </span>
          {isOwner && (
            <Badge className="text-[10px] px-1.5 py-0 bg-foreground text-background">
              Author
            </Badge>
          )}
          <span className="text-muted-foreground text-xs">
            {comment.created_local}
          </span>
        </div>

        {/* Body */}
        <p className='mt-1 text-sm leading-relaxed text-foreground/90'>
          {comment.body}
        </p>

        {/* Actions - minimal style */}
        <div className='mt-2 flex items-center gap-3 text-muted-foreground'>
          {isPending ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  'hover:text-foreground',
                  !canVote && 'opacity-50 pointer-events-none'
                )}
                onClick={() => onVote('up')}
                disabled={!canVote}
              >
                <ThumbsUp className='size-3.5' />
                <span>{comment.up}</span>
              </button>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  'hover:text-foreground',
                  !canVote && 'opacity-50 pointer-events-none'
                )}
                onClick={() => onVote('down')}
                disabled={!canVote}
              >
                <ThumbsDown className='size-3.5' />
                <span>{comment.down}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
