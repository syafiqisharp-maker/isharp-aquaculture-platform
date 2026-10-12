/**
 * iSHARP DBMS 2.0 — Security & Access Control Service
 * Manages passwords fetched dynamically from Supabase (with offline local fallback),
 * role verification (DBMS Editor vs Viewer), and Field Ops Module/Manager authentication.
 */

import { supabase } from "../infrastructure/supabase.js";
import { ROLES } from "./permissions.js";

const DBMS_SESSION_KEY = "isharp_dbms_session";
const FIELD_OPS_SESSION_KEY = "isharp_field_ops_module";
const FIELD_OPS_ROLE_KEY = "isharp_field_ops_role";

// Offline default passwords matching database setup
const OFFLINE_PASSWORDS = {
    app: {
        dbms_editor: "mantaray",
        dbms_viewer: "isharp",
        manager_master: "todak"
    },
    modules: {
        1: "siakap",
        2: "kerapu",
        3: "jenahak",
        4: "haruan",
        5: "bawal",
        6: "patin",
        7: "keli",
        8: "tilapia",
        9: "tongsan"
    }
};

class SecurityService {
    constructor() {
        this.cache = {
            appPasswords: { ...OFFLINE_PASSWORDS.app },
            modulePasswords: { ...OFFLINE_PASSWORDS.modules },
            lastFetched: 0
        };
        this._syncPromise = null;
        this._inMemorySessions = {
            dbms: null,
            fieldOpsModule: null,
            fieldOpsRole: null
        };

        // Eager background sync
        this.syncPasswords().catch(() => {});
    }

    /**
     * Fetch active passwords from Supabase (deduplicated in-flight)
     */
    async syncPasswords() {
        if (this._syncPromise) {
            return this._syncPromise;
        }

        this._syncPromise = (async () => {
            try {
                const [appRes, modRes] = await Promise.all([
                    supabase.request("app_passwords?select=key,password"),
                    supabase.request("module_passwords?select=module_no,access_password")
                ]);

                if (Array.isArray(appRes)) {
                    appRes.forEach(item => {
                        if (item.key && item.password) {
                            this.cache.appPasswords[item.key] = item.password.trim();
                        }
                    });
                }

                if (Array.isArray(modRes)) {
                    modRes.forEach(item => {
                        if (item.module_no != null && item.access_password) {
                            this.cache.modulePasswords[Number(item.module_no)] = item.access_password.trim();
                        }
                    });
                }

                this.cache.lastFetched = Date.now();
            } catch (err) {
                console.warn("[Security] Could not sync latest passwords from Supabase, using cached/offline values:", err.message);
            } finally {
                this._syncPromise = null;
            }
        })();

        return this._syncPromise;
    }

    /**
     * Get DBMS Session from sessionStorage or in-memory
     * @returns {"EDITOR"|"VIEWER"|null}
     */
    getDbmsSession() {
        if (typeof sessionStorage !== "undefined") {
            const session = sessionStorage.getItem(DBMS_SESSION_KEY);
            if (session === "EDITOR" || session === "VIEWER") {
                return session;
            }
        }
        return this._inMemorySessions.dbms;
    }

    /**
     * Set DBMS Session
     * @param {"EDITOR"|"VIEWER"} roleType
     */
    setDbmsSession(roleType) {
        if (roleType === "EDITOR" || roleType === "VIEWER") {
            this._inMemorySessions.dbms = roleType;
            if (typeof sessionStorage !== "undefined") {
                sessionStorage.setItem(DBMS_SESSION_KEY, roleType);
            }
        }
    }

