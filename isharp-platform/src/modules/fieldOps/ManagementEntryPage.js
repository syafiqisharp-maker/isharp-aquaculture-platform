/**
 * iSHARP DBMS 2.0 — Field Operations: Dedicated Management Entry Page
 * Standalone full-screen operational view for Supervisors to manage:
 * - Assigned Pond Personnel (Manager, Supervisor, Row Leader, Primary Operator, Support Operator)
 * - Active Paddlewheels (1.0 HP & 2.0 HP units only)
 * - Feeding Trays, Autofeeders, Pond Hut Condition, and Field Remarks
 * 
 * Single Source of Truth:
 * - Personnel & Aerators -> growout_pond_master
 * - Staff Directory -> pond_staff
 * - Hardware & Hut Condition -> pond_inventories
 */

import { StaffRepository } from "../../infrastructure/repositories/staffRepository.js";
import { InventoryRepository } from "../../infrastructure/repositories/inventoryRepository.js";
import { calculateTotalActiveHP, calculateAerationDensity } from "../../domain/aeration.js";
import { calculateDOC } from "../../domain/biometrics.js";
import { Toast } from "../../components/Toast.js";
import { OfflineSync } from "./offlineSync.js";
import { getManagementEntryHtml } from "./templates/managementEntryTemplate.js";

export class ManagementEntryPage {
    /**
     * @param {string} containerId Element ID where page is mounted
     * @param {object} callbacks Navigation callbacks { onBackToPond, onBackToMap, onSaved }
     */
    constructor(containerId = "field-ops-management-mount", callbacks = {}) {
        this.container = document.getElementById(containerId);
        this.callbacks = callbacks;
        this.currentPond = null;
        this.pondsList = [];
        this.isSaving = false;

        // In-memory cache of last saved personnel in this session (speeds up multi-pond setup)
        this.lastSavedStaff = null;
        this.lastSavedPondLabel = "";
    }

    /**
     * Renders the Management Entry Page for the specified pond
     * @param {object} pond Cycle & Pond record
     * @param {Array<object>} [pondsList=[]] Full module ponds list for sequential navigation
     */
    async render(pond, pondsList = []) {
        this.currentPond = pond;
        if (pondsList && pondsList.length > 0) {
            this.pondsList = pondsList;
        }
        if (!this.container) return;

        const pondLabel = pond.pond || pond.pond_index || "Pond";
        const doc = calculateDOC(pond.stck_date, pond.date_close);
        const areaHa = parseFloat(pond.area) || 0.50;
        const u1 = parseInt(pond.aerator_1hp || 0, 10);
        const u2 = parseInt(pond.aerator_2hp || 0, 10);
        const initialTotalHP = calculateTotalActiveHP(u1, u2);
        const initialDensity = calculateAerationDensity(initialTotalHP, areaHa);

        // Preload staff directory for quick ID resolution
        const staffList = await StaffRepository.getStaffDirectory();

        this.container.innerHTML = getManagementEntryHtml({
            pondLabel,
            pond,
            doc,
            initialTotalHP,
            initialDensity,
            u1,
            u2,
            staffList,
            pondsList: this.pondsList
        });

        this.bindEvents(pond);
        await this.loadInitialData(pond);
    }

