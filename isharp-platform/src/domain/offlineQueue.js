/**
 * iSHARP DBMS 2.0 — Offline Queue Domain Logic
 * Pure functions for queue item construction, status transitions,
 * payload deduplication, and retry evaluation.
 * 
 * ZERO DOM imports. ZERO fetch calls. 100% pure testable domain logic.
 */

export const QUEUE_STATUS = Object.freeze({
    PENDING: "pending",
    IN_FLIGHT: "in_flight",
    SYNCED: "synced",
    FAILED: "failed"
});

/**
 * Creates a normalized offline queue item.
 * @param {string} endpoint REST endpoint e.g. "growout_pond_master"
 * @param {string} method HTTP method e.g. "PATCH", "POST"
 * @param {object} payload Request body data
 * @param {object} [metadata={}] Optional context (pondIndex, action, description)
 * @returns {object} Queue item
 */
export function createQueueItem(endpoint, method = "POST", payload = {}, metadata = {}) {
    if (!endpoint || typeof endpoint !== "string") {
        throw new Error("createQueueItem requires a valid endpoint string.");
    }

    const now = new Date();
    const id = `item_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
        id,
        endpoint,
        method: method.toUpperCase(),
        payload: payload ? JSON.parse(JSON.stringify(payload)) : {},
        metadata: {
            pondIndex: metadata.pondIndex || null,
            action: metadata.action || "update",
            description: metadata.description || "Field operation entry",
            ...metadata
        },
        status: QUEUE_STATUS.PENDING,
        attempts: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        error: null
    };
}

/**
 * Transitions queue item status with validation.
 * @param {object} item Queue item
 * @param {string} nextStatus New status from QUEUE_STATUS
 * @param {string|null} [error=null] Optional error message
 * @returns {object} New mutated item copy
 */
export function transitionItemStatus(item, nextStatus, error = null) {
    if (!item || !item.id) {
        throw new Error("Invalid queue item provided to transitionItemStatus.");
    }

    const validStatuses = Object.values(QUEUE_STATUS);
    if (!validStatuses.includes(nextStatus)) {
        throw new Error(`Invalid status: ${nextStatus}. Must be one of ${validStatuses.join(", ")}`);
    }

    return {
        ...item,
        status: nextStatus,
        attempts: nextStatus === QUEUE_STATUS.IN_FLIGHT ? (item.attempts || 0) + 1 : item.attempts || 0,
        updatedAt: new Date().toISOString(),
        error: error ? String(error) : null
    };
}

/**
 * Deduplicates queue items by replacing earlier pending updates for the same pond and endpoint
 * with the latest one if they target the same unique resource.
 * @param {Array<object>} queue Array of queue items
 * @returns {Array<object>} Deduplicated queue
 */
export function deduplicateQueue(queue) {
    if (!Array.isArray(queue)) return [];

    const result = [];
    const seenMap = new Map();

    // Iterate backwards so the latest submission takes precedence
    for (let i = queue.length - 1; i >= 0; i--) {
        const item = queue[i];
        if (!item || !item.id) continue;

        // If not pending, keep as is
        if (item.status !== QUEUE_STATUS.PENDING) {
            result.unshift(item);
            continue;
        }

        const pondKey = item.metadata?.pondIndex || "general";
        const dedupKey = `${item.endpoint}_${item.method}_${pondKey}`;

        if (!seenMap.has(dedupKey)) {
            seenMap.set(dedupKey, true);
            result.unshift(item);
        }
    }

    return result;
}

/**
 * Evaluates whether an error indicates a transient network failure suitable for retry.
 * @param {any} error Error object or string
 * @returns {boolean} True if transient network error, false if fatal 4xx schema rejection
 */
export function isRetryableNetworkError(error) {
    if (!error) return false;
    const msg = (error.message || String(error)).toLowerCase();

    // Explicit network, timeout, or aborted fetch errors
    if (error.name === "AbortError") return true;
    if (msg.includes("failed to fetch")) return true;
    if (msg.includes("network")) return true;
    if (msg.includes("timeout")) return true;
    if (msg.includes("connection")) return true;
    if (msg.includes("offline")) return true;
    if (msg.includes("502") || msg.includes("503") || msg.includes("504")) return true;

    // Supabase 400, 401, 403, 404, 409 are client or schema errors (non-retryable without payload change)
    if (msg.includes("400") || msg.includes("401") || msg.includes("403") || msg.includes("404")) {
        return false;
    }

    return true;
}
