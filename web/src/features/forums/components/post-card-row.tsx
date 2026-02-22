import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, getAppPath, formatTimestamp } from '@mochi/common'
import { MessageSquare, ThumbsUp, ThumbsDown, Clock, EyeOff, Lock, Pin, Hash, Maximize2, X } from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { PostTagsTooltip } from './post-tags'

interface PostCardRowProps {
  post: Post
  forumName: string
  showForumBadge: boolean
  onSelect: (forumId: string, postId: string) => void
  onTagRemoved?: (tagId: string) => void
  onTagFilter?: (label: string) => void
  onInterestUp?: (qid: string) => void
  onInterestDown?: (qid: string) => void
}

export function PostCardRow({
  post,
  forumName,
  showForumBadge,
  onSelect,
  onTagRemoved,
  onTagFilter,
  onInterestUp,
  onInterestDown,
}: PostCardRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const timestamp = formatTimestamp(post.created)



  // Determine thumbnail
  const renderThumbnail = () => {
    // Image attachment
    const imageAttachment = post.attachments?.find((att) =>
      att.type?.startsWith('image/')
    )

    if (imageAttachment) {
      return (
        <img
          src={imageAttachment.thumbnail_url ?? `${getAppPath()}/${post.fingerprint ?? post.forum}/-/attachments/${imageAttachment.id}/thumbnail`}
          alt={imageAttachment.name}
          className='h-full w-full object-cover'
        />
      )
    }

    // Default: No specific thumbnail
    return null
  }

  const thumbnail = renderThumbnail()

  // Render Full Content (Image) for Expanded View
  const renderExpandedContent = () => {
    // Image Attachments (Show all if expanded)
    const images = post.attachments?.filter((att) => att.type?.startsWith('image/'))
    if (images && images.length > 0) {
        return (
            <div className="mt-3 space-y-2">
                {images.map(att => (
                     <img
                     key={att.id}
                     src={att.url ?? `${getAppPath()}/${post.fingerprint ?? post.forum}/-/attachments/${att.id}`}
                     alt={att.name}
                     className='w-full rounded-md object-contain max-h-[500px] bg-black/5'
                   />
                ))}
            </div>
        )
    }
    
    return null
  }

  return (
    <Card 
      className='group/card hover:border-primary/30 overflow-hidden transition-all hover:shadow-md cursor-pointer'
      onClick={() => onSelect(post.fingerprint ?? post.forum, post.id)}
    >
      <div className={`flex${thumbnail ? ' min-h-[120px]' : ''}`}>
        {/* Left: Content */}
        <div className='relative flex min-w-0 flex-1 flex-col p-3'>
          <div className='space-y-1.5'>
            {/* Row 1: Forum Name + Date + Tags (on hover) */}
            <div className='flex items-start justify-between'>
              <div className='flex items-center gap-2 text-xs'>
                {showForumBadge && (
                  <Link
                    to='/$forum'
                    params={{ forum: post.forum }}
                    className='bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium transition-colors'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Hash className='size-3' />
                    <span>{forumName}</span>
                  </Link>
                )}
                <span className='text-muted-foreground'>{timestamp}</span>
              </div>
            </div>

            {/* Row 2: Title & Badges */}
            <div className='flex items-center gap-2'>
              <h3 className='text-sm font-semibold leading-tight truncate'>
                {post.title}
              </h3>
               <div className='flex items-center gap-1 shrink-0'>
                {post.status === 'pending' && (
                    <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
                    <Clock className='size-3' />
                    </span>
                )}
                {post.status === 'removed' && (
                    <span className='inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900 dark:text-red-200'>
                    <EyeOff className='size-3' />
                    </span>
                )}
                {!!post.locked && (
                    <span className='bg-surface-2 text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium'>
                    <Lock className='size-3' />
                    </span>
                )}
                {!!post.pinned && (
                    <span className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
                    <Pin className='size-3' />
                    </span>
                )}
                </div>
            </div>
             <p className='text-muted-foreground truncate text-xs'>
                {post.body}
            </p>

          </div>

          {/* Row 3: Actions */}
          {((post.tags && post.tags.length > 0) || post.up > 0 || post.down > 0 || getCommentCount(post.comments) > 0) && (
            <div className='text-muted-foreground mt-2 flex items-center gap-3 text-xs'>
              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <PostTagsTooltip tags={post.tags} onRemove={onTagRemoved} onFilter={onTagFilter} onInterestUp={onInterestUp} onInterestDown={onInterestDown} />
              )}

              {/* Upvote count */}
              {(post.up > 0 || post.user_vote === 'up') && (
                <span className='inline-flex items-center gap-1'>
                  {post.user_vote === 'up' ? <span className='text-sm'>👍</span> : <ThumbsUp className='size-4' />}
                  <span>{post.up > 0 && post.up}</span>
                </span>
              )}

              {/* Downvote count */}
              {(post.down > 0 || post.user_vote === 'down') && (
                <span className='inline-flex items-center gap-1'>
                  {post.user_vote === 'down' ? <span className='text-sm'>👎</span> : <ThumbsDown className='size-4' />}
                  <span>{post.down > 0 && post.down}</span>
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

             {/* Expanded Content */}
             {isExpanded && renderExpandedContent()}
        </div>

        {/* Right: Thumbnail (Fixed Width + Padding) */}
        {thumbnail && (
            <div className='w-[140px] shrink-0 p-3 pl-0 flex flex-col'>
                <div className="bg-surface-2 h-20 w-full overflow-hidden rounded-[8px] border">
                    {thumbnail}
                </div>
                
                {/* Expand Toggle */}
                <button
                    type='button'
                    className='text-foreground bg-surface-2 mt-2 ml-auto inline-flex size-7 items-center justify-center rounded-full transition-colors hover:bg-interactive-hover active:bg-interactive-active'
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsExpanded(!isExpanded)
                    }}
                >
                    {isExpanded ? <X className="size-4" /> : <Maximize2 className="size-3.5" />}
                </button>
            </div>
        )}
      </div>
    </Card>
  )
}
