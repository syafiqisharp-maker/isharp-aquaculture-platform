/**
 * iSHARP DBMS 2.0 — Field Operations Offline Synchronization Engine
 * Local persistence and background queue engine for field data entries
 * when connectivity drops at remote pond locations.
 */

import { supabase } from "../../infrastructure/supabase.js";
import { appState } from "../../state/appState.js";
import { Toast } from "../../components/Toast.js";

const QUEUE_STORAGE_KEY = "isharp_fieldops_offline_queue";
let isSyncing = false;

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
     * @returns {Array<object>}
     */
    static getQueue() {
        try {
            const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            console.warn("Could not read offline queue from localStorage:", err);
            return [];
        }
    }

    /**
     * Saves queue items to persistent storage.
     * @param {Array<object>} queue 
     */
    static saveQueue(queue) {
        try {
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
            const count = queue.length;
            if (count > 0 && !this.isOnline()) {
                appState.setSyncStatus("offline");
            } else if (count === 0 && this.isOnline()) {
                appState.setSyncStatus("connected");
            }
        } catch (err) {
            console.error("Could not write offline queue to localStorage:", err);
        }
    }

    /**
     * Returns total pending queue count.
     * @returns {number}
     */
    static getPendingCount() {
        return this.getQueue().length;
    }

    /**
     * Queues an HTTP REST request for deferred synchronization.
     * @param {string} endpoint e.g. "daily_pond_records?on_conflict=pond_index,log_date"
     * @param {object} options fetch options ({ method, headers, body })
     * @param {object} [metadata] description, pondIndex, label, etc.
     * @returns {object} The queued item
     */
    static queueRequest(endpoint, options = {}, metadata = {}) {
        const queue = this.getQueue();
        const item = {
            id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
            endpoint,
            method: options.method || "POST",
            headers: options.headers || {},
            body: typeof options.body === "string" ? options.body : JSON.stringify(options.body || {}),
            metadata: {
                timestamp: new Date().toISOString(),
                ...metadata
            },
            status: "pending",
            retryCount: 0
        };

        queue.push(item);
        this.saveQueue(queue);

        console.info(`[OfflineSync] Queued request ${item.id} for endpoint: ${endpoint}`);
        return item;
    }

    /**
     * Synchronizes all pending requests sequentially against Supabase.
     * @returns {Promise<{ synced: number, failed: number, remaining: number }>}
     */
    static async syncQueue() {
        if (isSyncing) {
            console.log("[OfflineSync] Sync already in progress, skipping duplicate call.");
            return { synced: 0, failed: 0, remaining: this.getPendingCount() };
        }

        if (!this.isOnline()) {
            console.log("[OfflineSync] Network offline; deferring sync.");
            appState.setSyncStatus("offline");
            return { synced: 0, failed: 0, remaining: this.getPendingCount() };
        }

        const queue = this.getQueue();
        if (queue.length === 0) {
            appState.setSyncStatus("connected");
            return { synced: 0, failed: 0, remaining: 0 };
        }

        isSyncing = true;
        appState.setSyncStatus("syncing");

        let syncedCount = 0;
        let failedCount = 0;
        const remainingQueue = [];

        console.info(`[OfflineSync] Beginning sync for ${queue.length} pending operations...`);

        for (const item of queue) {
            try {
                const options = {
                    method: item.method,
                    headers: item.headers || {},
                    body: item.body
                };

                await supabase.request(item.endpoint, options);
                syncedCount++;
                console.info(`[OfflineSync] Successfully synced ${item.id} (${item.endpoint})`);
            } catch (err) {
                console.error(`[OfflineSync] Failed to sync ${item.id}:`, err);
                item.retryCount = (item.retryCount || 0) + 1;
                item.lastError = err.message || String(err);

                // Check if error is network related vs permanent schema failure
                const isNetworkErr = err.name === "AbortError" || 
                                     /failed to fetch|network|timeout/i.test(err.message || "");

                if (isNetworkErr || item.retryCount < 5) {
                    remainingQueue.push(item);
                } else {
                    console.error(`[OfflineSync] Dropping permanently failing item ${item.id} after 5 retries`);
                    failedCount++;
                }
            }
        }

        this.saveQueue(remainingQueue);
        isSyncing = false;

        if (remainingQueue.length === 0) {
            appState.setSyncStatus("connected");
            if (syncedCount > 0) {
                Toast.success(`✅ Synced ${syncedCount} offline record(s) to database!`);
            }
        } else {
            appState.setSyncStatus("offline");
            if (syncedCount > 0) {
                Toast.info(`Synced ${syncedCount} record(s); ${remainingQueue.length} pending connection.`);
            }
        }

        return {
            synced: syncedCount,
            failed: failedCount,
            remaining: remainingQueue.length
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
            this.queueRequest(queueParams.endpoint, queueParams.options, queueParams.metadata);
            Toast.info("📡 Offline: Entry saved locally. Will sync automatically when connected.");
            return { isOffline: true, result: null };
        }

        try {
            const result = await apiCallFn();
            return { isOffline: false, result };
        } catch (err) {
            const isNetworkErr = err.name === "AbortError" || 
                                 /failed to fetch|network|timeout|connection/i.test(err.message || "");
            if (isNetworkErr) {
                console.warn("[OfflineSync] Network error during write, falling back to local queue:", err);
                this.queueRequest(queueParams.endpoint, queueParams.options, queueParams.metadata);
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
            appState.setSyncStatus("syncing");
            Toast.info("🌐 Network restored. Syncing offline records...");
            OfflineSync.syncQueue();
        });

        window.addEventListener("offline", () => {
            console.log("[OfflineSync] Connection lost (offline).");
            appState.setSyncStatus("offline");
            Toast.warning("📡 Offline mode active. Entries will be saved locally.");
        });

        // Initial check on load
        if (!this.isOnline()) {
            appState.setSyncStatus("offline");
        } else if (this.getPendingCount() > 0) {
            // Auto sync on load if queue has pending items
            setTimeout(() => OfflineSync.syncQueue(), 2000);
        }
    }
}

// Auto-initialize when imported
if (typeof window !== "undefined") {
    OfflineSync.init();
}
