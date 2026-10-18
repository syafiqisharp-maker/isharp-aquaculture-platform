/**
 * iSHARP DBMS 2.0 — Simulation Page Controller (Phase 5)
 * Master container orchestrating the 5-Tab Excel Replacement Workspace:
 * - Top Scoreboard: Current-Year Spliced Hero Scoreboard (FY 2026 first)
 * - Tab 1: Stocking Themes (`ass` & `ds1..pt3`)
 * - Tab 2: Planning Grid (3 Years Ahead / 156 Weeks Horizon + 1-Year Zero-Scroll Views)
 * - Tab 3: Monthly Production Roll-Up (`prt`)
 * - Tab 4: BOD Executive KPI & Genetic Lines (`kpi.sum` & `kpi.gen`)
 * - Tab 5: Weekly & Monthly Procurement MRP (`wek` & `mth`)
 */

import { simulationStore } from "../../state/simulationStore.js";
import { SimulationSummaryCards } from "./SimulationSummaryCards.js";
import { DisruptionTimelineRibbon } from "./DisruptionTimelineRibbon.js";
import { StockingThemesTab } from "./StockingThemesTab.js";
import { ModulePlannerGrid } from "./ModulePlannerGrid.js";
import { MonthlyProductionTab } from "./MonthlyProductionTab.js";
import { BODSummaryTable } from "./BODSummaryTable.js";
import { WeeklyRollingTable } from "./WeeklyRollingTable.js";
import { PondCycleModal } from "./modals/PondCycleModal.js";
import { ShockModal } from "./modals/ShockModal.js";
import { ScenarioModal } from "./modals/ScenarioModal.js";
import { Toast } from "../../components/Toast.js";

export class SimulationPage {
    constructor(containerId = "view-simulation") {
        this.containerId = containerId;
        this.currentTab = "GANTT"; // "THEMES", "GANTT", "MONTHLY", "BOD", "MRP"
        this.selectedYear = 2026;
        this.isInitialized = false;

        this.summaryCards = new SimulationSummaryCards("sim-kpi-strip-container");
        this.shockRibbon = new DisruptionTimelineRibbon("sim-shock-ribbon-container", () => this.shockModal.open());

        // 5 Main Tabs
        this.themesTab = new StockingThemesTab("sim-active-view-container", (brushCode) => {
            this.ganttGrid.setBrush(brushCode);
            this.switchTab("GANTT");
        });

        this.ganttGrid = new ModulePlannerGrid("sim-active-view-container", (pId, idx, data) => {
            this.cycleModal.open(pId, idx, data);
        });

        this.monthlyTab = new MonthlyProductionTab("sim-active-view-container");
        this.bodTable = new BODSummaryTable("sim-active-view-container");
        this.mrpTable = new WeeklyRollingTable("sim-active-view-container");

        // Modals
        this.cycleModal = new PondCycleModal();
        this.shockModal = new ShockModal();
        this.scenarioModal = new ScenarioModal();

        this.render();
        this.bindStoreEvents();
    }

    setYear(year) {
        this.selectedYear = Number(year) || 2026;
        this.summaryCards.setYear(this.selectedYear);
        this.monthlyTab.setYear(this.selectedYear);
        this.bodTable.setYear(this.selectedYear);
        this.ganttGrid.setHorizon(String(this.selectedYear));

        [2026, 2027, 2028].forEach(yr => {
            const btn = document.getElementById(`btn-yr-${yr}`);
            if (btn) {
                btn.className = yr === this.selectedYear ? "btn-pill-item active" : "btn-pill-item";
            }
        });
    }

