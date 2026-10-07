/**
 * iSHARP DBMS 2.0 — PWA Install Prompt Manager
 * Captures browser beforeinstallprompt events, detects standalone display mode,
 * and coordinates install trigger actions across UI components.
 */

import { Toast } from "../../components/Toast.js";

const SNOOZE_KEY = "isharp_pwa_install_banner_dismissed_until";

export class PwaInstallManager {
    constructor() {
        this.deferredPrompt = null;
        this.subscribers = new Set();
        this.isInstalled = false;

        this.init();
    }

    init() {
        if (typeof window === "undefined") return;

        // Check if already running in standalone PWA mode
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                             window.navigator.standalone === true ||
                             document.referrer.includes("android-app://");

        if (isStandalone) {
            this.isInstalled = true;
            console.log("[PwaInstallManager] App is running in standalone PWA mode.");
            return;
        }

        // Capture Chrome / Edge beforeinstallprompt
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log("[PwaInstallManager] Captured beforeinstallprompt event.");
            this.notify(true);
        });

        // App successfully installed
        window.addEventListener("appinstalled", () => {
            this.deferredPrompt = null;
            this.isInstalled = true;
            console.log("[PwaInstallManager] PWA was installed successfully.");
            Toast.success("📲 iSHARP Field Ops installed to your home screen!");
            this.notify(false);
        });
    }

    /**
     * Checks if install is available or prompt can be invoked.
     * Returns true unless the user is already running inside the installed standalone PWA.
     * @returns {boolean}
     */
    canInstall() {
        return !this.isInstalled;
    }

    /**
     * Checks if current browser is iOS Safari where standard beforeinstallprompt is absent.
     * @returns {boolean}
     */
    isIos() {
        if (typeof navigator === "undefined") return false;
        return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    }

    /**
     * Checks if mobile bottom banner should be displayed.
     * @returns {boolean}
     */
    shouldShowBanner() {
        if (this.isInstalled) return false;

        // Check if user snoozed the banner
        try {
            const dismissedUntil = localStorage.getItem(SNOOZE_KEY);
            if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
                return false;
            }
        } catch {
            // Ignore storage access errors
        }

        return true;
    }

    /**
     * Snoozes the install banner for 7 days.
     */
    dismissBanner() {
        try {
            const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
            localStorage.setItem(SNOOZE_KEY, String(sevenDays));
        } catch {}
        this.notify(false);
    }

    /**
     * Triggers the native install prompt or shows guided instructions.
     * @returns {Promise<boolean>} True if user accepted
     */
    async promptInstall() {
        if (this.deferredPrompt) {
            try {
                this.deferredPrompt.prompt();
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log(`[PwaInstallManager] User response to install prompt: ${outcome}`);
                this.deferredPrompt = null;
                return outcome === "accepted";
            } catch (err) {
                console.warn("[PwaInstallManager] Prompt error:", err);
            }
        }

        if (this.isIos()) {
            Toast.info("📲 On iOS / iPhone: Tap the Share button [⎙] in Safari, then tap 'Add to Home Screen' [+]");
            return false;
        }

        // Android / Desktop Chrome without beforeinstallprompt or on HTTP / Netlify preview
        Toast.info("📲 To install: Tap your browser's menu (⋮ or ⋯) and select 'Install app' or 'Add to Home screen'");
        return false;
    }

    /**
     * Subscribes to changes in install availability.
     * @param {Function} callback 
     */
    subscribe(callback) {
        if (typeof callback === "function") {
            this.subscribers.add(callback);
            callback(this.canInstall());
        }
        return () => this.subscribers.delete(callback);
    }

    notify(canInstall) {
        this.subscribers.forEach((fn) => {
            try {
                fn(canInstall);
            } catch (err) {
                console.error("[PwaInstallManager] Subscriber error:", err);
            }
        });
    }
}

export const pwaInstallManager = new PwaInstallManager();
