/**
 * iSHARP DBMS 2.0 & Field Operations — Water Quality History Modal Controller
 * Orchestrates modal lifecycle, focus trapping, body scroll locking,
 * data retrieval from LabRepository, presentation mapping, and CSV export.
 */

import { LabRepository } from "../../../infrastructure/repositories/labRepository.js";
import { downloadCsv } from "../../../utils/csvExporter.js";
import { presentWaterQualityRecords, buildWaterQualityCsvData } from "./waterQualityPresenter.js";
import { getWaterQualityModalHtml } from "./waterQualityModalTemplate.js";

export class WaterQualityHistoryModal {
    /**
     * @param {HTMLElement} [container] Mount point for the modal. Defaults to document.body.
     */
    constructor(container = null) {
        this.container = container || document.body;
        this.currentPond = null;
        this.currentRecords = [];
        this.lastFocusedElement = null;
        this.onKeyDown = this.handleKeyDown.bind(this);

        this.dom = {
            modal: null,
            pondLabel: null,
            badgeCount: null,
            badgeDate: null,
            btnExport: null,
            btnClose: null,
            btnCloseBottom: null,
            tbody: null
        };
    }

    /**
     * Ensures modal HTML is injected into the DOM.
     * @param {object} pond Cycle record
     */
    ensureMounted(pond) {
        let existing = document.getElementById("modal-field-ops-lab-wq");
        const pondLabel = pond?.pond || pond?.pond_index || "Pond";
        const cycleNo = pond?.cycle_no || "";

        if (!existing) {
            const wrapper = document.createElement("div");
            wrapper.innerHTML = getWaterQualityModalHtml(pondLabel, cycleNo);
            existing = wrapper.firstElementChild;
            this.container.appendChild(existing);
        }

        this.dom.modal = existing;
        this.dom.pondLabel = existing.querySelector("#modal-lab-wq-pond-label");
        this.dom.badgeCount = existing.querySelector("#modal-lab-wq-badge-count");
        this.dom.badgeDate = existing.querySelector("#modal-lab-wq-badge-date");
        this.dom.btnExport = existing.querySelector("#btn-export-lab-wq-csv");
        this.dom.btnClose = existing.querySelector("#btn-close-lab-wq-modal");
        this.dom.btnCloseBottom = existing.querySelector("#btn-close-lab-wq-bottom");
        this.dom.tbody = existing.querySelector("#tbody-field-ops-lab-wq");

        this.bindEvents();
    }

    /**
     * Binds user interaction listeners once.
     */
    bindEvents() {
        if (!this.dom.modal || this.dom.modal._eventsBound) return;

        if (this.dom.btnClose) {
            this.dom.btnClose.addEventListener("click", () => this.close());
        }

        if (this.dom.btnCloseBottom) {
            this.dom.btnCloseBottom.addEventListener("click", () => this.close());
        }

        this.dom.modal.addEventListener("click", (e) => {
            if (e.target === this.dom.modal) {
                this.close();
            }
        });

        if (this.dom.btnExport) {
            this.dom.btnExport.addEventListener("click", () => this.exportCsv());
        }

        this.dom.modal._eventsBound = true;
    }