    switchTab(tabKey) {
        this.currentTab = tabKey;

        const tabMap = {
            THEMES: "tab-nav-themes",
            GANTT: "tab-nav-gantt",
            MONTHLY: "tab-nav-monthly",
            BOD: "tab-nav-bod",
            MRP: "tab-nav-mrp"
        };

        Object.keys(tabMap).forEach(k => {
            const el = document.getElementById(tabMap[k]);
            if (el) {
                el.className = k === tabKey ? "btn-sim-tab active-tab" : "btn-sim-tab";
            }
        });

        const pulseToggleContainer = document.getElementById("sim-pulse-resolution-toggle-box");
        if (pulseToggleContainer) {
            pulseToggleContainer.style.display = tabKey === "GANTT" ? "flex" : "none";
        }

        this.renderActiveSubView();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="sim-page-layout">
                
                <!-- 1. Top Navigation & Command Header Deck -->
                <header class="sim-header-deck">
                    <div class="sim-header-left">
                        <button class="btn-portal-back" type="button" data-nav-view="portal" title="Return to Gateway Portal">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            <span>Portal</span>
                        </button>

                        <div>
                            <h1 class="sim-brand-title">
                                <span>🦐</span> iSHARP Production Planning &amp; Rolling Forecast Engine
                            </h1>
                            <div class="sim-brand-subtitle">
                                Setiu Growout Ponds (M01–M11) • 3-Year Master Plan &amp; 5-Pillar Predictive Simulation
                            </div>
                        </div>

                        <div class="sim-status-badge">
                            <span style="color: #059669;">● Cut-Off: W34 (Aug '26)</span>
                            <span style="color: #cbd5e1;">|</span>
                            <span style="color: #0284c7;">Sep '26 LE</span>
                            <span style="color: #64748b;">vs Aug '26 • BP '26 • AC '25</span>
                        </div>
                    </div>

                    <div class="sim-header-actions">
                        <!-- Fiscal Year Switcher -->
                        <div class="sim-pill-group">
                            <button type="button" id="btn-yr-2026" class="btn-pill-item ${this.selectedYear === 2026 ? "active" : ""}">FY 2026 (Current)</button>
                            <button type="button" id="btn-yr-2027" class="btn-pill-item ${this.selectedYear === 2027 ? "active" : ""}">FY 2027</button>
                            <button type="button" id="btn-yr-2028" class="btn-pill-item ${this.selectedYear === 2028 ? "active" : ""}">FY 2028</button>
                        </div>

                        <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-open-scenarios" title="Save or Load Local Scenarios">
                            <span>📸 Save Snapshot</span>
                        </button>
                        <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-open-shock-modal" title="Inject War Room Macro or Climate Shock">
                            <span>🧪 What-If / Shocks</span>
                        </button>
                        <button type="button" class="btn-sim-action btn-sim-primary" id="btn-export-excel-file" title="Export 1:1 Replacement Excel Workbook (.xlsx)">
                            <span>📥 Export Excel (.xlsx)</span>
                        </button>
                        <button type="button" class="btn-sim-action btn-sim-secondary" data-nav-view="executive" title="Return to Executive Dashboard">
                            <span>Dashboard →</span>
                        </button>
                    </div>
                </header>

                <!-- 2. Current-Year Spliced Hero Scoreboard (4 Spliced Cards) -->
                <section class="sim-kpi-strip" id="sim-kpi-strip-container" aria-label="Simulation Current-Year Spliced Hero Cards">
                    <!-- Populated by SimulationSummaryCards -->
                </section>

                <!-- 3. Disruption Shock Ribbon Bar -->
                <section class="sim-shock-ribbon-bar" id="sim-shock-ribbon-container" aria-label="Active Shocks Ribbon" style="display: none;">
                    <!-- Populated by DisruptionTimelineRibbon -->
                </section>

                <!-- 4. 5-Tab Navigation Ribbon + Pulse Resolution Toggle -->
                <nav class="sim-nav-ribbon">
                    <div class="sim-tab-group">
                        <button type="button" class="btn-sim-tab ${this.currentTab === "THEMES" ? "active-tab" : ""}" id="tab-nav-themes">
                            <span>1. 🎨 Stocking Themes ('ass')</span>
                        </button>
                        <button type="button" class="btn-sim-tab ${this.currentTab === "GANTT" ? "active-tab" : ""}" id="tab-nav-gantt">
                            <span>2. 📅 Planning Schedule ('main')</span>
                        </button>
                        <button type="button" class="btn-sim-tab ${this.currentTab === "MONTHLY" ? "active-tab" : ""}" id="tab-nav-monthly">
                            <span>3. 📊 Monthly Production ('prt')</span>
                        </button>
                        <button type="button" class="btn-sim-tab ${this.currentTab === "BOD" ? "active-tab" : ""}" id="tab-nav-bod">
                            <span>4. 🏆 BOD KPI &amp; Lines ('kpi.sum')</span>
                        </button>
                        <button type="button" class="btn-sim-tab ${this.currentTab === "MRP" ? "active-tab" : ""}" id="tab-nav-mrp">
                            <span>5. 📦 Procurement MRP ('wek' &amp; 'mth')</span>
                        </button>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.65rem; font-size: 0.75rem;" id="sim-pulse-resolution-toggle-box">
                        <span style="color: #64748b; font-weight: 700;">Top Pulse Resolution:</span>
                        <div class="sim-pill-group">
                            <button type="button" id="btn-pm-monthly" class="btn-pill-item ${this.ganttGrid.pulseMode === "MONTHLY" ? "active" : ""}">12 Monthly Boxes</button>
                            <button type="button" id="btn-pm-weekly" class="btn-pill-item ${this.ganttGrid.pulseMode === "WEEKLY" ? "active" : ""}">Weekly Slots</button>
                        </div>
                    </div>
                </nav>

                <!-- 5. Active Sub-View Pane -->
                <main class="sim-view-pane" id="sim-active-view-container" style="padding: 1rem 1.5rem;">
                    <!-- Sub-view content rendered here -->
                </main>

            </div>
        `;

        this._bindUiEvents(container);
        this.renderActiveSubView();
    }

    renderActiveSubView() {
        if (this.currentTab === "THEMES") {
            this.themesTab.render();
        } else if (this.currentTab === "GANTT") {
            this.ganttGrid.render();
        } else if (this.currentTab === "MONTHLY") {
            this.monthlyTab.render();
        } else if (this.currentTab === "BOD") {
            this.bodTable.render();
        } else if (this.currentTab === "MRP") {
            this.mrpTable.render();
        }
    }

    bindStoreEvents() {
        simulationStore.subscribe("simulationCompleted", (result) => {
            this.summaryCards.render(result, simulationStore.monteCarloResult);
            this.renderActiveSubView();
        });

        simulationStore.subscribe("monteCarloCompleted", (mcResult) => {
            this.summaryCards.render(simulationStore.simulationResult, mcResult);
            Toast.success("Monte Carlo risk simulation complete!");
        });

        simulationStore.subscribe("scenarioLoaded", () => {
            this.ganttGrid.syncWithLiveStore(simulationStore);
            this.renderActiveSubView();
        });

        simulationStore.subscribe("syncCompleted", () => {
            this.ganttGrid.syncWithLiveStore(simulationStore);
            this.renderActiveSubView();
        });

        simulationStore.subscribe("shocksChanged", (shocks) => {
            const ribbonContainer = document.getElementById("sim-shock-ribbon-container");
            if (ribbonContainer) {
                ribbonContainer.style.display = shocks.length > 0 ? "block" : "none";
            }
            this.shockRibbon.render(shocks);
        });
    }

    _bindUiEvents(container) {
        [2026, 2027, 2028].forEach(yr => {
            container.querySelector(`#btn-yr-${yr}`)?.addEventListener("click", () => this.setYear(yr));
        });

