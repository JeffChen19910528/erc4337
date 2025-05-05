// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EntryPoint {
    event UserOpHandled(address indexed sender, bool success, string reason);

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

    function handleOps(UserOperation[] calldata ops, address beneficiary) external {
        for (uint256 i = 0; i < ops.length; i++) {
            bool success;
            string memory reason = "";

            (bool callSuccess, bytes memory ret) = ops[i].sender.call{gas: ops[i].callGasLimit}(ops[i].callData);
            success = callSuccess;

            if (!callSuccess) {
                if (ret.length >= 68) {
                    assembly {
                        ret := add(ret, 0x04)
                    }
                    reason = abi.decode(ret, (string));
                } else {
                    reason = "Execution failed";
                }
            }

            emit UserOpHandled(ops[i].sender, success, reason);
        }

        if (beneficiary != address(0)) {
            payable(beneficiary).transfer(0);
        }
    }

    receive() external payable {}
}
