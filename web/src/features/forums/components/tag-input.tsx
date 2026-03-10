import { TagInput as CommonTagInput } from '@mochi/common'
import forumsApi from '@/api/forums'

interface TagInputProps {
  forumId: string
  postId: string
  existingLabels: string[]
  onAdded: (tag: { id: string; label: string }) => void
}

export function TagInput({
  forumId,
  postId,
  existingLabels,
  onAdded,
}: TagInputProps) {
  return (
    <CommonTagInput
      existingLabels={existingLabels}
      onAdded={onAdded}
      loadSuggestions={() => forumsApi.getForumTags(forumId)}
      submitTag={(label) => forumsApi.addPostTag(forumId, postId, label)}
      submitErrorMessage='Failed to add tag'
    />
  )
}
