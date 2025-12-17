import {
  cn,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
} from '@mochi/common'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

// Partial comment interface based on usage
export interface ThreadCommentType {
  id: string
  name: string
  body: string
  up: number
  down: number
  created_local: string
  member: string
}

interface ThreadCommentProps {
  comment: ThreadCommentType
  isOwner: boolean
  onVote: (vote: 'up' | 'down') => void
}

export function ThreadComment({
  comment,
  isOwner,
  onVote,
}: ThreadCommentProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card/80 p-4'
      )}
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <Avatar className='size-10'>
            <AvatarImage src='' alt={comment.name} />
            <AvatarFallback>
              {comment.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className='text-sm font-semibold text-foreground'>
              {comment.name}
            </p>
            <p className='text-xs text-muted-foreground'>
              Member
            </p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          {isOwner && <Badge variant='secondary'>Original poster</Badge>}
          <span>{comment.created_local}</span>
        </div>
      </div>
      <p className='mt-4 text-sm leading-6 text-muted-foreground'>
        {comment.body}
      </p>
      <div className='mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground'>
        <Button 
          variant='link' 
          size='sm' 
          className='h-auto px-0 text-primary'
          onClick={() => onVote('up')}
        >
          <ThumbsUp className='mr-1 size-3' />
          {comment.up}
        </Button>
        <Button 
          variant='link' 
          size='sm' 
          className='h-auto px-0 text-primary'
          onClick={() => onVote('down')}
        >
          <ThumbsDown className='mr-1 size-3' />
          {comment.down}
        </Button>
      </div>
    </div>
  )
}
