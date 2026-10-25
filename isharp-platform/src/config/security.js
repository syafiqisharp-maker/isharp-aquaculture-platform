/**
 * iSHARP DBMS 2.0 — Security & Access Control Service
 * Manages cryptographic passcode verification (salted SHA-256 + server-side Postgres pgcrypto RPC),
 * role verification (DBMS Editor vs Viewer), and Field Ops Module/Manager authentication.
 * Zero plaintext passwords are stored in client source or fetched over public SELECT queries.
 */

import { supabase } from "../infrastructure/supabase.js";

const DBMS_SESSION_KEY = "isharp_dbms_session";
const FIELD_OPS_SESSION_KEY = "isharp_field_ops_module";
const FIELD_OPS_ROLE_KEY = "isharp_field_ops_role";
const HASH_SALT_PREFIX = "isharp_v2_salt";

// One-way salted SHA-256 digests (SHA-256("isharp_v2_salt:<scope>:<normalized_passcode>"))
const OFFLINE_HASHES = {
    app: {
        dbms_editor: "c95decea77a41544d2540af492d1aac58a6dbcb9afaafa44b735f659b19acd46",
        dbms_viewer: "f84b5ac90177360325e4fcce08cd504df369aae8f26a2206a1fb568b97aee406",
        legacy_viewer: "970c0c69445e2b92c0d6683801472f6b399beddca66c5fe7cfcde323f6a90b21",
        manager_master: "7eee103ebdc4b85037db7a69696ad6bc9c442aab05343a59ee9d6cac45544e2f"
    },
    modules: {
        1: "880767e981de1d93691daf53c26b9d033212ae6b2adbab8c329248f1e2962953",
        2: "3a404ea596916667688f0bfe54537bd818d3cc808d02c2b6d546cbd4603511af",
        3: "bcce0769402e4096682124d464afae7cefefc2651f1c98ed340a3d91d2079799",
        4: "6a84bfafb2f36aaaa170e4e5894846231e675f104ab0e86a8469c3cb68926805",
        5: "c134cd563a3ed58abc8313b0677423d94f53d31cb1362f8d692faf8fe0a531e1",
        6: "24d5d4f494c5990de4a228b2ab64f798d3fb645cb97e7951aac30f0d536f2a4e",
        7: "3dad7efd1e14997a7651530876a5434870adc21e9002f2c3cf8a8c142f85b7f8",
        8: "9e706323d653b1b63758eda28ceaf76efedf8883c1b7dae8f73b91c36517ec1e",
        9: "8fc3cddf9909155ea9bb04e400b83f2c8a22e58de74558afbf9113241e951d12"
    }
};

/**
 * Computes a salted SHA-256 hex digest using standard Web Crypto API.
 * Works identically in modern browsers and Node.js.
 * @param {string} scope e.g. "app:dbms_editor" or "mod:1"
 * @param {string} normalizedPasscode lowercase trimmed passcode
 * @returns {Promise<string>} 64-char hex digest
 */
