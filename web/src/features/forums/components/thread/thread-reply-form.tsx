import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Textarea,
  Button
} from '@mochi/common'

interface ThreadReplyFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isPending: boolean
}

export function ThreadReplyForm({ value, onChange, onSubmit, isPending }: ThreadReplyFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave a reply</CardTitle>
        <CardDescription>
          Share tips, provide resources, or log your own observation.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Textarea
          placeholder='Add to the conversation...'
          className='min-h-[160px]'
          value={value}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        />
        <div className='flex justify-end gap-3'>
          <Button 
            size='sm'
            onClick={onSubmit}
            disabled={isPending || !value.trim()}
          >
            {isPending ? 'Posting...' : 'Post reply'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
