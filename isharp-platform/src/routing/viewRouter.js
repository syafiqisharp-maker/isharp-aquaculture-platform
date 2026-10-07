/**
 * iSHARP DBMS 2.0 — View Router
 * Coordinates top-level view switching between Portal Landing, Executive Dashboard, and Operations DBMS.
 */

import { appState } from "../state/appState.js";
import { security } from "../config/security.js";
import { ROLES } from "../config/permissions.js";
import { Toast } from "../components/Toast.js";

export class ViewRouter {
    constructor() {
        this.views = {
            portal: document.getElementById("view-portal"),
            executive: document.getElementById("view-executive"),
            "field-ops": document.getElementById("view-field-ops"),
            dbms: document.getElementById("view-dbms")
        };

        this.currentView = null;
        this.viewScrollPositions = {
            portal: 0,
            executive: 0,
            "field-ops": 0,
            dbms: 0
        };
        this.isNavigatingBack = false;
        this.viewHistory = [];
        this.isPromptingDbmsAuth = false;

        this.init();
        this.initDbmsAuthModal();
    }

    init() {
        // Prevent erratic browser auto-jumping on back/forward
        if ("scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }

        // Handle initial hash or default to portal
        window.addEventListener("hashchange", () => this.handleHashChange());
        
        // Listen to appState viewChanged event
        appState.subscribe("viewChanged", (viewName) => {
            this.renderView(viewName);
        });

        // Delegate clicks on elements with data-nav-view
        document.addEventListener("click", (e) => {
            const navBtn = e.target.closest("[data-nav-view]");
            if (navBtn) {
                const targetView = navBtn.getAttribute("data-nav-view");
                if (targetView) {
                    const btnText = (navBtn.textContent || "").toLowerCase();
                    const isBack = navBtn.classList.contains("btn-portal-back") ||
                                   navBtn.hasAttribute("data-nav-back") ||
                                   navBtn.id === "btn-to-executive-map" ||
                                   btnText.includes("back") ||
                                   btnText.includes("prev") ||
                                   btnText.includes("return") ||
                                   btnText.includes("216") ||
                                   (targetView === "executive" && this.currentView === "dbms") ||
                                   targetView === "portal";
                    if (isBack) {
                        this.isNavigatingBack = true;
                    }
                    this.navigate(targetView);
                }
            }
        });

        // Trigger initial view based on current hash
        this.handleHashChange();
    }

    initDbmsAuthModal() {
        const modal = document.getElementById("modal-dbms-passcode");
        if (!modal) return;

        const input = document.getElementById("input-dbms-passcode");
        const btnCancel = document.getElementById("btn-cancel-dbms-passcode");
        const btnVerify = document.getElementById("btn-verify-dbms-passcode");

        const cancelAuth = () => {
            this.isPromptingDbmsAuth = false;
            modal.classList.add("hidden");
            if (input) input.value = "";
            // Revert back to previous view or portal
            const fallback = this.currentView && this.currentView !== "dbms" ? this.currentView : "portal";
            window.location.hash = `#/${fallback}`;
        };

        if (btnCancel) {
            btnCancel.addEventListener("click", cancelAuth);
        }

        modal.addEventListener("click", (e) => {
            if (e.target === modal) cancelAuth();
        });

        const submitPasscode = async () => {
            const entered = (input ? input.value : "").trim();
            if (!entered) {
                Toast.error("Please enter the DBMS access password.");
                return;
            }

            if (btnVerify) {
                btnVerify.disabled = true;
                btnVerify.textContent = "Verifying...";
            }

            try {
                const roleType = await security.verifyDbmsPassword(entered);
                if (roleType === "EDITOR") {
                    appState.setUserRole(ROLES.PLANNER);
                    Toast.success("Welcome, DBMS Editor! Full edit mode unlocked.");
                    this.isPromptingDbmsAuth = false;
                    modal.classList.add("hidden");
                    if (input) input.value = "";
                    window.location.hash = "#/dbms";
                    this.completeNavigation("dbms");
                } else if (roleType === "VIEWER") {
                    appState.setUserRole(ROLES.VIEWER);
                    Toast.info("Authenticated as Viewer (Read-Only Mode).");
                    this.isPromptingDbmsAuth = false;
                    modal.classList.add("hidden");
                    if (input) input.value = "";
                    window.location.hash = "#/dbms";
                    this.completeNavigation("dbms");
                } else {
                    Toast.error("Incorrect password. Please try again.");
                    if (input) {
                        input.value = "";
                        input.focus();
                    }
                }
            } catch (err) {
                Toast.error("Authentication error: " + err.message);
            } finally {
                if (btnVerify) {
                    btnVerify.disabled = false;
                    btnVerify.textContent = "Unlock DBMS";
                }
            }
        };

        if (btnVerify) {
            btnVerify.addEventListener("click", submitPasscode);
        }

        if (input) {
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") submitPasscode();
                if (e.key === "Escape") cancelAuth();
            });
        }
    }

    promptDbmsPasscode() {
        const modal = document.getElementById("modal-dbms-passcode");
        const input = document.getElementById("input-dbms-passcode");
        if (!modal) {
            // Fallback if modal DOM not loaded yet
            this.navigate("portal");
            return;
        }

        this.isPromptingDbmsAuth = true;
        modal.classList.remove("hidden");
        if (input) {
            input.value = "";
            setTimeout(() => input.focus(), 50);
        }
    }

    handleHashChange() {
        const hash = window.location.hash.toLowerCase();
        let targetView = "portal";

        if (hash === "#/executive" || hash === "#executive") {
            targetView = "executive";
        } else if (hash === "#/field-ops" || hash === "#field-ops") {
            targetView = "field-ops";
        } else if (hash === "#/dbms" || hash === "#dbms") {
            targetView = "dbms";
        } else {
            targetView = "portal";
        }

        // GUARD: Check DBMS Authentication before allowing navigation
        if (targetView === "dbms") {
            const session = security.getDbmsSession();
            if (!session) {
                this.promptDbmsPasscode();
                return;
            } else {
                // Ensure role aligns with session
                if (session === "VIEWER") {
                    appState.setUserRole(ROLES.VIEWER);
                } else if (session === "EDITOR") {
                    appState.setUserRole(ROLES.PLANNER);
                }
            }
        }

        this.completeNavigation(targetView);
    }

    completeNavigation(targetView) {
        // Track history to detect browser back button navigation
        if (this.viewHistory.length > 1 && this.viewHistory[this.viewHistory.length - 2] === targetView) {
            this.isNavigatingBack = true;
            this.viewHistory.pop();
        } else {
            if (this.viewHistory[this.viewHistory.length - 1] !== targetView) {
                this.viewHistory.push(targetView);
            }
        }

        appState.setView(targetView);
        this.renderView(targetView);
    }

    navigate(viewName) {
        if (!["portal", "executive", "field-ops", "dbms"].includes(viewName)) {
            viewName = "portal";
        }
        window.location.hash = `#/${viewName}`;
    }

    renderView(viewName) {
        const getScrollY = () => window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

        // Remember scroll position of outgoing view
        if (this.currentView) {
            this.viewScrollPositions[this.currentView] = getScrollY();
        }

        const isBack = this.isNavigatingBack || 
                       (this.viewScrollPositions[viewName] > 0 && (viewName === "portal" || viewName === "executive"));
        this.isNavigatingBack = false;
        this.currentView = viewName;

        Object.entries(this.views).forEach(([name, el]) => {
            if (!el) return;
            if (name === viewName) {
                el.classList.add("active-view");
                el.style.display = "flex";
            } else {
                el.classList.remove("active-view");
                el.style.display = "none";
            }
        });

        // Clean up any legacy bubble layer for mobile performance
        const bubbleLayer = document.getElementById("aero-global-bubble-layer");
        if (bubbleLayer) {
            bubbleLayer.remove();
        }

        // Restore scroll position if navigating back or returning to a previously scrolled view
        const targetY = isBack ? (this.viewScrollPositions[viewName] || 0) : 0;
        window.scrollTo(0, targetY);
        requestAnimationFrame(() => {
            window.scrollTo(0, targetY);
            setTimeout(() => {
                window.scrollTo(0, targetY);
                // Smart fallback: If targetY is 0 but returning to executive with an active pond, center its module
                if (targetY === 0 && viewName === "executive" && appState.currentPond) {
                    const rawPond = String(appState.currentPond.pond || "");
                    let modStr = rawPond.split(".")[0];
                    if (!modStr && appState.currentPond.pond_index) {
                        modStr = String(appState.currentPond.pond_index).substring(1, 3);
                    }
                    if (modStr) {
                        const modPadded = modStr.padStart(2, "0");
                        const modEl = document.querySelector(`.farm-module-block[data-module="${modPadded}"]`);
                        if (modEl) {
                            modEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                    }
                }
            }, 35);
        });
    }
}
