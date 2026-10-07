/**
 * iSHARP DBMS 2.0 — Master KPI Banner Component
 * Displays selected pond callout bubble, cycle number, DOC, area, total HP, and status.
 */

import { appState } from "../state/appState.js";
import { calculateDOC } from "../domain/biometrics.js";
import { formatPondLabel, evaluateBiosecurityStatus } from "../domain/rollover.js";
import { PondRepository } from "../infrastructure/repositories/pondRepository.js";
import { LabRepository } from "../infrastructure/repositories/labRepository.js";
import { DOM_IDS } from "../config/domContracts.js";

export class MasterBanner {
    constructor(onSelectCycle) {
        this.onSelectCycle = onSelectCycle;
        this.dom = {
            badgePondIndex: document.getElementById(DOM_IDS.BANNER.BADGE_POND_INDEX),
            badgePondLabel: document.getElementById(DOM_IDS.BANNER.BADGE_POND_LABEL),
            badgePondStatus: document.getElementById(DOM_IDS.BANNER.BADGE_POND_STATUS),
            badgePondActive: document.getElementById(DOM_IDS.BANNER.BADGE_POND_ACTIVE),
            badgeSpecies: document.getElementById(DOM_IDS.BANNER.BADGE_SPECIES) || document.getElementById("snap-species"),
            badgeGenetic: document.getElementById(DOM_IDS.BANNER.BADGE_GENETIC) || document.getElementById("snap-genetic"),
            badgeCycleNo: document.getElementById("badge-cycle-no"),
            selectCycleHistory: document.getElementById(DOM_IDS.NAV.CYCLE_HISTORY),
            badgeCropNo: document.getElementById("badge-crop-no"),
            badgeDoc: document.getElementById(DOM_IDS.BANNER.BADGE_DOC),
            badgeArea: document.getElementById("badge-area"),
            badgeTotalHp: document.getElementById(DOM_IDS.BANNER.BADGE_TOTAL_HP),
            badgeDiseaseStatus: document.getElementById(DOM_IDS.BANNER.BADGE_DISEASE_STATUS)
        };

        if (this.dom.selectCycleHistory) {
            this.dom.selectCycleHistory.addEventListener("change", (e) => {
                if (e.target.value && this.onSelectCycle) {
                    this.onSelectCycle(e.target.value);
                }
            });
        }

        // Click pathology block to quickly inspect Laboratory Logbook
        const diseaseBlock = document.querySelector(".disease-block");
        if (diseaseBlock) {
            diseaseBlock.addEventListener("click", () => {
                const labTabBtn = document.getElementById("btn-tab-laboratory");
                if (labTabBtn) labTabBtn.click();
            });
        }

        // Listen for active pond changes
        appState.subscribe("pondChanged", (pond) => this.render(pond));
    }

