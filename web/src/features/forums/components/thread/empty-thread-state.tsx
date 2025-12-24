import { Button } from '@mochi/common'

export function EmptyThreadState({ onBack }: { onBack: () => void }) {
  return (
    <div className='flex h-full flex-col items-center justify-center space-y-4 p-8 text-center'>
      <p className='text-lg font-semibold'>Post not found</p>
      <Button onClick={onBack}>Back to forum</Button>
    </div>
  )
}
