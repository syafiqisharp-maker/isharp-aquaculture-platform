/**
 * iSHARP DBMS 2.0 — App Navbar Component
 * Global pond selector, cycle stepping, role selector, and action buttons.
 */

import { appState } from "../state/appState.js";
import { ROLES, getRoleMeta } from "../config/permissions.js";
import { PondRepository } from "../infrastructure/repositories/pondRepository.js";
import { calculateDOC } from "../domain/biometrics.js";
import { Toast } from "./Toast.js";
import { DOM_IDS } from "../config/domContracts.js";

export class Navbar {
    constructor(onOpenExcel) {
        this.onOpenExcel = onOpenExcel;

        this.dom = {
            selectPond: document.getElementById(DOM_IDS.NAV.SELECT_POND),
            btnPrev: document.getElementById(DOM_IDS.NAV.BTN_PREV),
            btnNext: document.getElementById(DOM_IDS.NAV.BTN_NEXT),
            btnRefresh: document.getElementById(DOM_IDS.NAV.BTN_REFRESH),
            btnExcel: document.getElementById(DOM_IDS.NAV.BTN_EXCEL),
            selectRole: document.getElementById(DOM_IDS.NAV.SELECT_ROLE)
        };

        this.initRoleSelector();
        this.bindEvents();

        // Listen for cycles change to update dropdown
        appState.subscribe("filteredCyclesChanged", (cycles) => this.populatePondDropdown(cycles));
        appState.subscribe("cyclesLoaded", (cycles) => this.populatePondDropdown(cycles));
        appState.subscribe("pondChanged", (pond) => this.onPondChanged(pond));
    }

    initRoleSelector() {
        // If role selector doesn't exist in header, inject it seamlessly
        let roleContainer = document.querySelector(".role-badge-container");
        if (!roleContainer) {
            const headerActions = document.querySelector(".header-actions");
            if (headerActions) {
                roleContainer = document.createElement("div");
                roleContainer.className = "role-badge-container";
                roleContainer.innerHTML = `
                    <span class="role-badge-label">Role:</span>
                    <select id="select-user-role" class="role-select" aria-label="Select User Role">
                        <option value="${ROLES.PLANNER}">👑 Planner (100% Edit)</option>
                        <option value="${ROLES.SUPERVISOR}">📋 Supervisor (Inventory)</option>
                        <option value="${ROLES.LAB_TECH}">🔬 Lab Tech (Lab Only)</option>
                        <option value="${ROLES.VIEWER}">👁️ Viewer (Read Only)</option>
                    </select>
                `;
                headerActions.prepend(roleContainer);
                this.dom.selectRole = document.getElementById("select-user-role");
            }
        }

        if (this.dom.selectRole) {
            this.dom.selectRole.value = appState.userRole;
            this.dom.selectRole.addEventListener("change", (e) => {
                const newRole = e.target.value;
                appState.setUserRole(newRole);
                const meta = getRoleMeta(newRole);
                Toast.info(`Switched role to: ${meta.label}`);
            });
        }
    }

    bindEvents() {
        // Pond select change
        if (this.dom.selectPond) {
            this.dom.selectPond.addEventListener("change", (e) => {
                this.selectPondByIndex(e.target.value);
            });
        }

        // Stepper buttons
        if (this.dom.btnPrev) {
            this.dom.btnPrev.addEventListener("click", () => this.stepPond(-1));
        }
        if (this.dom.btnNext) {
            this.dom.btnNext.addEventListener("click", () => this.stepPond(1));
        }

        // Refresh
        if (this.dom.btnRefresh) {
            this.dom.btnRefresh.addEventListener("click", async () => {
                Toast.info("Refreshing pond data from cloud...");
                const cycles = await PondRepository.getCycles();
                appState.setCycles(cycles);
                if (appState.currentPondIndex) {
                    await this.selectPondByIndex(appState.currentPondIndex);
                }
                Toast.success("Cloud data up to date.");
            });
        }

        // Header Action buttons
        if (this.dom.btnExcel && this.onOpenExcel) {
            this.dom.btnExcel.addEventListener("click", () => this.onOpenExcel());
        }
    }

    populatePondDropdown(cycles) {
        if (!this.dom.selectPond) return;

        if (!cycles || cycles.length === 0) {
            this.dom.selectPond.innerHTML = `<option value="" disabled selected>No matching ponds found</option>`;
            return;
        }

        this.dom.selectPond.innerHTML = cycles.map(c => {
            let docLabel = "DOC —";
            if (c.stck_date && String(c.stck_date).trim() !== "") {
                const doc = calculateDOC(c.stck_date, c.date_close);
                docLabel = `DOC ${doc}`;
            }
            return `<option value="${c.pond_index}">Pond ${c.pond} - ${c.pond_index} (${docLabel})</option>`;
        }).join("");

        if (appState.currentPondIndex) {
            this.dom.selectPond.value = String(appState.currentPondIndex);
        } else if (cycles.length > 0) {
            this.selectPondByIndex(cycles[0].pond_index);
        }
    }

    onPondChanged(pond) {
        if (!this.dom.selectPond || !pond || !pond.pond_index) return;
        const pIdx = String(pond.pond_index);
        let opt = this.dom.selectPond.querySelector(`option[value="${pIdx}"]`);
        if (!opt) {
            opt = document.createElement("option");
            opt.value = pIdx;
            const doc = pond.stck_date ? calculateDOC(pond.stck_date, pond.date_close) : null;
            opt.textContent = `Pond ${pond.pond} - ${pIdx} (${doc !== null ? 'DOC ' + doc : 'DOC —'})`;
            this.dom.selectPond.appendChild(opt);
        }
        this.dom.selectPond.value = pIdx;
    }

    async selectPondByIndex(pondIndex) {
        if (!pondIndex) return;
        try {
            appState.setLoading(true);
            const pondDetails = await PondRepository.getCycleDetails(pondIndex);
            if (pondDetails) {
                appState.setCurrentPond(pondDetails);
                if (this.dom.selectPond) this.dom.selectPond.value = String(pondIndex);
            }
        } catch (err) {
            console.error("Failed to select pond:", err);
            Toast.error(`Could not load pond details: ${err.message}`);
        } finally {
            appState.setLoading(false);
        }
    }

    stepPond(delta) {
        const list = appState.filteredCycles.length > 0 ? appState.filteredCycles : appState.allCycles;
        if (!list || list.length === 0) return;

        const curIdx = list.findIndex(c => String(c.pond_index) === String(appState.currentPondIndex));
        let nextIdx = curIdx + delta;
        if (nextIdx < 0) nextIdx = list.length - 1;
        if (nextIdx >= list.length) nextIdx = 0;

        const nextPond = list[nextIdx];
        if (nextPond) {
            this.selectPondByIndex(nextPond.pond_index);
        }
    }
}