    /**
     * Handles keyboard events (Escape to close, focus trapping).
     * @param {KeyboardEvent} e 
     */
    handleKeyDown(e) {
        if (e.key === "Escape") {
            this.close();
            return;
        }

        // Focus trap inside modal dialog
        if (e.key === "Tab" && this.dom.modal && this.dom.modal.style.display !== "none") {
            const focusables = this.dom.modal.querySelectorAll(
                'button:not([disabled]), [tabindex="0"]'
            );
            if (focusables.length === 0) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                last.focus();
                e.preventDefault();
            } else if (!e.shiftKey && document.activeElement === last) {
                first.focus();
                e.preventDefault();
            }
        }
    }

    /**
     * Opens the modal dialog and fetches cycle records.
     * @param {object} pond Pond cycle record
     */
    async open(pond) {
        if (!pond) return;
        this.currentPond = pond;
        this.lastFocusedElement = document.activeElement;

        this.ensureMounted(pond);

        const pondLabel = pond.pond || pond.pond_index || "Pond";
        const cycleNo = pond.cycle_no ? ` (Cycle ${pond.cycle_no})` : "";
        if (this.dom.pondLabel) {
            this.dom.pondLabel.textContent = `Pond ${pondLabel}${cycleNo}`;
        }

        // Show modal and lock background scrolling
        this.dom.modal.style.display = "flex";
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", this.onKeyDown);

        if (this.dom.btnClose) {
            this.dom.btnClose.focus();
        }

        // Display loading state
        if (this.dom.tbody) {
            this.dom.tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="padding: 2.5rem 1rem; text-align: center; color: #0284c7; font-weight: 700;">
                        <span>⏳</span> Loading full water quality cycle history...
                    </td>
                </tr>
            `;
        }

        try {
            const records = await LabRepository.getWaterQualityByPond(pond.pond_index);
            this.currentRecords = records || [];
            this.renderTable(this.currentRecords);
        } catch (err) {
            console.error("Failed to load pond water quality history:", err);
            if (this.dom.tbody) {
                this.dom.tbody.innerHTML = `
                    <tr>
                        <td colspan="10" style="padding: 2.5rem 1rem; text-align: center; color: #b91c1c; font-weight: 700;">
                            Failed to load laboratory water quality records: ${err.message || 'Network error'}
                        </td>
                    </tr>
                `;
            }
        }
    }

    /**
     * Renders records into the table body.
     * @param {Array<object>} records 
     */
    renderTable(records) {
        if (!this.dom.tbody) return;

        const count = records.length;
        if (this.dom.badgeCount) {
            this.dom.badgeCount.textContent = `${count} Record${count === 1 ? '' : 's'}`;
        }

        const latestDate = count > 0 && records[0].log_date ? records[0].log_date : "—";
        if (this.dom.badgeDate) {
            this.dom.badgeDate.textContent = `Last Sample: ${latestDate}`;
        }

        if (count === 0) {
            this.dom.tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="padding: 2.5rem 1rem; text-align: center; color: #64748b; font-style: italic;">
                        No laboratory water quality records found for this pond cycle.
                    </td>
                </tr>
            `;
            return;
        }

        const viewModels = presentWaterQualityRecords(records);

        this.dom.tbody.innerHTML = viewModels.map((row, idx) => {
            const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
            return `
                <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0; text-align: center; transition: background 0.1s ease;">
                    <td style="padding: 0.6rem 0.75rem; text-align: left; font-family: var(--font-mono, monospace); font-weight: 700; color: #0f172a; border-right: 1px solid #f1f5f9;">
                        ${row.logDate}
                    </td>
                    <td style="padding: 0.6rem 0.5rem; font-weight: 900; color: #0284c7; border-right: 1px solid #f1f5f9;">
                        ${row.doc}
                    </td>
                    <td class="${row.salClass}" style="padding: 0.6rem 0.6rem; font-family: var(--font-mono, monospace); font-weight: 700; border-right: 1px solid #f1f5f9;">
                        ${row.salinity}
                    </td>
                    <td class="${row.alkClass}" style="padding: 0.6rem 0.6rem; font-family: var(--font-mono, monospace); font-weight: 700; border-right: 1px solid #f1f5f9;">
                        ${row.alkalinity}
                    </td>
                    <td class="${row.nh3Class}" style="padding: 0.6rem 0.6rem; font-family: var(--font-mono, monospace); font-weight: 700; border-right: 1px solid #f1f5f9;">
                        ${row.ammonia}
                    </td>
                    <td class="${row.no2Class}" style="padding: 0.6rem 0.6rem; font-family: var(--font-mono, monospace); font-weight: 700; border-right: 1px solid #f1f5f9;">
                        ${row.nitrite}
                    </td>
                    <td class="${row.caClass}" style="padding: 0.6rem 0.6rem; font-family: var(--font-mono, monospace); font-weight: 700; border-right: 1px solid #f1f5f9;">
                        ${row.calcium}
                    </td>
                    <td class="${row.mgClass}" style="padding: 0.6rem 0.6rem; font-family: var(--font-mono, monospace); font-weight: 700; border-right: 1px solid #f1f5f9;">
                        ${row.magnesium}
                    </td>
                    <td class="${row.ratioClass}" style="padding: 0.6rem 0.6rem; font-family: var(--font-mono, monospace); font-weight: 800; border-right: 1px solid #f1f5f9;">
                        ${row.ratioText}
                    </td>
                    <td class="${row.turbClass}" style="padding: 0.6rem 0.6rem; font-family: var(--font-mono, monospace); font-weight: 700;">
                        ${row.turbidity}
                    </td>
                </tr>
            `;
        }).join("");
    }

    /**
     * Exports the current records as an RFC-4180 UTF-8 BOM CSV.
     */
    exportCsv() {
        if (!this.currentRecords || this.currentRecords.length === 0) {
            alert("No water quality records available to export.");
            return;
        }

        const pondLabel = this.currentPond?.pond || this.currentPond?.pond_index || "Pond";
        const { filename, headers, rows } = buildWaterQualityCsvData(pondLabel, this.currentRecords);
        downloadCsv(filename, headers, rows);
    }

    /**
     * Closes the modal and restores background state.
     */
    close() {
        if (!this.dom.modal) return;
        this.dom.modal.style.display = "none";
        document.body.style.overflow = "";
        document.removeEventListener("keydown", this.onKeyDown);

        if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === "function") {
            this.lastFocusedElement.focus();
        }
    }
}
