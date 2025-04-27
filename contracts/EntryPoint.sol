// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EntryPoint {
    event HandleOps(address indexed sender);

    function handleOps(
        UserOperation[] calldata ops,
        address beneficiary
    ) external {
        emit HandleOps(ops[0].sender);
    }

    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }
}
