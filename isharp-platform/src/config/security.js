/**
 * iSHARP DBMS 2.0 — Security & Access Control Service
 * Manages passwords fetched dynamically from Supabase (with offline local fallback),
 * role verification (DBMS Editor vs Viewer), and Field Ops Module/Manager authentication.
 */

import { supabase } from "../infrastructure/supabase.js";
import { ROLES } from "./permissions.js";

const DBMS_SESSION_KEY = "isharp_dbms_session";
const FIELD_OPS_SESSION_KEY = "isharp_field_ops_module";

// Offline default passwords matching database setup
const OFFLINE_PASSWORDS = {
    app: {
        dbms_editor: "mantaray",
        dbms_viewer: "monodon",
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

        // Eager background sync
        this.syncPasswords().catch(() => {});
    }

    /**
     * Fetch active passwords from Supabase
     */
    async syncPasswords() {
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
                        this.cache.modulePasswords[item.module_no] = item.access_password.trim();
                    }
                });
            }

            this.cache.lastFetched = Date.now();
        } catch (err) {
            console.warn("[Security] Could not sync latest passwords from Supabase, using cached/offline values:", err.message);
        }
    }

    /**
     * Get DBMS Session from sessionStorage
     * @returns {"EDITOR"|"VIEWER"|null}
     */
    getDbmsSession() {
        const session = sessionStorage.getItem(DBMS_SESSION_KEY);
        if (session === "EDITOR" || session === "VIEWER") {
            return session;
        }
        return null;
    }

    /**
     * Set DBMS Session
     * @param {"EDITOR"|"VIEWER"} roleType
     */
    setDbmsSession(roleType) {
        if (roleType === "EDITOR" || roleType === "VIEWER") {
            sessionStorage.setItem(DBMS_SESSION_KEY, roleType);
        }
    }

    /**
     * Clear DBMS Session (Lock / Logout)
     */
    clearDbmsSession() {
        sessionStorage.removeItem(DBMS_SESSION_KEY);
    }

    /**
     * Clear Field Ops Session
     */
    clearFieldOpsSession() {
        sessionStorage.removeItem(FIELD_OPS_SESSION_KEY);
    }

    /**
     * Verify entered password against DBMS Editor and Viewer credentials.
     * @param {string} inputPassword
     * @returns {Promise<"EDITOR"|"VIEWER"|null>}
     */
    async verifyDbmsPassword(inputPassword) {
        const normalized = (inputPassword || "").trim().toLowerCase();
        if (!normalized) return null;

        // Try fresh sync if older than 30s
        if (Date.now() - this.cache.lastFetched > 30000) {
            await this.syncPasswords();
        }

        const editorPass = (this.cache.appPasswords.dbms_editor || OFFLINE_PASSWORDS.app.dbms_editor).toLowerCase();
        const viewerPass = (this.cache.appPasswords.dbms_viewer || OFFLINE_PASSWORDS.app.dbms_viewer).toLowerCase();

        if (normalized === editorPass) {
            this.setDbmsSession("EDITOR");
            return "EDITOR";
        }

        if (normalized === viewerPass) {
            this.setDbmsSession("VIEWER");
            return "VIEWER";
        }

        return null;
    }

    /**
     * Verify entered password for a Field Ops module (or manager master).
     * @param {number} moduleNo
     * @param {string} inputPassword
     * @returns {Promise<boolean>}
     */
    async verifyFieldOpsPassword(moduleNo, inputPassword) {
        const normalized = (inputPassword || "").trim().toLowerCase();
        if (!normalized) return false;

        // Try fresh sync if older than 30s
        if (Date.now() - this.cache.lastFetched > 30000) {
            await this.syncPasswords();
        }

        const managerPass = (this.cache.appPasswords.manager_master || OFFLINE_PASSWORDS.app.manager_master).toLowerCase();
        const modulePass = (this.cache.modulePasswords[moduleNo] || OFFLINE_PASSWORDS.modules[moduleNo] || "").toLowerCase();

        // Check against manager master ("todak") OR module-specific password
        if (normalized === managerPass || (modulePass && normalized === modulePass)) {
            sessionStorage.setItem(FIELD_OPS_SESSION_KEY, String(moduleNo));
            return true;
        }

        return false;
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
