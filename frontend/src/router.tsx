import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { getMeQueryOptions } from '@/api'
import { AppLayout, Spinner } from '@/components/Layout'

interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: () => (
    <p className="p-6 text-center text-muted-foreground">Seite nicht gefunden.</p>
  ),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: lazyRouteComponent(() => import('./routes/Auth'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: lazyRouteComponent(() => import('./routes/Auth'), 'RegisterPage'),
})

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: lazyRouteComponent(() => import('./routes/Privacy'), 'PrivacyPage'),
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData({
        ...getMeQueryOptions(),
        staleTime: 60_000,
      })
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
  pendingComponent: Spinner,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  privacyRoute,
  appRoute.addChildren([
    createRoute({
      getParentRoute: () => appRoute,
      path: '/',
      component: lazyRouteComponent(() => import('./routes/Today'), 'TodayPage'),
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/workout/$sessionId',
      component: lazyRouteComponent(() => import('./routes/Workout'), 'WorkoutPage'),
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/plans',
      component: lazyRouteComponent(() => import('./routes/Plans'), 'PlansPage'),
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/plans/$planId',
      component: lazyRouteComponent(() => import('./routes/PlanEditor'), 'PlanEditorPage'),
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/history',
      component: lazyRouteComponent(() => import('./routes/HistoryPage'), 'HistoryPage'),
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/exercises',
      component: lazyRouteComponent(() => import('./routes/Exercises'), 'ExercisesPage'),
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/exercises/$exerciseId',
      component: lazyRouteComponent(() => import('./routes/ExerciseDetail'), 'ExerciseDetailPage'),
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/settings',
      component: lazyRouteComponent(() => import('./routes/Settings'), 'SettingsPage'),
    }),
    createRoute({
      getParentRoute: () => appRoute,
      path: '/admin',
      component: lazyRouteComponent(() => import('./routes/Admin'), 'AdminPage'),
    }),
  ]),
])

export const router = createRouter({
  routeTree,
  context: { queryClient: undefined as unknown as QueryClient },
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
