/**
 * iSHARP Platform — Management Info Audit & WhatsApp Callout Modal
 * 
 * Accessible across the entire platform (Executive Dashboard & Field Operations 24-Pond Map).
 * Allows managers to:
 * 1. View farm-wide or module-specific operational pond management compliance.
 * 2. Identify ponds missing Core Field Crew (Supervisor, Row Leader, Pond Operator),
 *    Paddlewheel Aerators (Total HP > 0), or Feed Trays/Autofeeders & Hut condition.
 * 3. Copy a formatted WhatsApp Supervisor Callout message with 1 click.
 * 4. Jump directly to ManagementEntryPage for any unupdated pond.
 */

import { supabase } from "../infrastructure/supabase.js";
import { StaffRepository } from "../infrastructure/repositories/staffRepository.js";
import {
    summarizeModuleManagementCompliance,
    formatWeeklyManagementCalloutWhatsApp
} from "../domain/managementCompliance.js";
import { Toast } from "./Toast.js";
import { DOM_IDS } from "../config/domContracts.js";

export class ManagementCalloutModal {
    static _instance = null;

    static getInstance() {
        if (!this._instance) {
            this._instance = new ManagementCalloutModal();
        }
        return this._instance;
    }

    /**
     * Opens the modal.
     * @param {object} options
     * @param {string|number} [options.initialModule="ALL"] E.g. "ALL" or 1..9 or "04"
     * @param {Function} [options.onNavigateToPond=null] Callback to open pond management in Field Ops
     */
    static async open(options = {}) {
        const modal = this.getInstance();
        await modal.show(options);
    }

    constructor() {
        this.container = null;
        this.currentModule = "ALL";
        this.pendingOnly = true;
        this.summaryData = null;
        this.onNavigateToPond = null;
        this.isLoading = false;

        this.injectModalDom();
    }

    injectModalDom() {
        let el = document.getElementById(DOM_IDS.MANAGEMENT_CALLOUT?.MODAL || "modal-mgmt-callout");
        if (!el) {
            el = document.createElement("div");
            el.id = DOM_IDS.MANAGEMENT_CALLOUT?.MODAL || "modal-mgmt-callout";
            el.className = "mgmt-callout-modal-overlay";
            el.style.display = "none";
            document.body.appendChild(el);
        }
        this.container = el;
    }

    async show({ initialModule = "ALL", onNavigateToPond = null } = {}) {
        this.currentModule = initialModule === "ALL" ? "ALL" : String(initialModule).padStart(2, "0");
        this.onNavigateToPond = onNavigateToPond;
        this.container.style.display = "flex";
        document.body.style.overflow = "hidden";

        this.renderShell();
        this.bindShellEvents();
        await this.loadData();
    }

    close() {
        if (this.container) {
            this.container.style.display = "none";
            document.body.style.overflow = "";
        }
    }

