/**
 * iSHARP DBMS 2.0 — Supabase REST Client
 * Robust fetch wrapper with timeout, custom headers, structured error handling,
 * and automatic read-through offline fallback via OfflineSnapshotCache.
 */

import { ENV } from "../config/env.js";
import { OfflineSnapshotCache } from "./offlineSnapshotCache.js";

const AUTH_PASSCODE_STORAGE_KEY = "isharp_auth_passcode";

class SupabaseClient {
    constructor() {
        this.baseUrl = ENV.SUPABASE_URL;
        this.apiKey = ENV.SUPABASE_KEY;
        this.authPasscode = null;
        this.isOfflineFallbackActive = false;
        this.lastOfflineSnapshotAt = null;
    }

    /**
     * Sets or clears the active passcode used for server-side RLS verification.
     * @param {string|null} passcode
     */
    setAuthPasscode(passcode) {
        this.authPasscode = passcode ? String(passcode).trim().toLowerCase() : null;
        if (typeof sessionStorage !== "undefined") {
            if (this.authPasscode) {
                sessionStorage.setItem(AUTH_PASSCODE_STORAGE_KEY, this.authPasscode);
            } else {
                sessionStorage.removeItem(AUTH_PASSCODE_STORAGE_KEY);
            }
        }
    }

    /**
     * Retrieves the currently active passcode from memory or sessionStorage.
     * @returns {string|null}
     */
    getAuthPasscode() {
        if (this.authPasscode) return this.authPasscode;
        if (typeof sessionStorage !== "undefined") {
            const stored = sessionStorage.getItem(AUTH_PASSCODE_STORAGE_KEY);
            if (stored) return stored;
        }
        return null;
    }

    /**
     * Executes a REST API request to Supabase Cloud PostgreSQL.
     * For GET requests, mirrors successful responses into OfflineSnapshotCache and
     * automatically falls back to cached snapshots if Supabase is unreachable.
     *
     * @param {string} endpoint e.g. "stocking_records?select=*&limit=10" or "rpc/fn_name"
     * @param {RequestInit} [options]
     * @returns {Promise<any>}
     */
    async request(endpoint, options = {}) {
        const method = String(options.method || "GET").toUpperCase();
        const isGetRequest = method === "GET" && !String(endpoint).startsWith("rpc/");
        const url = `${this.baseUrl}/rest/v1/${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ENV.API_TIMEOUT_MS);

        const activePasscode = this.getAuthPasscode();
        const headers = {
            "apikey": this.apiKey,
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
            ...(activePasscode ? { "x-isharp-passcode": activePasscode } : {}),
            ...(options.headers || {})
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // If Supabase server/gateway is temporarily down (502/503/504/520+), attempt offline read fallback
                if (isGetRequest && response.status >= 502) {
                    const fallbackHit = await OfflineSnapshotCache.getEndpointResponse(endpoint);
                    if (fallbackHit) {
                        this._setOfflineState(true, fallbackHit.updatedAt);
                        return fallbackHit.data;
                    }
                }

                const errText = await response.text();
                let errorDetails = errText;
                try {
                    const errJson = JSON.parse(errText);
                    errorDetails = errJson.message || errJson.hint || errText;
                } catch {
                    // Retain raw error text
                }
                throw new Error(`Supabase Error (${response.status} ${response.statusText}): ${errorDetails}`);
            }

            // For 204 No Content
            if (response.status === 204) return null;

            const text = await response.text();
            const parsed = text && text.trim() ? JSON.parse(text) : null;

            if (isGetRequest && parsed !== null) {
                this._setOfflineState(false, null);
                OfflineSnapshotCache.putEndpointResponse(endpoint, parsed).catch(() => {});
            }

            return parsed;
        } catch (error) {
            clearTimeout(timeoutId);

            // On network failure or AbortError timeout during a GET request, serve from OfflineSnapshotCache
            const isNetworkOrTimeout =
                error.name === "AbortError" ||
                error.name === "TypeError" ||
                /network|fetch|timed out|failed to fetch|offline/i.test(error.message || "");

            if (isGetRequest && isNetworkOrTimeout) {
                const fallbackHit = await OfflineSnapshotCache.getEndpointResponse(endpoint);
                if (fallbackHit) {
                    this._setOfflineState(true, fallbackHit.updatedAt);
                    return fallbackHit.data;
                }
            }

            if (error.name === "AbortError") {
                throw new Error(`Request timed out after ${ENV.API_TIMEOUT_MS / 1000}s. Please check your network.`);
            }
            throw error;
        }
    }

    /**
     * Executes a PostgreSQL Remote Procedure Call (RPC)
     * @param {string} functionName
     * @param {object} params
     * @returns {Promise<any>}
     */
    async rpc(functionName, params = {}) {
        return this.request(`rpc/${functionName}`, {
            method: "POST",
            body: JSON.stringify(params)
        });
    }

    /**
     * Emits offline fallback state transitions for UI status banners.
     * @param {boolean} isOffline
     * @param {string|null} snapshotTimestamp
     */
    _setOfflineState(isOffline, snapshotTimestamp) {
        const changed = this.isOfflineFallbackActive !== isOffline;
        this.isOfflineFallbackActive = isOffline;
        if (snapshotTimestamp) {
            this.lastOfflineSnapshotAt = snapshotTimestamp;
        }
        if (changed && typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
            try {
                window.dispatchEvent(new CustomEvent("isharp:offline-fallback", {
                    detail: {
                        isOfflineFallbackActive: isOffline,
                        snapshotTimestamp: this.lastOfflineSnapshotAt
                    }
                }));
            } catch {
                // Ignore in non-DOM test environments
            }
        }
    }
}

export const supabase = new SupabaseClient();
