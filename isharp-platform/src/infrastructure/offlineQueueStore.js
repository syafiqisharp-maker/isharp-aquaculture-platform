/**
 * iSHARP DBMS 2.0 — Offline Queue Storage Adapter
 * Encapsulates client-side persistence for queued field operations using
 * browser IndexedDB with a transparent fallback to localStorage.
 * 
 * Inward Dependency: Infrastructure Layer.
 */

const DB_NAME = "isharp_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "fieldops_queue";
const FALLBACK_KEY = "isharp_fieldops_offline_queue";

export class OfflineQueueStore {
    /**
     * Opens or initialises IndexedDB database
     * @returns {Promise<IDBDatabase|null>}
     */
    static async getDb() {
        if (typeof window === "undefined" || !window.indexedDB) {
            return null;
        }

        return new Promise((resolve) => {
            try {
                const request = window.indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: "id" });
                    }
                };

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    console.warn("[OfflineQueueStore] IndexedDB open error, using localStorage fallback.");
                    resolve(null);
                };
            } catch (err) {
                console.warn("[OfflineQueueStore] IndexedDB unsupported or blocked:", err);
                resolve(null);
            }
        });
    }

    /**
     * Retrieves all queued records.
     * @returns {Promise<Array<object>>}
     */
    static async getAll() {
        const db = await this.getDb();
        if (!db) {
            return this.getFallback();
        }

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, "readonly");
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();

                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => {
                    console.warn("[OfflineQueueStore] IndexedDB getAll failed, using fallback.");
                    resolve(this.getFallback());
                };
            } catch {
                resolve(this.getFallback());
            }
        });
    }

    /**
     * Stores or updates a queue item.
     * @param {object} item Queue item with unique id
     * @returns {Promise<void>}
     */
    static async put(item) {
        if (!item || !item.id) return;

        const db = await this.getDb();
        if (!db) {
            const list = this.getFallback();
            const idx = list.findIndex(i => i.id === item.id);
            if (idx >= 0) list[idx] = item;
            else list.push(item);
            this.saveFallback(list);
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(item);

                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            } catch (err) {
                // Fallback on transaction failure
                const list = this.getFallback();
                list.push(item);
                this.saveFallback(list);
                resolve();
            }
        });
    }

    /**
     * Removes an item by id.
     * @param {string} id 
     * @returns {Promise<void>}
     */
    static async remove(id) {
        if (!id) return;

        const db = await this.getDb();
        if (!db) {
            const list = this.getFallback().filter(i => i.id !== id);
            this.saveFallback(list);
            return;
        }

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(id);

                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
            } catch {
                resolve();
            }
        });
    }

    /**
     * Clears all stored queue items.
     * @returns {Promise<void>}
     */
    static async clear() {
        const db = await this.getDb();
        if (!db) {
            this.saveFallback([]);
            return;
        }

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
            } catch {
                resolve();
            }
        });
    }

    /* --- Synchronous LocalStorage Fallbacks --- */

    static getFallback() {
        try {
            const raw = localStorage.getItem(FALLBACK_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    static saveFallback(list) {
        try {
            localStorage.setItem(FALLBACK_KEY, JSON.stringify(list));
        } catch (err) {
            console.error("[OfflineQueueStore] Failed to write fallback localStorage:", err);
        }
    }
}
