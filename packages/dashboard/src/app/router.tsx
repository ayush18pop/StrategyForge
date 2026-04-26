import { createBrowserRouter } from 'react-router-dom';
import { PublicShell } from '../components/primitives/PublicShell';
import { AppShell } from '../components/primitives/AppShell';
import { PublicLandingPage } from '../features/marketing/PublicLandingPage';

// Route placeholders — each TODO references the implementing ticket
const PlaceholderPage = ({ name }: { name: string }) => (
  <div style={{ padding: '2rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
    <span style={{ color: 'var(--text-tertiary)' }}>// TODO</span>{' '}
    <span style={{ color: 'var(--accent-500)' }}>{name}</span>
  </div>
);

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
        // TODO: Ticket 12 — AppHome with search input, live stats, strategy results
        element: <PlaceholderPage name="AppHome / Search" />,
      },
      {
        path: '/app/strategy/:familyId',
        // TODO: Ticket 13 — StrategyDetail with allocation donut, Kelly bars, version timeline, evidence sheet
        element: <PlaceholderPage name="StrategyDetail" />,
      },
      {
        path: '/app/generate',
        // TODO: Ticket 14 — Pipeline / Generate with 6-station flow
        element: <PlaceholderPage name="GeneratePipeline" />,
      },
      {
        path: '/app/dag/:familyId',
        // TODO: Ticket 15 — DAG viewer with React Flow, priorCid edges, compare sheet
        element: <PlaceholderPage name="DAGViewer" />,
      },
      {
        path: '/app/agent',
        // TODO: Ticket 16 — iNFT identity card, brain CID, earnings, strategy list
        element: <PlaceholderPage name="AgentIdentity" />,
      },
      {
        path: '/app/execution/:workflowId',
        // TODO: Ticket 17 — Live execution, position bars, rebalance flow, update banner
        element: <PlaceholderPage name="LiveExecution" />,
      },
      {
        path: '/app/settings',
        // TODO: Ticket 18 — Theme toggle, wallet, API key, TBA balance
        element: <PlaceholderPage name="Settings" />,
      },
    ],
  },
]);
