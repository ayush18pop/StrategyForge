import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { Toaster } from 'sonner';
import { ThemeProvider } from '../theme/ThemeProvider';
import { wagmiConfig } from '../lib/wallet';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-3)',
              border: '1px solid var(--edge-sides)',
              borderTopColor: 'var(--edge-top)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--fs-sm)',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
    </WagmiProvider>
  );
}
