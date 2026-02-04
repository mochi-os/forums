import { Skeleton, Card, CardContent, Main } from '@mochi/common'

export function ThreadDetailSkeleton() {
  return (
    <Main className="space-y-4">
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className='flex gap-4'>
            {/* Vote buttons */}
            <div className='flex flex-col items-center gap-1 pt-1'>
              <Skeleton className='h-8 w-8 rounded-md' />
              <Skeleton className='h-4 w-4' />
              <Skeleton className='h-8 w-8 rounded-md' />
            </div>
            
            <div className='flex-1 space-y-2'>
              {/* Title */}
              <Skeleton className='h-6 w-3/4' />
              {/* Meta */}
              <div className='flex items-center gap-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-4 rounded-full' />
                <Skeleton className='h-4 w-32' />
              </div>
              {/* Body */}
              <div className='space-y-2 pt-2'>
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-5/6' />
              </div>
            </div>
          </div>
          
          {/* Divider */}
          <div className='border-t pt-4 mt-6'>
            {/* Comments Skeletons */}
            <div className='space-y-6'>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className='flex gap-4'>
                  <div className='flex flex-col items-center gap-1'>
                    <Skeleton className='h-6 w-6 rounded-md' />
                    <Skeleton className='h-8 w-px mx-auto' />
                  </div>
                  <div className='flex-1 space-y-2'>
                    <div className='flex items-center gap-2'>
                      <Skeleton className='h-4 w-24' />
                      <Skeleton className='h-3 w-16' />
                    </div>
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-4 w-2/3' />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </Main>
  )
}
