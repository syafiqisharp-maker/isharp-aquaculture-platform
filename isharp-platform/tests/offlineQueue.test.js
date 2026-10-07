import test from "node:test";
import assert from "node:assert/strict";
import {
    QUEUE_STATUS,
    createQueueItem,
    transitionItemStatus,
    deduplicateQueue,
    isRetryableNetworkError
} from "../src/domain/offlineQueue.js";

test("offlineQueue: createQueueItem initializes valid normalized item", () => {
    const item = createQueueItem("growout_pond_master?pond_index=eq.2091701", "PATCH", { aerator_1hp: 4 }, { pondIndex: "2091701", action: "update_aerators" });

    assert.ok(item.id.startsWith("item_"));
    assert.equal(item.endpoint, "growout_pond_master?pond_index=eq.2091701");
    assert.equal(item.method, "PATCH");
    assert.deepEqual(item.payload, { aerator_1hp: 4 });
    assert.equal(item.metadata.pondIndex, "2091701");
    assert.equal(item.status, QUEUE_STATUS.PENDING);
    assert.equal(item.attempts, 0);
    assert.ok(item.createdAt);
    assert.equal(item.error, null);
});

test("offlineQueue: transitionItemStatus transitions safely and increments attempts on in_flight", () => {
    const initial = createQueueItem("daily_pond_records", "POST", { mortality_kg: 2.5 });
    assert.equal(initial.status, QUEUE_STATUS.PENDING);
    assert.equal(initial.attempts, 0);

    const inFlight = transitionItemStatus(initial, QUEUE_STATUS.IN_FLIGHT);
    assert.equal(inFlight.status, QUEUE_STATUS.IN_FLIGHT);
    assert.equal(inFlight.attempts, 1);

    const synced = transitionItemStatus(inFlight, QUEUE_STATUS.SYNCED);
    assert.equal(synced.status, QUEUE_STATUS.SYNCED);
    assert.equal(synced.attempts, 1);
    assert.equal(synced.error, null);

    const failed = transitionItemStatus(inFlight, QUEUE_STATUS.FAILED, "Network timeout 504");
    assert.equal(failed.status, QUEUE_STATUS.FAILED);
    assert.equal(failed.error, "Network timeout 504");
});

test("offlineQueue: transitionItemStatus rejects invalid status", () => {
    const item = createQueueItem("test", "GET");
    assert.throws(() => {
        transitionItemStatus(item, "invalid_status");
    }, /Invalid status/);
});

test("offlineQueue: deduplicateQueue keeps the latest pending update for the same resource", () => {
    const item1 = createQueueItem("growout_pond_master", "PATCH", { aerator_1hp: 2 }, { pondIndex: "2091701" });
    const item2 = createQueueItem("growout_pond_master", "PATCH", { aerator_1hp: 6 }, { pondIndex: "2091701" });
    const itemOtherPond = createQueueItem("growout_pond_master", "PATCH", { aerator_1hp: 4 }, { pondIndex: "2091702" });

    const deduped = deduplicateQueue([item1, item2, itemOtherPond]);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].payload.aerator_1hp, 6);
    assert.equal(deduped[1].metadata.pondIndex, "2091702");
});

test("offlineQueue: isRetryableNetworkError correctly identifies transient vs permanent errors", () => {
    assert.equal(isRetryableNetworkError(new Error("Failed to fetch")), true);
    assert.equal(isRetryableNetworkError({ name: "AbortError", message: "aborted" }), true);
    assert.equal(isRetryableNetworkError(new Error("Network connection dropped")), true);
    assert.equal(isRetryableNetworkError(new Error("HTTP 504 Gateway Timeout")), true);

    // Fatal schema or auth errors should not keep looping
    assert.equal(isRetryableNetworkError(new Error("Supabase Error (400 Bad Request): Column does not exist")), false);
    assert.equal(isRetryableNetworkError(new Error("Supabase Error (401 Unauthorized)")), false);
});
