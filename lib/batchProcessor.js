/**
 * 依 maxFeePerGas 由高到低排序（不改動原陣列）。
 */
function sortByFeeDesc(ops) {
    return [...ops].sort((a, b) => {
        const aFee = BigInt(a.maxFeePerGas);
        const bFee = BigInt(b.maxFeePerGas);
        return aFee > bFee ? -1 : aFee < bFee ? 1 : 0;
    });
}

/**
 * 嘗試解析單筆 UserOperation 的 callData，供 log 輸出使用。
 * 無法解析時回傳 label: null。
 */
function describeOp(op, { walletInterface, counterInterface, counterAddress }) {
    try {
        const decoded = walletInterface.decodeFunctionData("execute", op.callData);
        const target = decoded.target;
        let label = "unknown";
        if (target.toLowerCase() === counterAddress.toLowerCase()) {
            label = counterInterface.parseTransaction({ data: decoded.data }).name;
        }
        return { nonce: parseInt(op.nonce), label, maxFeePerGas: BigInt(op.maxFeePerGas) };
    } catch {
        return { nonce: parseInt(op.nonce), label: null, maxFeePerGas: BigInt(op.maxFeePerGas) };
    }
}

module.exports = { sortByFeeDesc, describeOp };
