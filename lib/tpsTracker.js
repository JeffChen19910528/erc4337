/**
 * 追蹤固定時間窗內處理的 UserOperation 數量並計算 TPS。
 * `now` 可注入以利測試（避免依賴真實時間）。
 */
class TpsTracker {
    constructor({ intervalMs = 2 * 60 * 1000, now = Date.now } = {}) {
        this.intervalMs = intervalMs;
        this.now = now;
        this.intervalStartTime = now();
        this.intervalIndex = 1;
        this.totalUserOpsProcessed = 0;
        this.recentProcessed = 0;
        this.logs = [];
    }

    recordProcessed(count) {
        this.recentProcessed += count;
    }

    /**
     * 若時間窗已滿，回傳這次的統計結果並重置窗口；否則回傳 null。
     */
    tick() {
        const now = this.now();
        const elapsed = now - this.intervalStartTime;
        if (elapsed < this.intervalMs) return null;

        const secondsElapsed = elapsed / 1000;
        const tps = this.recentProcessed / secondsElapsed;
        this.totalUserOpsProcessed += this.recentProcessed;

        const entry = {
            interval: this.intervalIndex,
            timestamp: new Date(now).toISOString(),
            userOpsProcessed: this.recentProcessed,
            tps: Number(tps.toFixed(2)),
            totalUserOpsProcessed: this.totalUserOpsProcessed,
        };

        this.logs.push(entry);
        this.intervalIndex++;
        this.intervalStartTime = now;
        this.recentProcessed = 0;

        return entry;
    }
}

module.exports = { TpsTracker };
