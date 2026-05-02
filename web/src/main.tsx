import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import {
  ThemeProvider,
  SearchProvider,
  CommandMenu,
  createQueryClient,
  getRouterBasepath,
  I18nProvider,
  type Catalogs,
} from '@mochi/web'
import { useSidebarData } from './components/layout/data/sidebar-data'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

// Lingui catalogs bundled by @lingui/vite-plugin (compiled from
// src/locales/<lang>/messages.po on the fly).
const catalogs: Catalogs = {
  en: () => import('./locales/en/messages.po'),
  'en-us': () => import('./locales/en-US/messages.po'),
  fr: () => import('./locales/fr/messages.po'),
  ja: () => import('./locales/ja/messages.po'),

  ar: () => import('./locales/ar/messages.po'),
}

const queryClient = createQueryClient()

const router = createRouter({
  routeTree,
  context: { queryClient },
  basepath: getRouterBasepath(),
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function ForumsCommandMenu() {
  const sidebarData = useSidebarData()
  return <CommandMenu sidebarData={sidebarData} />
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nProvider catalogs={catalogs}>
          <ThemeProvider>
            <SearchProvider>
              <RouterProvider router={router} />
              <ForumsCommandMenu />
            </SearchProvider>
          </ThemeProvider>

        </I18nProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
