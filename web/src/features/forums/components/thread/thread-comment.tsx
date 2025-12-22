import { useState } from 'react'
import {
  cn,
  FacelessAvatar,
  Badge,
  Button,
  Textarea,
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
import { ThumbsUp, ThumbsDown, Loader2, MoreHorizontal, Pencil, Trash2, X, Check } from 'lucide-react'

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
  edited?: number
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
  canEdit?: boolean
  onEdit?: (body: string) => void
  onDelete?: () => void
  isEditPending?: boolean
  isDeletePending?: boolean
}

export function ThreadComment({
  comment,
  isOwner,
  onVote,
  canVote = true,
  isPending = false,
  canEdit = false,
  onEdit,
  onDelete,
  isEditPending = false,
  isDeletePending = false,
}: ThreadCommentProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleStartEdit = () => {
    setEditBody(comment.body)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditBody(comment.body)
    setIsEditing(false)
  }

  const handleSaveEdit = () => {
    if (editBody.trim() && editBody !== comment.body) {
      onEdit?.(editBody)
    }
    setIsEditing(false)
  }

  const handleDelete = () => {
    setDeleteDialogOpen(false)
    onDelete?.()
  }

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
            {comment.edited ? ' (edited)' : ''}
          </span>
          {canEdit && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleStartEdit}>
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

        {/* Body - show textarea when editing */}
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="min-h-[80px] text-sm"
              disabled={isEditPending}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isEditPending || !editBody.trim()}
              >
                <Check className="mr-1 size-3" />
                {isEditPending ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isEditPending}
              >
                <X className="mr-1 size-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className='mt-1 text-sm leading-relaxed text-foreground/90'>
            {comment.body}
          </p>
        )}

        {/* Actions - minimal style */}
        {!isEditing && (
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
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this comment and all its replies. This action cannot be undone.
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
    </div>
  )
}
