import { Button, EmptyState } from '@mochi/common'
import { FileQuestion } from 'lucide-react'

export function EmptyThreadState({ onBack }: { onBack: () => void }) {
  return (
    <div className='flex h-full flex-col items-center justify-center p-8'>
      <EmptyState
        icon={FileQuestion}
        title="Post not found"
        description="This post may have been deleted or doesn't exist."
      >
        <Button onClick={onBack}>Back to forum</Button>
      </EmptyState>
    </div>
  )
}
