const axios = require("axios");

/**
 * 以 JSON-RPC 格式呼叫 bundler 的 eth_sendUserOperation。
 */
function sendUserOperation(userOp, entryPointAddress, bundlerUrl, id = 1) {
    return axios.post(bundlerUrl, {
        jsonrpc: "2.0",
        id,
        method: "eth_sendUserOperation",
        params: [userOp, entryPointAddress],
    });
}

module.exports = { sendUserOperation };
