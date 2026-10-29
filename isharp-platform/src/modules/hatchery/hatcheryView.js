/**
 * iSHARP DBMS 2.0 — Telaga Putat Hatchery (TPH) Module Subsystem
 * Top-Level View Controller coordinating 64-Tank Map, PL Harvest Report, and Broodstock Report
 */

import { HatcheryTankMap } from "./HatcheryTankMap.js";
import { PlHarvestReportPage } from "./PlHarvestReportPage.js";
import { BroodstockReportPage } from "./BroodstockReportPage.js";

export class HatcheryView {
    constructor(containerId = "view-hatchery") {
        this.container = document.getElementById(containerId);
        this.currentSubView = "MAP"; // "MAP" | "PL_REPORT" | "BROODSTOCK_REPORT"
        this.initialized = false;

        this.tankMap = null;
        this.plReport = null;
        this.broodstockReport = null;
    }

    ensureInitialized() {
        if (!this.initialized) {
            this.initialized = true;
            this.handleRoute();
        }
    }

    /**
     * Inspects window.location.hash and renders appropriate sub-view
     */
    handleRoute() {
        if (!this.container) return;

        const hash = (window.location.hash || "").toLowerCase();

        if (hash.includes("pl-report")) {
            this.renderPlReport();
        } else if (hash.includes("broodstock-report")) {
            this.renderBroodstockReport();
        } else {
            this.renderMap();
        }
    }

    renderMap() {
        this.currentSubView = "MAP";
        if (!this.container) return;
        this.container.innerHTML = `<div id="hatchery-subview-container"></div>`;
        const subContainer = document.getElementById("hatchery-subview-container");
        this.tankMap = new HatcheryTankMap(subContainer, (route) => {
            if (route === "portal") {
                window.location.hash = "#portal";
            } else if (route === "hatchery/pl-report") {
                window.location.hash = "#/hatchery/pl-report";
                this.renderPlReport();
            } else if (route === "hatchery/broodstock-report") {
                window.location.hash = "#/hatchery/broodstock-report";
                this.renderBroodstockReport();
            }
        });
        this.tankMap.init();
    }

    renderPlReport() {
        this.currentSubView = "PL_REPORT";
        if (!this.container) return;
        this.container.innerHTML = `<div id="hatchery-subview-container"></div>`;
        const subContainer = document.getElementById("hatchery-subview-container");
        this.plReport = new PlHarvestReportPage(subContainer, (route) => {
            if (route === "hatchery") {
                window.location.hash = "#/hatchery";
                this.renderMap();
            }
        });
        this.plReport.init();
    }

    renderBroodstockReport() {
        this.currentSubView = "BROODSTOCK_REPORT";
        if (!this.container) return;
        this.container.innerHTML = `<div id="hatchery-subview-container"></div>`;
        const subContainer = document.getElementById("hatchery-subview-container");
        this.broodstockReport = new BroodstockReportPage(subContainer, (route) => {
            if (route === "hatchery") {
                window.location.hash = "#/hatchery";
                this.renderMap();
            }
        });
        this.broodstockReport.init();
    }
}