    renderShell() {
        this.container.innerHTML = `
            <div class="mgmt-callout-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="mgmt-callout-title">
                
                <!-- Header -->
                <header class="mgmt-modal-header">
                    <div class="mgmt-modal-header-left">
                        <div class="mgmt-modal-icon">📋</div>
                        <div>
                            <h2 id="mgmt-callout-title" class="mgmt-modal-title">Weekly Pond Management Audit &amp; Supervisor Callout</h2>
                            <p class="mgmt-modal-sub">Blue Archipelago Berhad • Operational Pond Compliance Verification</p>
                        </div>
                    </div>
                    <button type="button" class="btn-mgmt-modal-close" id="${DOM_IDS.MANAGEMENT_CALLOUT?.BTN_CLOSE || 'btn-close-mgmt-callout'}" aria-label="Close Modal">✕</button>
                </header>

                <!-- Filter Controls Toolbar -->
                <div class="mgmt-modal-toolbar">
                    <div class="mgmt-toolbar-group">
                        <label for="${DOM_IDS.MANAGEMENT_CALLOUT?.SELECT_MODULE || 'select-mgmt-callout-module'}" class="mgmt-toolbar-label">Module:</label>
                        <select id="${DOM_IDS.MANAGEMENT_CALLOUT?.SELECT_MODULE || 'select-mgmt-callout-module'}" class="mgmt-select">
                            <option value="ALL">All Modules (01–09)</option>
                            <option value="01">Module 01</option>
                            <option value="02">Module 02</option>
                            <option value="03">Module 03</option>
                            <option value="04">Module 04</option>
                            <option value="05">Module 05</option>
                            <option value="06">Module 06</option>
                            <option value="07">Module 07</option>
                            <option value="08">Module 08</option>
                            <option value="09">Module 09</option>
                        </select>

                        <label class="mgmt-checkbox-label">
                            <input type="checkbox" id="${DOM_IDS.MANAGEMENT_CALLOUT?.FILTER_PENDING_ONLY || 'check-mgmt-callout-pending'}" ${this.pendingOnly ? "checked" : ""} />
                            <span>Show Incomplete Ponds Only</span>
                        </label>
                    </div>

                    <div class="mgmt-toolbar-group right">
                        <button type="button" class="btn-mgmt-action btn-copy-wa" id="${DOM_IDS.MANAGEMENT_CALLOUT?.BTN_COPY_WHATSAPP || 'btn-mgmt-copy-whatsapp'}">
                            <span>📋 Copy WhatsApp Callout</span>
                        </button>
                        <button type="button" class="btn-mgmt-action btn-open-wa" id="${DOM_IDS.MANAGEMENT_CALLOUT?.BTN_OPEN_WHATSAPP || 'btn-mgmt-open-whatsapp'}" title="Send directly to WhatsApp">
                            <span>📲 Open WhatsApp</span>
                        </button>
                    </div>
                </div>

                <!-- KPI Quick Strip -->
                <div class="mgmt-kpi-strip" id="mgmt-kpi-mount">
                    <div class="mgmt-kpi-box">
                        <span class="mgmt-kpi-val" id="kpi-mgmt-operational">--</span>
                        <span class="mgmt-kpi-lbl">Operational Ponds</span>
                    </div>
                    <div class="mgmt-kpi-box kpi-success">
                        <span class="mgmt-kpi-val" id="kpi-mgmt-compliant">--</span>
                        <span class="mgmt-kpi-lbl">✅ Fully Updated</span>
                    </div>
                    <div class="mgmt-kpi-box kpi-warning">
                        <span class="mgmt-kpi-val" id="kpi-mgmt-partial">--</span>
                        <span class="mgmt-kpi-lbl">⚠️ Partial Info</span>
                    </div>
                    <div class="mgmt-kpi-box kpi-danger">
                        <span class="mgmt-kpi-val" id="kpi-mgmt-missing">--</span>
                        <span class="mgmt-kpi-lbl">❌ Unupdated</span>
                    </div>
                    <div class="mgmt-kpi-box kpi-highlight">
                        <span class="mgmt-kpi-val" id="kpi-mgmt-rate">--%</span>
                        <span class="mgmt-kpi-lbl">Compliance Rate</span>
                    </div>
                </div>

                <!-- Main Content Body: Scrollable Table & Collapsible WhatsApp Message -->
                <div class="mgmt-modal-body" id="mgmt-modal-body-mount">
                    <div class="mgmt-loading-state">
                        <div class="spinner-sm"></div>
                        <span>Evaluating operational pond management status from Supabase...</span>
                    </div>
                </div>

            </div>
        `;

        // Set initial select value
        const select = this.container.querySelector(`#${DOM_IDS.MANAGEMENT_CALLOUT?.SELECT_MODULE || 'select-mgmt-callout-module'}`);
        if (select) select.value = this.currentModule;
    }

