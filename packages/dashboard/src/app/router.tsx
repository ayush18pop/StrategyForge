import { createBrowserRouter } from 'react-router-dom';
import { PublicShell } from '../components/primitives/PublicShell';
import { AppShell } from '../components/primitives/AppShell';
import { PublicLandingPage } from '../features/marketing/PublicLandingPage';
import { AgentPage } from '../features/app/AgentPage';
import { DagPage } from '../features/app/DagPage';
import { ExecutionPage } from '../features/app/ExecutionPage';
import { GeneratePage } from '../features/app/GeneratePage';
import { SettingsPage } from '../features/app/SettingsPage';
import { StrategyDetailPage } from '../features/app/StrategyDetailPage';
import { AppHomePage } from '../features/search';

export const router = createBrowserRouter([
  {
    element: <PublicShell />,
    children: [
      {
        path: '/',
        element: <PublicLandingPage />,
      },
    ],
  },
  {
    element: <AppShell />,
    children: [
      {
        path: '/app',
        element: <AppHomePage />,
      },
      {
        path: '/app/strategy/:familyId',
        element: <StrategyDetailPage />,
      },
      {
        path: '/app/generate',
        element: <GeneratePage />,
      },
      {
        path: '/app/dag/:familyId',
        element: <DagPage />,
      },
      {
        path: '/app/agent',
        element: <AgentPage />,
      },
      {
        path: '/app/execution/:workflowId',
        element: <ExecutionPage />,
      },
      {
        path: '/app/settings',
        element: <SettingsPage />,
      },
    ],
  },
]);