async function computeSaltedDigest(scope, normalizedPasscode) {
    const payload = `${HASH_SALT_PREFIX}:${scope}:${normalizedPasscode}`;
    const bytes = new TextEncoder().encode(payload);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

class SecurityService {
    constructor() {
        this._inMemorySessions = {
            dbms: null,
            fieldOpsModule: null,
            fieldOpsRole: null,
            passcode: null
        };
    }

    /**
     * Retained as a safe no-op for backward compatibility.
     * Passwords are never downloaded in plaintext from Supabase tables.
     */
    async syncPasswords() {
        return;
    }

    /**
     * Stores the authenticated passcode for server-side RLS header verification.
     * @param {string|null} passcode
     */
    setActivePasscode(passcode) {
        const clean = passcode ? String(passcode).trim().toLowerCase() : null;
        this._inMemorySessions.passcode = clean;
        supabase.setAuthPasscode(clean);
    }

    /**
     * Returns the currently active authenticated passcode.
     * @returns {string|null}
     */
    getActivePasscode() {
        return this._inMemorySessions.passcode || supabase.getAuthPasscode();
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
        if (!this._inMemorySessions.fieldOpsModule) {
            this.setActivePasscode(null);
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
        if (!this._inMemorySessions.dbms) {
            this.setActivePasscode(null);
        }
    }

    /**
     * Verify entered password against DBMS Editor, Viewer, or Manager Master credentials.
     * Evaluates salted SHA-256 digests first (<1ms latency), falling back to
     * server-side PostgreSQL pgcrypto RPC verification (`fn_verify_dbms_passcode`) if rotated in DB.
     * @param {string} inputPassword
     * @returns {Promise<"EDITOR"|"VIEWER"|null>}
     */
    async verifyDbmsPassword(inputPassword) {
        const normalized = (inputPassword || "").trim().toLowerCase();
        if (!normalized) return null;

        // 1. Check Editor digest
        const editorDigest = await computeSaltedDigest("app:dbms_editor", normalized);
        if (editorDigest === OFFLINE_HASHES.app.dbms_editor) {
            this.setActivePasscode(normalized);
            this.setDbmsSession("EDITOR");
            return "EDITOR";
        }

        // 2. Check Viewer, Legacy Viewer, and Manager Master digests
        const [viewerDigest, legacyDigest, managerDigest] = await Promise.all([
            computeSaltedDigest("app:dbms_viewer", normalized),
            computeSaltedDigest("app:legacy_viewer", normalized),
            computeSaltedDigest("app:manager_master", normalized)
        ]);

        if (
            viewerDigest === OFFLINE_HASHES.app.dbms_viewer ||
            legacyDigest === OFFLINE_HASHES.app.legacy_viewer ||
            managerDigest === OFFLINE_HASHES.app.manager_master
        ) {
            this.setActivePasscode(normalized);
            this.setDbmsSession("VIEWER");
            return "VIEWER";
        }

        // 3. Check if entered password matches any of the 9 module supervisor digests
        const moduleNums = Object.keys(OFFLINE_HASHES.modules);
        const modDigests = await Promise.all(
            moduleNums.map(m => computeSaltedDigest(`mod:${m}`, normalized))
        );
        const matchedModule = moduleNums.some((m, idx) => modDigests[idx] === OFFLINE_HASHES.modules[m]);
        if (matchedModule) {
            this.setActivePasscode(normalized);
            this.setDbmsSession("VIEWER");
            return "VIEWER";
        }

        // 4. Server-side PostgreSQL pgcrypto RPC fallback (supports live password rotation in Supabase)
        try {
            const rpcRole = await supabase.rpc("fn_verify_dbms_passcode", { p_passcode: normalized });
            if (rpcRole === "EDITOR" || rpcRole === "VIEWER") {
                this.setActivePasscode(normalized);
                this.setDbmsSession(rpcRole);
                return rpcRole;
            }
        } catch {
            // Offline or RPC not yet applied
        }

        return null;
    }

    /**
     * Verify entered password for a Field Ops module (or manager master / editor / viewer).
     * Supports module numbers as integers (1), strings ("1"), or padded strings ("01").
     * Returns "SUPERVISOR", "VIEWER", or null.
     * @param {number|string} moduleNo
     * @param {string} inputPassword
     * @returns {Promise<"SUPERVISOR"|"VIEWER"|null>}
     */
    async verifyFieldOpsPassword(moduleNo, inputPassword) {
        const normalized = (inputPassword || "").trim().toLowerCase();
        if (!normalized) return null;

        const modKey = Number(moduleNo);

        const [managerDigest, editorDigest, modDigest, viewerDigest, legacyDigest] = await Promise.all([
            computeSaltedDigest("app:manager_master", normalized),
            computeSaltedDigest("app:dbms_editor", normalized),
            computeSaltedDigest(`mod:${modKey}`, normalized),
            computeSaltedDigest("app:dbms_viewer", normalized),
            computeSaltedDigest("app:legacy_viewer", normalized)
        ]);

        // 1. Supervisor / Editor Full Access: Module passcode, manager master, or DBMS editor
        const expectedModHash = OFFLINE_HASHES.modules[modKey];
        if (
            managerDigest === OFFLINE_HASHES.app.manager_master ||
            editorDigest === OFFLINE_HASHES.app.dbms_editor ||
            (Boolean(expectedModHash) && modDigest === expectedModHash)
        ) {
            this.setActivePasscode(normalized);
            this.setFieldOpsSession(modKey, "SUPERVISOR");
            return "SUPERVISOR";
        }

        // 2. Read-Only Viewer Access: Universal viewer
        if (
            viewerDigest === OFFLINE_HASHES.app.dbms_viewer ||
            legacyDigest === OFFLINE_HASHES.app.legacy_viewer
        ) {
            this.setActivePasscode(normalized);
            this.setFieldOpsSession(modKey, "VIEWER");
            return "VIEWER";
        }

        // 3. Server-side PostgreSQL pgcrypto RPC fallback (supports live password rotation in Supabase)
        try {
            const rpcRole = await supabase.rpc("fn_verify_field_ops_passcode", {
                p_module_no: modKey,
                p_passcode: normalized
            });
            if (rpcRole === "SUPERVISOR" || rpcRole === "VIEWER") {
                this.setActivePasscode(normalized);
                this.setFieldOpsSession(modKey, rpcRole);
                return rpcRole;
            }
        } catch {
            // Offline or RPC not yet applied
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