    bindShellEvents() {
        const btnClose = this.container.querySelector(`#${DOM_IDS.MANAGEMENT_CALLOUT?.BTN_CLOSE || 'btn-close-mgmt-callout'}`);
        if (btnClose) {
            btnClose.addEventListener("click", () => this.close());
        }

        // Close on clicking backdrop outside dialog
        this.container.addEventListener("click", (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === "Escape" && this.container.style.display !== "none") {
                this.close();
                document.removeEventListener("keydown", escHandler);
            }
        };
        document.addEventListener("keydown", escHandler);

        // Filter Controls
        const select = this.container.querySelector(`#${DOM_IDS.MANAGEMENT_CALLOUT?.SELECT_MODULE || 'select-mgmt-callout-module'}`);
        if (select) {
            select.addEventListener("change", (e) => {
                this.currentModule = e.target.value;
                this.renderContent();
            });
        }

        const checkbox = this.container.querySelector(`#${DOM_IDS.MANAGEMENT_CALLOUT?.FILTER_PENDING_ONLY || 'check-mgmt-callout-pending'}`);
        if (checkbox) {
            checkbox.addEventListener("change", (e) => {
                this.pendingOnly = e.target.checked;
                this.renderContent();
            });
        }

        // WhatsApp Copy Button
        const btnCopy = this.container.querySelector(`#${DOM_IDS.MANAGEMENT_CALLOUT?.BTN_COPY_WHATSAPP || 'btn-mgmt-copy-whatsapp'}`);
        if (btnCopy) {
            btnCopy.addEventListener("click", () => this.copyWhatsAppText());
        }

        // WhatsApp Open Button
        const btnOpen = this.container.querySelector(`#${DOM_IDS.MANAGEMENT_CALLOUT?.BTN_OPEN_WHATSAPP || 'btn-mgmt-open-whatsapp'}`);
        if (btnOpen) {
            btnOpen.addEventListener("click", () => this.openWhatsAppDirect());
        }
    }

    async loadData() {
        this.isLoading = true;
        try {
            const [cyclesRes, invRes, staffRes] = await Promise.all([
                supabase.request("view_growout_pond_cycles?pond_status=eq.PRODUCTION&pond_active=eq.ACTIVE&order=pond_index.desc&select=pond_index,pond,modl,row_no,cycle_no,crop_no,pond_status,pond_active,stck_date,date_close,area,aerator_1hp,aerator_2hp,stck_species,pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no").catch(() => []),
                supabase.request("pond_inventories?select=pond_index,feeding_tray_count,autofeeder_count,hut_condition,notes,updated_at").catch(() => []),
                StaffRepository.getStaffDirectory().catch(() => [])
            ]);

            const cycles = Array.isArray(cyclesRes) ? cyclesRes : [];
            const inventories = Array.isArray(invRes) ? invRes : [];

            this.summaryData = summarizeModuleManagementCompliance(cycles, inventories, staffRes);
            this.renderContent();
        } catch (err) {
            console.error("ManagementCalloutModal load error:", err);
            const mount = this.container.querySelector("#mgmt-modal-body-mount");
            if (mount) {
                mount.innerHTML = `
                    <div class="mgmt-error-box">
                        <span>⚠️ Failed to load pond management data: ${err.message || 'Network error'}</span>
                    </div>
                `;
            }
        } finally {
            this.isLoading = false;
        }
    }

