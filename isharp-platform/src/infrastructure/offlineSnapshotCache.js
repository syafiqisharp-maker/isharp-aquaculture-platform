/**
 * iSHARP DBMS 2.0 — Offline Snapshot Read-Through Cache (Pillar 5 Continuity)
 * Provides automatic client-side read-through caching in IndexedDB (with in-memory
 * and localStorage fallbacks) so that when Supabase Cloud is offline or unreachable,
 * the platform seamlessly serves the Last-Known-Good (LKG) operational dataset
 * or a locally imported Google Drive backup snapshot (latest_farm_snapshot.json).
 *
 * Inward Dependency: Infrastructure Layer.
 */

const CACHE_DB_NAME = "isharp_read_cache_db";
const CACHE_DB_VERSION = 1;
const ENDPOINT_STORE = "endpoint_snapshots";
const TABLE_STORE = "table_snapshots";
const META_STORAGE_KEY = "isharp_offline_snapshot_meta";

export class OfflineSnapshotCache {
    static _memoryEndpoints = new Map();
    static _memoryTables = new Map();
    static _lastUpdatedIso = null;

    /**
     * Opens IndexedDB for read-through snapshot storage (returns null in Node/SSR).
     * @returns {Promise<IDBDatabase|null>}
     */
    static async getDb() {
        if (typeof window === "undefined" || !window.indexedDB) {
            return null;
        }

        return new Promise((resolve) => {
            try {
                const req = window.indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(ENDPOINT_STORE)) {
                        db.createObjectStore(ENDPOINT_STORE, { keyPath: "endpoint" });
                    }
                    if (!db.objectStoreNames.contains(TABLE_STORE)) {
                        db.createObjectStore(TABLE_STORE, { keyPath: "tableName" });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    /**
     * Normalizes a PostgREST endpoint string for deterministic cache keys.
     * @param {string} endpoint
     * @returns {string}
     */
    static normalizeEndpoint(endpoint) {
        return String(endpoint || "").trim();
    }

    /**
     * Extracts the base table/view name from a PostgREST endpoint.
     * @param {string} endpoint e.g. "view_growout_pond_cycles?select=*&limit=1000"
     * @returns {string}
     */
    static extractTableName(endpoint) {
        const clean = String(endpoint || "").trim();
        const qIdx = clean.indexOf("?");
        return qIdx >= 0 ? clean.slice(0, qIdx) : clean;
    }

    /**
     * Stores a successful GET response in the read-through cache.
     * @param {string} endpoint
     * @param {any} data
     * @returns {Promise<void>}
     */
    static async putEndpointResponse(endpoint, data) {
        if (!endpoint || data === undefined || data === null) return;
        const key = this.normalizeEndpoint(endpoint);
        const updatedAt = new Date().toISOString();
        const entry = { endpoint: key, data, updatedAt };

        this._memoryEndpoints.set(key, entry);
        this._lastUpdatedIso = updatedAt;
        this._saveMeta({ lastUpdatedIso: updatedAt });

        const db = await this.getDb();
        if (!db) return;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(ENDPOINT_STORE, "readwrite");
                tx.objectStore(ENDPOINT_STORE).put(entry);
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            } catch {
                resolve();
            }
        });
    }

    /**
     * Retrieves a cached GET response for an endpoint, falling back to an imported
     * full-table Google Drive snapshot if an exact endpoint match is not found.
     * @param {string} endpoint
     * @returns {Promise<{ data: any, updatedAt: string, source: string }|null>}
     */
    static async getEndpointResponse(endpoint) {
        const key = this.normalizeEndpoint(endpoint);
        if (!key) return null;

        // 1. Check in-memory cache first
        if (this._memoryEndpoints.has(key)) {
            const hit = this._memoryEndpoints.get(key);
            return { data: hit.data, updatedAt: hit.updatedAt, source: "memory-endpoint" };
        }

        // 2. Check IndexedDB endpoint cache
        const db = await this.getDb();
        if (db) {
            const idbHit = await new Promise((resolve) => {
                try {
                    const tx = db.transaction(ENDPOINT_STORE, "readonly");
                    const req = tx.objectStore(ENDPOINT_STORE).get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                } catch {
                    resolve(null);
                }
            });
            if (idbHit && idbHit.data !== undefined) {
                this._memoryEndpoints.set(key, idbHit);
                return { data: idbHit.data, updatedAt: idbHit.updatedAt, source: "indexeddb-endpoint" };
            }
        }

        // 3. Fallback to imported Google Drive table snapshot (if loaded)
        const tableName = this.extractTableName(key);
        const tableHit = await this.getTableSnapshot(tableName);
        if (tableHit && Array.isArray(tableHit.rows)) {
            const filtered = this._applyBasicPostgrestFilter(tableHit.rows, key);
            return { data: filtered, updatedAt: tableHit.updatedAt, source: "table-snapshot" };
        }

        return null;
    }

    /**
     * Retrieves a full table snapshot imported from latest_farm_snapshot.json.
     * @param {string} tableName
     * @returns {Promise<{ tableName: string, rows: Array<object>, updatedAt: string }|null>}
     */
    static async getTableSnapshot(tableName) {
        if (!tableName) return null;
        if (this._memoryTables.has(tableName)) {
            return this._memoryTables.get(tableName);
        }

        const db = await this.getDb();
        if (!db) return null;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(TABLE_STORE, "readonly");
                const req = tx.objectStore(TABLE_STORE).get(tableName);
                req.onsuccess = () => {
                    if (req.result) {
                        this._memoryTables.set(tableName, req.result);
                    }
                    resolve(req.result || null);
                };
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    /**
     * Imports a Google Drive backup bundle (latest_farm_snapshot.json) into the browser cache.
     * @param {object} bundle Parsed JSON from latest_farm_snapshot.json
     * @returns {Promise<{ tablesImported: number, totalRows: number, generatedAt: string }>}
     */
    static async importSnapshotBundle(bundle) {
        if (!bundle || typeof bundle !== "object" || !bundle.tables) {
            throw new Error("Invalid snapshot bundle format: missing 'tables' dictionary.");
        }

        const generatedAt = bundle.generated_at || new Date().toISOString();
        const tableEntries = Object.entries(bundle.tables);
        let tablesImported = 0;
        let totalRows = 0;

        const db = await this.getDb();

        for (const [tableName, rows] of tableEntries) {
            if (!Array.isArray(rows)) continue;
            const entry = { tableName, rows, updatedAt: generatedAt };
            this._memoryTables.set(tableName, entry);
            tablesImported++;
            totalRows += rows.length;

            if (db) {
                await new Promise((resolve) => {
                    try {
                        const tx = db.transaction(TABLE_STORE, "readwrite");
                        tx.objectStore(TABLE_STORE).put(entry);
                        tx.oncomplete = () => resolve();
                        tx.onerror = () => resolve();
                    } catch {
                        resolve();
                    }
                });
            }
        }

        this._lastUpdatedIso = generatedAt;
        this._saveMeta({ lastUpdatedIso: generatedAt, tablesImported, totalRows });

        return { tablesImported, totalRows, generatedAt };
    }

    /**
     * Clears all in-memory and IndexedDB cached snapshots.
     */
    static async clear() {
        this._memoryEndpoints.clear();
        this._memoryTables.clear();
        this._lastUpdatedIso = null;

        const db = await this.getDb();
        if (!db) return;

        await new Promise((resolve) => {
            try {
                const tx = db.transaction([ENDPOINT_STORE, TABLE_STORE], "readwrite");
                tx.objectStore(ENDPOINT_STORE).clear();
                tx.objectStore(TABLE_STORE).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            } catch {
                resolve();
            }
        });
    }

    /**
     * Applies lightweight PostgREST equality (`col=eq.val`) and limit filters when
     * serving from a full-table backup snapshot.
     * @param {Array<object>} rows
     * @param {string} endpoint
     * @returns {Array<object>}
     */
    static _applyBasicPostgrestFilter(rows, endpoint) {
        if (!Array.isArray(rows)) return [];
        const qIdx = endpoint.indexOf("?");
        if (qIdx < 0) return rows;

        const queryStr = endpoint.slice(qIdx + 1);
        const params = new URLSearchParams(queryStr);
        let result = rows;

        for (const [k, v] of params.entries()) {
            if (k === "select" || k === "order" || k === "limit" || k === "offset" || k === "or") {
                continue;
            }
            if (v.startsWith("eq.")) {
                const targetVal = decodeURIComponent(v.slice(3));
                result = result.filter((r) => String(r?.[k] ?? "") === targetVal);
            } else if (v.startsWith("neq.")) {
                const targetVal = decodeURIComponent(v.slice(4));
                result = result.filter((r) => String(r?.[k] ?? "") !== targetVal);
            }
        }

        const limitParam = params.get("limit");
        if (limitParam) {
            const lim = parseInt(limitParam, 10);
            if (!Number.isNaN(lim) && lim > 0) {
                result = result.slice(0, lim);
            }
        }

        return result;
    }

    static getLastUpdatedIso() {
        if (this._lastUpdatedIso) return this._lastUpdatedIso;
        try {
            if (typeof localStorage !== "undefined") {
                const raw = localStorage.getItem(META_STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    return parsed.lastUpdatedIso || null;
                }
            }
        } catch {
            // Ignore storage errors
        }
        return null;
    }

    static _saveMeta(meta) {
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
            }
        } catch {
            // Ignore storage errors
        }
    }
}
