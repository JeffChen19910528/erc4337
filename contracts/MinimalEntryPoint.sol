// contracts/MinimalEntryPoint.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISimpleWallet {
    function validateUserOp(bytes calldata, bytes32, uint256) external returns (uint256, uint256);
    function execute(address target, bytes calldata data) external;
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

contract MinimalEntryPoint {
    function handleOps(UserOperation[] calldata ops, address) external {
        for (uint i = 0; i < ops.length; i++) {
            UserOperation calldata op = ops[i];
            ISimpleWallet wallet = ISimpleWallet(op.sender);

            wallet.validateUserOp("", bytes32(0), 0);

            (address target, bytes memory data) = abi.decode(op.callData[4:], (address, bytes));
            wallet.execute(target, data);
        }
    }
}
