const ethers = require("ethers");
const axios = require("axios");
const fs = require("fs");

async function sendSegment(actions, walletMap, walletCallData, counterIface, ENTRY_POINT_ADDRESS, segment) {
    const provider = walletMap[Object.keys(walletMap)[0]].signer.provider;
    const nonceMap = {};
    for (const name of Object.keys(walletMap)) {
        nonceMap[name] = await walletMap[name].contract.nonce();
    }

    const start = Date.now();
    const duration = 2 * 60 * 1000;
    let counter = 0;
    while (Date.now() - start < duration) {
        for (let i = 0; i < actions.length; i++) {
            const { wallet: walletName, action, fee } = actions[i];
            const { signer, walletAddress } = walletMap[walletName];

            const nonce = nonceMap[walletName];
            nonceMap[walletName] = nonce + 1n;

            const userOp = {
                sender: walletAddress,
                nonce: ethers.toBeHex(nonce),
                initCode: "0x",
                callData: walletCallData[action],
                callGasLimit: ethers.toBeHex(150000),
                verificationGasLimit: ethers.toBeHex(150000),
                preVerificationGas: ethers.toBeHex(20000),
                maxFeePerGas: ethers.toBeHex(fee),
                maxPriorityFeePerGas: ethers.toBeHex(1e9),
                paymasterAndData: "0x",
                signature: "0x"
            };

            const userOpHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode([
                    "address", "uint256", "bytes", "bytes",
                    "uint256", "uint256", "uint256",
                    "uint256", "uint256", "bytes"
                ], [
                    userOp.sender,
                    BigInt(userOp.nonce),
                    userOp.initCode,
                    userOp.callData,
                    BigInt(userOp.callGasLimit),
                    BigInt(userOp.verificationGasLimit),
                    BigInt(userOp.preVerificationGas),
                    BigInt(userOp.maxFeePerGas),
                    BigInt(userOp.maxPriorityFeePerGas),
                    userOp.paymasterAndData
                ])
            );
            userOp.signature = await signer.signMessage(ethers.getBytes(userOpHash));

            await axios.post("http://localhost:3000/", {
                jsonrpc: "2.0",
                id: counter++,
                method: "eth_sendUserOperation",
                params: [userOp, ENTRY_POINT_ADDRESS]
            });
        }

        // === 每組10筆交易送出後暫停1秒 ===
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

async function main() {
    const RPC_URL = "http://localhost:8545";
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const deployInfo = JSON.parse(fs.readFileSync("deploy.json"));
    const ENTRY_POINT_ADDRESS = deployInfo.entryPoint;
    const COUNTER_ADDRESS = deployInfo.counter;
    const wallets = deployInfo.wallets;

    const counterIface = new ethers.Interface(["function increase()", "function decrease()"]);
    const walletIface = new ethers.Interface(["function execute(address target, bytes data)"]);
    const simpleWalletIface = new ethers.Interface(["function nonce() view returns (uint256)"]);

    const increaseData = counterIface.encodeFunctionData("increase");
    const decreaseData = counterIface.encodeFunctionData("decrease");

    const walletCallData = {
        increase: walletIface.encodeFunctionData("execute", [COUNTER_ADDRESS, increaseData]),
        decrease: walletIface.encodeFunctionData("execute", [COUNTER_ADDRESS, decreaseData])
    };

    const walletMap = {};
    for (const w of wallets) {
        walletMap[w.name] = {
            signer: new ethers.Wallet(w.privateKey, provider),
            address: w.address,
            walletAddress: w.walletAddress,
            contract: new ethers.Contract(w.walletAddress, simpleWalletIface, provider),
        };
    }

    const actions = [
        { wallet: "A", action: "increase", fee: 12e9 },
        { wallet: "B", action: "decrease", fee: 12e9 },
        { wallet: "A", action: "increase", fee: 10e9 },
        { wallet: "B", action: "decrease", fee: 11e9 },
        { wallet: "A", action: "decrease", fee: 10e9 },
        { wallet: "B", action: "decrease", fee: 10e9 },
        { wallet: "A", action: "increase", fee: 9e9 },
        { wallet: "B", action: "decrease", fee: 7e9 },
        { wallet: "B", action: "decrease", fee: 6e9 },
        { wallet: "A", action: "increase", fee: 8e9 }
    ];

    for (let i = 1; i <= 10; i++) {
        console.log(`\n🔁 開始第 ${i} 區段的送出`);
        await sendSegment(actions, walletMap, walletCallData, counterIface, ENTRY_POINT_ADDRESS, i);
    }
}

main().catch(console.error);