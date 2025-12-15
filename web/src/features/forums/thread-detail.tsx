// import { type ComponentType, useMemo, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  BellPlus,
  // Eye,
  // MessageSquare,
  Share2,
  // Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { NotificationsDropdown } from '@mochi/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
// import { Textarea } from '@/components/ui/textarea'
import {
  findThreadById,
  // type ForumAuthor,
  type ForumComment,
} from './data'
import { threadStatusStyles } from './status'

type ThreadDetailProps = {
  threadId: string
}

export function ThreadDetail({ threadId }: ThreadDetailProps) {
  const navigate = useNavigate()
  const thread = findThreadById(threadId)
  // const replySectionRef = useRef<HTMLDivElement | null>(null)

  // const participants = useMemo(() => {
  //   if (!thread) {
  //     return []
  //   }

  //   const unique = new Map<string, ForumAuthor>()
  //   unique.set(thread.author.name, thread.author)
  //   thread.comments.forEach((comment) => {
  //     if (!unique.has(comment.author.name)) {
  //       unique.set(comment.author.name, comment.author)
  //     }
  //   })
  //   return Array.from(unique.values())
  // }, [thread])

  if (!thread) {
    return (
      <>
        <Header>
          <Search />
          <div className='ms-auto flex items-center space-x-4'>
            <NotificationsDropdown />
          </div>
        </Header>
        <Main>
          <Button
            variant='ghost'
            className='mb-6 h-auto px-0 text-muted-foreground hover:text-foreground'
            onClick={() =>
              navigate({
                to: '/',
              })
            }
          >
            <ArrowLeft className='mr-2 size-4' />
            Back to threads
          </Button>
          <EmptyThreadState
            onBack={() =>
              navigate({
                to: '/',
              })
            }
          />
        </Main>
      </>
    )
  }

  const status = threadStatusStyles[thread.status]
  const StatusIcon = status.icon
  const commentCount = thread.comments.length
  const handleNewCommentClick = () => {
    // replySectionRef.current?.scrollIntoView({
    //   behavior: 'smooth',
    //   block: 'start',
    // })
  }

  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <NotificationsDropdown />
        </div>
      </Header>

      <Main>
        <Button
          variant='ghost'
          className='mb-6 h-auto px-0 text-muted-foreground hover:text-foreground'
          onClick={() =>
            navigate({
              to: '/',
            })
          }
        >
          <ArrowLeft className='mr-2 size-4' />
          Back to threads
        </Button>

        <div className='grid gap-6 lg:grid-cols-[2fr,1fr]'>
          <div className='space-y-6'>
            <Card>
              <CardHeader className='gap-4 border-b border-border/40 pb-4'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='secondary'>{thread.category}</Badge>
                  <Badge
                    variant='outline'
                    className={cn(
                      'border px-2 py-1 text-[11px]',
                      status.className
                    )}
                  >
                    <StatusIcon className='mr-1 size-3' />
                    {status.label}
                  </Badge>
                </div>
                <div className='flex flex-col gap-2'>
                  <CardTitle className='text-2xl'>{thread.title}</CardTitle>
                  <CardDescription className='text-base text-muted-foreground'>
                    {thread.excerpt}
                  </CardDescription>
                  <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                    <span>
                      Posted&nbsp;
                      <span className='font-semibold text-foreground'>{thread.postedAt}</span>
                    </span>
                    <span>•</span>
                    <span>
                      Author&nbsp;
                      <span className='font-semibold text-foreground'>
                        {thread.author.name}
                      </span>
                    </span>
                    {thread.editedBy && (
                      <>
                        <span>•</span>
                        <span>
                          Edited by&nbsp;
                          <span className='font-semibold text-foreground'>
                            {thread.editedBy.name}
                          </span>
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>Last activity {thread.lastActivity}</span>
                    <Button
                      variant='link'
                      size='sm'
                      className='px-2 py-1.5 h-auto text-primary'
                      onClick={handleNewCommentClick}
                    >
                      New comment
                    </Button>
                  </div>
                </div>
                <div className='flex flex-wrap items-center gap-3'>
                  {thread.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant='outline'
                      className='text-xs font-medium'
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
                <div className='flex flex-wrap items-center gap-3 text-sm text-muted-foreground'>
                  <div className='flex items-center gap-2'>
                    <Avatar className='size-10'>
                      <AvatarImage src='' alt={thread.author.name} />
                      <AvatarFallback>
                        {thread.author.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className='font-semibold text-foreground'>
                        {thread.author.name}
                      </p>
                      <p>{thread.author.role}</p>
                    </div>
                  </div>
                  <span>Updated {thread.lastActivity}</span>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button variant='secondary' size='sm'>
                    <BellPlus className='mr-2 size-4' />
                    Follow thread
                  </Button>
                  <Button variant='ghost' size='sm' className='text-muted-foreground'>
                    <Share2 className='mr-2 size-4' />
                    Share
                  </Button>
                </div>
              </CardHeader>
              {/* <CardContent className='space-y-4 text-sm leading-relaxed text-muted-foreground'>
                <p>{thread.content}</p>
                <p>
                  Feel free to expand with your own render profiles or capture
                  metrics if you have them. I will roll everything into a doc so
                  the settings stay easy to find later.
                </p>
              </CardContent> */}
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-xl'>
                  Discussion ({commentCount})
                </CardTitle>
                <CardDescription>
                  {commentCount > 0
                    ? 'Latest replies from the community'
                    : 'No replies yet — start the thread!'}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-5'>
                {thread.comments.map((comment) => (
                  <ThreadComment
                    key={comment.id}
                    comment={comment}
                    isOwner={comment.author.name === thread.author.name}
                  />
                ))}
              </CardContent>
            </Card>

            {/* <div ref={replySectionRef} id='reply-form'>
              <Card>
                <CardHeader>
                  <CardTitle>Leave a reply</CardTitle>
                  <CardDescription>
                    Share tips, provide resources, or log your own repro steps.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <Textarea
                    placeholder='Add to the conversation...'
                    className='min-h-[160px]'
                  />
                  <div className='flex justify-end gap-3'>
                    <Button variant='outline' size='sm'>
                      Save draft
                    </Button>
                    <Button size='sm'>Post reply</Button>
                  </div>
                </CardContent>
              </Card>
            </div> */}
          </div>

          {/* <div className='space-y-6'>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-lg'>Thread stats</CardTitle>
                <CardDescription>Updated live from your activity</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <ThreadStat
                  icon={MessageSquare}
                  label='Replies'
                  value={`${commentCount}`}
                />
                <ThreadStat
                  icon={Users}
                  label='Participants'
                  value={`${thread.participants}`}
                />
                <ThreadStat
                  icon={Eye}
                  label='Views'
                  value={`${thread.viewCount}`}
                />
                <ThreadStat
                  icon={BellPlus}
                  label='Watchers'
                  value={`${thread.watchers}`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-lg'>Participants</CardTitle>
                <CardDescription>People active in this thread</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {participants.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    No one has replied yet.
                  </p>
                ) : (
                  participants.map((author) => (
                    <div key={author.name} className='flex items-center gap-3'>
                      <Avatar className='size-9'>
                        <AvatarImage src={author.avatar} alt={author.name} />
                        <AvatarFallback>
                          {author.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className='text-sm font-medium text-foreground'>
                          {author.name}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {author.role ?? 'Contributor'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div> */}
        </div>
      </Main>
    </>
  )
}

// function ThreadStat({
//   icon: Icon,
//   label,
//   value,
// }: {
//   icon: ComponentType<{ className?: string }>
//   label: string
//   value: string
// }) {
//   return (
//     <div className='flex items-center justify-between rounded-lg border border-border/40 px-3 py-2'>
//       <div className='flex items-center gap-3 text-sm'>
//         <Icon className='size-4 text-muted-foreground' />
//         <span>{label}</span>
//       </div>
//       <span className='text-sm font-semibold'>{value}</span>
//     </div>
//   )
// }

function ThreadComment({
  comment,
  isOwner,
}: {
  comment: ForumComment
  isOwner: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card/80 p-4',
        comment.isAnswer && 'border-green-500/40 bg-green-500/5'
      )}
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <Avatar className='size-10'>
            <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
            <AvatarFallback>
              {comment.author.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className='text-sm font-semibold text-foreground'>
              {comment.author.name}
            </p>
            <p className='text-xs text-muted-foreground'>
              {comment.author.role ?? 'Contributor'}
            </p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          {isOwner && <Badge variant='secondary'>Original poster</Badge>}
          {comment.isAnswer && (
            <Badge variant='outline' className='border-green-500/40 text-green-300'>
              Marked as solution
            </Badge>
          )}
          <span>{comment.postedAt}</span>
        </div>
      </div>
      <p className='mt-4 text-sm leading-6 text-muted-foreground'>
        {comment.content}
      </p>
      <div className='mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground'>
        <Button variant='link' size='sm' className='h-auto px-0 text-primary'>
          Reply
        </Button>
        <div className='flex items-center gap-1'>
          <span>↑</span>
          <span className='font-semibold text-foreground'>
            {comment.upvotes ?? 0}
          </span>
        </div>
        <div className='flex items-center gap-1'>
          <span>↓</span>
          <span className='font-semibold text-foreground'>
            {comment.downvotes ?? 0}
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyThreadState({ onBack }: { onBack: () => void }) {
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
