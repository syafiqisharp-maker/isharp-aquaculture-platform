import test from "node:test";
import assert from "node:assert/strict";
import { PwaUpdateManager } from "../src/infrastructure/pwaUpdateManager.js";

test("PwaUpdateManager: safely handles non-browser environment without throws", () => {
    const manager = new PwaUpdateManager();
    // In Node.js environment where navigator.serviceWorker does not exist
    assert.doesNotThrow(() => {
        manager.init();
    });
    assert.equal(manager.registration, null);
    assert.equal(manager.isReloading, false);
});

test("PwaUpdateManager: safeReload throttles rapid reload cycles", () => {
    const manager = new PwaUpdateManager();
    let reloadedCount = 0;

    // Mock window.sessionStorage
    const storageMap = new Map();
    global.sessionStorage = {
        getItem: (k) => storageMap.get(k) || null,
        setItem: (k, v) => storageMap.set(k, String(v))
    };

    // First reload attempt
    manager.safeReload("test_initial");
    assert.equal(manager.isReloading, true);
    assert.ok(storageMap.has("isharp_pwa_last_reload"));

    // Reset flag to simulate another fast trigger within throttle window
    manager.isReloading = false;
    manager.safeReload("test_rapid_loop");
    // isReloading should not be set because throttle guard suppressed it
    assert.equal(manager.isReloading, false);

    delete global.sessionStorage;
});

test("PwaUpdateManager: checkForUpdates safely calls registration.update() when present", async () => {
    const manager = new PwaUpdateManager();
    let updateCalled = false;

    manager.registration = {
        update: async () => {
            updateCalled = true;
        }
    };

    manager.checkForUpdates();
    assert.equal(updateCalled, true);
});
