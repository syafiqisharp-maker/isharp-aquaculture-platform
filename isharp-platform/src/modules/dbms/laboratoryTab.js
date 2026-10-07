/**
 * iSHARP DBMS 2.0 — Laboratory Tab Module (Tab 2)
 * Water chemistry telemetry, mineral balance, and PCR pathology records.
 */

import { appState } from "../../state/appState.js";
import { LabRepository } from "../../infrastructure/repositories/labRepository.js";
import { hasPermission, PERMISSIONS } from "../../config/permissions.js";
import { DOM_IDS, validateContract } from "../../config/domContracts.js";
import { evaluateParameterStatus, getWaterQualityColorClass } from "../../domain/waterQualityLimit.js";

export class LaboratoryTab {
    constructor(onOpenExcel) {
        this.onOpenExcel = onOpenExcel;
        validateContract("LaboratoryTab", DOM_IDS.LABORATORY);

        this.dom = {
            tabPane: document.getElementById(DOM_IDS.LABORATORY.TAB_PANE),
            tbodyIssues: document.getElementById(DOM_IDS.LABORATORY.TBODY_ISSUES),
            btnAddLab: document.getElementById(DOM_IDS.LABORATORY.BTN_ADD_LAB),
            tbodyWq: document.getElementById(DOM_IDS.LABORATORY.TBODY_WQ),
            kpiSalinity: document.getElementById(DOM_IDS.LABORATORY.KPI_SALINITY),
            kpiAlkalinity: document.getElementById(DOM_IDS.LABORATORY.KPI_ALKALINITY),
            kpiAmmonia: document.getElementById(DOM_IDS.LABORATORY.KPI_AMMONIA),
            kpiNitrite: document.getElementById(DOM_IDS.LABORATORY.KPI_NITRITE),
            kpiCalcium: document.getElementById(DOM_IDS.LABORATORY.KPI_CALCIUM),
            kpiMagnesium: document.getElementById(DOM_IDS.LABORATORY.KPI_MAGNESIUM),
            kpiCaMgRatio: document.getElementById(DOM_IDS.LABORATORY.KPI_CAMG_RATIO),
            kpiTurbidity: document.getElementById(DOM_IDS.LABORATORY.KPI_TURBIDITY),
            badgeWqCount: document.getElementById(DOM_IDS.LABORATORY.BADGE_WQ_COUNT),
            badgeLatestDate: document.getElementById(DOM_IDS.LABORATORY.BADGE_LATEST_DATE)
        };

        this.bindEvents();
        appState.subscribe("pondChanged", (pond) => this.render(pond));
        appState.subscribe("roleChanged", () => this.applyRolePermissions());
    }

    bindEvents() {
        if (this.dom.btnAddLab) {
            this.dom.btnAddLab.addEventListener("click", () => {
                if (this.onOpenExcel) this.onOpenExcel("issues");
            });
        }
    }

    async render(pond) {
        if (!pond || !this.dom.tabPane) return;
        this.applyRolePermissions();
        await Promise.all([
            this.loadWaterQuality(pond.pond_index),
            this.loadIssues(pond.pond_index)
        ]);
    }

