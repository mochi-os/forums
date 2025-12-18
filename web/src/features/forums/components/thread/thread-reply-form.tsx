import {
  Textarea,
  Button,
  Avatar,
  AvatarFallback,
} from '@mochi/common'
import { Send } from 'lucide-react'

interface ThreadReplyFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isPending: boolean
  userName?: string
}

export function ThreadReplyForm({ 
  value, 
  onChange, 
  onSubmit, 
  isPending,
  userName = 'You'
}: ThreadReplyFormProps) {
  return (
    <div className="flex gap-3 pt-4">
      {/* User Avatar */}
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-xs">
          {userName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      
      {/* Reply Input */}
      <div className="flex-1 space-y-2">
        <Textarea
          placeholder="Write a reply..."
          className="min-h-20 resize-none border-border/60 bg-muted/30 focus:bg-background"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          disabled={isPending}
        />
        <div className="flex justify-end">
          <Button 
            size="sm"
            onClick={onSubmit}
            disabled={isPending || !value.trim()}
            className="gap-1.5"
          >
            {isPending ? (
              'Posting...'
            ) : (
              <>
                <Send className="size-3.5" />
                Reply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
