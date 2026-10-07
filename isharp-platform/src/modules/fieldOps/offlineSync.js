/**
 * iSHARP DBMS 2.0 — Field Operations Offline Synchronization Engine
 * Bridges domain queue logic, persistent IndexedDB store, and Supabase client.
 * Provides transparent offline fallback and reactive sync state dispatching.
 */

import { supabase } from "../../infrastructure/supabase.js";
import { appState } from "../../state/appState.js";
import { Toast } from "../../components/Toast.js";
import { OfflineQueueStore } from "../../infrastructure/offlineQueueStore.js";
import {
    QUEUE_STATUS,
    createQueueItem,
    transitionItemStatus,
    deduplicateQueue,
    isRetryableNetworkError
} from "../../domain/offlineQueue.js";

let isSyncing = false;
let pendingCount = 0;

export class OfflineSync {
    /**
     * Checks if current client environment is online.
     * @returns {boolean}
     */
    static isOnline() {
        return typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
            ? navigator.onLine
            : true;
    }

    /**
     * Reads all pending queue items from persistent storage.
     * @returns {Promise<Array<object>>}
     */
    static async getQueue() {
        return await OfflineQueueStore.getAll();
    }

    /**
     * Returns total pending queue count (synchronous cache or fresh query).
     * @returns {number}
     */
    static getPendingCount() {
        return pendingCount;
    }

    /**
     * Updates and broadcasts pending queue count to appState.
     * @param {number} count 
     */
    static updateStateCount(count) {
        pendingCount = count;
        if (!this.isOnline()) {
            appState.setSyncStatus("offline");
        } else if (count > 0) {
            appState.setSyncStatus("pending");
        } else {
            appState.setSyncStatus("connected");
        }

        // Notify subscribers of pending count update
        appState.notify("queueCountChanged", count);
    }

    /**
     * Enqueues a write request into the persistent offline outbox.
     * @param {string} endpoint 
     * @param {object} [options={}] 
     * @param {object} [metadata={}] 
     * @returns {Promise<object>} Enqueued item
     */
    static async queueRequest(endpoint, options = {}, metadata = {}) {
        const method = options.method || "POST";
        let payload = {};
        try {
            payload = options.body ? JSON.parse(options.body) : {};
        } catch {
            payload = options.body || {};
        }

        const newItem = createQueueItem(endpoint, method, payload, metadata);

        // Fetch existing queue, append and deduplicate
        const currentQueue = await OfflineQueueStore.getAll();
        currentQueue.push(newItem);
        const deduplicated = deduplicateQueue(currentQueue);

        // Save back into IndexedDB
        await OfflineQueueStore.clear();
        for (const item of deduplicated) {
            await OfflineQueueStore.put(item);
        }

        this.updateStateCount(deduplicated.length);
        console.log(`[OfflineSync] Enqueued offline item ${newItem.id}. Total queue: ${deduplicated.length}`);
        return newItem;
    }

