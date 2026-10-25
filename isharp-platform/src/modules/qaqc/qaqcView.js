/**
 * iSHARP QA/QC Inspection Module Controller (Mobile-First)
 * Manages the 6-Section Hub, Cascading Pond Selection, Live WhatsApp Formatting, and Cloud Persistence
 */

import { renderQaqcHub } from "./templates/qaqcHubTemplate.js";
import { renderPondCleaningForm } from "./templates/pondCleaningFormTemplate.js";
import { QaqcRepository } from "../../infrastructure/repositories/qaqcRepository.js";
import { StaffRepository } from "../../infrastructure/repositories/staffRepository.js";
import {
    buildHierarchicalPondTree,
    formatDateWithDay,
    formatRawPondCode,
    generateCleaningWhatsAppText,
    calculatePondIdleDays,
    extractShortPondNumber
} from "../../domain/qaqcWhatsAppFormatter.js";
import { Toast } from "../../components/Toast.js";
import { appState } from "../../state/appState.js";
import { escapeHtml } from "../../utils/formatters.js";

export class QaqcView {
    constructor(containerId = "view-lab-qaqc") {
        this.container = document.getElementById(containerId);
        this.currentViewMode = "HUB"; // "HUB" | "CLEANING_FORM"
        
        // Cascading & form state
        this.candidatePonds = [];
        this.tree = {};
        this.selectedModule = "";
        this.selectedRow = "";
        this.selectedPond = null;
        this.selectedInspector = "Helmi";
        this.selectedRequestor = "Rosdi";
        
        this.checklist = {
            lining: true,
            sump: true,
            pwa_autofeeder: true,
            jetty: true
        };

        this.initialized = false;
    }

    ensureInitialized() {
        if (!this.initialized) {
            this.initialized = true;
            this.renderHub();
        }
    }

    renderHub() {
        if (!this.container) return;
        this.currentViewMode = "HUB";
        this.container.innerHTML = renderQaqcHub();
        this.bindHubEvents();
    }

    bindHubEvents() {
        // Section 1: Pond Cleaning
        const btnCleaning = document.getElementById("btn-qaqc-sec-cleaning");
        if (btnCleaning) {
            btnCleaning.addEventListener("click", () => this.openCleaningForm());
        }

        // Placeholders 2 to 6
        const placeholders = [
            { id: "btn-qaqc-sec-readiness", name: "Stocking Readiness" },
            { id: "btn-qaqc-sec-stocking", name: "Stocking Event" },
            { id: "btn-qaqc-sec-mortality", name: "Mortality Report" },
            { id: "btn-qaqc-sec-preharvest", name: "Pre-Harvest" },
            { id: "btn-qaqc-sec-postharvest", name: "Post-Harvest" }
        ];

        placeholders.forEach(sec => {
            const el = document.getElementById(sec.id);
            if (el) {
                el.addEventListener("click", () => {
                    Toast.info(`📋 ${sec.name} module is upcoming in next phase.`);
                });
            }
        });
    }

    async openCleaningForm() {
        if (!this.container) return;
        this.currentViewMode = "CLEANING_FORM";
        this.selectedInspector = "Helmi";
        this.selectedRequestor = "Rosdi";
        this.container.innerHTML = renderPondCleaningForm();

        // 1. Set today's date in local YYYY-MM-DD
        const inputDate = document.getElementById("input-qaqc-date");
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const todayStr = `${yyyy}-${mm}-${dd}`;
        if (inputDate) {
            inputDate.value = todayStr;
        }

        // 2. Load staff roster into datalist
        this.populateStaffDatalist();

        // 3. Load non-production candidate ponds and populate cascading selectors
        await this.loadPondTree();

        // 4. Bind interactive form events
        this.bindFormEvents();

        // 5. Initial preview generation
        this.updateWhatsAppPreview();
    }

    populateStaffDatalist() {
        const datalist = document.getElementById("qaqc-staff-list");
        if (!datalist) return;
        try {
            const staffMembers = StaffRepository.getAllStaff() || [];
            datalist.innerHTML = staffMembers
                .map(s => `<option value="${escapeHtml(s.staff_name)}">${s.staff_no ? `[${escapeHtml(s.staff_no)}] ` : ""}${escapeHtml(s.staff_position || "")}</option>`)
                .join("");
        } catch (e) {
            console.warn("Could not populate staff datalist:", e);
        }
    }

