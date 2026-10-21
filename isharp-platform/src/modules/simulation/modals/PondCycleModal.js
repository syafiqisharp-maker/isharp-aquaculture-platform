/**
 * iSHARP DBMS 2.0 — Pond Cycle Modal (Phase 5)
 * Modal dialogue to inspect, tune, or delete individual pond cycles in the schedule.
 */

import { SPECIES, CULTURE_STRATEGIES } from "../../../domain/simulation/baselineCalibrator.js";
import { simulationStore } from "../../../state/simulationStore.js";

export class PondCycleModal {
    constructor(modalId = "modal-sim-cycle") {
        this.modalId = modalId;
        this.currentCycle = null;
        this.currentPondId = null;
        this.currentCycleIndex = -1;
    }

    open(pondId, cycleIndex, cycleData) {
        this.currentPondId = pondId;
        this.currentCycleIndex = cycleIndex;
        this.currentCycle = cycleData;

        let modalEl = document.getElementById(this.modalId);
        if (!modalEl) {
            modalEl = document.createElement("div");
            modalEl.id = this.modalId;
            modalEl.className = "sim-modal-backdrop";
            document.body.appendChild(modalEl);
        }

        const isLocked = Boolean(cycleData.isLocked);
        const isMonodon = cycleData.species === SPECIES.MONODON;
        const durationWeeks = Math.max(1, (cycleData.endWeekIndex - cycleData.startWeekIndex) + 1);
        const estDoc = cycleData.targetFinalDoc || (durationWeeks * 7);

        modalEl.innerHTML = `
            <div class="sim-modal-dialog" role="dialog" aria-modal="true">
                <div class="sim-modal-header">
                    <div>
                        <h3 class="sim-modal-title">${isLocked ? "🔒 Operational Actual Cycle" : "Tune Pond Cycle"}: ${pondId}</h3>
                        <span style="font-size: 0.72rem; color: #0369a1; font-weight: 600;">
                            Module ${cycleData.moduleId} • Area: ${cycleData.areaHa} ha
                        </span>
                    </div>
                    <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-close-cycle-modal" style="padding: 0.2rem 0.5rem; font-size: 1.1rem; border-radius: 6px;">&times;</button>
                </div>

                ${isLocked ? `
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; padding: 0.6rem 0.8rem; margin: 0 1.5rem 1rem 1.5rem; border-radius: 4px; font-size: 0.75rem; color: #166534; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.1rem;">🔒</span>
                        <div>
                            <strong style="font-weight: 800;">Operational Actual / Database Cycle (Read-Only)</strong>
                            <div style="opacity: 0.9;">This cycle represents historical field production recorded in Supabase. Parameters cannot be modified or deleted.</div>
                        </div>
                    </div>
                ` : ""}

                <div class="sim-form-grid">
                    <div class="sim-form-group">
                        <label class="sim-form-label">Species Partition (Pillar 0)</label>
                        <select class="sim-form-input" id="cycle-species-select" ${isLocked ? "disabled" : ""}>
                            <option value="${SPECIES.VANNAMEI}" ${!isMonodon ? "selected" : ""}>Litopenaeus vannamei (Whiteleg)</option>
                            <option value="${SPECIES.MONODON}" ${isMonodon ? "selected" : ""}>Penaeus monodon (Black Tiger)</option>
                        </select>
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Culture Strategy</label>
                        <select class="sim-form-input" id="cycle-strategy-select" ${isLocked ? "disabled" : ""}>
                            ${Object.entries(CULTURE_STRATEGIES).map(([k, s]) => `
                                <option value="${k}" ${cycleData.strategyCode === k ? "selected" : ""}>
                                    ${k}: ${s.name} (${s.isNurseryTransfer ? "Nursery Transfer" : "Direct Stock"})
                                </option>
                            `).join("")}
                        </select>
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Genetic Line</label>
                        <select class="sim-form-input" id="cycle-genetic-select" ${isLocked ? "disabled" : ""}>
                            <option value="SIS_GROWTH" ${cycleData.geneticLine === "SIS_GROWTH" ? "selected" : ""}>SIS Fast Growth (API Golden / 25-01-V1)</option>
                            <option value="SYAQUA_BAL" ${cycleData.geneticLine === "SYAQUA_BAL" ? "selected" : ""}>SyAqua Balanced (SPT / 25-02-S1)</option>
                            <option value="SPF" ${cycleData.geneticLine === "SPF" ? "selected" : ""}>SPF (Standard Specific Pathogen Free)</option>
                            <option value="SPR" ${cycleData.geneticLine === "SPR" ? "selected" : ""}>SPR (Specific Pathogen Resistant - Golden/FireDragon)</option>
                            <option value="SPT" ${cycleData.geneticLine === "SPT" ? "selected" : ""}>SPT (Specific Pathogen Tolerant - SyAqua)</option>
                            <option value="MONODON" ${cycleData.geneticLine === "MONODON" ? "selected" : ""}>MONODON (CP Thai / Moana / Madagascar)</option>
                        </select>
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Broodstock Line</label>
                        <input type="text" class="sim-form-input" id="cycle-bsline-input" value="${cycleData.bsLine || (isMonodon ? "CP THAI" : "API GOLDEN")}" ${isLocked ? "disabled" : ""} />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Primary Hatchery Source</label>
                        <input type="text" class="sim-form-input" id="cycle-hatchery-input" value="${cycleData.stckSource || (isMonodon ? "KSK" : "SHT")}" ${isLocked ? "disabled" : ""} />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Stock Density (PL / m²)</label>
                        <input type="number" class="sim-form-input" id="cycle-density-input" value="${cycleData.stockDensityPlM2 || (isMonodon ? 45 : 100)}" min="20" max="150" step="5" ${isLocked ? "disabled" : ""} />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Stock Week Index (1 to 156)</label>
                        <input type="number" class="sim-form-input" id="cycle-startweek-input" value="${cycleData.startWeekIndex || 1}" min="1" max="156" ${isLocked ? "disabled" : ""} />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Target Growout DOC (Days)</label>
                        <input type="number" class="sim-form-input" id="cycle-doc-input" value="${estDoc}" min="50" max="150" step="5" ${isLocked ? "disabled" : ""} />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Harvest Strategy (Pillar 4)</label>
                        <select class="sim-form-input" id="cycle-harvestcount-select" ${isLocked ? "disabled" : ""}>
                            <option value="1" ${cycleData.harvestPlanCount === 1 ? "selected" : ""}>1X: Single Final Harvest</option>
                            <option value="2" ${cycleData.harvestPlanCount === 2 ? "selected" : ""}>2X: 1 Partial Thinning + Final Harvest (+55% EBITDA)</option>
                            <option value="3" ${cycleData.harvestPlanCount === 3 ? "selected" : ""}>3X: 2 Partial Skims + Final Harvest (+134% EBITDA)</option>
                        </select>
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Turnaround Rest Time (DOP Days)</label>
                        <input type="number" class="sim-form-input" id="cycle-dop-input" value="${cycleData.dopDays || 42}" min="7" max="120" step="1" ${isLocked ? "disabled" : ""} />
                    </div>
                </div>

                <div class="sim-modal-footer">
                    ${isLocked ? `
                        <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-cancel-cycle-modal" style="margin-left: auto;">
                            <span>Close</span>
                        </button>
                    ` : `
                        <button type="button" class="btn-sim-action btn-sim-danger" id="btn-delete-cycle" style="margin-right: auto;">
                            <span>Delete Cycle</span>
                        </button>
                        <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-cancel-cycle-modal">
                            <span>Cancel</span>
                        </button>
                        <button type="button" class="btn-sim-action btn-sim-primary" id="btn-save-cycle-modal">
                            <span>Save &amp; Recalculate</span>
                        </button>
                    `}
                </div>
            </div>
        `;

        modalEl.style.display = "flex";
        this._bindEvents(modalEl);
    }

