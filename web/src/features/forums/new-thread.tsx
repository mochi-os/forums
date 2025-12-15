import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Search,
  NotificationsDropdown,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  Header,
  Main,
} from '@mochi/common'
import { forumsApi } from '@/api/forums'

type ThreadFormState = {
  title: string
  body: string
}

export function CreateThread() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // Get first available forum
  const { data: forumsData } = useQuery({
    queryKey: ['forums', 'list'],
    queryFn: () => forumsApi.list(),
  })
  
  const forumId = forumsData?.data?.forums?.[0]?.id

  const [formState, setFormState] = useState<ThreadFormState>({
    title: '',
    body: '',
  })

  const createPostMutation = useMutation({
    mutationFn: (data: { forum: string; title: string; body: string }) =>
      forumsApi.createPost(data),
    onSuccess: (response) => {
      toast.success('Thread created successfully!')
      queryClient.invalidateQueries({ queryKey: ['forums', 'view', response.data.forum] })
      navigate({ to: `/thread/${response.data.post}` })
    },
    onError: (error) => {
      toast.error('Failed to create thread')
      console.error('Create post error:', error)
    },
  })

  const onFieldChange = (field: keyof ThreadFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    
    if (!forumId) {
      toast.error('No forum available')
      return
    }

    if (!formState.title.trim() || !formState.body.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    createPostMutation.mutate({
      forum: forumId,
      title: formState.title,
      body: formState.body,
    })
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

        <Card>
          <form className='space-y-6' onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Create a new thread</CardTitle>
              <CardDescription>
                Set the context, highlight what you have tried, and share your question or insight.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='thread-title'>Title</Label>
                <Input
                  id='thread-title'
                  placeholder='What would you like to discuss?'
                  value={formState.title}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    onFieldChange('title', event.target.value)
                  }
                  required
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='thread-body'>Content</Label>
                <Textarea
                  id='thread-body'
                  className='min-h-[220px]'
                  placeholder='Share your context, steps you tried, and what kind of help you need...'
                  value={formState.body}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                    onFieldChange('body', event.target.value)
                  }
                  required
                />
              </div>

              <div className='flex flex-wrap items-center justify-end gap-3'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => navigate({ to: '/' })}
                  disabled={createPostMutation.isPending}
                >
                  <Save className='size-4' />
                  Cancel
                </Button>
                <Button 
                  type='submit' 
                  disabled={createPostMutation.isPending || !forumId}
                >
                  {createPostMutation.isPending ? (
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
      </Main>
    </>
  )
}