    renderContent() {
        if (!this.summaryData) return;

        const isAll = this.currentModule === "ALL";
        const targetModules = isAll
            ? this.summaryData.modules
            : this.summaryData.modules.filter(m => m.module === this.currentModule);

        // Calculate active KPI totals for current view
        let totalOp = 0;
        let completeOp = 0;
        let partialOp = 0;
        let missingOp = 0;

        targetModules.forEach(m => {
            totalOp += m.totalOperational;
            completeOp += m.completedCount;
            partialOp += m.partialCount;
            missingOp += m.missingCount;
        });

        const rate = totalOp > 0 ? Math.round((completeOp / totalOp) * 100) : 0;

        // Update KPIs
        const kpiOp = this.container.querySelector("#kpi-mgmt-operational");
        const kpiComp = this.container.querySelector("#kpi-mgmt-compliant");
        const kpiPart = this.container.querySelector("#kpi-mgmt-partial");
        const kpiMiss = this.container.querySelector("#kpi-mgmt-missing");
        const kpiRate = this.container.querySelector("#kpi-mgmt-rate");

        if (kpiOp) kpiOp.textContent = totalOp;
        if (kpiComp) kpiComp.textContent = completeOp;
        if (kpiPart) kpiPart.textContent = partialOp;
        if (kpiMiss) kpiMiss.textContent = missingOp;
        if (kpiRate) kpiRate.textContent = `${rate}%`;

        // Flatten ponds for the table
        let displayedPonds = [];
        targetModules.forEach(m => {
            m.ponds.forEach(p => {
                displayedPonds.push({
                    module: m.module,
                    ...p
                });
            });
        });

        if (this.pendingOnly) {
            displayedPonds = displayedPonds.filter(p => p.evaluation.status !== "COMPLETE");
        }

        const bodyMount = this.container.querySelector("#mgmt-modal-body-mount");
        if (!bodyMount) return;

        const waText = formatWeeklyManagementCalloutWhatsApp(this.summaryData, {
            filterModule: this.currentModule
        });

        bodyMount.innerHTML = `
            <div class="mgmt-content-split">
                
                <!-- Left: Compliance Table -->
                <div class="mgmt-table-section">
                    <div class="mgmt-section-header">
                        <span class="mgmt-section-title">
                            Operational Ponds Matrix (${displayedPonds.length} ${this.pendingOnly ? 'Pending Action' : 'Total'})
                        </span>
                        <span class="mgmt-section-badge ${rate === 100 ? 'badge-ok' : 'badge-alert'}">
                            ${rate === 100 ? '✅ 100% Complete' : `⚠️ ${totalOp - completeOp} Ponds Incomplete`}
                        </span>
                    </div>

                    <div class="mgmt-table-wrapper">
                        <table class="mgmt-table">
                            <thead>
                                <tr>
                                    <th>Pond &amp; Cycle</th>
                                    <th>Status</th>
                                    <th>Core Staff (SV / RL / PO)</th>
                                    <th>Aerators (1HP / 2HP)</th>
                                    <th>Inventory (Trays / Hut)</th>
                                    <th style="text-align: right;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="${DOM_IDS.MANAGEMENT_CALLOUT?.TABLE_BODY || 'tbody-mgmt-callout'}">
                                ${displayedPonds.length === 0 ? `
                                    <tr>
                                        <td colspan="6" style="text-align: center; padding: 2rem; color: #059669; font-weight: 700;">
                                            🎉 Excellent! All operational ponds in this selection have complete management info.
                                        </td>
                                    </tr>
                                ` : displayedPonds.map(p => this.renderTableRow(p)).join("")}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Right / Bottom: WhatsApp Broadcast Preview -->
                <div class="mgmt-wa-section">
                    <div class="mgmt-section-header">
                        <span class="mgmt-section-title">📲 WhatsApp Broadcast Message Preview</span>
                        <button type="button" class="btn-copy-wa-sm" id="btn-copy-wa-inline">📋 Copy Text</button>
                    </div>
                    <pre class="mgmt-wa-preview" id="${DOM_IDS.MANAGEMENT_CALLOUT?.WHATSAPP_PREVIEW || 'mgmt-callout-whatsapp-preview'}">${this.escapeHtml(waText)}</pre>
                </div>

            </div>
        `;

        // Bind table action buttons
        bodyMount.querySelectorAll(".btn-mgmt-edit-pond").forEach(btn => {
            btn.addEventListener("click", () => {
                const pondIndex = btn.dataset.pondIndex;
                const pondLabel = btn.dataset.pondLabel;
                const pondItem = displayedPonds.find(p => p.cycle?.pond_index === pondIndex || p.evaluation?.pondLabel === pondLabel);
                if (pondItem) {
                    this.handleNavigateToPond(pondItem.cycle);
                }
            });
        });

        const btnCopyInline = bodyMount.querySelector("#btn-copy-wa-inline");
        if (btnCopyInline) {
            btnCopyInline.addEventListener("click", () => this.copyWhatsAppText());
        }
    }

