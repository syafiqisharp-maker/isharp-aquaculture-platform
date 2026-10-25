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
import { security } from "../../config/security.js";
import { getManagementEntryHtml } from "./templates/managementEntryTemplate.js";

const SESSION_STAFF_KEY = "isharp_mgmt_last_saved_staff";
const SESSION_POND_KEY = "isharp_mgmt_last_saved_pond";

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

        // In-memory cache & session storage of last saved personnel (speeds up multi-pond setup)
        this.lastSavedStaff = null;
        this.lastSavedPondLabel = "";
        this.loadSessionStaff();
    }

    saveSessionStaff(staffAssignments, pondLabel) {
        this.lastSavedStaff = { ...staffAssignments };
        this.lastSavedPondLabel = pondLabel || "";
        try {
            if (typeof sessionStorage !== "undefined") {
                sessionStorage.setItem(SESSION_STAFF_KEY, JSON.stringify(this.lastSavedStaff));
                sessionStorage.setItem(SESSION_POND_KEY, this.lastSavedPondLabel);
            }
        } catch {
            // Ignore sessionStorage quota or access errors
        }
    }

    loadSessionStaff() {
        if (this.lastSavedStaff && Object.values(this.lastSavedStaff).some(Boolean)) {
            return { staff: this.lastSavedStaff, pondLabel: this.lastSavedPondLabel };
        }
        try {
            if (typeof sessionStorage !== "undefined") {
                const raw = sessionStorage.getItem(SESSION_STAFF_KEY);
                const pondLabel = sessionStorage.getItem(SESSION_POND_KEY) || "";
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === "object" && Object.values(parsed).some(Boolean)) {
                        this.lastSavedStaff = parsed;
                        this.lastSavedPondLabel = pondLabel;
                        return { staff: parsed, pondLabel };
                    }
                }
            }
        } catch {
            // Ignore parse errors
        }
        return null;
    }

    getCopySourceStaff(currentPond) {
        // Priority 1: Check session storage or last saved in this browser session
        const sessionSource = this.loadSessionStaff();
        if (sessionSource && sessionSource.staff && Object.values(sessionSource.staff).some(Boolean)) {
            return {
                source: "session",
                label: sessionSource.pondLabel || "Previous Pond",
                staff: sessionSource.staff
            };
        }

        // Priority 2: Fall back to preceding pond in active module list (Pond N - 1)
        if (this.pondsList && this.pondsList.length > 1) {
            const currIdx = this.pondsList.findIndex(p =>
                (p.pond_index && p.pond_index === currentPond?.pond_index) ||
                (p.pond && p.pond === currentPond?.pond)
            );
            if (currIdx > 0) {
                const prevPond = this.pondsList[currIdx - 1];
                const hasPrevStaff = Boolean(
                    prevPond.pm_staff_no || prevPond.sv_staff_no ||
                    prevPond.rl_staff_no || prevPond.po_staff_no ||
                    prevPond.support_staff_no
                );
                if (hasPrevStaff) {
                    return {
                        source: "sequence",
                        label: prevPond.pond || prevPond.pond_index || "Previous Pond",
                        staff: {
                            pm_staff_no: prevPond.pm_staff_no || null,
                            sv_staff_no: prevPond.sv_staff_no || null,
                            rl_staff_no: prevPond.rl_staff_no || null,
                            po_staff_no: prevPond.po_staff_no || null,
                            support_staff_no: prevPond.support_staff_no || null
                        }
                    };
                }
            }
        }

        return null;
    }

    updateCopyPrevButton(pond) {
        const copyContainer = this.container?.querySelector("#mgmt-copy-prev-container");
        const btnCopy = this.container?.querySelector("#btn-copy-prev-pond");
        if (!copyContainer || !btnCopy) return;

        // In read-only viewer mode, do not show copy action
        if (!security.canEditFieldOps()) {
            copyContainer.style.display = "none";
            return;
        }

        const copySource = this.getCopySourceStaff(pond);
        if (copySource && copySource.staff) {
            copyContainer.style.display = "block";
            btnCopy.innerHTML = `<span>📋 Copy from Pond ${copySource.label}</span>`;
            btnCopy.title = `Copy supervisory personnel from Pond ${copySource.label}`;
        } else {
            copyContainer.style.display = "none";
        }
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

        // Lock form inputs in Read-Only Viewer Mode (isharp / monodon)
        if (!security.canEditFieldOps()) {
            this.container.querySelectorAll("input, select, textarea, .stepper-btn, #btn-copy-prev-pond, #btn-mgmt-clear-autofill").forEach(el => {
                el.disabled = true;
                if (el.classList.contains("stepper-btn") || el.id === "btn-copy-prev-pond") {
                    el.style.pointerEvents = "none";
                    el.style.opacity = "0.5";
                }
            });
            const copyPrevCont = this.container.querySelector("#mgmt-copy-prev-container");
            if (copyPrevCont) copyPrevCont.style.display = "none";
        }
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

        // Live staff name resolution on typing ID or Name
        const staffRoles = ["pm", "sv", "rl", "po", "support"];
        staffRoles.forEach(role => {
            const idInput = this.container.querySelector(`#mgmt-${role}-id`);
            const nameInput = this.container.querySelector(`#mgmt-${role}-name`);
            if (idInput && nameInput) {
                const handleStaffLookup = (event) => {
                    const raw = idInput.value ? idInput.value.trim() : "";
                    if (!raw) {
                        nameInput.value = "";
                        idInput.style.borderColor = "";
                        idInput.style.background = "";
                        return;
                    }
                    const found = StaffRepository.findStaff(raw);
                    if (found) {
                        nameInput.value = `${found.staff_name} (${found.staff_position || 'Staff'})`;
                        nameInput.style.color = "#047857";
                        idInput.style.borderColor = "";
                        idInput.style.background = "";

                        // Only normalize ID box when user commits (selects from dropdown, blurs, or hits enter)
                        if (event && (event.type === "change" || event.type === "blur")) {
                            idInput.value = found.staff_no;
                        }
                    } else {
                        // On commit, show warning if unrecognized
                        if (event && (event.type === "change" || event.type === "blur")) {
                            nameInput.value = "⚠️ Unknown / Inactive Staff ID or Name";
                            nameInput.style.color = "#b91c1c";
                            idInput.style.borderColor = "#ef4444";
                            idInput.style.background = "#fef2f2";
                        }
                    }
                };
                idInput.addEventListener("input", handleStaffLookup);
                idInput.addEventListener("change", handleStaffLookup);
                idInput.addEventListener("blur", handleStaffLookup);
            }
        });

        // Clear Auto-fill button
        const btnClearAutofill = this.container.querySelector("#btn-mgmt-clear-autofill");
        if (btnClearAutofill) {
            btnClearAutofill.addEventListener("click", () => {
                staffRoles.forEach(role => {
                    const idInput = this.container.querySelector(`#mgmt-${role}-id`);
                    const nameInput = this.container.querySelector(`#mgmt-${role}-name`);
                    if (idInput) {
                        idInput.value = "";
                        idInput.style.borderColor = "";
                        idInput.style.background = "";
                    }
                    if (nameInput) nameInput.value = "";
                });
                const banner = this.container.querySelector("#mgmt-carry-forward-badge");
                if (banner) banner.style.display = "none";

                // Ensure copy button stays visible if a copy source exists
                this.updateCopyPrevButton(pond);
            });
        }

        // Copy from Previous Pond button (always bound)
        const btnCopyPrev = this.container.querySelector("#btn-copy-prev-pond");
        if (btnCopyPrev) {
            btnCopyPrev.addEventListener("click", () => {
                const copySource = this.getCopySourceStaff(pond);
                if (!copySource || !copySource.staff) {
                    Toast.warning("No previous pond personnel found to copy.");
                    return;
                }

                staffRoles.forEach(role => {
                    const key = `${role}_staff_no`;
                    const val = copySource.staff[key];
                    const idInput = this.container.querySelector(`#mgmt-${role}-id`);
                    const nameInput = this.container.querySelector(`#mgmt-${role}-name`);
                    if (idInput) {
                        idInput.value = val || "";
                        idInput.style.borderColor = "";
                        idInput.style.background = "";
                    }
                    if (nameInput) {
                        if (val) {
                            const found = StaffRepository.findStaff(val);
                            if (found) {
                                nameInput.value = `${found.staff_name} (${found.staff_position || 'Staff'})`;
                                nameInput.style.color = "#047857";
                            } else {
                                nameInput.value = `Staff #${val}`;
                                nameInput.style.color = "#0f172a";
                            }
                        } else {
                            nameInput.value = "";
                        }
                    }
                });
                Toast.info(`Copied personnel from Pond ${copySource.label}`);
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
                const idInput = this.container.querySelector(`#mgmt-${role}-id`);
                const nameInput = this.container.querySelector(`#mgmt-${role}-name`);
                if (idVal && nameInput) {
                    const found = StaffRepository.findStaffByNo(idVal);
                    if (found) {
                        if (idInput) idInput.value = found.staff_no;
                        nameInput.value = `${found.staff_name} (${found.staff_position || 'Staff'})`;
                        nameInput.style.color = "#047857";
                        if (idInput) {
                            idInput.style.borderColor = "";
                            idInput.style.background = "";
                        }
                    } else {
                        nameInput.value = "⚠️ Unknown / Inactive Staff ID";
                        nameInput.style.color = "#b91c1c";
                        if (idInput) {
                            idInput.style.borderColor = "#ef4444";
                            idInput.style.background = "#fef2f2";
                        }
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
            }
        }

        // Always check and show Copy from Previous Pond button if valid source exists
        this.updateCopyPrevButton(pond);

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
        if (!security.canEditFieldOps()) {
            Toast.warning("Viewing only. You do not have permission to edit or save management entries.");
            return;
        }

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

            // Validate that all entered staff IDs or names exist in directory
            const staffRoles = ["pm", "sv", "rl", "po", "support"];
            for (const role of staffRoles) {
                const raw = this.container.querySelector(`#mgmt-${role}-id`)?.value.trim();
                if (raw) {
                    const found = StaffRepository.findStaff(raw);
                    if (!found) {
                        Toast.error(`Cannot save: Staff "${raw}" is not recognized or inactive. Please correct or clear.`);
                        this.isSaving = false;
                        if (btnSave) btnSave.disabled = false;
                        if (btnSaveNext) btnSaveNext.disabled = false;
                        if (activeBtn) activeBtn.innerHTML = advanceToNextPond ? "<span>💾 Save &amp; Next Pond ➔</span>" : "<span>💾 Save Management Info</span>";
                        return;
                    }
                    // Normalize the ID box on screen to the 4-digit ID
                    const idInput = this.container.querySelector(`#mgmt-${role}-id`);
                    if (idInput) idInput.value = found.staff_no;
                }
            }

            // 1. Staff Assignments (Saved to growout_pond_master)
            const staffAssignments = {
                pm_staff_no: StaffRepository.normalizeStaffNo(this.container.querySelector("#mgmt-pm-id")?.value),
                sv_staff_no: StaffRepository.normalizeStaffNo(this.container.querySelector("#mgmt-sv-id")?.value),
                rl_staff_no: StaffRepository.normalizeStaffNo(this.container.querySelector("#mgmt-rl-id")?.value),
                po_staff_no: StaffRepository.normalizeStaffNo(this.container.querySelector("#mgmt-po-id")?.value),
                support_staff_no: StaffRepository.normalizeStaffNo(this.container.querySelector("#mgmt-support-id")?.value)
            };
            await StaffRepository.saveCycleStaff(pondIndex, staffAssignments);

            // Cache in-memory and in sessionStorage for session copy shortcut
            this.saveSessionStaff(staffAssignments, pondLabel);

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
                this.saveSessionStaff(staffAssignments, pondLabel);

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
