import {
  cn,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button
} from '@mochi/common'
import { ThumbsUp, ThumbsDown, BellPlus, Share2 } from 'lucide-react'
import { threadStatusStyles } from '../../status'
import type { Post } from '@/api/types/posts'

interface ThreadContentProps {
  post: Post
  onVote: (vote: 'up' | 'down') => void
  isVotePending: boolean
}

export function ThreadContent({ post, onVote, isVotePending }: ThreadContentProps) {
  const status = threadStatusStyles['open']
  const StatusIcon = status.icon

  return (
    <Card>
      <CardHeader className='gap-4 border-b border-border/40 pb-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge
            variant='outline'
            className={cn(
              'border px-2 py-1 text-[11px]',
              status.className
            )}
          >
            <StatusIcon className='mr-1 size-3' />
            {status.label}
          </Badge>
        </div>
        <div className='flex flex-col gap-2'>
          <CardTitle className='text-2xl'>{post.title}</CardTitle>
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
            <span>
              Posted&nbsp;
              <span className='font-semibold text-foreground'>{post.created_local}</span>
            </span>
            <span>•</span>
            <span>
              Author&nbsp;
              <span className='font-semibold text-foreground'>
                {post.name}
              </span>
            </span>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-3 text-sm text-muted-foreground'>
          <div className='flex items-center gap-2'>
            <Avatar className='size-10'>
              <AvatarImage src='' alt={post.name} />
              <AvatarFallback>
                {post.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className='font-semibold text-foreground'>
                {post.name}
              </p>
              <p>Member</p>
            </div>
          </div>
        </div>
        <div className='flex flex-wrap gap-3 items-center'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onVote('up')}
            disabled={isVotePending}
          >
            <ThumbsUp className='mr-1 size-4' />
            {post.up}
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onVote('down')}
            disabled={isVotePending}
          >
            <ThumbsDown className='mr-1 size-4' />
            {post.down}
          </Button>
          <Button variant='secondary' size='sm'>
            <BellPlus className='mr-2 size-4' />
            Follow thread
          </Button>
          <Button variant='ghost' size='sm' className='text-muted-foreground'>
            <Share2 className='mr-2 size-4' />
            Share
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}
