// 共用 ABI 定義，避免同樣的介面片段散落在多支腳本中。
const COUNTER_ABI = [
    "function increase()",
    "function decrease()",
    "function number() view returns (uint256)",
    "event NumberChanged(string action, uint256 newValue)",
];

const SIMPLE_WALLET_ABI = [
    "function execute(address target, bytes data)",
    "function nonce() view returns (uint256)",
];

const ENTRY_POINT_ABI = [
    "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address beneficiary)",
    "event UserOpHandled(address indexed sender, bool success, string reason)",
];

module.exports = { COUNTER_ABI, SIMPLE_WALLET_ABI, ENTRY_POINT_ABI };