    close() {
        const modalEl = document.getElementById(this.modalId);
        if (modalEl) {
            modalEl.style.display = "none";
        }
    }

    _bindEvents(modalEl) {
        const btnClose = modalEl.querySelector("#btn-close-cycle-modal");
        const btnCancel = modalEl.querySelector("#btn-cancel-cycle-modal");
        const btnSave = modalEl.querySelector("#btn-save-cycle-modal");
        const btnDelete = modalEl.querySelector("#btn-delete-cycle");
        const stratSelect = modalEl.querySelector("#cycle-strategy-select");

        const dismiss = () => this.close();
        if (btnClose) btnClose.onclick = dismiss;
        if (btnCancel) btnCancel.onclick = dismiss;

        // Auto-populate preset parameters when changing Culture Strategy (Single Source of Truth)
        if (stratSelect) {
            stratSelect.onchange = (e) => {
                const code = e.target.value;
                const strat = CULTURE_STRATEGIES[code];
                if (!strat) return;
                const densEl = modalEl.querySelector("#cycle-density-input");
                const docEl = modalEl.querySelector("#cycle-doc-input");
                const harvEl = modalEl.querySelector("#cycle-harvestcount-select");
                const dopEl = modalEl.querySelector("#cycle-dop-input");
                if (densEl && strat.defaultDensityPlM2) densEl.value = strat.defaultDensityPlM2;
                if (docEl && strat.targetFinalDoc) docEl.value = strat.targetFinalDoc;
                if (harvEl && strat.harvestPlanCount) harvEl.value = String(strat.harvestPlanCount);
                if (dopEl && strat.restWeeks) dopEl.value = strat.restWeeks * 7;
            };
        }

        if (btnDelete) {
            btnDelete.onclick = () => {
                if (confirm(`Remove cycle for pond ${this.currentPondId}?`)) {
                    simulationStore.removeCycle(this.currentPondId, this.currentCycleIndex);
                    this.close();
                }
            };
        }

        if (btnSave) {
            btnSave.onclick = () => {
                const species = modalEl.querySelector("#cycle-species-select").value;
                const strategyCode = modalEl.querySelector("#cycle-strategy-select").value;
                const geneticLine = modalEl.querySelector("#cycle-genetic-select").value;
                const bsLine = modalEl.querySelector("#cycle-bsline-input").value.trim();
                const stckSource = modalEl.querySelector("#cycle-hatchery-input").value.trim();
                const stockDensityPlM2 = Number(modalEl.querySelector("#cycle-density-input").value) || 95;
                const startWeekIndex = Number(modalEl.querySelector("#cycle-startweek-input").value) || 1;
                const targetDoc = Number(modalEl.querySelector("#cycle-doc-input").value) || 90;
                const harvestPlanCount = Number(modalEl.querySelector("#cycle-harvestcount-select").value) || 1;
                const dopDays = Number(modalEl.querySelector("#cycle-dop-input").value) || 42;

                const durationWeeks = Math.ceil(targetDoc / 7);
                const endWeekIndex = startWeekIndex + durationWeeks - 1;

                simulationStore.updateCycle(this.currentPondId, this.currentCycleIndex, {
                    species,
                    strategyCode,
                    geneticLine,
                    bsLine,
                    stckSource,
                    stockDensityPlM2,
                    startWeekIndex,
                    endWeekIndex,
                    targetFinalDoc: targetDoc,
                    harvestPlanCount,
                    dopDays
                });

                this.close();
            };
        }

        // Close on outside backdrop click
        modalEl.onclick = (e) => {
            if (e.target === modalEl) this.close();
        };
    }
}