    /**
     * Synchronizes all pending queue records with Supabase Cloud.
     * @returns {Promise<{ synced: number, failed: number, remaining: number }>}
     */
    static async syncQueue() {
        if (isSyncing) {
            console.log("[OfflineSync] Sync already in progress, skipping duplicate call.");
            return { synced: 0, failed: 0, remaining: pendingCount };
        }

        if (!this.isOnline()) {
            console.log("[OfflineSync] Network offline; deferring sync.");
            return { synced: 0, failed: 0, remaining: pendingCount };
        }

        const queue = await OfflineQueueStore.getAll();
        if (queue.length === 0) {
            this.updateStateCount(0);
            return { synced: 0, failed: 0, remaining: 0 };
        }

        isSyncing = true;
        appState.setSyncStatus("syncing");
        console.log(`[OfflineSync] Starting sync flush of ${queue.length} pending records...`);

        let syncedCount = 0;
        let failedCount = 0;

        for (const rawItem of queue) {
            const item = transitionItemStatus(rawItem, QUEUE_STATUS.IN_FLIGHT);
            await OfflineQueueStore.put(item);

            try {
                const requestOptions = {
                    method: item.method,
                    headers: {
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    }
                };

                if (item.method !== "GET" && item.method !== "HEAD" && item.payload) {
                    requestOptions.body = JSON.stringify(item.payload);
                }

                await supabase.request(item.endpoint, requestOptions);

                // Success! Remove from outbox
                await OfflineQueueStore.remove(item.id);
                syncedCount++;
                console.log(`[OfflineSync] Successfully synced record: ${item.id} (${item.metadata.description})`);
            } catch (err) {
                console.error(`[OfflineSync] Sync attempt failed for ${item.id}:`, err);

                if (isRetryableNetworkError(err)) {
                    // Keep in queue for next reconnection
                    const pendingItem = transitionItemStatus(item, QUEUE_STATUS.PENDING, err.message);
                    await OfflineQueueStore.put(pendingItem);
                    failedCount++;
                } else {
                    // Fatal schema / validation error: mark failed so it doesn't block outbox indefinitely
                    const failedItem = transitionItemStatus(item, QUEUE_STATUS.FAILED, err.message);
                    await OfflineQueueStore.put(failedItem);
                    failedCount++;
                }
            }
        }

        isSyncing = false;
        const remaining = await OfflineQueueStore.getAll();
        const pendingRemaining = remaining.filter(i => i.status === QUEUE_STATUS.PENDING).length;
        this.updateStateCount(pendingRemaining);

        if (syncedCount > 0) {
            Toast.success(`🔄 Synced ${syncedCount} offline record${syncedCount > 1 ? "s" : ""} to Cloud!`);
        }

        return {
            synced: syncedCount,
            failed: failedCount,
            remaining: pendingRemaining
        };
    }

    /**
     * Executes an operation with offline fallback: if network is down or fetch throws a network error,
     * queues the request locally and notifies the user gracefully.
     * @param {Function} apiCallFn Async function making the remote Supabase call
     * @param {object} queueParams { endpoint, options, metadata }
     * @returns {Promise<{ isOffline: boolean, result?: any }>}
     */
    static async withOfflineFallback(apiCallFn, queueParams) {
        if (!this.isOnline()) {
            await this.queueRequest(queueParams.endpoint, queueParams.options, queueParams.metadata);
            Toast.info("📡 Offline: Entry saved locally. Will sync automatically when connected.");
            return { isOffline: true, result: null };
        }

        try {
            const result = await apiCallFn();
            return { isOffline: false, result };
        } catch (err) {
            if (isRetryableNetworkError(err)) {
                console.warn("[OfflineSync] Network error during write, falling back to local queue:", err);
                await this.queueRequest(queueParams.endpoint, queueParams.options, queueParams.metadata);
                Toast.info("📡 Connection lost: Entry saved locally. Will sync automatically once online.");
                return { isOffline: true, result: null };
            }
            throw err;
        }
    }

    /**
     * Initializes global network state listeners.
     */
    static init() {
        if (typeof window === "undefined") return;

        window.addEventListener("online", () => {
            console.log("[OfflineSync] Connection restored (online).");
            OfflineSync.updateStateCount(pendingCount);
            Toast.info("🌐 Network restored. Syncing offline records...");
            OfflineSync.syncQueue();
        });

        window.addEventListener("offline", () => {
            console.log("[OfflineSync] Connection lost (offline).");
            OfflineSync.updateStateCount(pendingCount);
            Toast.warning("📡 Offline mode active. Entries will be saved locally.");
        });

        // Initialize queue count on startup
        OfflineQueueStore.getAll().then((items) => {
            const pending = items.filter(i => i.status === QUEUE_STATUS.PENDING).length;
            OfflineSync.updateStateCount(pending);
            if (OfflineSync.isOnline() && pending > 0) {
                setTimeout(() => OfflineSync.syncQueue(), 1500);
            }
        });
    }
}

// Auto-initialize when imported
if (typeof window !== "undefined") {
    OfflineSync.init();
}
