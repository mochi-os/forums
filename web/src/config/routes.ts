export const APP_ROUTES = {
  HOME: '/',
  SEARCH: '/search',
  THREAD: (forum: string, thread: string) => `/thread/${forum}/${thread}`,
} as const