    async loadPondTree() {
        const modSelect = document.getElementById("select-qaqc-module");
        if (!modSelect) return;

        modSelect.innerHTML = `<option value="">Loading...</option>`;

        try {
            this.candidatePonds = await QaqcRepository.getCandidateCleaningPonds();
            this.tree = buildHierarchicalPondTree(this.candidatePonds);
            
            const modules = Object.keys(this.tree).sort();
            if (modules.length === 0) {
                modSelect.innerHTML = `<option value="">No ponds</option>`;
                return;
            }

            // Module numbers only: "01", "02", "03", etc.
            modSelect.innerHTML = modules
                .map(m => `<option value="${m}">${m}</option>`)
                .join("");

            // Select first module by default
            this.selectedModule = modules[0];
            modSelect.value = this.selectedModule;
            this.handleModuleChange(this.selectedModule);
        } catch (err) {
            console.error("Error loading candidate cleaning ponds:", err);
            modSelect.innerHTML = `<option value="">Error</option>`;
        }
    }

    handleModuleChange(modl) {
        this.selectedModule = modl;
        const rowSelect = document.getElementById("select-qaqc-row");
        const pondSelect = document.getElementById("select-qaqc-pond");
        if (!rowSelect || !pondSelect) return;

        if (!modl || !this.tree[modl]) {
            rowSelect.disabled = true;
            rowSelect.innerHTML = `<option value="">--</option>`;
            pondSelect.disabled = true;
            pondSelect.innerHTML = `<option value="">--</option>`;
            return;
        }

        const rows = Object.keys(this.tree[modl]).sort();
        if (rows.length === 0) {
            rowSelect.disabled = true;
            rowSelect.innerHTML = `<option value="">--</option>`;
            return;
        }

        rowSelect.disabled = false;
        // Row numbers only: "01", "02", "03", etc.
        rowSelect.innerHTML = rows
            .map(r => `<option value="${r}">${r}</option>`)
            .join("");

        this.selectedRow = rows[0];
        rowSelect.value = this.selectedRow;
        this.handleRowChange(this.selectedRow);
    }

    handleRowChange(rowNo) {
        this.selectedRow = rowNo;
        const pondSelect = document.getElementById("select-qaqc-pond");
        if (!pondSelect) return;

        const modl = this.selectedModule;
        if (!modl || !rowNo || !this.tree[modl] || !this.tree[modl][rowNo]) {
            pondSelect.disabled = true;
            pondSelect.innerHTML = `<option value="">--</option>`;
            return;
        }

        const ponds = this.tree[modl][rowNo];
        if (ponds.length === 0) {
            pondSelect.disabled = true;
            pondSelect.innerHTML = `<option value="">--</option>`;
            return;
        }

        pondSelect.disabled = false;
        // Pond numbers only: "01", "03", "12", etc.
        pondSelect.innerHTML = ponds
            .map(p => {
                const shortNum = extractShortPondNumber(p.pond);
                return `<option value="${p.pond}">${shortNum}</option>`;
            })
            .join("");

        this.selectedPond = ponds[0];
        pondSelect.value = this.selectedPond.pond;
        this.handlePondChange(this.selectedPond.pond);
    }

    handlePondChange(pondStr) {
        const modl = this.selectedModule;
        const rowNo = this.selectedRow;
        if (modl && rowNo && this.tree[modl] && this.tree[modl][rowNo]) {
            this.selectedPond = this.tree[modl][rowNo].find(p => p.pond === pondStr) || null;
        }

        // Update idle days display from start cycle date (from pond_event_date)
        const ctxBar = document.getElementById("qaqc-pond-context-bar");
        const idleDaysEl = document.getElementById("ctx-idle-days");
        if (ctxBar && this.selectedPond) {
            ctxBar.classList.remove("hidden");
            const idleDays = calculatePondIdleDays(this.selectedPond.date_cycle);
            if (idleDaysEl) {
                idleDaysEl.textContent = idleDays;
            }
            if (this.selectedPond.date_cycle) {
                ctxBar.title = `Cycle start date: ${this.selectedPond.date_cycle} (from pond_event_date)`;
            }
        }

        this.updateWhatsAppPreview();
        this.loadPondHistory();
    }

