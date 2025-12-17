import { Button } from '@mochi/common'

export function EmptyThreadState({ onBack }: { onBack: () => void }) {
  return (
    <div className='flex h-full flex-col items-center justify-center space-y-4 p-8 text-center'>
      <p className='text-lg font-semibold'>Thread not found</p>
      <p className='max-w-md text-sm text-muted-foreground'>
        The link you followed may be broken, or the thread may have been removed.
      </p>
      <Button onClick={onBack}>Back to threads</Button>
    </div>
  )
}
