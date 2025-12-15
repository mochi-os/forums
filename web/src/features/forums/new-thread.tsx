import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ListChecks, Sparkles, Save, Send } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { NotificationsDropdown } from '@mochi/common'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const categories = [
  'General Discussion',
  'How To',
  'Show & Tell',
  'Support',
  'Announcements',
]

const statuses = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'announcement', label: 'Announcement' },
]

type ThreadFormState = {
  title: string
  category: string
  status: string
  tags: string
  content: string
}

export function CreateThread() {
  const navigate = useNavigate()
  const [formState, setFormState] = useState<ThreadFormState>({
    title: '',
    category: categories[0] ?? 'General Discussion',
    status: 'open',
    tags: '',
    content: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onFieldChange = (field: keyof ThreadFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      navigate({ to: '/' })
    }, 600)
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
          onClick={() => navigate({ to: '/' })}
        >
          <ArrowLeft className='mr-2 size-4' />
          Back to threads
        </Button>

        <div className='grid gap-6 lg:grid-cols-[2fr,1fr]'>
          <Card>
            <form className='space-y-6' onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Create a new thread</CardTitle>
                <CardDescription>
                  Set the context, highlight what you have tried, and tag it so
                  the right folks see it.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='thread-category'>Category</Label>
                    <Select
                      value={formState.category}
                      onValueChange={(value) => onFieldChange('category', value)}
                    >
                      <SelectTrigger id='thread-category'>
                        <SelectValue placeholder='Select a category' />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='thread-status'>Status</Label>
                    <Select
                      value={formState.status}
                      onValueChange={(value) => onFieldChange('status', value)}
                    >
                      <SelectTrigger id='thread-status'>
                        <SelectValue placeholder='Status' />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='thread-title'>Title</Label>
                  <Input
                    id='thread-title'
                    placeholder='What would you like to discuss?'
                    value={formState.title}
                    onChange={(event) =>
                      onFieldChange('title', event.target.value)
                    }
                    required
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='thread-tags'>Tags</Label>
                  <Input
                    id='thread-tags'
                    placeholder='workflow, rendering, template'
                    value={formState.tags}
                    onChange={(event) =>
                      onFieldChange('tags', event.target.value)
                    }
                  />
                  <p className='text-xs text-muted-foreground'>
                    Separate tags with commas. They help others find your thread.
                  </p>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='thread-content'>Content</Label>
                  <Textarea
                    id='thread-content'
                    className='min-h-[220px]'
                    placeholder='Share your context, steps you tried, and what kind of help you need...'
                    value={formState.content}
                    onChange={(event) =>
                      onFieldChange('content', event.target.value)
                    }
                    required
                  />
                </div>

                <div className='flex flex-wrap items-center justify-end gap-3'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => navigate({ to: '/' })}
                  >
                    <Save className='size-4' />
                    Save draft
                  </Button>
                  <Button type='submit' disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Send className='size-4' />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Send className='size-4' />
                        Publish thread
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>

          <div className='space-y-6'>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='flex items-center gap-2 text-lg'>
                  <ListChecks className='size-4 text-muted-foreground' />
                  Posting checklist
                </CardTitle>
                <CardDescription>
                  A few tips to keep discussions helpful
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3 text-sm text-muted-foreground'>
                <ChecklistItem label='Include what you already tried' />
                <ChecklistItem label='Share screenshots or files if you can' />
                <ChecklistItem label='Tag teammates who should follow along' />
                <ChecklistItem label='Mark solutions so others can spot them' />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='flex items-center gap-2 text-lg'>
                  <Sparkles className='size-4 text-muted-foreground' />
                  Live preview
                </CardTitle>
                <CardDescription>
                  This is how your thread will appear
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3 text-sm'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='secondary'>
                    {formState.category || 'Category'}
                  </Badge>
                  <Badge variant='outline'>{formState.status}</Badge>
                </div>
                <p className='text-lg font-semibold'>
                  {formState.title || 'Thread title'}
                </p>
                <p className='text-muted-foreground leading-relaxed'>
                  {formState.content ||
                    'Your preview updates as you write. Use this space to ensure your introduction is clear and concise.'}
                </p>
                <div className='flex flex-wrap gap-2'>
                  {formState.tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <Badge key={tag} variant='outline'>
                        #{tag}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Main>
    </>
  )
}

function ChecklistItem({ label }: { label: string }) {
  return (
    <div className='flex items-start gap-2 rounded-lg border border-border/40 px-3 py-2'>
      <span className='mt-0.5 size-1.5 rounded-full bg-emerald-400' />
      <p>{label}</p>
    </div>
  )
}
