import { useEffect } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell, HeistFrame } from './app/Shell';
import { useAuth } from './app/auth';
import { AppToaster } from './components/ui';
import { Gate } from './screens/Gate';
import { NotFound } from './screens/NotFound';

const screen = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => ({
  lazy: async () => ({ Component: (await load())[name] }),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

/** A data router, because the Forge asks "Leave without saving?" before navigating away. */
const router = createBrowserRouter([
  { path: '/gate', element: <Gate /> },
  { path: '/styleguide', ...screen(() => import('./styleguide/Styleguide'), 'Styleguide') },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/board" replace /> },
      { path: '/board', ...screen(() => import('./screens/Board'), 'Board') },
      { path: '/forge', ...screen(() => import('./screens/Forge'), 'Forge') },
      { path: '/forge/:guardId', ...screen(() => import('./screens/Forge'), 'Forge') },
      { path: '/vaults', ...screen(() => import('./screens/MyVaults'), 'MyVaults') },
      { path: '/cases', ...screen(() => import('./screens/CaseFiles'), 'CaseFiles') },
      { path: '/report/:sessionId', ...screen(() => import('./screens/Report'), 'Report') },
      { path: '*', element: <NotFound /> },
    ],
  },
  { element: <HeistFrame />, children: [{ path: '/heist/:sessionId', ...screen(() => import('./screens/Heist'), 'Heist') }] },
]);

export function App() {
  const init = useAuth((state) => state.init);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <AppToaster />
    </QueryClientProvider>
  );
}
