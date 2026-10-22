/**
 * iSHARP QA/QC Inspection Module Controller
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
    generateCleaningWhatsAppText
} from "../../domain/qaqcWhatsAppFormatter.js";
import { Toast } from "../../components/Toast.js";
import { appState } from "../../state/appState.js";

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
            { id: "btn-qaqc-sec-readiness", name: "Pond Stocking Readiness" },
            { id: "btn-qaqc-sec-stocking", name: "Stocking Event Inspection" },
            { id: "btn-qaqc-sec-mortality", name: "Mortality Report" },
            { id: "btn-qaqc-sec-preharvest", name: "Pre-Harvest Inspection" },
            { id: "btn-qaqc-sec-postharvest", name: "Post-Harvest Audit" }
        ];

        placeholders.forEach(sec => {
            const el = document.getElementById(sec.id);
            if (el) {
                el.addEventListener("click", () => {
                    Toast.info(`📋 ${sec.name} module is currently under development for next phase.`);
                });
            }
        });
    }

    async openCleaningForm() {
        if (!this.container) return;
        this.currentViewMode = "CLEANING_FORM";
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
                .map(s => `<option value="${s.staff_name}">${s.staff_no ? `[${s.staff_no}] ` : ""}${s.staff_position || ""}</option>`)
                .join("");
        } catch (e) {
            console.warn("Could not populate staff datalist:", e);
        }
    }

    async loadPondTree() {
        const modSelect = document.getElementById("select-qaqc-module");
        if (!modSelect) return;

        modSelect.innerHTML = `<option value="">Loading non-production ponds...</option>`;

        try {
            this.candidatePonds = await QaqcRepository.getCandidateCleaningPonds();
            this.tree = buildHierarchicalPondTree(this.candidatePonds);
            
            const modules = Object.keys(this.tree).sort();
            if (modules.length === 0) {
                modSelect.innerHTML = `<option value="">No non-production ponds available</option>`;
                return;
            }

            modSelect.innerHTML = modules
                .map(m => {
                    // Count total available non-production ponds in module
                    let count = 0;
                    Object.keys(this.tree[m]).forEach(r => { count += this.tree[m][r].length; });
                    return `<option value="${m}">Module ${m} (${count} ponds idle/cleaning)</option>`;
                })
                .join("");

            // Select first module by default
            this.selectedModule = modules[0];
            modSelect.value = this.selectedModule;
            this.handleModuleChange(this.selectedModule);
        } catch (err) {
            console.error("Error loading candidate cleaning ponds:", err);
            modSelect.innerHTML = `<option value="">Error loading ponds</option>`;
        }
    }

    handleModuleChange(modl) {
        this.selectedModule = modl;
        const rowSelect = document.getElementById("select-qaqc-row");
        const pondSelect = document.getElementById("select-qaqc-pond");
        if (!rowSelect || !pondSelect) return;

        if (!modl || !this.tree[modl]) {
            rowSelect.disabled = true;
            rowSelect.innerHTML = `<option value="">Select Module first</option>`;
            pondSelect.disabled = true;
            pondSelect.innerHTML = `<option value="">Select Row first</option>`;
            return;
        }

        const rows = Object.keys(this.tree[modl]).sort();
        if (rows.length === 0) {
            rowSelect.disabled = true;
            rowSelect.innerHTML = `<option value="">No rows available</option>`;
            return;
        }

        rowSelect.disabled = false;
        rowSelect.innerHTML = rows
            .map(r => {
                const count = this.tree[modl][r].length;
                return `<option value="${r}">Row ${r} (${count} ponds)</option>`;
            })
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
            pondSelect.innerHTML = `<option value="">Select Row first</option>`;
            return;
        }

        const ponds = this.tree[modl][rowNo];
        if (ponds.length === 0) {
            pondSelect.disabled = true;
            pondSelect.innerHTML = `<option value="">No candidate ponds</option>`;
            return;
        }

        pondSelect.disabled = false;
        pondSelect.innerHTML = ponds
            .map(p => {
                const idleInfo = p.idle_days ? ` (${p.idle_days}d idle)` : "";
                return `<option value="${p.pond}">${p.pond} &bull; ${p.pond_status}${idleInfo}</option>`;
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

        // Update context bar
        const ctxBar = document.getElementById("qaqc-pond-context-bar");
        if (ctxBar && this.selectedPond) {
            ctxBar.classList.remove("hidden");
            const rawPond = formatRawPondCode(this.selectedPond.pond);
            document.getElementById("ctx-pond-code").textContent = `${this.selectedPond.pond} (${rawPond})`;
            document.getElementById("ctx-cycle-no").textContent = this.selectedPond.cycle_no || "--";
            document.getElementById("ctx-pond-index").textContent = this.selectedPond.pond_index || "--";
            document.getElementById("ctx-pond-status").textContent = this.selectedPond.pond_status || "IDLE";
            document.getElementById("ctx-idle-days").textContent = this.selectedPond.idle_days ? `${this.selectedPond.idle_days} days` : "Just drained";
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

        // Inspector input change & quick chips
        const inputInspector = document.getElementById("input-qaqc-inspector");
        if (inputInspector) {
            inputInspector.addEventListener("input", () => this.updateWhatsAppPreview());
        }

        document.querySelectorAll("[data-set-inspector]").forEach(btn => {
            btn.addEventListener("click", () => {
                const name = btn.getAttribute("data-set-inspector");
                if (inputInspector) {
                    inputInspector.value = name;
                    this.updateWhatsAppPreview();
                }
            });
        });

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
        document.querySelectorAll(".qaqc-toggle-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const item = btn.getAttribute("data-toggle");
                const val = btn.getAttribute("data-val") === "true";
                
                // Update button styles in pair
                const parent = btn.parentElement;
                parent.querySelectorAll(".qaqc-toggle-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                // Update checklist state
                this.checklist[item] = val;

                // Update item status badge
                const badge = document.getElementById(`badge-chk-${item}`);
                if (badge) {
                    if (val) {
                        badge.className = "qaqc-item-state-badge pass";
                        badge.textContent = "Passed ✅";
                    } else {
                        badge.className = "qaqc-item-state-badge fail";
                        badge.textContent = "Failed ❌";
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
                        badge.className = "qaqc-item-state-badge pass";
                        badge.textContent = "Passed ✅";
                    }
                    const row = document.querySelector(`.qaqc-chk-item[data-item="${item}"]`);
                    if (row) {
                        row.querySelectorAll(".qaqc-toggle-btn").forEach(b => {
                            if (b.getAttribute("data-val") === "true") b.classList.add("active");
                            else b.classList.remove("active");
                        });
                    }
                });
                Toast.success("All 4 checklist items set to Passed ✅");
                this.updateWhatsAppPreview();
            });
        }

        // Defect Remark Preset Chips
        document.querySelectorAll(".qaqc-remark-chip").forEach(btn => {
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

        // Action: Save to Database
        const btnSave = document.getElementById("btn-qaqc-save");
        if (btnSave) {
            btnSave.addEventListener("click", () => this.handleSaveInspection());
        }

        // Action: Copy WhatsApp Message
        const btnCopyWa = document.getElementById("btn-qaqc-copy-wa");
        if (btnCopyWa) {
            btnCopyWa.addEventListener("click", () => this.handleCopyWhatsAppText());
        }
    }

    getCurrentFormValues() {
        const inputDate = document.getElementById("input-qaqc-date");
        const inputInspector = document.getElementById("input-qaqc-inspector");
        const inputTeam = document.getElementById("input-qaqc-team");
        const inputRemarks = document.getElementById("input-qaqc-remarks");

        const dateVal = inputDate ? inputDate.value : "";
        const inspectorVal = inputInspector ? inputInspector.value.trim() : "Rosdi";
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
            requestor: inspectorVal,
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

        // Update WhatsApp web link
        const shareLink = document.getElementById("btn-qaqc-share-wa");
        if (shareLink) {
            shareLink.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        }
    }

    async handleSaveInspection() {
        if (!this.selectedPond) {
            Toast.error("Please select a candidate pond first.");
            return;
        }

        const btnSave = document.getElementById("btn-qaqc-save");
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.textContent = "💾 Saving to Database...";
        }

        try {
            const vals = this.getCurrentFormValues();
            const text = generateCleaningWhatsAppText(vals);

            const record = {
                pond_index: this.selectedPond.pond_index,
                pond: this.selectedPond.pond,
                inspection_type: "POND_CLEANING",
                inspection_date: vals.date,
                inspector_name: vals.requestor,
                team: vals.team,
                status: vals.status,
                remarks: vals.remarks,
                checklist_data: vals.checklist,
                whatsapp_text: text
            };

            const result = await QaqcRepository.saveCleaningInspection(record);
            if (result.success) {
                Toast.success(`✅ Inspection saved successfully (${result.source === "cloud" ? "Cloud DB" : "Local Sync"})!`);
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
                btnSave.textContent = "💾 Save Inspection to Database";
            }
        }
    }

    handleCopyWhatsAppText() {
        const vals = this.getCurrentFormValues();
        const text = generateCleaningWhatsAppText(vals);

        const btnCopy = document.getElementById("btn-qaqc-copy-wa");
        navigator.clipboard.writeText(text).then(() => {
            Toast.success("📋 WhatsApp broadcast text copied to clipboard!");
            if (btnCopy) {
                const originalText = btnCopy.textContent;
                btnCopy.textContent = "✅ Copied to Clipboard!";
                setTimeout(() => {
                    btnCopy.textContent = originalText;
                }, 2000);
            }
        }).catch(err => {
            console.error("Clipboard copy failed:", err);
            Toast.info("Please copy text manually from preview box.");
        });
    }

    async loadPondHistory() {
        const container = document.getElementById("qaqc-history-container");
        if (!container || !this.selectedPond) return;

        container.innerHTML = `<span style="font-size: 0.85rem; color: #64748b;">Loading inspection logbook...</span>`;

        try {
            const history = await QaqcRepository.getCleaningHistory(this.selectedPond.pond_index);
            if (!Array.isArray(history) || history.length === 0) {
                container.innerHTML = `<p class="qaqc-empty-hint">No previous cleaning inspections recorded for ${this.selectedPond.pond}.</p>`;
                return;
            }

            container.innerHTML = history.map(h => {
                const isPass = h.status === "PASSED";
                const badgeClass = isPass ? "qaqc-hist-pass" : "qaqc-hist-fail";
                const badgeText = isPass ? "Passed ✅" : "Failed ❌";
                return `
                    <div class="qaqc-hist-card">
                        <div class="qaqc-hist-header">
                            <span class="qaqc-hist-date">${h.inspection_date || "--"}</span>
                            <span class="qaqc-hist-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <div class="qaqc-hist-details">
                            <span><strong>Inspector:</strong> ${h.inspector_name || "-"}</span>
                            <span><strong>Team:</strong> ${h.team || "-"}</span>
                        </div>
                        ${h.remarks ? `<div class="qaqc-hist-remarks"><em>"${h.remarks}"</em></div>` : ""}
                    </div>
                `;
            }).join("");
        } catch (e) {
            container.innerHTML = `<p class="qaqc-empty-hint">Logbook loaded.</p>`;
        }
    }
}
