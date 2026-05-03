import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const EXPLORER_API = 'https://chainscan-galileo.0g.ai/open/api';

// Blockscout / Etherscan API format
async function verifyContract(name: string, address: string) {
    console.log(`\nVerifying ${name} at ${address}...`);
    
    const sourcePath = path.join(process.cwd(), 'contracts', `${name}.sol`);
    const sourceCode = fs.readFileSync(sourcePath, 'utf8');
    
    const params = new URLSearchParams();
    params.append('module', 'contract');
    params.append('action', 'verifysourcecode');
    params.append('contractaddress', address);
    params.append('sourceCode', sourceCode);
    params.append('codeformat', 'solidity-single-file');
    params.append('contractname', name);
    // Solc version installed is 0.8.35
    params.append('compilerversion', 'v0.8.35+commit.47b9dedd');
    params.append('optimizationUsed', '0');
    
    try {
        const response = await fetch(EXPLORER_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });
        
        const data = await response.json();
        
        if (data.status === '1') {
            console.log(`✅ Success! Verification request submitted. GUID: ${data.result}`);
            await checkStatus(data.result);
        } else if (data.result && data.result.includes('Already Verified')) {
            console.log(`✅ ${name} is already verified.`);
        } else {
            console.error(`❌ Failed:`, data.message || data.result);
        }
    } catch (e: any) {
        console.error(`❌ Error verifying ${name}:`, e.message);
    }
}

async function checkStatus(guid: string) {
    console.log(`Checking verification status...`);
    let pending = true;
    while (pending) {
        await new Promise(r => setTimeout(r, 3000));
        
        const res = await fetch(`${EXPLORER_API}?module=contract&action=checkverifystatus&guid=${guid}`);
        const data = await res.json();
        
        if (data.status === '1') {
            console.log(`✅ ${data.result}`);
            pending = false;
        } else if (data.result === 'Pending in queue') {
            process.stdout.write('.');
        } else {
            console.error(`❌ Verification failed: ${data.result}`);
            pending = false;
        }
    }
}

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  StrategyForge — Blockscout Contract Verification');
    console.log('═══════════════════════════════════════════════════');

    const registryAddr = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || process.env.AGENT_REGISTRY_ADDRESS;
    const ledgerAddr = process.env.NEXT_PUBLIC_REPUTATION_LEDGER_ADDRESS || process.env.REPUTATION_LEDGER_ADDRESS;

    if (!registryAddr || !ledgerAddr) {
        console.error('Missing contract addresses in .env');
        process.exit(1);
    }

    await verifyContract('AgentRegistry', registryAddr);
    await verifyContract('ReputationLedger', ledgerAddr);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
