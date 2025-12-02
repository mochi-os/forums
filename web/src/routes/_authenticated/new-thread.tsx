import { createFileRoute } from '@tanstack/react-router'
import { CreateThread } from '@/features/forums/new-thread'

export const Route = createFileRoute('/_authenticated/new-thread')({
  component: CreateThread,
})
