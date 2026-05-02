/**
 * Deploy AgentRegistry and ReputationLedger to 0G Chain testnet.
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... npx tsx contracts/deploy.ts
 *
 * Requires: npm install -D solc tsx
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
// @ts-ignore — solc types are loose
import solc from 'solc';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OG_RPC = process.env.OG_CHAIN_RPC ?? 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error('AGENT_PRIVATE_KEY env var required');
    process.exit(1);
}

function compileContract(name: string) {
    const source = readFileSync(resolve(__dirname, `${name}.sol`), 'utf8');
    const input = {
        language: 'Solidity',
        sources: { [`${name}.sol`]: { content: source } },
        settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } },
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    const errors = (output.errors ?? []).filter((e: any) => e.severity === 'error');
    if (errors.length > 0) {
        throw new Error(`Compile error in ${name}.sol:\n${errors.map((e: any) => e.message).join('\n')}`);
    }

    const contract = output.contracts[`${name}.sol`][name];
    return {
        abi: contract.abi,
        bytecode: '0x' + contract.evm.bytecode.object,
    };
}

async function deploy() {
    const provider = new ethers.JsonRpcProvider(OG_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);

    console.log(`Deploying from: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

    // Deploy AgentRegistry
    console.log('\nCompiling AgentRegistry...');
    const registry = compileContract('AgentRegistry');
    const registryFactory = new ethers.ContractFactory(registry.abi, registry.bytecode, wallet);
    console.log('Deploying AgentRegistry...');
    const registryContract = await registryFactory.deploy();
    await registryContract.waitForDeployment();
    const registryAddress = await registryContract.getAddress();
    console.log(`AgentRegistry deployed: ${registryAddress}`);

    // Deploy ReputationLedger
    console.log('\nCompiling ReputationLedger...');
    const ledger = compileContract('ReputationLedger');
    const ledgerFactory = new ethers.ContractFactory(ledger.abi, ledger.bytecode, wallet);
    console.log('Deploying ReputationLedger...');
    const ledgerContract = await ledgerFactory.deploy();
    await ledgerContract.waitForDeployment();
    const ledgerAddress = await ledgerContract.getAddress();
    console.log(`ReputationLedger deployed: ${ledgerAddress}`);

    // Register the StrategyForge agent (agentId will be 1)
    console.log('\nRegistering StrategyForge agent (ID=1)...');
    const reg = new ethers.Contract(registryAddress, registry.abi, wallet);
    const tx = await (reg as any).register('strategyforge-agent-v1');
    await tx.wait();
    console.log('Agent registered with ID: 1');

    // Save deployment addresses
    const deployments = {
        network: 'og-testnet',
        rpc: OG_RPC,
        deployer: wallet.address,
        AgentRegistry: registryAddress,
        ReputationLedger: ledgerAddress,
        deployedAt: new Date().toISOString(),
    };
    writeFileSync(resolve(__dirname, '../deployments.json'), JSON.stringify(deployments, null, 2));

    console.log('\n✓ Deployment complete. Add to .env:');
    console.log(`AGENT_REGISTRY_ADDRESS=${registryAddress}`);
    console.log(`REPUTATION_LEDGER_ADDRESS=${ledgerAddress}`);
    console.log(`\nSaved to deployments.json`);
}

deploy().catch(err => {
    console.error(err);
    process.exit(1);
});
