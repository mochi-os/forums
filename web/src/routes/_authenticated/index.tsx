import { createFileRoute } from '@tanstack/react-router'
import { Forums } from '@/features/forums'

export const Route = createFileRoute('/_authenticated/')({
  component: Forums,
})
