/**
 * iSHARP DBMS 2.0 — Stocking Themes Tab (Phase 5)
 * Replaces Excel "ass" sheet & strategy template sheets "ds1" to "pt3".
 * Pure Semantic CSS — derives all strategy specifications from CULTURE_STRATEGIES (Single Source of Truth).
 */

import {
    SPECIES,
    GENETIC_LINES,
    CULTURE_STRATEGIES,
    registerCustomStrategy
} from "../../domain/simulation/baselineCalibrator.js";
import { Toast } from "../../components/Toast.js";

export class StockingThemesTab {
    constructor(containerId = "sim-active-view-container", onSelectBrush = null) {
        this.containerId = containerId;
        this.onSelectBrush = onSelectBrush;
        this.selectedThemeCode = "DS3";
        this.isEmpiricalMode = true; // Empirical AI (5 Pillars) vs Theoretical Target
    }

    /**
     * Always reads from `CULTURE_STRATEGIES` (Single Source of Truth).
     */
    get themes() {
        return Object.values(CULTURE_STRATEGIES);
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="sim-stack-layout">
                <!-- Header Deck -->
                <div class="sim-command-bar">
                    <div>
                        <h2 class="sim-section-heading">
                            <span>🎨</span> Stocking Strategy &amp; Theme Matrix (Replaces Excel 'ass')
                        </h2>
                        <div class="sim-section-subtitle">
                            Single source of truth across all 10 culture presets (DS1–DS4, NT1–NT3, PT1–PT3). Select a theme brush to stamp directly across modules in Tab 2.
                        </div>
                    </div>

                    <div class="sim-toolbar-group">
                        <span class="sim-toolbar-label">Forecasting Mode:</span>
                        <div class="sim-pill-group">
                            <button type="button" id="btn-theme-mode-empirical" class="btn-pill-item ${this.isEmpiricalMode ? "active" : ""}">
                                🤖 Empirical AI (5 Pillars)
                            </button>
                            <button type="button" id="btn-theme-mode-target" class="btn-pill-item ${!this.isEmpiricalMode ? "active" : ""}">
                                🎯 Theoretical Target
                            </button>
                        </div>
                        <button type="button" id="btn-add-custom-theme" class="btn-sim-action btn-sim-primary sim-btn-compact">
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
        const species = t.speciesDefault || t.species || SPECIES.VANNAMEI;
        const density = t.defaultDensityPlM2 ?? t.densityPlM2 ?? 95;
        const durationWeeks = t.durationWeeks || Math.ceil((t.targetFinalDoc || 91) / 7);
        const docDays = t.targetFinalDoc || t.targetDocDays || (durationWeeks * 7);
        const restWeeks = t.restWeeks || 5;

        const yieldKg = this.isEmpiricalMode
            ? (t.expectedYieldPondKg || 3800)
            : (t.targetYieldPondKg || Math.round((t.expectedYieldPondKg || 3800) * 1.15));
        const abwG = this.isEmpiricalMode
            ? (t.expectedAbwG || 18.5)
            : (t.targetAbwG || Number(((t.expectedAbwG || 18.5) + 1.5).toFixed(1)));
        const srPct = this.isEmpiricalMode
            ? (t.expectedSrPct || 72.0)
            : (t.targetSrPct || Math.min(92.0, (t.expectedSrPct || 72.0) + 6.0));
        const ebitdaRm = this.isEmpiricalMode
            ? (t.expectedEbitdaPondRm ?? 24000)
            : (t.targetEbitdaPondRm ?? Math.round((t.expectedEbitdaPondRm ?? 24000) * 1.25));

        const ebitdaSign = ebitdaRm >= 0 ? "+RM " : "-RM ";
        const ebitdaFormatted = ebitdaSign + Math.abs(ebitdaRm).toLocaleString();

        return `
            <div class="sim-theme-card ${isSelected ? "active-brush" : ""}">
                <div class="sim-theme-card-body">
                    <div class="sim-theme-card-top">
                        <span class="sim-theme-badge ${t.badgeClass || "bg-theme-ds3"}">${t.code}</span>
                        <span class="sim-theme-species-tag">${species} • ${this.isEmpiricalMode ? "Empirical AI" : "Target BP"}</span>
                    </div>

                    <div>
                        <div class="sim-theme-title">${t.name || t.label}</div>
                        <div class="sim-theme-desc">${t.description || ""}</div>
                    </div>

                    <div class="sim-spec-grid">
                        <div>Density: <strong class="sim-spec-val">${density} PL/m²</strong></div>
                        <div>Duration: <strong class="sim-spec-val">${durationWeeks}w (${docDays}d)</strong></div>
                        <div>Turnaround: <strong class="sim-spec-val-amber">${restWeeks}w (T)</strong></div>
                        <div>Partials: <strong class="sim-spec-val">${t.harvestPlanCount === 1 ? "1X Final" : t.harvestPlanCount + "X Skim"}</strong></div>
                    </div>

                    <div class="sim-output-box">
                        <div>Harvest: <strong class="sim-spec-val-blue">${(yieldKg / 1000).toFixed(1)} MT</strong></div>
                        <div>ABW: <strong>${abwG} g</strong></div>
                        <div>Survival: <strong>${srPct}%</strong></div>
                        <div>EBITDA: <strong class="${ebitdaRm >= 0 ? "sim-spec-val-green" : "sim-spec-val-red"}">${ebitdaFormatted}</strong></div>
                    </div>
                </div>

                <div class="sim-theme-card-actions">
                    <button type="button" data-action="set-brush" data-code="${t.code}" class="btn-sim-action ${isSelected ? "btn-sim-primary" : "btn-sim-secondary"} sim-btn-brush-select">
                        ${isSelected ? "✓ Active Brush" : "🎨 Select as Brush"}
                    </button>
                </div>
            </div>
        `;
    }

    _bindEvents(container) {
        container.querySelector("#btn-theme-mode-empirical")?.addEventListener("click", () => {
            this.isEmpiricalMode = true;
            this.render();
        });

        container.querySelector("#btn-theme-mode-target")?.addEventListener("click", () => {
            this.isEmpiricalMode = false;
            this.render();
        });

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

        container.querySelector("#btn-add-custom-theme")?.addEventListener("click", () => {
            const rawName = typeof prompt === "function"
                ? prompt("Enter Theme Code & Name (e.g. DS5 • Fast Summer Crop):", "DS5 • Fast Summer Crop")
                : "DS5 • Fast Summer Crop";
            if (rawName) {
                const code = rawName.split("•")[0].trim().toUpperCase() || "DS5";
                registerCustomStrategy({
                    code,
                    name: rawName,
                    speciesDefault: SPECIES.VANNAMEI,
                    geneticLineDefault: GENETIC_LINES.SPT,
                    defaultDensityPlM2: 85,
                    durationWeeks: 12,
                    targetFinalDoc: 84,
                    restWeeks: 5,
                    harvestPlanCount: 1,
                    expectedYieldPondKg: 3500,
                    expectedAbwG: 18.0,
                    expectedSrPct: 70.0,
                    expectedFcr: 1.60,
                    expectedFeedPondMt: 5.6,
                    expectedEbitdaPondRm: 18000,
                    badgeClass: "bg-theme-ds3",
                    description: "Custom user-configured stocking theme."
                });
                this.selectedThemeCode = code;
                if (typeof this.onSelectBrush === "function") {
                    this.onSelectBrush(code);
                }
                this.render();
                Toast.success(`Added and activated custom theme ${code}!`);
            }
        });
    }
}

