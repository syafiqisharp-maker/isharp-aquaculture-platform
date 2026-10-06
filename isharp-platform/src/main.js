/**
 * iSHARP DBMS 2.0 — Main Application Entry Point
 * Orchestrates modular components, reactive state, and tab coordination.
 */

import { appState } from "./state/appState.js";
import { filterStore } from "./state/filterStore.js";
import { PondRepository } from "./infrastructure/repositories/pondRepository.js";
import { Toast } from "./components/Toast.js";
import { Navbar } from "./components/Navbar.js";
import { ExecutiveFilterBar } from "./components/ExecutiveFilterBar.js";
import { MasterBanner } from "./components/MasterBanner.js";
import { PondTreeNav } from "./components/PondTreeNav.js";
import { ExcelModal } from "./features/excelImporter/excelModal.js";
import { ViewRouter } from "./routing/viewRouter.js";
import { LandingPage } from "./modules/landing/landingPage.js";
import { ExecutiveView } from "./modules/executive/executiveTab.js";
import { FieldOpsView } from "./modules/fieldOps/fieldOpsView.js";
import { DbmsView } from "./modules/dbms/dbmsView.js";

// Tab Modules (System 2: iSHARP DBMS)
import { MasterTab } from "./modules/dbms/masterTab.js";
import { SamplingTab } from "./modules/dbms/samplingTab.js";
import { FeedingTab } from "./modules/dbms/feedingTab.js";
import { PerformanceTab } from "./modules/dbms/performanceTab.js";
import { StockingTab } from "./modules/dbms/stockingTab.js";
import { HarvestTab } from "./modules/dbms/harvestTab.js";
import { LifecycleTab } from "./modules/dbms/lifecycleTab.js";
import { LaboratoryTab } from "./modules/dbms/laboratoryTab.js";
import { StaffTab } from "./modules/dbms/staffTab.js";
import { UtilitiesTab } from "./modules/dbms/utilitiesTab.js";

class App {
    constructor() {
        this.init();
    }

