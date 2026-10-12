/**
 * iSHARP DBMS 2.0 — Progressive Web App Update Manager
 * 
 * Architectural Role: Infrastructure Layer (Browser API Adapter)
 * Coordinates Service Worker lifecycle, listens for new builds, and handles
 * graceful automated reloads so users always run the most recent deployed version.
 */

import { Toast } from "../components/Toast.js";

const RELOAD_GUARD_KEY = "isharp_pwa_last_reload";
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes in background

export class PwaUpdateManager {
    constructor() {
        this.registration = null;
        this.isReloading = false;
        this.updateIntervalId = null;
    }

    /**
     * Bootstraps Service Worker registration and lifecycle event bindings.
     */
    init() {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            console.log("ℹ️ [PwaUpdateManager] Service Workers not supported in this environment.");
            return;
        }

        window.addEventListener("load", () => {
            this.registerServiceWorker();
        });

        this.bindLifecycleEvents();
    }

    /**
     * Registers sw.js and attaches registration listeners.
     */
    async registerServiceWorker() {
        try {
            this.registration = await navigator.serviceWorker.register("/sw.js");
            console.log("📲 [PwaUpdateManager] ServiceWorker registered with scope:", this.registration.scope);

            // Proactively check for an update immediately on load
            this.checkForUpdates();

            // Listen for new worker versions detected during install
            this.registration.addEventListener("updatefound", () => {
                const installingWorker = this.registration.installing;
                if (!installingWorker) return;

                installingWorker.addEventListener("statechange", () => {
                    if (installingWorker.state === "installed") {
                        if (navigator.serviceWorker.controller) {
                            // An older version was actively controlling the page -> legitimate new version deployed!
                            console.log("🚀 [PwaUpdateManager] New version detected! Triggering activation...");
                            installingWorker.postMessage({ type: "SKIP_WAITING" });
                            Toast.info("Updating iSHARP to latest release...");
                        } else {
                            // Initial cache populated on first-ever visit
                            console.log("✅ [PwaUpdateManager] Application shell cached for offline operation.");
                        }
                    }
                });
            });

            // Set up periodic background checks
            this.setupPeriodicUpdateChecks();

        } catch (err) {
            console.warn("⚠️ [PwaUpdateManager] Registration failed:", err);
        }
    }

    /**
     * Binds controller change and tab focus/visibility events.
     */
    bindLifecycleEvents() {
        // When a new Service Worker takes over control, reload to show latest code
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            this.safeReload("controllerchange");
        });

        // Check for updates when the user switches back to the tab or focuses window
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") {
                    this.checkForUpdates();
                }
            });
        }

        if (typeof window !== "undefined") {
            window.addEventListener("focus", () => {
                this.checkForUpdates();
            });
        }
    }

    /**
     * Instructs browser to query the server for an updated sw.js file.
     */
    checkForUpdates() {
        if (this.registration && typeof this.registration.update === "function") {
            this.registration.update().catch((err) => {
                console.debug("[PwaUpdateManager] Background update check deferred:", err);
            });
        }
    }

    /**
     * Periodically queries for new platform updates in the background.
     */
    setupPeriodicUpdateChecks() {
        if (this.updateIntervalId) clearInterval(this.updateIntervalId);
        this.updateIntervalId = setInterval(() => {
            this.checkForUpdates();
        }, UPDATE_CHECK_INTERVAL_MS);
    }

    /**
     * Reloads window to activate new assets, guarded against rapid cyclic reloads.
     * @param {string} reason 
     * @returns {boolean} Whether reload was initiated
     */
    safeReload(reason = "update") {
        if (this.isReloading) return false;

        const now = Date.now();
        const lastReload = (typeof sessionStorage !== "undefined" && sessionStorage.getItem(RELOAD_GUARD_KEY))
            ? parseInt(sessionStorage.getItem(RELOAD_GUARD_KEY), 10)
            : 0;

        // Guard: Prevent reload loops if triggered within less than 5 seconds
        if (now - lastReload < 5000) {
            console.warn(`[PwaUpdateManager] Reload suppressed (guard active, last reload ${now - lastReload}ms ago).`);
            return false;
        }

        this.isReloading = true;
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(RELOAD_GUARD_KEY, now.toString());
        }
        console.log(`🔄 [PwaUpdateManager] Executing automatic reload (${reason})...`);

        if (typeof window !== "undefined" && window.location && typeof window.location.reload === "function") {
            setTimeout(() => {
                window.location.reload();
            }, 350);
        }
        return true;
    }
}

export const pwaUpdateManager = new PwaUpdateManager();
