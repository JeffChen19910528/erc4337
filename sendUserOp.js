const ethers = require("ethers");
const axios = require("axios");
const fs = require("fs");

async function main() {
    const RPC_URL = "http://localhost:8545";
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // === 讀取部署資訊 ===
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

    // A/B 錢包設定
    const walletMap = {};
    for (const w of wallets) {
        walletMap[w.name] = {
            signer: new ethers.Wallet(w.privateKey, provider),
            address: w.address,
            walletAddress: w.walletAddress,
            contract: new ethers.Contract(w.walletAddress, simpleWalletIface, provider),
        };
    }

    // 指定交錯順序與參數
    const actions = [
        { wallet: "A", action: "increase", fee: 12e9 }, // 1
        { wallet: "B", action: "decrease", fee: 12e9 }, // 2
        { wallet: "A", action: "increase", fee: 10e9 }, // 4
        { wallet: "B", action: "decrease", fee: 11e9 }, // 3
        { wallet: "A", action: "decrease", fee: 10e9 }, // 5
        { wallet: "B", action: "decrease", fee: 10e9 }, // 6
        { wallet: "A", action: "increase", fee: 9e9 },  // 7
        { wallet: "B", action: "decrease", fee: 7e9 },  // 8
        { wallet: "B", action: "decrease", fee: 6e9 },  // 9
        { wallet: "A", action: "increase", fee: 8e9 }   // 10
    ];

    // 預抓每個 wallet 的 nonce 起點
    const nonceMap = {};
    for (const name of Object.keys(walletMap)) {
        nonceMap[name] = await walletMap[name].contract.nonce();
    }

    for (let i = 0; i < actions.length; i++) {
        const { wallet: walletName, action, fee } = actions[i];
        const { signer, walletAddress } = walletMap[walletName];

        const nonce = nonceMap[walletName];
        nonceMap[walletName] = nonce + 1n; // 遞增

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

        // 建立 userOpHash
        const userOpHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                [
                    "address", "uint256", "bytes", "bytes",
                    "uint256", "uint256", "uint256",
                    "uint256", "uint256", "bytes"
                ],
                [
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
                ]
            )
        );

        // 簽章
        userOp.signature = await signer.signMessage(ethers.getBytes(userOpHash));

        console.log(`📤 傳送 UserOp #${i + 1} | ${walletName} | ${action} | fee=${fee / 1e9} gwei`);
        await axios.post("http://localhost:3000/", {
            jsonrpc: "2.0",
            id: i + 1,
            method: "eth_sendUserOperation",
            params: [userOp, ENTRY_POINT_ADDRESS]
        });
    }

    console.log("✅ 所有交錯 UserOperations 已送出");
}

main().catch(console.error);