    render(pond) {
        if (!pond) {
            if (this.dom.badgePondLabel) this.dom.badgePondLabel.textContent = "No Pond Selected";
            return;
        }

        // Physical Pond Label & Index
        const pondCode = formatPondLabel(pond.pond);
        if (this.dom.badgePondLabel) this.dom.badgePondLabel.textContent = `Pond ${pondCode}`;
        if (this.dom.badgePondIndex) this.dom.badgePondIndex.textContent = pond.pond_index || "—";

        // Cycle Status
        const st = (pond.status || "UNKNOWN").toUpperCase();
        if (this.dom.badgePondStatus) {
            this.dom.badgePondStatus.textContent = st;
            this.dom.badgePondStatus.className = `status-badge ${this.getStatusClass(st)}`;
        }

        // Active State Badge
        if (this.dom.badgePondActive) {
            const isActive = (pond.active || pond.pond_active || "").toUpperCase() === "ACTIVE";
            this.dom.badgePondActive.textContent = pond.active || pond.pond_active || "ACTIVE";
            this.dom.badgePondActive.className = `status-badge ${isActive ? "status-production" : "status-close"}`;
        }

        // Species & Genetics
        const isProd = (pond.status || pond.pond_status || "").toUpperCase() === "PRODUCTION";
        const species = pond.species || pond.stck_species;
        if (this.dom.badgeSpecies) {
            this.dom.badgeSpecies.textContent = (species && species !== "—") ? species : (isProd ? "P. VANNAMEi" : "—");
        }
        const genetic = pond.genetic_line || pond.bs_line;
        if (this.dom.badgeGenetic) {
            this.dom.badgeGenetic.textContent = (genetic && genetic !== "—") ? genetic : (isProd ? "Standard Line" : "—");
        }

        // Cycle & Crop Numbers
        const parts = String(pond.pond_index || "").split(".");
        const cycleNum = parts.length > 1 ? parts[1] : (pond.cycle_no || "1");
        if (this.dom.badgeCycleNo) this.dom.badgeCycleNo.textContent = cycleNum;
        if (this.dom.badgeCropNo) this.dom.badgeCropNo.textContent = pond.crop_no || "—";

        // Load Cycle History dropdown
        if (this.dom.selectCycleHistory && pond.pond) {
            PondRepository.getCycleHistory(pond.pond).then(history => {
                if (history && history.length > 0) {
                    this.dom.selectCycleHistory.innerHTML = history.map(c => {
                        const st = (c.status || c.pond_status || "").toUpperCase();
                        const isCurrent = c.pond_index === pond.pond_index;
                        return `<option value="${c.pond_index}" ${isCurrent ? 'selected' : ''}>Cycle ${c.cycle_no || c.pond_index} (${st})</option>`;
                    }).join("");
                } else {
                    this.dom.selectCycleHistory.innerHTML = `<option value="${pond.pond_index}" selected>Cycle ${cycleNum}</option>`;
                }
            }).catch(e => {
                console.warn("Could not load cycle history:", e);
                this.dom.selectCycleHistory.innerHTML = `<option value="${pond.pond_index}" selected>Cycle ${cycleNum}</option>`;
            });
        }

        // DOC Calculation (from stocking date)
        if (this.dom.badgeDoc) {
            if (pond.stck_date && pond.stck_date.trim() !== "") {
                const doc = calculateDOC(pond.stck_date, pond.date_close || null);
                this.dom.badgeDoc.textContent = `${doc}`;
            } else {
                this.dom.badgeDoc.textContent = "0";
            }
        }

        // Area (Hectares)
        if (this.dom.badgeArea) {
            const areaVal = parseFloat(pond.area);
            this.dom.badgeArea.textContent = !isNaN(areaVal) ? `${areaVal.toFixed(2)}` : "—";
        }

        // Disease Status (Synced with Laboratory reports & Master record)
        this.updateDiseaseBadge(pond);
    }

    /**
     * Dynamically synchronizes the Pathology & Biosecurity badge with lab reports and master record.
     * @param {object|string} pondOrIndex 
     */
    async updateDiseaseBadge(pondOrIndex) {
        if (!this.dom.badgeDiseaseStatus) return;

        const pond = typeof pondOrIndex === "object" ? pondOrIndex : null;
        const pondIndex = pond ? pond.pond_index : pondOrIndex;

        if (!pondIndex) {
            this.dom.badgeDiseaseStatus.textContent = "Pathogen Negative (Normal)";
            this.dom.badgeDiseaseStatus.className = "disease-pill disease-ok";
            this.dom.badgeDiseaseStatus.title = "No pond selected";
            return;
        }

        try {
            const issues = await LabRepository.getIssuesByPond(pondIndex);
            const status = evaluateBiosecurityStatus(pond, issues);

            this.dom.badgeDiseaseStatus.textContent = status.label;
            this.dom.badgeDiseaseStatus.className = status.className;
            this.dom.badgeDiseaseStatus.title = `${status.label} — ${status.footText}. Click to open Laboratory tab.`;
        } catch (err) {
            console.warn("Could not sync pathology badge with laboratory:", err);
            const fallback = evaluateBiosecurityStatus(pond, []);
            this.dom.badgeDiseaseStatus.textContent = fallback.label;
            this.dom.badgeDiseaseStatus.className = fallback.className;
            this.dom.badgeDiseaseStatus.title = `${fallback.label} — ${fallback.footText}`;
        }
    }

    getStatusClass(status) {
        switch (status) {
            case "PRODUCTION": return "status-production";
            case "iDLE":
            case "IDLE": return "status-idle";
            case "CLOSE": return "status-close";
            case "MAINTENANCE": return "status-maintenance";
            case "RESERVOIR": return "status-reservoir";
            default: return "status-idle";
        }
    }
}
