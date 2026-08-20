const test = require("node:test");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");

const { DEFAULT_ACTIONS, buildWalletMap, buildCallData } = require("../lib/txActions");

const COUNTER_ADDRESS = ethers.getAddress("0x" + "1".repeat(40));
const WALLET_A_ADDRESS = ethers.getAddress("0x" + "a".repeat(40));
const WALLET_B_ADDRESS = ethers.getAddress("0x" + "b".repeat(40));

test("DEFAULT_ACTIONS only reference wallets A and B and known actions", () => {
    for (const step of DEFAULT_ACTIONS) {
        assert.ok(["A", "B"].includes(step.wallet));
        assert.ok(["increase", "decrease"].includes(step.action));
        assert.ok(step.fee > 0);
    }
});

test("buildCallData encodes execute(counter, increase/decrease) correctly", () => {
    const counterAddress = COUNTER_ADDRESS;
    const callData = buildCallData(counterAddress);

    const walletInterface = new ethers.Interface(["function execute(address target, bytes data)"]);
    const counterInterface = new ethers.Interface(["function increase()", "function decrease()"]);

    const decodedIncrease = walletInterface.decodeFunctionData("execute", callData.increase);
    assert.equal(decodedIncrease.target.toLowerCase(), counterAddress.toLowerCase());
    assert.equal(counterInterface.parseTransaction({ data: decodedIncrease.data }).name, "increase");

    const decodedDecrease = walletInterface.decodeFunctionData("execute", callData.decrease);
    assert.equal(counterInterface.parseTransaction({ data: decodedDecrease.data }).name, "decrease");
});

test("buildWalletMap indexes wallets by name with signer/contract wired up", () => {
    const provider = new ethers.JsonRpcProvider("http://localhost:8545", undefined, { staticNetwork: true });
    const walletA = ethers.Wallet.createRandom();
    const walletB = ethers.Wallet.createRandom();

    const wallets = [
        { name: "A", privateKey: walletA.privateKey, address: walletA.address, walletAddress: WALLET_A_ADDRESS },
        { name: "B", privateKey: walletB.privateKey, address: walletB.address, walletAddress: WALLET_B_ADDRESS },
    ];

    const map = buildWalletMap(wallets, provider);

    assert.equal(Object.keys(map).sort().join(","), "A,B");
    assert.equal(map.A.signer.address, walletA.address);
    assert.equal(map.A.walletAddress, WALLET_A_ADDRESS);
    assert.equal(map.B.signer.address, walletB.address);

    provider.destroy();
});