    renderTableRow(p) {
        const ev = p.evaluation;
        const cy = p.cycle;

        let statusBadge = "";
        if (ev.status === "COMPLETE") {
            statusBadge = `<span class="badge-status-complete">✅ Complete</span>`;
        } else if (ev.status === "PARTIAL") {
            statusBadge = `<span class="badge-status-partial">⚠️ Partial</span>`;
        } else {
            statusBadge = `<span class="badge-status-missing">❌ Missing</span>`;
        }

        // Staff formatting
        const svName = ev.staffSummary.sv || "None";
        const rlName = ev.staffSummary.rl || "None";
        const poName = ev.staffSummary.po || "None";
        const staffValidClass = ev.hasValidCoreStaff ? "text-success" : "text-danger";

        // Aerator formatting
        const hpText = `${ev.aeratorSummary.units1hp}×1HP + ${ev.aeratorSummary.units2hp}×2HP = ${ev.aeratorSummary.totalHP} HP`;
        const aeratorValidClass = ev.hasValidAerators ? "text-success" : "text-danger";

        // Inventory formatting
        const invText = `Trays: ${ev.inventorySummary.feedingTrayCount} • Feeders: ${ev.inventorySummary.autofeederCount} • Hut: ${ev.inventorySummary.hutCondition}`;
        const invValidClass = ev.hasValidInventory ? "text-success" : "text-danger";

        return `
            <tr class="mgmt-row ${ev.status.toLowerCase()}">
                <td>
                    <div class="mgmt-pond-code">${ev.pondLabel}</div>
                    <div class="mgmt-pond-sub">Mod ${p.module} • C${cy.cycle_no || cy.pond_index?.split('.')[1] || '—'} • ${cy.stck_species || 'VAN'}</div>
                </td>
                <td>${statusBadge}</td>
                <td>
                    <div class="${staffValidClass}" style="font-weight: 700; font-size: 0.78rem;">
                        ${ev.hasValidCoreStaff ? '✅ Core Crew Assigned' : '⚠️ Missing/Invalid Core Crew'}
                    </div>
                    <div class="mgmt-detail-sub" title="SV: ${svName} | RL: ${rlName} | PO: ${poName}">
                        SV: ${svName} • RL: ${rlName} • PO: ${poName}
                    </div>
                </td>
                <td>
                    <div class="${aeratorValidClass}" style="font-weight: 700; font-size: 0.78rem;">
                        ${ev.hasValidAerators ? `✅ ${ev.aeratorSummary.totalHP} HP Active` : '❌ 0 HP Aeration'}
                    </div>
                    <div class="mgmt-detail-sub">${hpText}</div>
                </td>
                <td>
                    <div class="${invValidClass}" style="font-weight: 700; font-size: 0.78rem;">
                        ${ev.hasValidInventory ? '✅ Equipment & Hut Recorded' : '⚠️ Inventory Incomplete'}
                    </div>
                    <div class="mgmt-detail-sub">${invText}</div>
                </td>
                <td style="text-align: right;">
                    <button type="button" class="btn-mgmt-edit-pond" data-pond-index="${cy.pond_index}" data-pond-label="${ev.pondLabel}" title="Open Management Entry Page">
                        ✏️ Update
                    </button>
                </td>
            </tr>
        `;
    }

    handleNavigateToPond(cycleRecord) {
        this.close();
        if (typeof this.onNavigateToPond === "function") {
            this.onNavigateToPond(cycleRecord);
        } else {
            // Default: dispatch custom event or route to Field Ops
            window.dispatchEvent(new CustomEvent("navigate-field-ops-pond", {
                detail: { cycleRecord, openManagement: true }
            }));
        }
    }

    getGeneratedWhatsAppText() {
        if (!this.summaryData) return "";
        return formatWeeklyManagementCalloutWhatsApp(this.summaryData, {
            filterModule: this.currentModule
        });
    }

    async copyWhatsAppText() {
        const text = this.getGeneratedWhatsAppText();
        if (!text) return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            Toast.success("WhatsApp Callout message copied to clipboard!");
        } catch (err) {
            console.error("Clipboard copy error:", err);
            Toast.info("Selected text ready. Please use Ctrl+C to copy.");
        }
    }

    openWhatsAppDirect() {
        const text = this.getGeneratedWhatsAppText();
        if (!text) return;
        const encoded = encodeURIComponent(text);
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
    }

    escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
