const test = require("node:test");
const assert = require("node:assert/strict");

const { TpsTracker } = require("../lib/tpsTracker");

test("tick() returns null before the interval has elapsed", () => {
    let now = 1_000_000;
    const tracker = new TpsTracker({ intervalMs: 60_000, now: () => now });

    tracker.recordProcessed(5);
    now += 30_000;

    assert.equal(tracker.tick(), null);
});

test("tick() computes TPS and resets the window once the interval elapses", () => {
    let now = 1_000_000;
    const tracker = new TpsTracker({ intervalMs: 60_000, now: () => now });

    tracker.recordProcessed(30);
    now += 60_000;

    const entry = tracker.tick();

    assert.ok(entry);
    assert.equal(entry.interval, 1);
    assert.equal(entry.userOpsProcessed, 30);
    assert.equal(entry.tps, 0.5); // 30 ops / 60s
    assert.equal(entry.totalUserOpsProcessed, 30);
    assert.equal(tracker.recentProcessed, 0);
    assert.equal(tracker.logs.length, 1);
});

test("consecutive intervals accumulate totalUserOpsProcessed and increment interval index", () => {
    let now = 0;
    const tracker = new TpsTracker({ intervalMs: 1000, now: () => now });

    tracker.recordProcessed(10);
    now += 1000;
    const first = tracker.tick();

    tracker.recordProcessed(5);
    now += 1000;
    const second = tracker.tick();

    assert.equal(first.interval, 1);
    assert.equal(second.interval, 2);
    assert.equal(second.userOpsProcessed, 5);
    assert.equal(second.totalUserOpsProcessed, 15);
    assert.equal(tracker.logs.length, 2);
});

test("recordProcessed accumulates across multiple calls within the same window", () => {
    let now = 0;
    const tracker = new TpsTracker({ intervalMs: 1000, now: () => now });

    tracker.recordProcessed(3);
    tracker.recordProcessed(4);
    now += 1000;

    const entry = tracker.tick();
    assert.equal(entry.userOpsProcessed, 7);
});
