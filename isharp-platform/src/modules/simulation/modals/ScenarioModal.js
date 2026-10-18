/**
 * iSHARP DBMS 2.0 — Scenario Modal (Phase 5)
 * Manages saving, loading, exporting, and importing scenarios from browser localStorage.
 */

import { SimulationRepository } from "../../../infrastructure/repositories/simulationRepository.js";
import { simulationStore } from "../../../state/simulationStore.js";

export class ScenarioModal {
    constructor(modalId = "modal-sim-scenarios") {
        this.modalId = modalId;
    }

    open() {
        let modalEl = document.getElementById(this.modalId);
        if (!modalEl) {
            modalEl = document.createElement("div");
            modalEl.id = this.modalId;
            modalEl.className = "sim-modal-backdrop";
            document.body.appendChild(modalEl);
        }

        const scenarios = SimulationRepository.listScenarios();
        const currentMeta = simulationStore.scenarioMetadata;

        modalEl.innerHTML = `
            <div class="sim-modal-dialog" role="dialog" aria-modal="true" style="max-width: 650px;">
                <div class="sim-modal-header">
                    <div>
                        <h3 class="sim-modal-title">💾 Manage Digital Twin Scenarios</h3>
                        <span style="font-size: 0.72rem; color: #0369a1; font-weight: 600;">
                            Saved locally in browser localStorage (Zero Supabase bloat)
                        </span>
                    </div>
                    <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-close-scenarios-modal" style="padding: 0.2rem 0.5rem; font-size: 1.1rem; border-radius: 6px;">&times;</button>
                </div>

                <!-- Section 1: Save Current State -->
                <div style="background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 10px; padding: 0.85rem 1rem;">
                    <div style="font-size: 0.8rem; font-weight: 800; color: #0369a1; margin-bottom: 0.4rem;">
                        Save Current Simulation as New Scenario
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <input type="text" class="sim-form-input" id="scenario-name-input" placeholder="Scenario name (e.g. 2026 Aggressive Monodon M08/M09)" style="flex: 1; min-width: 200px;" value="${currentMeta.name || ""}" />
                        <button type="button" class="btn-sim-action btn-sim-primary" id="btn-save-scenario-submit">
                            <span>Save Scenario</span>
                        </button>
                    </div>
                </div>

                <!-- Section 2: Saved Scenarios List -->
                <div>
                    <div style="font-size: 0.8rem; font-weight: 800; color: #071e33; margin-bottom: 0.5rem;">
                        Saved Scenarios (${scenarios.length})
                    </div>
                    ${scenarios.length === 0 ? `
                        <div style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.8rem; background: #f8fafc; border-radius: 8px;">
                            No saved custom scenarios yet. Save your current plan above!
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto;">
                            ${scenarios.map((sc) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                                    <div>
                                        <div style="font-size: 0.82rem; font-weight: 800; color: #0c4a6e;">${sc.name}</div>
                                        <div style="font-size: 0.68rem; color: #64748b;">
                                            ${sc.cycleCount || 0} cycles • ${sc.shockCount || 0} shocks • ${new Date(sc.updatedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 0.35rem;">
                                        <button type="button" class="btn-sim-action btn-sim-primary btn-load-scenario" data-sc-id="${sc.id}" style="padding: 0.3rem 0.65rem; font-size: 0.72rem;">
                                            <span>Load</span>
                                        </button>
                                        <button type="button" class="btn-sim-action btn-sim-secondary btn-export-scenario" data-sc-id="${sc.id}" style="padding: 0.3rem 0.55rem; font-size: 0.72rem;">
                                            <span>Export</span>
                                        </button>
                                        <button type="button" class="btn-sim-action btn-sim-danger btn-delete-scenario" data-sc-id="${sc.id}" style="padding: 0.3rem 0.5rem; font-size: 0.72rem;">
                                            <span>&times;</span>
                                        </button>
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    `}
                </div>

                <!-- Section 3: Import JSON -->
                <div style="border-top: 1px solid #e2e8f0; padding-top: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
                    <label class="btn-sim-action btn-sim-secondary" style="cursor: pointer; font-size: 0.75rem;">
                        <span>📥 Import Scenario JSON</span>
                        <input type="file" id="input-import-scenario-file" accept=".json" style="display: none;" />
                    </label>
                    <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-close-scenarios-footer">
                        <span>Done</span>
                    </button>
                </div>
            </div>
        `;

        modalEl.style.display = "flex";
        this._bindEvents(modalEl);
    }

    close() {
        const modalEl = document.getElementById(this.modalId);
        if (modalEl) modalEl.style.display = "none";
    }

    _bindEvents(modalEl) {
        const btnClose = modalEl.querySelector("#btn-close-scenarios-modal");
        const btnDone = modalEl.querySelector("#btn-close-scenarios-footer");
        const btnSave = modalEl.querySelector("#btn-save-scenario-submit");
        const fileImport = modalEl.querySelector("#input-import-scenario-file");

        const dismiss = () => this.close();
        if (btnClose) btnClose.onclick = dismiss;
        if (btnDone) btnDone.onclick = dismiss;

        if (btnSave) {
            btnSave.onclick = () => {
                const name = modalEl.querySelector("#scenario-name-input").value.trim();
                if (!name) {
                    alert("Please provide a name for this scenario.");
                    return;
                }
                simulationStore.saveCurrentScenario(name);
                this.open(); // Refresh list
            };
        }

        // Load buttons
        modalEl.querySelectorAll(".btn-load-scenario").forEach((btn) => {
            btn.onclick = () => {
                const scId = btn.getAttribute("data-sc-id");
                if (scId) {
                    simulationStore.loadScenario(scId);
                    this.close();
                }
            };
        });

        // Export buttons
        modalEl.querySelectorAll(".btn-export-scenario").forEach((btn) => {
            btn.onclick = () => {
                const scId = btn.getAttribute("data-sc-id");
                const jsonStr = SimulationRepository.exportScenarioJson(scId);
                if (jsonStr) {
                    const blob = new Blob([jsonStr], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `isharp_scenario_${scId}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            };
        });

        // Delete buttons
        modalEl.querySelectorAll(".btn-delete-scenario").forEach((btn) => {
            btn.onclick = () => {
                const scId = btn.getAttribute("data-sc-id");
                if (confirm("Delete this saved scenario?")) {
                    SimulationRepository.deleteScenario(scId);
                    this.open();
                }
            };
        });

        // Import file handler
        if (fileImport) {
            fileImport.onchange = (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const jsonStr = evt.target.result;
                        const imported = SimulationRepository.importScenarioJson(jsonStr);
                        simulationStore.loadScenario(imported.id);
                        this.open();
                    } catch (err) {
                        alert("Invalid scenario JSON file: " + err.message);
                    }
                };
                reader.readAsText(file);
            };
        }

        modalEl.onclick = (e) => {
            if (e.target === modalEl) this.close();
        };
    }
}