    bindEvents(pond) {
        // Navigation buttons
        const btnBackPond = this.container.querySelector("#btn-mgmt-back-pond");
        if (btnBackPond && typeof this.callbacks.onBackToPond === "function") {
            btnBackPond.addEventListener("click", () => this.callbacks.onBackToPond(pond));
        }

        const btnBackMap = this.container.querySelector("#btn-mgmt-back-map");
        if (btnBackMap && typeof this.callbacks.onBackToMap === "function") {
            btnBackMap.addEventListener("click", () => this.callbacks.onBackToMap());
        }

        const btnCancel = this.container.querySelector("#btn-mgmt-cancel");
        if (btnCancel && typeof this.callbacks.onBackToPond === "function") {
            btnCancel.addEventListener("click", () => this.callbacks.onBackToPond(pond));
        }

        // Sequential Pond Switcher Navigation (◀ Prev Pond / Next Pond ▶)
        const btnPrevPond = this.container.querySelector("#btn-mgmt-prev-pond");
        const btnNextPond = this.container.querySelector("#btn-mgmt-next-pond");
        if (btnPrevPond) {
            btnPrevPond.addEventListener("click", () => this.switchPond(-1));
        }
        if (btnNextPond) {
            btnNextPond.addEventListener("click", () => this.switchPond(1));
        }

        // Live staff name resolution on typing ID
        const staffRoles = ["pm", "sv", "rl", "po", "support"];
        staffRoles.forEach(role => {
            const idInput = this.container.querySelector(`#mgmt-${role}-id`);
            const nameInput = this.container.querySelector(`#mgmt-${role}-name`);
            if (idInput && nameInput) {
                idInput.addEventListener("input", (e) => {
                    const enteredId = e.target.value.trim();
                    if (!enteredId) {
                        nameInput.value = "";
                        return;
                    }
                    const found = StaffRepository.findStaffByNo(enteredId);
                    if (found) {
                        nameInput.value = `${found.staff_name} (${found.staff_position || 'Staff'})`;
                        nameInput.style.color = "#047857";
                    } else {
                        nameInput.value = "Unknown Staff ID";
                        nameInput.style.color = "#b91c1c";
                    }
                });
            }
        });

        // Clear Auto-fill button
        const btnClearAutofill = this.container.querySelector("#btn-mgmt-clear-autofill");
        if (btnClearAutofill) {
            btnClearAutofill.addEventListener("click", () => {
                staffRoles.forEach(role => {
                    const idInput = this.container.querySelector(`#mgmt-${role}-id`);
                    const nameInput = this.container.querySelector(`#mgmt-${role}-name`);
                    if (idInput) idInput.value = "";
                    if (nameInput) nameInput.value = "";
                });
                const banner = this.container.querySelector("#mgmt-carry-forward-badge");
                if (banner) banner.style.display = "none";
            });
        }

        // Copy from Previous Pond in session button
        const btnCopyPrev = this.container.querySelector("#btn-copy-prev-pond");
        if (btnCopyPrev && this.lastSavedStaff) {
            btnCopyPrev.addEventListener("click", () => {
                staffRoles.forEach(role => {
                    const key = `${role}_staff_no`;
                    const val = this.lastSavedStaff[key];
                    const idInput = this.container.querySelector(`#mgmt-${role}-id`);
                    const nameInput = this.container.querySelector(`#mgmt-${role}-name`);
                    if (idInput && val) {
                        idInput.value = val;
                        const found = StaffRepository.findStaffByNo(val);
                        if (found && nameInput) {
                            nameInput.value = `${found.staff_name} (${found.staff_position || 'Staff'})`;
                            nameInput.style.color = "#047857";
                        }
                    }
                });
                Toast.info(`Copied supervisory personnel from Pond ${this.lastSavedPondLabel}`);
            });
        }

        // Live HP Calculation on changing 1HP / 2HP units
        const input1hp = this.container.querySelector("#mgmt-input-1hp");
        const input2hp = this.container.querySelector("#mgmt-input-2hp");
        const badge = this.container.querySelector("#mgmt-aeration-badge");
        const areaHa = parseFloat(pond.area) || 0.50;

        const updateAerationBadge = () => {
            const u1 = parseInt(input1hp.value || 0, 10);
            const u2 = parseInt(input2hp.value || 0, 10);
            const totalHP = calculateTotalActiveHP(u1, u2);
            const density = calculateAerationDensity(totalHP, areaHa);
            if (badge) {
                badge.textContent = `Total: ${totalHP} HP (${density} HP/Ha)`;
            }
        };

        if (input1hp) input1hp.addEventListener("input", updateAerationBadge);
        if (input2hp) input2hp.addEventListener("input", updateAerationBadge);

        // Quick stepper buttons (+ / −) for touchscreens
        this.container.querySelectorAll(".stepper-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetId = btn.dataset.target;
                const targetInput = this.container.querySelector(`#${targetId}`);
                if (!targetInput) return;
                const min = parseInt(targetInput.getAttribute("min") ?? "0", 10);
                const max = parseInt(targetInput.getAttribute("max") ?? "999", 10);
                let val = parseInt(targetInput.value || 0, 10);
                if (btn.classList.contains("btn-stepper-add")) {
                    if (val < max) val += 1;
                } else if (btn.classList.contains("btn-stepper-sub")) {
                    if (val > min) val -= 1;
                }
                targetInput.value = val;
                targetInput.dispatchEvent(new Event("input", { bubbles: true }));
            });
        });

        // Save Button (Save only)
        const btnSave = this.container.querySelector("#btn-mgmt-save");
        if (btnSave) {
            btnSave.addEventListener("click", () => this.handleSave(pond, { advanceToNextPond: false }));
        }

        // Save & Next Pond Button
        const btnSaveNext = this.container.querySelector("#btn-mgmt-save-next");
        if (btnSaveNext) {
            btnSaveNext.addEventListener("click", () => this.handleSave(pond, { advanceToNextPond: true }));
        }
    }

    /**
     * Switches to the previous (-1) or next (+1) pond in the module sequence
     * @param {number} direction -1 or 1
     */
    async switchPond(direction = 1) {
        if (!this.pondsList || this.pondsList.length === 0) return null;

        const currPond = this.currentPond;
        const currIdx = this.pondsList.findIndex(p =>
            (p.pond_index && currPond?.pond_index && p.pond_index === currPond.pond_index) ||
            (p.pond && currPond?.pond && p.pond === currPond.pond)
        );

        const nextIdx = (currIdx + direction + this.pondsList.length) % this.pondsList.length;
        const nextPond = this.pondsList[nextIdx];

        if (nextPond) {
            await this.render(nextPond, this.pondsList);
            window.scrollTo(0, 0);
        }
        return nextPond;
    }

    async loadInitialData(pond) {
        const pondIndex = pond.pond_index;
        if (!pondIndex) return;

        const staffRoles = ["pm", "sv", "rl", "po", "support"];

        // 1. Check if current cycle already has personnel assigned
        const hasCurrentStaff = staffRoles.some(role => Boolean(pond[`${role}_staff_no`]));

        if (hasCurrentStaff) {
            // Populate current cycle personnel
            staffRoles.forEach(role => {
                const idVal = pond[`${role}_staff_no`];
                const nameInput = this.container.querySelector(`#mgmt-${role}-name`);
                if (idVal && nameInput) {
                    const found = StaffRepository.findStaffByNo(idVal);
                    if (found) {
                        nameInput.value = `${found.staff_name} (${found.staff_position || 'Staff'})`;
                        nameInput.style.color = "#047857";
                    }
                }
            });
        } else {
            // Current cycle has no staff entered yet -> Query the most recent previous cycle!
            const pondLabel = pond.pond || pondIndex;
            const lastCycleStaff = await StaffRepository.getLastCycleStaff(pondLabel, pondIndex);

            if (lastCycleStaff) {
                // Auto-fill all roles from previous cycle
                staffRoles.forEach(role => {
                    const idVal = lastCycleStaff[`${role}_staff_no`];
                    const idInput = this.container.querySelector(`#mgmt-${role}-id`);
                    const nameInput = this.container.querySelector(`#mgmt-${role}-name`);
                    if (idVal && idInput) {
                        idInput.value = idVal;
                        const found = StaffRepository.findStaffByNo(idVal);
                        if (found && nameInput) {
                            nameInput.value = `${found.staff_name} (${found.staff_position || 'Staff'})`;
                            nameInput.style.color = "#047857";
                        }
                    }
                });

                // Display Smart Carry-Forward Banner
                const banner = this.container.querySelector("#mgmt-carry-forward-badge");
                const bannerText = this.container.querySelector("#mgmt-carry-forward-text");
                const badgePill = this.container.querySelector("#mgmt-carry-badge-pill");
                if (banner) {
                    banner.style.display = "flex";
                    if (bannerText) {
                        const cycleStr = lastCycleStaff.cycle_no ? `Cycle ${lastCycleStaff.cycle_no}` : "last cycle";
                        bannerText.textContent = `Auto-filled personnel from ${cycleStr} (Edit any role if changed, then Save)`;
                    }
                    if (badgePill && lastCycleStaff.cycle_no) {
                        badgePill.textContent = `Cycle ${lastCycleStaff.cycle_no} Preset`;
                    }
                }
            } else if (this.lastSavedStaff) {
                // No previous cycle in DB, but user saved personnel in this session -> show copy shortcut
                const copyContainer = this.container.querySelector("#mgmt-copy-prev-container");
                const btnCopy = this.container.querySelector("#btn-copy-prev-pond");
                if (copyContainer) copyContainer.style.display = "block";
                if (btnCopy && this.lastSavedPondLabel) {
                    btnCopy.innerHTML = `<span>📋 Copy from Pond ${this.lastSavedPondLabel}</span>`;
                }
            }
        }

        // 2. Load inventory from pond_inventories table
        try {
            const inv = await InventoryRepository.getPondInventory(pondIndex);
            if (inv) {
                if (inv.feeding_tray_count !== null && inv.feeding_tray_count !== undefined) {
                    const trayInput = this.container.querySelector("#mgmt-input-tray");
                    if (trayInput) trayInput.value = inv.feeding_tray_count;
                }
                if (inv.autofeeder_count !== null && inv.autofeeder_count !== undefined) {
                    const feederInput = this.container.querySelector("#mgmt-input-feeder");
                    if (feederInput) feederInput.value = inv.autofeeder_count;
                }
                if (inv.hut_condition) {
                    const hutSelect = this.container.querySelector("#mgmt-select-hut");
                    if (hutSelect) hutSelect.value = inv.hut_condition;
                }
                if (inv.notes) {
                    const notesArea = this.container.querySelector("#mgmt-textarea-notes");
                    if (notesArea) notesArea.value = inv.notes;
                }
            }
        } catch (err) {
            console.warn("Could not load pond inventory:", err);
        }
    }

    async handleSave(pond, { advanceToNextPond = false } = {}) {
        if (!pond || !pond.pond_index) {
            Toast.error("No active pond cycle selected.");
            return;
        }

        if (this.isSaving) return;
        this.isSaving = true;

        const btnSave = this.container.querySelector("#btn-mgmt-save");
        const btnSaveNext = this.container.querySelector("#btn-mgmt-save-next");

        if (btnSave) btnSave.disabled = true;
        if (btnSaveNext) btnSaveNext.disabled = true;

        const activeBtn = advanceToNextPond ? btnSaveNext : btnSave;
        if (activeBtn) {
            activeBtn.innerHTML = `<span>⏳ Saving...</span>`;
        }

        try {
            const pondIndex = pond.pond_index;
            const pondLabel = pond.pond || pondIndex;

            // 1. Staff Assignments (Saved to growout_pond_master)
            const staffAssignments = {
                pm_staff_no: this.container.querySelector("#mgmt-pm-id")?.value.trim() || null,
                sv_staff_no: this.container.querySelector("#mgmt-sv-id")?.value.trim() || null,
                rl_staff_no: this.container.querySelector("#mgmt-rl-id")?.value.trim() || null,
                po_staff_no: this.container.querySelector("#mgmt-po-id")?.value.trim() || null,
                support_staff_no: this.container.querySelector("#mgmt-support-id")?.value.trim() || null
            };
            await StaffRepository.saveCycleStaff(pondIndex, staffAssignments);

            // Cache in-memory for session copy shortcut
            this.lastSavedStaff = { ...staffAssignments };
            this.lastSavedPondLabel = pondLabel;

            // 2. Active Paddlewheels (1.0 HP & 2.0 HP only, saved to growout_pond_master & pond_aerator_inventory)
            const u1 = parseInt(this.container.querySelector("#mgmt-input-1hp")?.value || 0, 10);
            const u2 = parseInt(this.container.querySelector("#mgmt-input-2hp")?.value || 0, 10);
            const aeratorList = [
                { hp: 1, total_units: u1 },
                { hp: 2, total_units: u2 }
            ];
            await InventoryRepository.syncAeratorInventory(pondIndex, pondLabel, aeratorList);

            // 3. Hardware, Hut Condition & Remarks (Saved to pond_inventories)
            const trayCount = parseInt(this.container.querySelector("#mgmt-input-tray")?.value || 0, 10);
            const feederCount = parseInt(this.container.querySelector("#mgmt-input-feeder")?.value || 0, 10);
            const hutCondition = this.container.querySelector("#mgmt-select-hut")?.value || "OK";
            const notesText = this.container.querySelector("#mgmt-textarea-notes")?.value || "";

            await InventoryRepository.savePondInventory(pondIndex, pondLabel, {
                feeding_tray_count: trayCount,
                autofeeder_count: feederCount,
                hut_condition: hutCondition,
                notes: notesText
            });

            // Update in-memory pond properties
            Object.assign(pond, staffAssignments, {
                aerator_1hp: u1,
                aerator_2hp: u2
            });

            if (typeof this.callbacks.onSaved === "function") {
                this.callbacks.onSaved(pond);
            }

            if (advanceToNextPond && this.pondsList && this.pondsList.length > 1) {
                Toast.success(`Management Entry for Pond ${pondLabel} saved! Loading next pond...`);
                await this.switchPond(1);
            } else {
                Toast.success(`Management Entry for Pond ${pondLabel} saved successfully!`);
                // Return to Pond View after brief feedback
                setTimeout(() => {
                    if (typeof this.callbacks.onBackToPond === "function") {
                        this.callbacks.onBackToPond(pond);
                    }
                }, 600);
            }

        } catch (err) {
            console.error("Management Entry Save Error:", err);
            const isNetworkErr = !OfflineSync.isOnline() || err.name === "AbortError" || /failed to fetch|network|timeout|connection/i.test(err.message || "");
            if (isNetworkErr) {
                // Queue staff to growout_pond_master
                OfflineSync.queueRequest(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}`, {
                    method: "PATCH",
                    body: { ...staffAssignments }
                }, { type: "management_master", pondIndex });
                
                // Queue aerators to pond_aerator_inventory
                OfflineSync.queueRequest("pond_aerator_inventory?on_conflict=pond_index,hp", {
                    method: "POST",
                    headers: { "Prefer": "resolution=merge-duplicates" },
                    body: aeratorList.map(a => ({
                        pond_index: pondIndex,
                        pond: pondLabel,
                        aerator_model: `${a.hp} HP Paddlewheel`,
                        hp: a.hp,
                        total_units: a.total_units,
                        active_units: a.total_units,
                        updated_at: new Date().toISOString()
                    }))
                }, { type: "management_aerator", pondIndex });

                // Queue equipment & notes to pond_inventories
                OfflineSync.queueRequest("pond_inventories?on_conflict=pond_index", {
                    method: "POST",
                    headers: { "Prefer": "resolution=merge-duplicates" },
                    body: {
                        pond_index: pondIndex,
                        pond: pondLabel || pondIndex,
                        feeding_tray_count: trayCount,
                        autofeeder_count: feederCount,
                        hut_condition: hutCondition,
                        notes: notesText,
                        updated_at: new Date().toISOString()
                    }
                }, { type: "management_inventory", pondIndex });

                Object.assign(pond, staffAssignments, { aerator_1hp: u1, aerator_2hp: u2 });
                this.lastSavedStaff = { ...staffAssignments };
                this.lastSavedPondLabel = pondLabel;

                Toast.info(`📡 Saved locally (Offline). Will sync when connection is restored!`);
                if (typeof this.callbacks.onSaved === "function") this.callbacks.onSaved(pond);

                if (advanceToNextPond && this.pondsList && this.pondsList.length > 1) {
                    await this.switchPond(1);
                } else {
                    setTimeout(() => {
                        if (typeof this.callbacks.onBackToPond === "function") this.callbacks.onBackToPond(pond);
                    }, 800);
                }
            } else {
                Toast.error(`Failed to save: ${err.message}`);
            }
        } finally {
            this.isSaving = false;
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = `<span>💾 Save</span>`;
            }
            if (btnSaveNext) {
                btnSaveNext.disabled = false;
                btnSaveNext.innerHTML = `<span>💾 Save &amp; Next Pond ▶</span>`;
            }
        }
    }
}
