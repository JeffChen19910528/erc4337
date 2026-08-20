const { ethers } = require("ethers");
const { SIMPLE_WALLET_ABI } = require("./abi");

// A/B 兩組使用者交錯送出 increase/decrease 的模擬腳本，
// 供 sendUserOp.js 與 sendUserOp-tps.js 共用。
const DEFAULT_ACTIONS = [
    { wallet: "A", action: "increase", fee: 12e9 },
    { wallet: "B", action: "decrease", fee: 12e9 },
    { wallet: "A", action: "increase", fee: 10e9 },
    { wallet: "B", action: "decrease", fee: 11e9 },
    { wallet: "A", action: "decrease", fee: 10e9 },
    { wallet: "B", action: "decrease", fee: 10e9 },
    { wallet: "A", action: "increase", fee: 9e9 },
    { wallet: "B", action: "decrease", fee: 7e9 },
    { wallet: "B", action: "decrease", fee: 6e9 },
    { wallet: "A", action: "increase", fee: 8e9 },
];

/**
 * 依 deploy.json 中的 wallets 清單，建立 name -> { signer, contract, ... } 的對照表。
 */
function buildWalletMap(wallets, provider) {
    const simpleWalletInterface = new ethers.Interface(SIMPLE_WALLET_ABI);
    const map = {};
    for (const w of wallets) {
        map[w.name] = {
            signer: new ethers.Wallet(w.privateKey, provider),
            address: w.address,
            walletAddress: w.walletAddress,
            contract: new ethers.Contract(w.walletAddress, simpleWalletInterface, provider),
        };
    }
    return map;
}

/**
 * 建立 SimpleWallet.execute(counter, increase/decrease) 的 callData。
 */
function buildCallData(counterAddress) {
    const counterInterface = new ethers.Interface(["function increase()", "function decrease()"]);
    const walletInterface = new ethers.Interface(["function execute(address target, bytes data)"]);

    return {
        increase: walletInterface.encodeFunctionData("execute", [
            counterAddress,
            counterInterface.encodeFunctionData("increase"),
        ]),
        decrease: walletInterface.encodeFunctionData("execute", [
            counterAddress,
            counterInterface.encodeFunctionData("decrease"),
        ]),
    };
}

module.exports = { DEFAULT_ACTIONS, buildWalletMap, buildCallData };
