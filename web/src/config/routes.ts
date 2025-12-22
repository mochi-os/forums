export const APP_ROUTES = {
  HOME: '/',
  SEARCH: '/search',
  POST: (forum: string, post: string) => `/${forum}/${post}`,
} as const
