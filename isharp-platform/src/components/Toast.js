/**
 * iSHARP DBMS 2.0 — Toast Notification Service
 * Frutiger Aero floating glass toast stack.
 */

import { escapeHtml } from "../utils/formatters.js";

class ToastService {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        if (typeof document === "undefined") return;
        if (!document.getElementById("toast-container")) {
            this.container = document.createElement("div");
            this.container.id = "toast-container";
            this.container.className = "toast-stack";
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById("toast-container");
            this.container.className = "toast-stack";
        }
    }

    /**
     * Show a floating notification
     * @param {string} message 
     * @param {"info"|"success"|"error"} [type="info"] 
     * @param {number} [duration=3500] 
     */
    show(message, type = "info", duration = 3500) {
        if (!this.container) this.init();

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;

        const icons = {
            success: "✅",
            error: "❌",
            info: "ℹ️"
        };

        toast.innerHTML = `
            <span>${icons[type] || "ℹ️"}</span>
            <span>${escapeHtml(message)}</span>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => {
                if (typeof toast.remove === "function") {
                    toast.remove();
                } else if (toast.parentNode && typeof toast.parentNode.removeChild === "function") {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    success(msg) { this.show(msg, "success"); }
    error(msg) { this.show(msg, "error"); }
    info(msg) { this.show(msg, "info"); }
}

export const Toast = new ToastService();
