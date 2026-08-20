const test = require("node:test");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");

const { buildUserOp, hashUserOp, signUserOp, toHandleOpsArgs } = require("../lib/userOperation");

test("buildUserOp fills in expected defaults and hex-encodes numeric fields", () => {
    const userOp = buildUserOp({
        sender: "0x1111111111111111111111111111111111111111".slice(0, 42),
        nonce: 3,
        callData: "0xabcdef",
        maxFeePerGas: 12e9,
    });

    assert.equal(userOp.nonce, ethers.toBeHex(3));
    assert.equal(userOp.callGasLimit, ethers.toBeHex(150000));
    assert.equal(userOp.verificationGasLimit, ethers.toBeHex(150000));
    assert.equal(userOp.preVerificationGas, ethers.toBeHex(20000));
    assert.equal(userOp.maxFeePerGas, ethers.toBeHex(12e9));
    assert.equal(userOp.maxPriorityFeePerGas, ethers.toBeHex(1e9));
    assert.equal(userOp.initCode, "0x");
    assert.equal(userOp.paymasterAndData, "0x");
    assert.equal(userOp.signature, "0x");
});

test("buildUserOp allows overriding gas fields", () => {
    const userOp = buildUserOp({
        sender: "0x2222222222222222222222222222222222222222".slice(0, 42),
        nonce: 0,
        callData: "0x",
        callGasLimit: 999,
        verificationGasLimit: 888,
        preVerificationGas: 777,
        maxFeePerGas: 1,
        maxPriorityFeePerGas: 2,
    });

    assert.equal(userOp.callGasLimit, ethers.toBeHex(999));
    assert.equal(userOp.verificationGasLimit, ethers.toBeHex(888));
    assert.equal(userOp.preVerificationGas, ethers.toBeHex(777));
    assert.equal(userOp.maxPriorityFeePerGas, ethers.toBeHex(2));
});

test("hashUserOp is deterministic for identical inputs", () => {
    const userOp = buildUserOp({
        sender: "0x3333333333333333333333333333333333333333".slice(0, 42),
        nonce: 5,
        callData: "0x1234",
        maxFeePerGas: 10e9,
    });

    const hash1 = hashUserOp(userOp);
    const hash2 = hashUserOp({ ...userOp });
    assert.equal(hash1, hash2);
});

test("hashUserOp changes when any field changes", () => {
    const base = buildUserOp({
        sender: "0x4444444444444444444444444444444444444444".slice(0, 42),
        nonce: 1,
        callData: "0x1234",
        maxFeePerGas: 10e9,
    });
    const changedNonce = buildUserOp({ ...base, sender: base.sender, nonce: 2, callData: "0x1234", maxFeePerGas: 10e9 });

    assert.notEqual(hashUserOp(base), hashUserOp(changedNonce));
});

test("signUserOp signs the userOpHash and mutates the signature in place", async () => {
    const signer = ethers.Wallet.createRandom();
    const userOp = buildUserOp({
        sender: "0x5555555555555555555555555555555555555555".slice(0, 42),
        nonce: 0,
        callData: "0x",
        maxFeePerGas: 1e9,
    });

    const result = await signUserOp(userOp, signer);

    assert.equal(result, userOp, "should return the same object it mutated");
    assert.notEqual(userOp.signature, "0x");

    const hash = hashUserOp(userOp);
    const recovered = ethers.verifyMessage(ethers.getBytes(hash), userOp.signature);
    assert.equal(recovered, signer.address);
});

test("toHandleOpsArgs produces the 11-field tuple in EntryPoint.handleOps order", () => {
    const userOp = buildUserOp({
        sender: "0x6666666666666666666666666666666666666666".slice(0, 42),
        nonce: 7,
        callData: "0xdead",
        maxFeePerGas: 3e9,
    });
    userOp.signature = "0xbeef";

    const args = toHandleOpsArgs(userOp);

    assert.deepEqual(args, [
        userOp.sender,
        userOp.nonce,
        userOp.initCode,
        userOp.callData,
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        userOp.paymasterAndData,
        userOp.signature,
    ]);
});
