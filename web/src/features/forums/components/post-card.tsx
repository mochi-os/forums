import { Link } from '@tanstack/react-router'
import { Card, CardContent, PostTitleBar, cn, formatTimestamp } from '@mochi/web'
import { MessageSquare, ThumbsUp, ThumbsDown, Clock, EyeOff, Lock, Pin } from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { sanitizeHtml } from '../utils'
import { PostAttachments } from './thread/post-attachments'
import { PostTagsTooltip } from './post-tags'

interface PostCardProps {
  post: Post
  forumName: string
  showForumBadge: boolean
  server?: string
  onSelect: (forumId: string, postId: string) => void
  onTagFilter?: (label: string) => void
  onInterestUp?: (qid: string) => void
  onInterestDown?: (qid: string) => void
  onInterestRemove?: (qid: string) => void
  variant?: 'card' | 'list-item'
}

export function PostCard({
  post,
  forumName,
  showForumBadge,
  server,
  onSelect,
  onTagFilter,
  onInterestUp,
  onInterestDown,
  onInterestRemove,
  variant = 'card',
}: PostCardProps) {
  const timestamp = formatTimestamp(post.created)

  const content = (
    <div className='relative space-y-3 p-4'>
      <PostTitleBar
        title={<h3>{post.title}</h3>}
        trailing={
          <>
            {post.status === 'pending' && (
              <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
                <Clock className='size-3' />
                Pending
              </span>
            )}
            {post.status === 'removed' && (
              <span className='inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200'>
                <EyeOff className='size-3' />
                Removed
              </span>
            )}
            {!!post.locked && (
              <span className='bg-surface-2 text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'>
                <Lock className='size-3' />
              </span>
            )}
            {!!post.pinned && (
              <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:bg-primary/20 dark:text-primary'>
                <Pin className='size-3' />
              </span>
            )}
          </>
        }
        meta={
          <>
            {showForumBadge ? (
              <>
                {forumName}
                <span> · </span>
              </>
            ) : null}
            {post.name}
            <span> · </span>
            {timestamp}
          </>
        }
        metaClassName='opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100'
      />

      {/* Body */}
      {post.body_markdown ? (
        <div
          className='text-foreground max-w-none text-sm leading-normal line-clamp-2 [&_p]:my-0 [&_ul]:my-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-0 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0'
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body_markdown) }}
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

      {/* Action buttons row - interactive */}
      {((post.tags && post.tags.length > 0) || post.matches?.length || post.up > 0 || post.down > 0 || getCommentCount(post.comments) > 0) && (
        <div className='text-muted-foreground flex items-center gap-4 md:gap-3 text-xs'>
          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <PostTagsTooltip tags={post.tags} onFilter={onTagFilter} onInterestUp={onInterestUp} onInterestDown={onInterestDown} onInterestRemove={onInterestRemove} />
          )}

          {/* Relevance match indicators */}
          {post.matches && post.matches.length > 0 && (
            <span className='inline-flex items-center gap-1'>
              {post.matches.map((m) => (
                <span key={m.qid} className='bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-full px-1.5 py-0.5 text-xs font-medium'>
                  {m.label || m.qid}
                </span>
              ))}
            </span>
          )}

          {/* Upvote count */}
          {(post.up > 0 || post.user_vote === 'up') && (
            <span className='inline-flex items-center gap-1'>
              {post.user_vote === 'up' ? <span className='text-sm'>👍</span> : <ThumbsUp className='size-4' />}
              {post.up > 0 && post.up}
            </span>
          )}

          {/* Downvote count */}
          {(post.down > 0 || post.user_vote === 'down') && (
            <span className='inline-flex items-center gap-1'>
              {post.user_vote === 'down' ? <span className='text-sm'>👎</span> : <ThumbsDown className='size-4' />}
              {post.down > 0 && post.down}
            </span>
          )}

          {/* Comments navigation link */}
          {getCommentCount(post.comments) > 0 && (
            <Link
              to='/$forum/$post'
              params={{ forum: post.forum, post: post.id }}
              search={showForumBadge ? { from: 'all' } : undefined}
              className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors'
              onClick={(e) => e.stopPropagation()}
            >
              <MessageSquare className='size-3' />
              <span>{getCommentCount(post.comments)}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )

  if (variant === 'list-item') {
    return (
      <div
        className={cn(
          'group/card hover:bg-accent/50 cursor-pointer overflow-hidden transition-colors'
        )}
        onClick={() => onSelect(post.fingerprint ?? post.forum, post.id)}
      >
        {content}
      </div>
    )
  }

  return (
    <Card
      className='group/card hover:border-primary/30 cursor-pointer overflow-hidden gap-0 py-0 md:py-0 transition-all hover:shadow-md'
      onClick={() => onSelect(post.fingerprint ?? post.forum, post.id)}
    >
      <CardContent className='p-0'>{content}</CardContent>
    </Card>
  )
}
