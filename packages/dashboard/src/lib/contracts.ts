export interface DeploymentContract {
  address: string;
  implementation?: string;
  txHash: string;
  block: number;
  gasUsed: number;
}

export interface DeploymentConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  timestamp: string;
  deployer: string;
  contracts: Record<string, DeploymentContract>;
  totalGasUsed: number;
  totalCost: string;
}

export const deploymentConfig: DeploymentConfig = {
  network: '0G Testnet',
  chainId: 16602,
  rpcUrl: 'https://evmrpc-testnet.0g.ai',
  timestamp: '2026-04-27T18:35:00Z',
  deployer: '0x7975E591c26e6c6D9B0CFd9A81f6d61A921C080c',
  contracts: {
    IdentityRegistryUpgradeable: {
      address: '0xF0Be1A141A3340262197f3e519FafB1a71Ee432a',
      implementation: '0x430e2F332fFe1BC5eFa3C54360fE9aC704EEaff7',
      txHash: '0x86f93eb015a17bc2a2d307de3d3c14124de5a8aa91b243f5c10fe5ae7c5dbb83',
      block: 30129053,
      gasUsed: 270938,
    },
    ReputationRegistryUpgradeable: {
      address: '0xCd2FD868b7eaB529075c5a7716dDfE395be33656',
      implementation: '0x05A74dc13A6E4B2E166393558357485bD76bBf3c',
      txHash: '0xa0144a9b5305614dda43891dca76618efbfc00ce364ae6edfa1280264c747cd8',
      block: 30129086,
      gasUsed: 197048,
    },
    StrategyForgeINFT: {
      address: '0xEAd14B860fa11e81a2B8348AC3Ea1b401b7C4135',
      txHash: '0x7ff64d24447ccc89917d8b32f2f658e94b543bea21c90b156f34d6d973796e8d',
      block: 30129101,
      gasUsed: 1268163,
    },
  },
  totalGasUsed: 7281758,
  totalCost: '0.029127032050972306 ETH',
};

export function getContractEntries(): Array<[string, DeploymentContract]> {
  return Object.entries(deploymentConfig.contracts);
}