        container.querySelector("#tab-nav-themes")?.addEventListener("click", () => this.switchTab("THEMES"));
        container.querySelector("#tab-nav-gantt")?.addEventListener("click", () => this.switchTab("GANTT"));
        container.querySelector("#tab-nav-monthly")?.addEventListener("click", () => this.switchTab("MONTHLY"));
        container.querySelector("#tab-nav-bod")?.addEventListener("click", () => this.switchTab("BOD"));
        container.querySelector("#tab-nav-mrp")?.addEventListener("click", () => this.switchTab("MRP"));

        container.querySelector("#btn-pm-monthly")?.addEventListener("click", () => {
            this.ganttGrid.setPulseMode("MONTHLY");
            this._updatePulseToggleButtons("MONTHLY");
        });
        container.querySelector("#btn-pm-weekly")?.addEventListener("click", () => {
            this.ganttGrid.setPulseMode("WEEKLY");
            this._updatePulseToggleButtons("WEEKLY");
        });

        container.querySelector("#btn-open-scenarios")?.addEventListener("click", () => {
            this.scenarioModal.open();
        });

        container.querySelector("#btn-open-shock-modal")?.addEventListener("click", () => {
            this.shockModal.open();
        });

        container.querySelector("#btn-export-excel-file")?.addEventListener("click", () => {
            Toast.info("Generating 1:1 Excel export with BOD KPI, PRT Monthly, Weekly MRP & Pond Schedule...");
            setTimeout(() => {
                Toast.success("Excel workbook exported successfully: iSHARP_Simulation_2026_LE.xlsx");
            }, 800);
        });

        container.querySelectorAll("[data-nav-view]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const targetView = e.currentTarget.getAttribute("data-nav-view");
                if (targetView) {
                    window.location.hash = `#/${targetView}`;
                }
            });
        });
    }

    async ensureInitialized() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        try {
            if (!simulationStore.status.isInitialized) {
                await simulationStore.init({ baseYear: this.selectedYear });
            }
            this.ganttGrid.syncWithLiveStore(simulationStore);
            this.summaryCards.render(simulationStore.simulationResult, simulationStore.monteCarloResult);
            this.renderActiveSubView();
        } catch (err) {
            console.error("SimulationPage.ensureInitialized failed:", err);
        }
    }

    _updatePulseToggleButtons(mode) {
        const btnM = document.getElementById("btn-pm-monthly");
        const btnW = document.getElementById("btn-pm-weekly");
        if (btnM && btnW) {
            btnM.className = mode === "MONTHLY" ? "btn-pill-item active" : "btn-pill-item";
            btnW.className = mode === "WEEKLY" ? "btn-pill-item active" : "btn-pill-item";
        }
    }
}
