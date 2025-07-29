// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWallet {
    function validateUserOp(
        EntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingFunds
    ) external returns (uint256 validUntil, uint256 validAfter);
}

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
            UserOperation calldata op = ops[i];
            string memory reason = "";
            bool success = false;

            bytes32 userOpHash = keccak256(abi.encode(
                op.sender,
                op.nonce,
                op.initCode,
                op.callData,
                op.callGasLimit,
                op.verificationGasLimit,
                op.preVerificationGas,
                op.maxFeePerGas,
                op.maxPriorityFeePerGas,
                op.paymasterAndData
            ));

            try IWallet(op.sender).validateUserOp(op, userOpHash, 0) {
                (bool callSuccess, bytes memory ret) = op.sender.call{gas: op.callGasLimit}(op.callData);
                success = callSuccess;
                if (!callSuccess) {
                    reason = _getRevertMsg(ret);
                }
            } catch Error(string memory err) {
                reason = err;
            } catch {
                reason = "Validation failed";
            }

            emit UserOpHandled(op.sender, success, reason);
        }

        if (beneficiary != address(0)) {
            payable(beneficiary).transfer(0);
        }
    }

    /// @dev Extracts revert reason from returned data
    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        if (_returnData.length < 68) return "Execution failed (no reason)";
        assembly {
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string));
    }

    receive() external payable {}
}
