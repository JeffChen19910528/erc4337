const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { loadDeployInfo } = require("../lib/deployInfo");

function writeTempJson(content) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-info-test-"));
    const filePath = path.join(dir, "deploy.json");
    fs.writeFileSync(filePath, JSON.stringify(content));
    return filePath;
}

test("loadDeployInfo parses a valid deploy.json", () => {
    const filePath = writeTempJson({ entryPoint: "0xEP", counter: "0xC0", wallets: [] });

    const info = loadDeployInfo(filePath);

    assert.equal(info.entryPoint, "0xEP");
    assert.equal(info.counter, "0xC0");
});

test("loadDeployInfo throws when entryPoint is missing", () => {
    const filePath = writeTempJson({ counter: "0xC0" });

    assert.throws(() => loadDeployInfo(filePath), /缺少必要欄位/);
});

test("loadDeployInfo throws when counter is missing", () => {
    const filePath = writeTempJson({ entryPoint: "0xEP" });

    assert.throws(() => loadDeployInfo(filePath), /缺少必要欄位/);
});

test("loadDeployInfo propagates fs errors for a missing file", () => {
    assert.throws(() => loadDeployInfo("./this-file-does-not-exist.json"));
});