    async loadWaterQuality(pondIndex) {
        if (!this.dom.tbodyWq) return;

        if (!pondIndex) {
            this.resetWqKpis();
            this.dom.tbodyWq.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding: 1.5rem;">Select a pond to view laboratory water quality records.</td></tr>`;
            return;
        }

        try {
            const data = await LabRepository.getWaterQualityByPond(pondIndex);

            if (!data || data.length === 0) {
                this.resetWqKpis();
                this.dom.tbodyWq.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding: 1.5rem;">No laboratory water quality records found for this cycle.</td></tr>`;
                return;
            }

            // Update Header Badges
            if (this.dom.badgeWqCount) this.dom.badgeWqCount.textContent = `${data.length} Records`;
            if (this.dom.badgeLatestDate) this.dom.badgeLatestDate.textContent = `Last Sample: ${data[0].log_date || '—'}`;

            // Update KPI Cards from latest sample (data[0]) via Single Source of Truth
            const latest = data[0];
            const latestRatioMultiplier = (latest.calcium && latest.magnesium && latest.calcium > 0)
                ? (latest.magnesium / latest.calcium)
                : null;
            const latestRatioText = latestRatioMultiplier !== null
                ? `1 : ${latestRatioMultiplier.toFixed(1)}`
                : '—';

            if (this.dom.kpiSalinity) {
                this.dom.kpiSalinity.textContent = latest.salinity_ppt !== null ? `${latest.salinity_ppt} ppt` : '—';
                this.dom.kpiSalinity.className = `kpi-val ${getWaterQualityColorClass("salinity", latest.salinity_ppt)}`.trim();
            }

            const alkEval = evaluateParameterStatus("alkalinity", latest.alkalinity);
            if (this.dom.kpiAlkalinity) {
                this.dom.kpiAlkalinity.textContent = latest.alkalinity !== null ? `${latest.alkalinity} mg/L` : '—';
                this.dom.kpiAlkalinity.className = `kpi-val ${getWaterQualityColorClass("alkalinity", latest.alkalinity)}`.trim();
            }

            if (this.dom.kpiAmmonia) {
                this.dom.kpiAmmonia.textContent = latest.ammonia !== null ? `${latest.ammonia} mg/L` : '—';
                this.dom.kpiAmmonia.className = `kpi-val ${getWaterQualityColorClass("ammonia", latest.ammonia)}`.trim();
            }

            if (this.dom.kpiNitrite) {
                this.dom.kpiNitrite.textContent = latest.nitrite !== null ? `${latest.nitrite} mg/L` : '—';
                this.dom.kpiNitrite.className = `kpi-val ${getWaterQualityColorClass("nitrite", latest.nitrite)}`.trim();
            }

            if (this.dom.kpiCalcium) {
                this.dom.kpiCalcium.textContent = latest.calcium !== null ? `${Math.round(latest.calcium)} mg/L` : '—';
                this.dom.kpiCalcium.className = `kpi-val ${getWaterQualityColorClass("calcium", latest.calcium)}`.trim();
            }

            if (this.dom.kpiMagnesium) {
                this.dom.kpiMagnesium.textContent = latest.magnesium !== null ? `${Math.round(latest.magnesium)} mg/L` : '—';
                this.dom.kpiMagnesium.className = `kpi-val ${getWaterQualityColorClass("magnesium", latest.magnesium)}`.trim();
            }

            if (this.dom.kpiCaMgRatio) {
                this.dom.kpiCaMgRatio.textContent = latestRatioText;
                this.dom.kpiCaMgRatio.className = `kpi-val ${getWaterQualityColorClass("camg_ratio", latestRatioMultiplier)}`.trim();
            }

            if (this.dom.kpiTurbidity) {
                this.dom.kpiTurbidity.textContent = latest.turbidity !== null ? `${latest.turbidity} NTU` : '—';
                this.dom.kpiTurbidity.className = `kpi-val ${getWaterQualityColorClass("turbidity", latest.turbidity)}`.trim();
            }

            // Render Historical Logbook Rows with dynamic SSOT font colors across all water quality parameters
            this.dom.tbodyWq.innerHTML = data.map(r => {
                const salClass = getWaterQualityColorClass("salinity", r.salinity_ppt);
                const alkClass = getWaterQualityColorClass("alkalinity", r.alkalinity);
                const nh3Class = getWaterQualityColorClass("ammonia", r.ammonia);
                const no2Class = getWaterQualityColorClass("nitrite", r.nitrite);
                const caClass = getWaterQualityColorClass("calcium", r.calcium);
                const mgClass = getWaterQualityColorClass("magnesium", r.magnesium);

                const rowRatioMultiplier = (r.calcium && r.magnesium && r.calcium > 0)
                    ? (r.magnesium / r.calcium)
                    : null;
                const ratioText = rowRatioMultiplier !== null
                    ? `1 : ${rowRatioMultiplier.toFixed(1)}`
                    : '—';
                const ratioClass = getWaterQualityColorClass("camg_ratio", rowRatioMultiplier);

                const turbClass = getWaterQualityColorClass("turbidity", r.turbidity);

                return `
                    <tr>
                        <td class="font-mono">${r.log_date || '—'}</td>
                        <td><strong>${r.doc !== null && r.doc !== undefined ? r.doc : '—'}</strong></td>
                        <td class="${salClass}">${r.salinity_ppt !== null ? r.salinity_ppt : '—'}</td>
                        <td class="${alkClass}">${r.alkalinity !== null ? r.alkalinity : '—'}</td>
                        <td class="${nh3Class}">${r.ammonia !== null ? r.ammonia : '—'}</td>
                        <td class="${no2Class}">${r.nitrite !== null ? r.nitrite : '—'}</td>
                        <td class="${caClass}">${r.calcium !== null ? Math.round(r.calcium) : '—'}</td>
                        <td class="${mgClass}">${r.magnesium !== null ? Math.round(r.magnesium) : '—'}</td>
                        <td class="${ratioClass}"><span class="font-mono">${ratioText}</span></td>
                        <td class="${turbClass}">${r.turbidity !== null ? r.turbidity : '—'}</td>
                    </tr>
                `;
            }).join("");
        } catch (err) {
            console.error("Failed to load laboratory water quality:", err);
            this.dom.tbodyWq.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Error loading water quality: ${err.message}</td></tr>`;
        }
    }

    resetWqKpis() {
        if (this.dom.badgeWqCount) this.dom.badgeWqCount.textContent = "0 Records";
        if (this.dom.badgeLatestDate) this.dom.badgeLatestDate.textContent = "Last Sample: —";
        if (this.dom.kpiSalinity) {
            this.dom.kpiSalinity.textContent = "—";
            this.dom.kpiSalinity.className = "kpi-val";
        }
        if (this.dom.kpiAlkalinity) {
            this.dom.kpiAlkalinity.textContent = "—";
            this.dom.kpiAlkalinity.className = "kpi-val";
        }
        if (this.dom.kpiAmmonia) {
            this.dom.kpiAmmonia.textContent = "—";
            this.dom.kpiAmmonia.className = "kpi-val";
        }
        if (this.dom.kpiNitrite) {
            this.dom.kpiNitrite.textContent = "—";
            this.dom.kpiNitrite.className = "kpi-val";
        }
        if (this.dom.kpiCalcium) {
            this.dom.kpiCalcium.textContent = "—";
            this.dom.kpiCalcium.className = "kpi-val";
        }
        if (this.dom.kpiMagnesium) {
            this.dom.kpiMagnesium.textContent = "—";
            this.dom.kpiMagnesium.className = "kpi-val";
        }
        if (this.dom.kpiCaMgRatio) {
            this.dom.kpiCaMgRatio.textContent = "—";
            this.dom.kpiCaMgRatio.className = "kpi-val";
        }
        if (this.dom.kpiTurbidity) {
            this.dom.kpiTurbidity.textContent = "—";
            this.dom.kpiTurbidity.className = "kpi-val";
        }
    }

    async loadIssues(pondIndex) {
        if (!this.dom.tbodyIssues) return;
        if (!pondIndex) {
            this.dom.tbodyIssues.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 1.5rem;">Select a pond to view pathology records.</td></tr>`;
            return;
        }

        try {
            const data = await LabRepository.getIssuesByPond(pondIndex);

            if (!data || data.length === 0) {
                this.dom.tbodyIssues.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 1.5rem;">No pathology issues recorded for this cycle (Pond is clean / negative).</td></tr>`;
                return;
            }

            this.dom.tbodyIssues.innerHTML = data.map(r => {
                const isRed = (r.issue_flag || "").toUpperCase() === "RED";
                const isGreen = (r.issue_flag || "").toUpperCase() === "GREEN";
                const flagClass = isRed ? "status-close text-danger font-bold" : isGreen ? "status-production font-bold" : "status-idle";

                return `
                    <tr>
                        <td class="font-mono">${r.issue_date || '—'}</td>
                        <td>${r.issue_category || 'PATHOLOGY'}</td>
                        <td><strong>${r.issue_status || '—'}</strong></td>
                        <td>${r.issue_test || '—'}</td>
                        <td><span class="status-badge ${flagClass}">${r.issue_flag || 'OK'}</span></td>
                        <td>${r.issue_grade || 'G0'}</td>
                        <td class="${isRed ? 'text-danger font-bold' : ''}">${r.issue_note || 'NEGATIVE'}</td>
                        <td>${r.remarks || '—'}</td>
                    </tr>
                `;
            }).join("");
        } catch (err) {
            console.error("Failed to load laboratory issues:", err);
            this.dom.tbodyIssues.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading issues: ${err.message}</td></tr>`;
        }
    }

    applyRolePermissions() {
        const canEdit = hasPermission(appState.userRole, PERMISSIONS.EDIT_LAB_RECORDS);
        if (!this.dom.tabPane) return;

        const inputs = this.dom.tabPane.querySelectorAll("input, select, textarea");
        inputs.forEach(inp => {
            inp.disabled = !canEdit;
            inp.style.opacity = canEdit ? "1" : "0.75";
        });
    }
}
