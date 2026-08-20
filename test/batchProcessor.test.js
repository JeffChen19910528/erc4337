const test = require("node:test");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");

const { sortByFeeDesc, describeOp } = require("../lib/batchProcessor");

const COUNTER_ADDRESS = ethers.getAddress("0x" + "1".repeat(40));
const OTHER_ADDRESS = ethers.getAddress("0x" + "2".repeat(40));

test("sortByFeeDesc orders ops by maxFeePerGas descending", () => {
    const ops = [
        { id: "low", maxFeePerGas: ethers.toBeHex(5e9) },
        { id: "high", maxFeePerGas: ethers.toBeHex(20e9) },
        { id: "mid", maxFeePerGas: ethers.toBeHex(10e9) },
    ];

    const sorted = sortByFeeDesc(ops);

    assert.deepEqual(sorted.map(op => op.id), ["high", "mid", "low"]);
});

test("sortByFeeDesc does not mutate the input array", () => {
    const ops = [
        { id: "a", maxFeePerGas: ethers.toBeHex(1e9) },
        { id: "b", maxFeePerGas: ethers.toBeHex(2e9) },
    ];
    const original = [...ops];

    sortByFeeDesc(ops);

    assert.deepEqual(ops, original);
});

test("sortByFeeDesc keeps equal fees in original relative order (stable-ish tie)", () => {
    const ops = [
        { id: "a", maxFeePerGas: ethers.toBeHex(5e9) },
        { id: "b", maxFeePerGas: ethers.toBeHex(5e9) },
    ];

    const sorted = sortByFeeDesc(ops);
    assert.deepEqual(sorted.map(op => op.id), ["a", "b"]);
});

test("describeOp labels a recognizable counter.increase() call", () => {
    const counterAddress = COUNTER_ADDRESS;
    const counterInterface = new ethers.Interface(["function increase()", "function decrease()"]);
    const walletInterface = new ethers.Interface(["function execute(address target, bytes data)"]);

    const callData = walletInterface.encodeFunctionData("execute", [
        counterAddress,
        counterInterface.encodeFunctionData("increase"),
    ]);

    const info = describeOp(
        { nonce: ethers.toBeHex(4), maxFeePerGas: ethers.toBeHex(9e9), callData },
        { walletInterface, counterInterface, counterAddress }
    );

    assert.equal(info.label, "increase");
    assert.equal(info.nonce, 4);
    assert.equal(info.maxFeePerGas, 9_000_000_000n);
});

test("describeOp returns label 'unknown' when target isn't the counter contract", () => {
    const counterAddress = COUNTER_ADDRESS;
    const otherAddress = OTHER_ADDRESS;
    const counterInterface = new ethers.Interface(["function increase()", "function decrease()"]);
    const walletInterface = new ethers.Interface(["function execute(address target, bytes data)"]);

    const callData = walletInterface.encodeFunctionData("execute", [otherAddress, "0x12345678"]);

    const info = describeOp(
        { nonce: ethers.toBeHex(0), maxFeePerGas: ethers.toBeHex(1e9), callData },
        { walletInterface, counterInterface, counterAddress }
    );

    assert.equal(info.label, "unknown");
});

test("describeOp returns label null when callData can't be decoded at all", () => {
    const info = describeOp(
        { nonce: ethers.toBeHex(0), maxFeePerGas: ethers.toBeHex(1e9), callData: "0xnotvalid" },
        {
            walletInterface: new ethers.Interface(["function execute(address target, bytes data)"]),
            counterInterface: new ethers.Interface(["function increase()"]),
            counterAddress: COUNTER_ADDRESS,
        }
    );

    assert.equal(info.label, null);
});
