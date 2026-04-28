import { createConfig, http } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = import.meta.env.VITE_WC_PROJECT_ID as string | undefined;

const connectors = projectId
  ? [injected(), walletConnect({ projectId })]
  : [injected()];

export const wagmiConfig = createConfig({
  chains: [mainnet, base],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});
