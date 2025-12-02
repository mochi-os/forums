import { Input } from '@/components/ui/input'
import { CreateForumDialog } from './create-forum-dialog'

type ForumsHeaderProps = {
  searchTerm: string
  onSearchChange: (value: string) => void
  onCreateForum: (input: { name: string; memberAccess: string; allowSearch: boolean }) => void
}

export function ForumsHeader({ searchTerm, onSearchChange, onCreateForum }: ForumsHeaderProps) {
  return (
    <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Forums</h1>
        <p className='text-muted-foreground'>
          Share progress, ask for help, and learn from the community
        </p>
        <div className='mt-4 max-w-xl'>
          <Input
            type='search'
            placeholder='Search forums'
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label='Search forums'
          />
        </div>
      </div>
      <CreateForumDialog onCreate={onCreateForum} />
    </div>
  )
}