    bindFormEvents() {
        // Return to Hub button
        const btnBackToHub = document.getElementById("btn-qaqc-back-to-hub");
        if (btnBackToHub) {
            btnBackToHub.addEventListener("click", () => this.renderHub());
        }

        // Cascading selects
        const modSelect = document.getElementById("select-qaqc-module");
        if (modSelect) {
            modSelect.addEventListener("change", (e) => this.handleModuleChange(e.target.value));
        }

        const rowSelect = document.getElementById("select-qaqc-row");
        if (rowSelect) {
            rowSelect.addEventListener("change", (e) => this.handleRowChange(e.target.value));
        }

        const pondSelect = document.getElementById("select-qaqc-pond");
        if (pondSelect) {
            pondSelect.addEventListener("change", (e) => this.handlePondChange(e.target.value));
        }

        // Date input change
        const inputDate = document.getElementById("input-qaqc-date");
        if (inputDate) {
            inputDate.addEventListener("input", () => this.updateWhatsAppPreview());
        }

        // Inspector quick chips selection
        document.querySelectorAll(".qaqc-inspector-chip").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".qaqc-inspector-chip").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const inspectorVal = btn.getAttribute("data-inspector") || "Helmi";
                this.selectedInspector = inspectorVal;
                const hiddenInput = document.getElementById("input-qaqc-inspector");
                if (hiddenInput) hiddenInput.value = inspectorVal;
            });
        });

        // Requestor dropdown & custom input
        const selectRequestor = document.getElementById("select-qaqc-requestor");
        const inputCustomRequestor = document.getElementById("input-qaqc-requestor-custom");

        if (selectRequestor) {
            selectRequestor.addEventListener("change", (e) => {
                const val = e.target.value;
                if (val === "__custom__") {
                    if (inputCustomRequestor) {
                        inputCustomRequestor.classList.remove("hidden");
                        inputCustomRequestor.focus();
                        this.selectedRequestor = inputCustomRequestor.value.trim() || "";
                    }
                } else {
                    if (inputCustomRequestor) {
                        inputCustomRequestor.classList.add("hidden");
                    }
                    this.selectedRequestor = val;
                }
                this.updateWhatsAppPreview();
            });
        }

        if (inputCustomRequestor) {
            inputCustomRequestor.addEventListener("input", (e) => {
                if (selectRequestor && selectRequestor.value === "__custom__") {
                    this.selectedRequestor = e.target.value.trim();
                    this.updateWhatsAppPreview();
                }
            });
        }

        // Team selection chips
        document.querySelectorAll(".qaqc-team-chip").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".qaqc-team-chip").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const teamVal = btn.getAttribute("data-team");
                const hiddenInput = document.getElementById("input-qaqc-team");
                if (hiddenInput) hiddenInput.value = teamVal;
                this.updateWhatsAppPreview();
            });
        });

        // 4 Checklist Item Toggles
        document.querySelectorAll(".qaqc-toggle-touch").forEach(btn => {
            btn.addEventListener("click", () => {
                const item = btn.getAttribute("data-toggle");
                const val = btn.getAttribute("data-val") === "true";
                
                // Update button styles in pair
                const parent = btn.parentElement;
                parent.querySelectorAll(".qaqc-toggle-touch").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                // Update checklist state
                this.checklist[item] = val;

                // Update item status badge
                const badge = document.getElementById(`badge-chk-${item}`);
                if (badge) {
                    if (val) {
                        badge.className = "qaqc-state-pill pass";
                        badge.textContent = "✅ Pass";
                    } else {
                        badge.className = "qaqc-state-pill fail";
                        badge.textContent = "❌ Fail";
                    }
                }

                this.updateWhatsAppPreview();
            });
        });

        // Quick Action: All Pass ✅
        const btnAllPass = document.getElementById("btn-qaqc-all-pass");
        if (btnAllPass) {
            btnAllPass.addEventListener("click", () => {
                ["lining", "sump", "pwa", "jetty"].forEach(item => {
                    this.checklist[item] = true;
                    const badge = document.getElementById(`badge-chk-${item}`);
                    if (badge) {
                        badge.className = "qaqc-state-pill pass";
                        badge.textContent = "✅ Pass";
                    }
                    const row = document.querySelector(`.qaqc-chk-touch-card[data-item="${item}"]`);
                    if (row) {
                        row.querySelectorAll(".qaqc-toggle-touch").forEach(b => {
                            if (b.getAttribute("data-val") === "true") b.classList.add("active");
                            else b.classList.remove("active");
                        });
                    }
                });
                Toast.success("All 4 items set to Pass ✅");
                this.updateWhatsAppPreview();
            });
        }

        // Defect Remark Preset Chips
        document.querySelectorAll(".qaqc-chip-mini[data-remark]").forEach(btn => {
            btn.addEventListener("click", () => {
                const remarkText = btn.getAttribute("data-remark");
                const textarea = document.getElementById("input-qaqc-remarks");
                if (textarea) {
                    const current = textarea.value.trim();
                    if (current) {
                        textarea.value = `${current}; ${remarkText}`;
                    } else {
                        textarea.value = remarkText;
                    }
                    this.updateWhatsAppPreview();
                }
            });
        });

        const inputRemarks = document.getElementById("input-qaqc-remarks");
        if (inputRemarks) {
            inputRemarks.addEventListener("input", () => this.updateWhatsAppPreview());
        }

        // Desktop Action: Save to Database
        const btnSave = document.getElementById("btn-qaqc-save");
        if (btnSave) {
            btnSave.addEventListener("click", () => this.handleSaveInspection());
        }

        // Desktop Action: Copy WhatsApp Message
        const btnCopyWa = document.getElementById("btn-qaqc-copy-wa");
        if (btnCopyWa) {
            btnCopyWa.addEventListener("click", () => this.handleCopyWhatsAppText());
        }

        // Mobile Sticky Dock Buttons
        const btnDockSave = document.getElementById("btn-dock-save");
        if (btnDockSave) {
            btnDockSave.addEventListener("click", () => this.handleSaveInspection());
        }

        const btnDockCopy = document.getElementById("btn-dock-copy");
        if (btnDockCopy) {
            btnDockCopy.addEventListener("click", () => this.handleCopyWhatsAppText());
        }

        // Toggle WhatsApp Preview Box (Collapse/Expand)
        const btnToggleWa = document.getElementById("btn-toggle-wa-preview");
        const bubbleBox = document.getElementById("qaqc-wa-bubble-box");
        if (btnToggleWa && bubbleBox) {
            btnToggleWa.addEventListener("click", () => {
                if (bubbleBox.classList.contains("collapsed")) {
                    bubbleBox.classList.remove("collapsed");
                    btnToggleWa.innerHTML = "Hide &and;";
                } else {
                    bubbleBox.classList.add("collapsed");
                    btnToggleWa.innerHTML = "Show &or;";
                }
            });
        }
    }

    getCurrentFormValues() {
        const inputDate = document.getElementById("input-qaqc-date");
        const inputTeam = document.getElementById("input-qaqc-team");
        const inputRemarks = document.getElementById("input-qaqc-remarks");

        const dateVal = inputDate ? inputDate.value : "";
        const inspectorVal = this.selectedInspector || "Helmi";
        const requestorVal = this.selectedRequestor || "Rosdi";
        const teamVal = inputTeam ? inputTeam.value.trim() : "Int 2";
        const remarksVal = inputRemarks ? inputRemarks.value.trim() : "";
        const pondVal = this.selectedPond ? this.selectedPond.pond : "01.01.07";
        const modStr = this.selectedModule ? `Module ${this.selectedModule}` : "Module 01";

        // Status is Passed ONLY if all 4 items pass
        const isPassed = this.checklist.lining && 
                         this.checklist.sump && 
                         this.checklist.pwa_autofeeder && 
                         this.checklist.jetty;
        const status = isPassed ? "PASSED" : "FAILED";

        return {
            date: dateVal,
            inspector: inspectorVal,
            requestor: requestorVal,
            team: teamVal,
            location: modStr,
            pond: pondVal,
            status: status,
            checklist: { ...this.checklist },
            remarks: remarksVal
        };
    }

    updateWhatsAppPreview() {
        const vals = this.getCurrentFormValues();
        const text = generateCleaningWhatsAppText(vals);

        const previewEl = document.getElementById("qaqc-wa-message-text");
        if (previewEl) {
            previewEl.textContent = text;
        }

        // Update date preview subtag
        const subPreview = document.getElementById("preview-formatted-date");
        if (subPreview) {
            subPreview.textContent = formatDateWithDay(vals.date);
        }

        // Update WhatsApp web links (Desktop & Mobile Dock)
        const shareLink = document.getElementById("btn-qaqc-share-wa");
        if (shareLink) {
            shareLink.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        }

        const dockShareLink = document.getElementById("btn-dock-share-wa");
        if (dockShareLink) {
            dockShareLink.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        }
    }

    async handleSaveInspection() {
        if (!this.selectedPond) {
            Toast.error("Please select a candidate pond first.");
            return;
        }

        const btnSave = document.getElementById("btn-qaqc-save");
        const btnDockSave = document.getElementById("btn-dock-save");
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.textContent = "💾 Saving...";
        }
        if (btnDockSave) {
            btnDockSave.disabled = true;
            btnDockSave.textContent = "Saving...";
        }

        try {
            const vals = this.getCurrentFormValues();
            const text = generateCleaningWhatsAppText(vals);

            const record = {
                pond_index: this.selectedPond.pond_index,
                pond: this.selectedPond.pond,
                inspection_type: "POND_CLEANING",
                inspection_date: vals.date,
                inspector_name: vals.inspector,
                requestor_name: vals.requestor,
                team: vals.team,
                status: vals.status,
                remarks: vals.remarks,
                checklist_data: vals.checklist,
                whatsapp_text: text
            };

            const result = await QaqcRepository.saveCleaningInspection(record);
            if (result.success) {
                Toast.success(`✅ Saved to ${result.source === "cloud" ? "Cloud DB" : "Local Sync"}!`);
                await this.loadPondHistory();
            } else {
                Toast.error("Could not save inspection record.");
            }
        } catch (err) {
            console.error("Save failed:", err);
            Toast.error("Error saving inspection: " + err.message);
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.textContent = "💾 Save Inspection";
            }
            if (btnDockSave) {
                btnDockSave.disabled = false;
                btnDockSave.textContent = "💾 Save";
            }
        }
    }

    handleCopyWhatsAppText() {
        const vals = this.getCurrentFormValues();
        const text = generateCleaningWhatsAppText(vals);

        const btnCopy = document.getElementById("btn-qaqc-copy-wa");
        const btnDockCopy = document.getElementById("btn-dock-copy");

        navigator.clipboard.writeText(text).then(() => {
            Toast.success("📋 WhatsApp text copied!");
            if (btnCopy) {
                const originalText = btnCopy.textContent;
                btnCopy.textContent = "✅ Copied!";
                setTimeout(() => { btnCopy.textContent = originalText; }, 2000);
            }
            if (btnDockCopy) {
                const originalDock = btnDockCopy.textContent;
                btnDockCopy.textContent = "✅ Copied!";
                setTimeout(() => { btnDockCopy.textContent = originalDock; }, 2000);
            }
        }).catch(err => {
            console.error("Clipboard copy failed:", err);
            Toast.info("Please copy text manually from preview box.");
        });
    }

    async loadPondHistory() {
        const container = document.getElementById("qaqc-history-container");
        if (!container || !this.selectedPond) return;

        container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">Loading history...</span>`;

        try {
            const history = await QaqcRepository.getCleaningHistory(this.selectedPond.pond_index);
            if (!Array.isArray(history) || history.length === 0) {
                container.innerHTML = `<p class="qaqc-empty-hint">No past cleaning records for ${this.selectedPond.pond}.</p>`;
                return;
            }

            container.innerHTML = history.slice(0, 5).map(h => {
                const isPass = h.status === "PASSED";
                const badgeClass = isPass ? "qaqc-hist-pass" : "qaqc-hist-fail";
                const badgeText = isPass ? "Passed ✅" : "Failed ❌";
                return `
                    <div class="qaqc-hist-card">
                        <div class="qaqc-hist-header">
                            <span class="qaqc-hist-date">${escapeHtml(h.inspection_date || "--")}</span>
                            <span class="qaqc-hist-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <div class="qaqc-hist-details">
                            <span>${escapeHtml(h.inspector_name || "-")}</span>
                            <span>&bull;</span>
                            <span>${escapeHtml(h.team || "-")}</span>
                        </div>
                        ${h.remarks ? `<div class="qaqc-hist-remarks"><em>"${escapeHtml(h.remarks)}"</em></div>` : ""}
                    </div>
                `;
            }).join("");
        } catch (e) {
            container.innerHTML = `<p class="qaqc-empty-hint">Logbook loaded.</p>`;
        }
    }
}
