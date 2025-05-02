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
            bool success = true;
            string memory reason = "";

            try this._execute(ops[i]) {
                // OK
            } catch Error(string memory err) {
                success = false;
                reason = err;
            } catch {
                success = false;
                reason = "Unknown error";
            }

            emit UserOpHandled(ops[i].sender, success, reason);
        }

        payable(beneficiary).transfer(0);
    }

    function _execute(UserOperation calldata op) external {
        require(msg.sender == address(this), "not allowed");
        (bool success,) = op.sender.call(op.callData);
        require(success, "Call failed");
    }

    receive() external payable {}
}
