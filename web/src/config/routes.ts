export const APP_ROUTES = {
  HOME: '/',
  POST: (forum: string, post: string) => `/${forum}/${post}`,
} as const
