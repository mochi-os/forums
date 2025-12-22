import {
  cn,
  Badge,
  FacelessAvatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@mochi/common'
import { ThumbsUp, ThumbsDown, BellPlus, Share2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { threadStatusStyles } from '../../status'
import { PostAttachments } from './post-attachments'
import type { Post, Attachment } from '@/api/types/posts'

interface ThreadContentProps {
  post: Post
  attachments?: Attachment[]
  onVote: (vote: 'up' | 'down') => void
  isVotePending: boolean
  canEdit?: boolean
  onEdit?: () => void
  onDelete?: () => void
  isDeletePending?: boolean
}

export function ThreadContent({
  post,
  attachments,
  onVote,
  isVotePending,
  canEdit = false,
  onEdit,
  onDelete,
  isDeletePending = false,
}: ThreadContentProps) {
  const status = threadStatusStyles['open']
  const StatusIcon = status.icon
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleDelete = () => {
    setDeleteDialogOpen(false)
    onDelete?.()
  }

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
            <BellPlus className='mr-1.5 size-3.5' />
            Follow
          </Button>
          <Button variant='ghost' size='sm' className='h-8 text-muted-foreground hover:text-foreground'>
            <Share2 className='mr-1.5 size-3.5' />
            Share
          </Button>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='sm' className='h-8 w-8 p-0 text-muted-foreground hover:text-foreground'>
                  <MoreHorizontal className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the post and all its comments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeletePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletePending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Title */}
      <h1 className="text-xl font-semibold leading-tight text-foreground">
        {post.title}
      </h1>

      {/* Author & Meta Line */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FacelessAvatar name={post.name} size={24} className="text-[10px]" />
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
      <PostAttachments attachments={attachments || post.attachments || []} forumId={post.forum} />

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