    /**
     * Clear DBMS Session (Lock / Logout)
     */
    clearDbmsSession() {
        this._inMemorySessions.dbms = null;
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem(DBMS_SESSION_KEY);
        }
    }

    /**
     * Set Field Ops Session
     * @param {number|string} moduleNo
     * @param {"SUPERVISOR"|"VIEWER"} role
     */
    setFieldOpsSession(moduleNo, role = "SUPERVISOR") {
        this._inMemorySessions.fieldOpsModule = String(moduleNo);
        this._inMemorySessions.fieldOpsRole = role;
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(FIELD_OPS_SESSION_KEY, String(moduleNo));
            sessionStorage.setItem(FIELD_OPS_ROLE_KEY, role);
        }
    }

    /**
     * Get current Field Ops Role
     * @returns {"SUPERVISOR"|"VIEWER"}
     */
    getFieldOpsRole() {
        if (typeof sessionStorage !== "undefined") {
            const role = sessionStorage.getItem(FIELD_OPS_ROLE_KEY);
            if (role === "SUPERVISOR" || role === "VIEWER") {
                return role;
            }
            if (sessionStorage.getItem(FIELD_OPS_SESSION_KEY)) {
                return "SUPERVISOR";
            }
        }
        if (this._inMemorySessions.fieldOpsRole) {
            return this._inMemorySessions.fieldOpsRole;
        }
        // Default to SUPERVISOR if unauthenticated or backward-compatible
        return "SUPERVISOR";
    }

    /**
     * Check if Field Ops allows editing (only SUPERVISOR or DBMS EDITOR)
     * @returns {boolean}
     */
    canEditFieldOps() {
        const role = this.getFieldOpsRole();
        return role !== "VIEWER";
    }

    /**
     * Clear Field Ops Session
     */
    clearFieldOpsSession() {
        this._inMemorySessions.fieldOpsModule = null;
        this._inMemorySessions.fieldOpsRole = null;
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem(FIELD_OPS_SESSION_KEY);
            sessionStorage.removeItem(FIELD_OPS_ROLE_KEY);
        }
    }

    /**
     * Verify entered password against DBMS Editor, Viewer, or Manager Master credentials.
     * Evaluates cached/offline credentials immediately (0ms latency), falling back to
     * a network sync only if unmatched and cache is stale.
     * @param {string} inputPassword
     * @returns {Promise<"EDITOR"|"VIEWER"|null>}
     */
    async verifyDbmsPassword(inputPassword) {
        const normalized = (inputPassword || "").trim().toLowerCase();
        if (!normalized) return null;

        const checkMatch = () => {
            const editorPass = (this.cache.appPasswords.dbms_editor || OFFLINE_PASSWORDS.app.dbms_editor).toLowerCase();
            const viewerPass = (this.cache.appPasswords.dbms_viewer || OFFLINE_PASSWORDS.app.dbms_viewer).toLowerCase();
            const managerPass = (this.cache.appPasswords.manager_master || OFFLINE_PASSWORDS.app.manager_master).toLowerCase();

            // 1. Strict Editor: Only mantaray
            if (normalized === editorPass) {
                this.setDbmsSession("EDITOR");
                return "EDITOR";
            }

            // 2. Check if entered password matches any of the 9 module/supervisor fish passwords
            const allModulePasses = Object.values({ ...OFFLINE_PASSWORDS.modules, ...this.cache.modulePasswords })
                .map(p => String(p).trim().toLowerCase());
            const isModulePass = allModulePasses.includes(normalized);

            // Viewer: isharp, monodon (legacy fallback), todak (manager master), or any of the 9 supervisor passcodes
            if (normalized === viewerPass || normalized === "isharp" || normalized === "monodon" || normalized === managerPass || isModulePass) {
                this.setDbmsSession("VIEWER");
                return "VIEWER";
            }

            return null;
        };

        // 1. Instant check against cache/offline defaults (0ms latency, prevents freezing on slow mobile connection)
        const instantMatch = checkMatch();
        if (instantMatch) return instantMatch;

        // 2. If unmatched and cache is older than 30s, fetch latest from Supabase and retry
        if (Date.now() - this.cache.lastFetched > 30000) {
            await this.syncPasswords();
            return checkMatch();
        }

        return null;
    }

    /**
     * Verify entered password for a Field Ops module (or manager master / editor / viewer).
     * Supports module numbers as integers (1), strings ("1"), or padded strings ("01").
     * Returns "SUPERVISOR", "VIEWER", or null.
     * Also supports boolean check if caller expects truthy.
     * @param {number|string} moduleNo
     * @param {string} inputPassword
     * @returns {Promise<"SUPERVISOR"|"VIEWER"|null>}
     */
    async verifyFieldOpsPassword(moduleNo, inputPassword) {
        const normalized = (inputPassword || "").trim().toLowerCase();
        if (!normalized) return null;

        const modKey = Number(moduleNo);

        const checkMatch = () => {
            const managerPass = (this.cache.appPasswords.manager_master || OFFLINE_PASSWORDS.app.manager_master).toLowerCase();
            const editorPass = (this.cache.appPasswords.dbms_editor || OFFLINE_PASSWORDS.app.dbms_editor).toLowerCase();
            const viewerPass = (this.cache.appPasswords.dbms_viewer || OFFLINE_PASSWORDS.app.dbms_viewer).toLowerCase();
            const modulePass = (this.cache.modulePasswords[modKey] || OFFLINE_PASSWORDS.modules[modKey] || "").toLowerCase();

            // 1. Supervisor / Editor Full Access: Module fish password, manager master ("todak"), or DBMS editor ("mantaray")
            if (normalized === managerPass || normalized === editorPass || (Boolean(modulePass) && normalized === modulePass)) {
                this.setFieldOpsSession(modKey, "SUPERVISOR");
                return "SUPERVISOR";
            }

            // 2. Read-Only Viewer Access: Universal viewer ("isharp" / legacy "monodon")
            if (normalized === viewerPass || normalized === "isharp" || normalized === "monodon") {
                this.setFieldOpsSession(modKey, "VIEWER");
                return "VIEWER";
            }

            return null;
        };

        // 1. Instant check against cache/offline defaults (0ms latency)
        const instantMatch = checkMatch();
        if (instantMatch) return instantMatch;

        // 2. If unmatched and cache is older than 30s, fetch latest from Supabase and retry
        if (Date.now() - this.cache.lastFetched > 30000) {
            await this.syncPasswords();
            return checkMatch();
        }

        return null;
    }

    /**
     * Check if current DBMS session allows editing
     * @returns {boolean}
     */
    canEditDbms() {
        return this.getDbmsSession() === "EDITOR";
    }
}

export const security = new SecurityService();