    async init() {
        try {
            console.log("🦐 Bootstrapping iSHARP DBMS 2.0 (Frutiger Aero Edition)...");

            // 0. Initialize View Router, Landing Page, Executive Dashboard, Field Operations, and DBMS View
            this.landingPage = new LandingPage("view-portal");
            this.executiveView = new ExecutiveView("view-executive");
            this.fieldOpsView = new FieldOpsView("view-field-ops");
            this.dbmsView = new DbmsView("view-dbms");
            this.router = new ViewRouter();
            this.landingPage.setRouter(this.router);

            // 1. Initialize Subsystems & Components
            this.excelModal = new ExcelModal((category, pondIndex) => {
                this.onExcelImportComplete(category, pondIndex);
            });

            this.harvestTab = new HarvestTab((cat) => this.excelModal.open(cat || "harvest"));
            this.lifecycleTab = new LifecycleTab((pondIndex) => this.navbar.selectPondByIndex(pondIndex));

            this.navbar = new Navbar(() => this.excelModal.open("sampling"));

            this.filterBar = new ExecutiveFilterBar();
            this.masterBanner = new MasterBanner((pondIndex) => {
                this.navbar.selectPondByIndex(pondIndex);
            });
            this.pondTree = new PondTreeNav((pondIndex) => {
                this.navbar.selectPondByIndex(pondIndex);
            });

            // Global Quick-Jump Keyboard Shortcut (Ctrl+K or Cmd+K)
            window.addEventListener("keydown", (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                    const searchInput = document.getElementById("input-pond-search") || document.getElementById("sidebar-pond-search");
                    if (searchInput) {
                        e.preventDefault();
                        searchInput.focus();
                        if (searchInput.select) searchInput.select();
                    }
                }
            });

            // 2. Initialize Tab Controllers
            this.tabs = {
                "tab-master": new MasterTab(),
                "tab-laboratory": new LaboratoryTab((cat) => this.excelModal.open(cat || "issues")),
                "tab-stocking": new StockingTab(),
                "tab-feeding": new FeedingTab((cat) => this.excelModal.open(cat || "feed")),
                "tab-sampling": new SamplingTab((cat) => this.excelModal.open(cat || "sampling")),
                "tab-performance": new PerformanceTab(),
                "tab-harvest": this.harvestTab,
                "tab-lifecycle": this.lifecycleTab,
                "tab-staff": new StaffTab(),
                "tab-utilities": new UtilitiesTab()
            };

            // 3. Tab Switching Coordinator
            this.bindTabNavigation();

            // 4. Initial Cloud Sync
            const isFieldOpsRoute = window.location.hash.toLowerCase().includes("field-ops");
            if (isFieldOpsRoute) {
                // Background non-blocking sync for Field Ops on mobile devices
                this.loadInitialData().catch(err => console.warn("Background DBMS sync deferred:", err));
            } else {
                Toast.info("Connecting to Supabase Cloud PostgreSQL...");
                await this.loadInitialData();
            }

        } catch (err) {
            console.error("App bootstrap error:", err);
            Toast.error(`Failed to initialize DBMS: ${err.message}`);
        }
    }

    bindTabNavigation() {
        const tabBtns = document.querySelectorAll(".tab-btn");
        const canvas = document.querySelector(".workspace-canvas");
        const tabScrollPositions = {};

        // When a new pond is selected, reset tab scroll positions so it starts fresh at top
        appState.subscribe("pondChanged", () => {
            Object.keys(tabScrollPositions).forEach(k => delete tabScrollPositions[k]);
            if (canvas) canvas.scrollTop = 0;
        });

        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.dataset.tab;
                if (!targetTab) return;

                // Save scroll position of current active tab
                const currentTab = appState.activeTab;
                if (canvas && currentTab) {
                    tabScrollPositions[currentTab] = canvas.scrollTop;
                }

                // Toggle active buttons
                tabBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                // Toggle active tab panes
                document.querySelectorAll(".tab-pane").forEach(pane => {
                    pane.classList.remove("active");
                });
                const targetPane = document.getElementById(targetTab);
                if (targetPane) targetPane.classList.add("active");

                // Update state
                appState.setActiveTab(targetTab);

                // Restore scroll position for target tab
                if (canvas) {
                    const savedY = tabScrollPositions[targetTab] || 0;
                    canvas.scrollTop = savedY;
                }
            });
        });
    }

    async loadInitialData() {
        try {
            appState.setLoading(true);
            const initialFilters = filterStore.getFilters();
            const cycles = await PondRepository.getCycles(initialFilters);
            appState.setCycles(cycles);

            if (cycles && cycles.length > 0) {
                await this.navbar.selectPondByIndex(cycles[0].pond_index);
            }
            Toast.success(`Cloud Synced: Loaded ${cycles.length} production ponds.`);
        } catch (err) {
            console.error("Initial load error:", err);
            Toast.error(`Could not connect to Supabase: ${err.message}`);
        } finally {
            appState.setLoading(false);
        }
    }

    async saveActiveTabData() {
        const activeTab = appState.activeTab;
        const controller = this.tabs[activeTab];

        if (controller && typeof controller.saveData === "function") {
            await controller.saveData();
        } else {
            Toast.info(`No changes to save for this tab.`);
        }
    }

    onExcelImportComplete(category, pondIndex) {
        if (category === "sampling") {
            const samplingController = this.tabs["tab-sampling"];
            if (samplingController) samplingController.loadData(pondIndex);
        } else if (category === "feed") {
            const feedController = this.tabs["tab-feeding"];
            if (feedController) feedController.loadData(pondIndex);
        } else if (category === "issues") {
            const labController = this.tabs["tab-laboratory"];
            if (labController) labController.loadIssues(pondIndex);
            if (this.masterBanner) this.masterBanner.updateDiseaseBadge(pondIndex);
        } else if (category === "harvest") {
            const harvestController = this.tabs["tab-harvest"];
            if (harvestController && appState.currentPond) harvestController.render(appState.currentPond);
        }
    }
}

// Instantiate on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    window.__isharpApp = new App();
    window.app = {
        openExcelModal: (cat) => window.__isharpApp.excelModal?.open(cat),
        promptTerminatePond: (createNext = true) => window.__isharpApp.lifecycleTab?.openTerminateModal(createNext),
        promptRevivePond: () => window.__isharpApp.lifecycleTab?.openReviveModal(),
        exportCycleCsv: () => window.__isharpApp.tabs["tab-utilities"]?.exportCycleCsv(),
        verifySyncStatus: () => window.__isharpApp.tabs["tab-utilities"]?.verifySyncStatus()
    };
});

