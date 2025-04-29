const ethers = require('ethers');
const fs = require('fs');

async function main() {
    const deployInfo = JSON.parse(fs.readFileSync('deploy.json'));
    const COUNTER_ADDRESS = deployInfo.counter;

    const RPC_URL = "http://localhost:8545";
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const counterAbi = [
        "function number() view returns (uint256)",
        "event NumberChanged(string action, uint256 newValue)"
    ];
    const counter = new ethers.Contract(COUNTER_ADDRESS, counterAbi, provider);

    const value = await counter.number();
    console.log("📊 Counter 現在的數值是:", value.toString());

    const filter = counter.filters.NumberChanged();
    const events = await counter.queryFilter(filter, "latest");
    for (const ev of events) {
        console.log(`🧾 Event: ${ev.args.action} ➝ ${ev.args.newValue}`);
    }
}

main().catch(console.error);
