import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MessageSquarePlus, Check } from 'lucide-react'
import {
  Button,
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@mochi/common'
import { DEFAULT_ACCESS_OPTIONS } from '../constants'

// Characters disallowed in forum names (matches backend validation)
const DISALLOWED_NAME_CHARS = /[<>\r\n\\;"'`]/

const createForumSchema = z.object({
  name: z
    .string()
    .min(1, 'Forum name is required')
    .max(1000, 'Name must be 1000 characters or less')
    .refine((val) => !DISALLOWED_NAME_CHARS.test(val), {
      message: 'Name cannot contain < > \\ ; " \' or ` characters',
    }),
  access: z.enum(['view', 'vote', 'comment', 'post']),
  allowSearch: z.boolean(),
})

type CreateForumFormValues = z.infer<typeof createForumSchema>

type CreateForumDialogProps = {
  onCreate: (input: { name: string; access: string; allowSearch: boolean }) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function CreateForumDialog({ onCreate, open, onOpenChange, hideTrigger }: CreateForumDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen

  const form = useForm<CreateForumFormValues>({
    resolver: zodResolver(createForumSchema),
    defaultValues: {
      name: '',
      access: 'post',
      allowSearch: true,
    },
  })

  const onSubmit = (values: CreateForumFormValues) => {
    onCreate(values)
    form.reset()
    setIsOpen(false)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      form.reset()
    }
  }

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <ResponsiveDialogTrigger asChild>
          <Button size="sm" className="text-sm">
            <MessageSquarePlus className="size-4" />
            Create forum
          </Button>
        </ResponsiveDialogTrigger>
      )}
      <ResponsiveDialogContent className="sm:max-w-[520px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>New forum</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Create a new forum space for your community.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forum name</FormLabel>
                  <FormControl>
                    <Input placeholder="Forum name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="access"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New members can</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full justify-between">
                        <SelectValue placeholder="Select access level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DEFAULT_ACCESS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowSearch"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="space-y-1">
                    <FormLabel className="text-sm font-medium">
                      Allow anyone to search for forum
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Keep the forum discoverable across workspaces.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <ResponsiveDialogFooter className="gap-2">
              <ResponsiveDialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </ResponsiveDialogClose>
              <Button type="submit" disabled={!form.formState.isValid}>
                <Check className="size-4" />
                Create
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
