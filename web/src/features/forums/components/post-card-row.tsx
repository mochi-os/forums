import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, getAppPath } from '@mochi/common'
import { MessageSquare, ThumbsUp, ThumbsDown, Clock, EyeOff, Lock, Pin, Hash, FileText, Maximize2, X } from 'lucide-react'
import type { Post } from '@/api/types/forums'
import { getCommentCount } from '@/api/types/posts'
import { formatDistanceToNow } from 'date-fns'

interface PostCardRowProps {
  post: Post
  forumName: string
  showForumBadge: boolean
  onSelect: (forumId: string, postId: string) => void
}

export function PostCardRow({
  post,
  forumName,
  showForumBadge,
  onSelect,
}: PostCardRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const dateParams = { addSuffix: true }
  const timeAgo = formatDistanceToNow(new Date(post.created * 1000), dateParams)



  // Determine thumbnail
  const renderThumbnail = () => {
    // Image attachment
    const imageAttachment = post.attachments?.find((att) =>
      att.type?.startsWith('image/')
    )

    if (imageAttachment) {
      return (
        <img
          src={`${getAppPath()}/${post.fingerprint ?? post.forum}/-/attachments/${imageAttachment.id}/thumbnail`}
          alt={imageAttachment.name}
          className='h-full w-full object-cover'
        />
      )
    }

    // Default: Text Icon
    return (
      <div className='bg-muted flex h-full w-full items-center justify-center'>
        <FileText className='text-muted-foreground size-8' />
      </div>
    )
  }

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
                     src={`${getAppPath()}/${post.fingerprint ?? post.forum}/-/attachments/${att.id}/original`}
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
      <div className='flex min-h-[120px]'>
         {/* Left: Thumbnail (Fixed Width + Padding) */}
         <div className='w-[140px] shrink-0 p-3 flex flex-col'>
            <div className="h-20 w-full overflow-hidden rounded-[8px] border bg-muted">
                {renderThumbnail()}
            </div>
        </div>

        {/* Right: Content */}
        <div className='flex min-w-0 flex-1 flex-col justify-between p-3 pl-0'>
          <div className='space-y-1.5'>
            {/* Row 1: Forum Name + Date */}
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
              <span className='text-muted-foreground capitalize'>{timeAgo}</span>
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
                    <span className='inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200'>
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
           <div className='text-muted-foreground flex items-center gap-1 text-xs mt-2'>
                {/* Expand Toggle */}
                <button
                    type='button'
                    className='text-foreground bg-muted hover:bg-muted/80 inline-flex size-7 items-center justify-center rounded-full transition-colors mr-1'
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsExpanded(!isExpanded)
                    }}
                >
                    {isExpanded ? <X className="size-4" /> : <Maximize2 className="size-3.5" />}
                </button>

                {/* Upvote button */}
                <button
                type='button'
                className='text-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-200 dark:hover:bg-gray-700'
                onClick={(e) => {
                    e.stopPropagation()
                }}
                >
                <ThumbsUp className='size-3' />
                <span>{post.up > 0 ? post.up : 'Upvote'}</span>
                </button>
                
                {/* Downvote button */}
                <button
                type='button'
                className='text-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-200 dark:hover:bg-gray-700'
                onClick={(e) => {
                    e.stopPropagation()
                }}
                >
                <ThumbsDown className='size-3' />
                 <span>{post.down > 0 ? post.down : 'Downvote'}</span>
                </button>
                
                {/* Comments navigation link */}
                <Link
                to='/$forum/$post'
                params={{ forum: post.forum, post: post.id }}
                className='text-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-200 dark:hover:bg-gray-700'
                onClick={(e) => e.stopPropagation()}
                >
                <MessageSquare className='size-3' />
                <span>{getCommentCount(post.comments)} Comments</span>
                </Link>
            </div>

             {/* Expanded Content */}
             {isExpanded && renderExpandedContent()}
        </div>
      </div>
    </Card>
  )
}
