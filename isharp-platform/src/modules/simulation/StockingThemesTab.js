/**
 * iSHARP DBMS 2.0 — Stocking Themes Tab (Phase 5)
 * Replaces Excel "ass" sheet & strategy template sheets "ds1" to "pt3".
 * Pure Semantic CSS — renders complete cards, specifications, and action buttons.
 */

import { SPECIES, GENETIC_LINES } from "../../domain/simulation/baselineCalibrator.js";
import { Toast } from "../../components/Toast.js";

export class StockingThemesTab {
    constructor(containerId = "sim-active-view-container", onSelectBrush = null) {
        this.containerId = containerId;
        this.onSelectBrush = onSelectBrush;
        this.selectedThemeCode = "DS3";
        this.isEmpiricalMode = true; // Empirical AI vs Theoretical Target
        this.themes = this._initDefaultThemes();
    }

    _initDefaultThemes() {
        return [
            {
                code: "DS1",
                name: "DS1 • Direct Stocking SPF",
                species: SPECIES.VANNAMEI,
                geneticLine: GENETIC_LINES.SPF,
                densityPlM2: 80,
                durationWeeks: 10,
                targetDocDays: 70,
                restWeeks: 5,
                harvestPlanCount: 1,
                expectedYieldPondKg: 2500,
                expectedAbwG: 16.5,
                expectedSrPct: 68.0,
                expectedFcr: 1.55,
                expectedFeedPondMt: 3.8,
                expectedEbitdaPondRm: 14500,
                badgeClass: "bg-theme-ds1",
                description: "Fast-turnaround SPF Vannamei crop for rapid cycle completion."
            },
            {
                code: "DS2",
                name: "DS2 • Direct Stocking SPR",
                species: SPECIES.VANNAMEI,
                geneticLine: GENETIC_LINES.SPR,
                densityPlM2: 80,
                durationWeeks: 13,
                targetDocDays: 91,
                restWeeks: 5,
                harvestPlanCount: 1,
                expectedYieldPondKg: 4000,
                expectedAbwG: 19.5,
                expectedSrPct: 74.0,
                expectedFcr: 1.58,
                expectedFeedPondMt: 6.3,
                expectedEbitdaPondRm: 24200,
                badgeClass: "bg-theme-ds2",
                description: "Hardy SPR broodstock (API Golden/Fire Dragon) with high survival."
            },
            {
                code: "DS3",
                name: "DS3 • Direct Stocking SPT",
                species: SPECIES.VANNAMEI,
                geneticLine: GENETIC_LINES.SPT,
                densityPlM2: 80,
                durationWeeks: 13,
                targetDocDays: 91,
                restWeeks: 5,
                harvestPlanCount: 1,
                expectedYieldPondKg: 3800,
                expectedAbwG: 18.2,
                expectedSrPct: 65.0,
                expectedFcr: 1.62,
                expectedFeedPondMt: 6.1,
                expectedEbitdaPondRm: 16900,
                badgeClass: "bg-theme-ds3",
                description: "Standard commercial SPT Vannamei baseline strategy."
            },
            {
                code: "DS4",
                name: "DS4 • Direct Stocking Monodon",
                species: SPECIES.MONODON,
                geneticLine: GENETIC_LINES.MONODON,
                densityPlM2: 45,
                durationWeeks: 20,
                targetDocDays: 140,
                restWeeks: 6,
                harvestPlanCount: 1,
                expectedYieldPondKg: 4500,
                expectedAbwG: 32.0,
                expectedSrPct: 73.0,
                expectedFcr: 1.91,
                expectedFeedPondMt: 8.6,
                expectedEbitdaPondRm: 38500,
                badgeClass: "bg-theme-ds4",
                description: "Premium Penaeus monodon (CP Thai/Moana) in high-salinity modules."
            },
            {
                code: "NT1",
                name: "NT1 • Nursery 1-Stage",
                species: SPECIES.VANNAMEI,
                geneticLine: GENETIC_LINES.SPR,
                densityPlM2: 100,
                durationWeeks: 12,
                targetDocDays: 84,
                restWeeks: 5,
                harvestPlanCount: 1,
                expectedYieldPondKg: 4400,
                expectedAbwG: 20.0,
                expectedSrPct: 78.0,
                expectedFcr: 1.50,
                expectedFeedPondMt: 6.6,
                expectedEbitdaPondRm: 27800,
                badgeClass: "bg-theme-nt1",
                description: "Pre-conditioned nursery juveniles transferred for rapid growout."
            },
            {
                code: "NT2",
                name: "NT2 • Nursery 2-Stage (2X Partial)",
                species: SPECIES.VANNAMEI,
                geneticLine: GENETIC_LINES.SPR,
                densityPlM2: 120,
                durationWeeks: 14,
                targetDocDays: 98,
                restWeeks: 5,
                harvestPlanCount: 2,
                expectedYieldPondKg: 5200,
                expectedAbwG: 21.5,
                expectedSrPct: 82.0,
                expectedFcr: 1.52,
                expectedFeedPondMt: 7.9,
                expectedEbitdaPondRm: 34500,
                badgeClass: "bg-theme-nt2",
                description: "High-density nursery stock with mid-cycle 2X carrying capacity skim."
            },
            {
                code: "PT2",
                name: "PT2 • Partial Harvest 2X Relief",
                species: SPECIES.VANNAMEI,
                geneticLine: GENETIC_LINES.SPT,
                densityPlM2: 110,
                durationWeeks: 14,
                targetDocDays: 98,
                restWeeks: 5,
                harvestPlanCount: 2,
                expectedYieldPondKg: 4950,
                expectedAbwG: 20.2,
                expectedSrPct: 74.0,
                expectedFcr: 1.56,
                expectedFeedPondMt: 7.7,
                expectedEbitdaPondRm: 31200,
                badgeClass: "bg-theme-pt2",
                description: "Skims 1,000 kg at DOC 65 to unlock compensatory late-stage growth."
            },
            {
                code: "PT3",
                name: "PT3 • Multi-Skim 3X Max Yield",
                species: SPECIES.VANNAMEI,
                geneticLine: GENETIC_LINES.SPR,
                densityPlM2: 125,
                durationWeeks: 16,
                targetDocDays: 112,
                restWeeks: 6,
                harvestPlanCount: 3,
                expectedYieldPondKg: 6150,
                expectedAbwG: 24.5,
                expectedSrPct: 84.0,
                expectedFcr: 1.48,
                expectedFeedPondMt: 9.1,
                expectedEbitdaPondRm: 50200,
                badgeClass: "bg-theme-pt3",
                description: "Two mid-cycle partial skims enabling maximum biomass yield per ha."
            }
        ];
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <!-- Header Deck -->
                <div class="sim-command-bar">
                    <div>
                        <h2 style="font-size: 0.9rem; font-weight: 800; color: #0c4a6e; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                            <span>🎨</span> Stocking Strategy &amp; Theme Matrix (Replaces Excel 'ass')
                        </h2>
                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
                            Configure standard culture presets once. Select a theme brush to stamp directly across modules in Tab 2.
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">Forecasting Mode:</span>
                        <div class="sim-pill-group">
                            <button type="button" id="btn-theme-mode-empirical" class="btn-pill-item ${this.isEmpiricalMode ? "active" : ""}">
                                🤖 Empirical AI (5 Pillars)
                            </button>
                            <button type="button" id="btn-theme-mode-target" class="btn-pill-item ${!this.isEmpiricalMode ? "active" : ""}">
                                🎯 Theoretical Target
                            </button>
                        </div>
                        <button type="button" id="btn-add-custom-theme" class="btn-sim-action btn-sim-primary" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">
                            + Add Custom Theme
                        </button>
                    </div>
                </div>

                <!-- Theme Cards Grid -->
                <div class="sim-theme-grid">
                    ${this.themes.map(t => this._renderThemeCard(t)).join("")}
                </div>
            </div>
        `;

        this._bindEvents(container);
    }

    _renderThemeCard(t) {
        const isSelected = this.selectedThemeCode === t.code;
        const ebitdaSign = t.expectedEbitdaPondRm >= 0 ? "+RM " : "-RM ";
        const ebitdaFormatted = ebitdaSign + Math.abs(t.expectedEbitdaPondRm).toLocaleString();

        return `
            <div class="sim-theme-card ${isSelected ? "active-brush" : ""}">
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="sim-theme-badge ${t.badgeClass}">${t.code}</span>
                        <span style="font-size: 0.72rem; font-weight: 700; color: #64748b;">${t.species}</span>
                    </div>

                    <div>
                        <div style="font-weight: 800; font-size: 0.85rem; color: #0c4a6e;">${t.name}</div>
                        <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.15rem; line-height: 1.3;">${t.description}</div>
                    </div>

                    <div class="sim-spec-grid">
                        <div>Density: <strong style="color: #0c4a6e;">${t.densityPlM2} PL/m²</strong></div>
                        <div>Duration: <strong style="color: #0c4a6e;">${t.durationWeeks}w (${t.targetDocDays}d)</strong></div>
                        <div>Turnaround: <strong style="color: #d97706;">${t.restWeeks}w (T)</strong></div>
                        <div>Partials: <strong style="color: #0c4a6e;">${t.harvestPlanCount === 1 ? "0X" : t.harvestPlanCount + "X"}</strong></div>
                    </div>

                    <div class="sim-output-box">
                        <div>Harvest: <strong style="color: #0284c7;">${(t.expectedYieldPondKg / 1000).toFixed(1)} MT</strong></div>
                        <div>ABW: <strong>${t.expectedAbwG} g</strong></div>
                        <div>Survival: <strong>${t.expectedSrPct}%</strong></div>
                        <div>EBITDA: <strong style="color: #059669;">${ebitdaFormatted}</strong></div>
                    </div>
                </div>

                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    <button type="button" data-action="set-brush" data-code="${t.code}" class="btn-sim-action ${isSelected ? "btn-sim-primary" : "btn-sim-secondary"}" style="flex: 1; justify-content: center; font-size: 0.75rem; padding: 0.35rem 0.6rem;">
                        ${isSelected ? "✓ Active Brush" : "🎨 Select as Brush"}
                    </button>
                </div>
            </div>
        `;
    }

    _bindEvents(container) {
        // Mode toggle
        container.querySelector("#btn-theme-mode-empirical")?.addEventListener("click", () => {
            this.isEmpiricalMode = true;
            this.render();
        });

        container.querySelector("#btn-theme-mode-target")?.addEventListener("click", () => {
            this.isEmpiricalMode = false;
            this.render();
        });

        // Set active brush
        container.querySelectorAll('[data-action="set-brush"]').forEach(btn => {
            btn.addEventListener("click", (e) => {
                const code = e.currentTarget.getAttribute("data-code");
                this.selectedThemeCode = code;
                if (typeof this.onSelectBrush === "function") {
                    this.onSelectBrush(code);
                }
                this.render();
                Toast.success(`Active Brush set to ${code}`);
            });
        });

        // Add custom theme
        container.querySelector("#btn-add-custom-theme")?.addEventListener("click", () => {
            const name = prompt("Enter Theme Code & Name (e.g. DS5 • Fast Summer Crop):", "DS5 • Fast Summer Crop");
            if (name) {
                const code = name.split("•")[0].trim().toUpperCase() || "DS5";
                this.themes.push({
                    code,
                    name,
                    species: SPECIES.VANNAMEI,
                    geneticLine: GENETIC_LINES.SPT,
                    densityPlM2: 85,
                    durationWeeks: 12,
                    targetDocDays: 84,
                    restWeeks: 5,
                    harvestPlanCount: 1,
                    expectedYieldPondKg: 3500,
                    expectedAbwG: 18.0,
                    expectedSrPct: 70.0,
                    expectedFcr: 1.6,
                    expectedFeedPondMt: 5.6,
                    expectedEbitdaPondRm: 18000,
                    badgeClass: "bg-theme-ds3",
                    description: "Custom user-configured stocking theme."
                });
                this.render();
                Toast.success(`Added custom theme ${code}!`);
            }
        });
    }
}
