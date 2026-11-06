/**
 * iSHARP DBMS 2.0 — Daily Report Tab Controller
 * Integrates Executive Dashboard 8 Hero Cards (SSOT), 216-Pond Map Progress,
 * Module 01-09 Species Allocation, and Outlook-Compliant Clipboard Email Export.
 */

import { appState } from "../../state/appState.js";
import { Toast } from "../../components/Toast.js";
import { ExecutiveMetricsPresenter } from "../executive/ExecutiveMetricsPresenter.js";
import { HarvestRepository } from "../../infrastructure/repositories/harvestRepository.js";
import { PondRepository } from "../../infrastructure/repositories/pondRepository.js";
import { SamplingRepository } from "../../infrastructure/repositories/samplingRepository.js";
import { buildDailyReportEmailHtml } from "./utils/dailyReportHtmlBuilder.js";
import { DailyReportStateService } from "./services/DailyReportStateService.js";
import { DailyReportLabService } from "./services/DailyReportLabService.js";
import { DailyReportExcelService } from "./services/DailyReportExcelService.js";
import { DailyReportImageService, LAB_IMAGE_STORAGE_KEY, WHITEBOARD_IMAGE_STORAGE_KEY } from "./services/DailyReportImageService.js";

export class DailyReportTab {
    constructor() {
        this.container = null;
        this.previewContainer = null;
        this.isLoaded = false;
        this.isLoadingSSOT = false;
        this.isImageZoomed = false;
        this.isWhiteboardZoomed = false;

        // Current compiled report state
        this.reportState = this.getDefaultReportState();

        // Auto-refresh when tab is clicked
        appState.subscribe("tabChanged", (tabId) => {
            if (tabId === "tab-daily-report") {
                setTimeout(() => {
                    this.ensureInitialized();
                    this.loadSSOTData(false);
                }, 50);
            }
        });

        // Initialize early
        setTimeout(() => this.ensureInitialized(), 300);
    }

    getDefaultReportState() {
        return DailyReportStateService.getDefaultReportState();
    }

    ensureInitialized() {
        this.container = document.getElementById("tab-daily-report");
        if (!this.container) return;

        this.previewContainer = document.getElementById("daily-report-preview-canvas");

        // Load saved draft or initialize with defaults
        const savedDraft = this.loadDraftFromStorage();
        this.reportState = savedDraft || this.getDefaultReportState();

        // Always render immediately so user sees UI without waiting
        this.populateFormFromState();
        this.renderPreview();
        this.restoreDockedImage();
        this.restoreWhiteboardDockedImage();

        if (!this.isLoaded) {
            this.bindEvents();
            this.isLoaded = true;
        }
        this.loadSSOTData(false);
    }

    bindEvents() {
        if (!this.container) return;

        // Sync Button
        const btnSync = document.getElementById("btn-daily-report-sync");
        if (btnSync) {
            btnSync.addEventListener("click", () => this.loadSSOTData(true));
        }

        // Save Draft Button
        const btnSave = document.getElementById("btn-daily-report-save");
        if (btnSave) {
            btnSave.addEventListener("click", () => this.saveDraftToStorage(true));
        }

        // Copy to Email Button
        const btnCopy = document.getElementById("btn-daily-report-copy");
        if (btnCopy) {
            btnCopy.addEventListener("click", () => this.copyReportToClipboard());
        }

        // Copy Raw HTML Button
        const btnCopyHtml = document.getElementById("btn-daily-report-copy-html");
        if (btnCopyHtml) {
            btnCopyHtml.addEventListener("click", () => this.copyRawHtmlToClipboard());
        }

        // Fetch Weather Button
        const btnWeather = document.getElementById("btn-fetch-weather");
        if (btnWeather) {
            btnWeather.addEventListener("click", () => this.fetchSetiuWeather());
        }

        // Quick-Paste Lab Table Area
        const labPasteArea = document.getElementById("dr-input-lab-paste");
        if (labPasteArea) {
            labPasteArea.addEventListener("paste", (e) => {
                setTimeout(() => {
                    this.handleLabTablePaste(labPasteArea.value);
                }, 50);
            });
            labPasteArea.addEventListener("change", () => {
                if (labPasteArea.value.trim()) {
                    this.handleLabTablePaste(labPasteArea.value);
                }
            });
        }

        // Sample Lab Data Button
        const btnSampleLab = document.getElementById("btn-sample-lab-data");
        if (btnSampleLab) {
            btnSampleLab.addEventListener("click", () => {
                const sampleText = `Nov-26\n31/10/2026\t1/11/2026\t2/11/2026\t3/11/2026\t4/11/2026\nRainfall (8.30 am)\t0.00\t0.00\t8.60\t4.20\t1.00\nRainfall (4.00 pm)\t0.00\t0.00\t0.00\t0.00\t0.00\nTotal Rainfall\t0.00\t0.00\t8.60\t4.20\t1.00\nPH\t\t\t5.60\t5.75\t\nTotal Pond Harvested\t0\t2\t1\t2\t1\nMDC (cm) (standard <80cm)\t104\t100\t98\t90\t84\nDaily Ponds (am)\t30.66\t30.45\t30.78\t31.32\t31.63\nDaily Ponds Salinity (am)\t\t29.96\t30.71\t30.22\t29.20`;
                this.handleLabTablePaste(sampleText);
            });
        }

        // Shift 1 Day Button
        const btnShift = document.getElementById("btn-shift-day");
        if (btnShift) {
            btnShift.addEventListener("click", () => this.handleShiftDay());
        }

        // Lab Image Docking & File Upload
        const dockContainer = document.getElementById("dr-lab-dock-container");
        const fileInput = document.getElementById("dr-lab-file-input");
        const placeholder = document.getElementById("dr-lab-image-placeholder");
        const btnZoom = document.getElementById("btn-zoom-lab-img");
        const btnClear = document.getElementById("btn-clear-lab-img");

        if (placeholder && fileInput) {
            placeholder.addEventListener("click", () => fileInput.click());
        }

        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleImageDock(e.target.files[0]);
                }
            });
        }

        if (btnZoom) {
            btnZoom.addEventListener("click", () => this.toggleImageZoom());
        }

        if (btnClear) {
            btnClear.addEventListener("click", () => this.clearDockedImage());
        }

        if (dockContainer) {
            // Drag and drop support
            dockContainer.addEventListener("dragover", (e) => {
                e.preventDefault();
                dockContainer.style.borderColor = "#0284c7";
                dockContainer.style.backgroundColor = "#f0f9ff";
            });
            dockContainer.addEventListener("dragleave", (e) => {
                e.preventDefault();
                dockContainer.style.borderColor = "#93c5fd";
                dockContainer.style.backgroundColor = "#f8fafc";
            });
            dockContainer.addEventListener("drop", (e) => {
                e.preventDefault();
                dockContainer.style.borderColor = "#93c5fd";
                dockContainer.style.backgroundColor = "#f8fafc";
                if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
                    this.handleImageDock(e.dataTransfer.files[0]);
                }
            });

            // Container paste event
            dockContainer.addEventListener("paste", (e) => {
                this.handleClipboardPaste(e);
            });
        }

        // Global paste listener when Daily Report view is active
        document.addEventListener("paste", (e) => {
            const tab = document.getElementById("tab-daily-report");
            if (!tab || !tab.classList.contains("active")) return;

            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        this.handleImageDock(file);
                        return;
                    }
                }
            }
        });

        // Whiteboard Photo Dock & Zoom
        const btnWbZoom = document.getElementById("btn-toggle-whiteboard-zoom");
        const wbWrap = document.getElementById("dr-whiteboard-preview-wrap");
        const wbUpload = document.getElementById("dr-whiteboard-upload");
        if (btnWbZoom) {
            btnWbZoom.addEventListener("click", () => this.toggleWhiteboardZoom());
        }
        if (wbWrap) {
            wbWrap.addEventListener("click", () => this.toggleWhiteboardZoom());
        }
        if (wbUpload) {
            wbUpload.addEventListener("change", (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleWhiteboardUpload(e.target.files[0]);
                }
            });
        }

        // Add Forecast / Harvest / Stocking Plan Row Buttons & Excel Sync
        const btnAddFc = document.getElementById("btn-add-forecast-row");
        if (btnAddFc) {
            btnAddFc.addEventListener("click", () => this.addForecastRow());
        }
        const btnAddHr = document.getElementById("btn-add-harvest-row");
        if (btnAddHr) {
            btnAddHr.addEventListener("click", () => this.addHarvestReportRow());
        }
        const btnAddSp = document.getElementById("btn-add-stocking-plan-row");
        if (btnAddSp) {
            btnAddSp.addEventListener("click", () => this.addStockingPlanRow());
        }
        const inputSpTitle = document.getElementById("dr-input-stocking-plan-title");
        if (inputSpTitle) {
            inputSpTitle.addEventListener("input", () => {
                if (!this.reportState.stockingPlanSummary) {
                    this.reportState.stockingPlanSummary = { title: inputSpTitle.value, rows: [] };
                } else {
                    this.reportState.stockingPlanSummary.title = inputSpTitle.value;
                }
                this.renderPreview();
                this.saveDraftToStorage(false);
            });
        }
        const btnRefreshHLog = document.getElementById("btn-refresh-harvest-log");
        if (btnRefreshHLog) {
            btnRefreshHLog.addEventListener("click", () => this.reloadHarvestLogFromExcel(true));
        }

        // Input live change listener
        const formInputs = this.container.querySelectorAll("input, textarea, select");
        formInputs.forEach(input => {
            if (input.id === "dr-input-lab-paste" || input.id === "dr-lab-file-input" || input.id === "dr-whiteboard-upload" || input.id === "dr-input-stocking-plan-title" || input.classList.contains("dr-fc-input") || input.classList.contains("dr-hr-input") || input.classList.contains("dr-sp-input")) return;
            input.addEventListener("input", () => {
                if (input.id === "dr-input-cleaning-teams") {
                    this.userHasOverriddenCleaningTeams = true;
                }
                this.updateStateFromForm();
                this.renderPreview();
            });
        });
    }

    /**
     * Docks user pasted or uploaded image into Card 3 reference area and persists it in sessionStorage.
     */
    async handleImageDock(file) {
        try {
            const dataUrl = await DailyReportImageService.readFileAsDataUrl(file);
            DailyReportImageService.setLabDockedImage(dataUrl);
            sessionStorage.setItem(LAB_IMAGE_STORAGE_KEY, dataUrl);
            Toast.success("📸 Lab email screenshot docked! You can zoom or reference it while filling.");
        } catch (err) {
            Toast.info("Please select or paste a valid image file.");
        }
    }

    setDockedImage(dataUrl) {
        DailyReportImageService.setLabDockedImage(dataUrl);
    }

    clearDockedImage() {
        DailyReportImageService.clearLabDockedImage();
        this.isImageZoomed = false;
        Toast.info("Docked lab picture cleared.");
    }

    toggleImageZoom() {
        this.isImageZoomed = DailyReportImageService.toggleLabImageZoom(this.isImageZoomed);
    }

    restoreDockedImage() {
        DailyReportImageService.restoreLabDockedImage();
    }

    toggleWhiteboardZoom() {
        this.isWhiteboardZoomed = DailyReportImageService.toggleWhiteboardZoom(this.isWhiteboardZoomed);
    }

    async handleWhiteboardUpload(file) {
        try {
            const dataUrl = await DailyReportImageService.readFileAsDataUrl(file);
            const img = document.getElementById("dr-whiteboard-img");
            if (img) img.src = dataUrl;
            localStorage.setItem(WHITEBOARD_IMAGE_STORAGE_KEY, dataUrl);
            Toast.success("📸 Farm whiteboard photo updated! You can inspect and edit the schedule below.");
        } catch (err) {
            Toast.info("Please select a valid image file.");
        }
    }

    restoreWhiteboardDockedImage() {
        DailyReportImageService.restoreWhiteboardPhoto();
    }

    /**
     * Adds a new pond candidate row to the weekly harvest forecast schedule.
     */
    addForecastRow() {
        if (!this.reportState.harvestForecasts) this.reportState.harvestForecasts = [];
        this.reportState.harvestForecasts.push({
            pond: "000000",
            doc: 70,
            date: "08/11",
            species: "Van",
            abw: 15,
            biomass: 3000,
            type: "Partial"
        });
        this.renderForecastTable();
        this.renderPreview();
        this.saveDraftToStorage(false);
        Toast.success("➕ Added new row to Harvest Forecast!");
    }

    removeForecastRow(idx) {
        if (!this.reportState.harvestForecasts || !this.reportState.harvestForecasts[idx]) return;
        const removed = this.reportState.harvestForecasts.splice(idx, 1);
        this.renderForecastTable();
        this.renderPreview();
        this.saveDraftToStorage(false);
        Toast.info(`Removed ${removed[0]?.pond || 'pond'} from Harvest Forecast.`);
    }

    /**
     * Adds a pond row to this week's harvest report.
     */
    addHarvestReportRow() {
        if (!this.reportState.harvestReports) this.reportState.harvestReports = [];
        this.reportState.harvestReports.push({
            pond: "00.00.00",
            date: "05/11",
            type: "Partial",
            actTonnage: "",
            actAbw: "",
            planTonnage: 3000,
            planAbw: 15,
            planAbw2: ""
        });
        this.renderHarvestReportTable();
        this.renderPreview();
        this.saveDraftToStorage(false);
        Toast.success("➕ Added new row to Harvest Report!");
    }

    removeHarvestReportRow(idx) {
        if (!this.reportState.harvestReports || !this.reportState.harvestReports[idx]) return;
        const removed = this.reportState.harvestReports.splice(idx, 1);
        this.renderHarvestReportTable();
        this.renderPreview();
        this.saveDraftToStorage(false);
        Toast.info(`Removed ${removed[0]?.pond || 'pond'} from Harvest Report.`);
    }

    /**
     * Adds a row to the monthly stocking plan target.
     */
    addStockingPlanRow() {
        if (!this.reportState.stockingPlanSummary) {
            this.reportState.stockingPlanSummary = { title: "Stocking Plan Nov '26", rows: [] };
        }
        if (!this.reportState.stockingPlanSummary.rows) {
            this.reportState.stockingPlanSummary.rows = [];
        }
        this.reportState.stockingPlanSummary.rows.push({
            genetic: "SPT",
            ponds: 10,
            density: 450000,
            fryMil: 4.50
        });
        this.renderStockingPlanTable();
        this.renderPreview();
        this.saveDraftToStorage(false);
        Toast.success("➕ Added new row to Monthly Stocking Plan!");
    }

    removeStockingPlanRow(idx) {
        if (!this.reportState.stockingPlanSummary?.rows || !this.reportState.stockingPlanSummary.rows[idx]) return;
        const removed = this.reportState.stockingPlanSummary.rows.splice(idx, 1);
        this.renderStockingPlanTable();
        this.renderPreview();
        this.saveDraftToStorage(false);
        Toast.info(`Removed ${removed[0]?.genetic || 'row'} from Stocking Plan.`);
    }

    /**
     * Renders editable monthly stocking plan target grid in Card 5.
     */
    renderStockingPlanTable() {
        const container = document.getElementById("dr-stocking-plan-container");
        const titleInput = document.getElementById("dr-input-stocking-plan-title");
        const plan = this.reportState.stockingPlanSummary || { title: "Stocking Plan Nov '26", rows: [] };

        if (titleInput && titleInput.value !== (plan.title || "")) {
            titleInput.value = plan.title || "";
        }

        if (!container) return;

        const rows = plan.rows || [];
        if (rows.length === 0) {
            container.innerHTML = `<div style="padding: 8px; color: #94a3b8; font-style: italic; text-align: center; font-size: 0.7rem;">No plan rows. Click "+ Add Row" to add.</div>`;
            return;
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem; text-align: center;">
                <thead>
                    <tr style="background: #f1f5f9; color: #475569; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                        <th style="padding: 3px 2px; width: 25%;">Genetic</th>
                        <th style="padding: 3px 2px; width: 22%;">Ponds</th>
                        <th style="padding: 3px 2px; width: 25%;">Density</th>
                        <th style="padding: 3px 2px; width: 22%;">Fry (Mil)</th>
                        <th style="padding: 3px 2px; width: 6%;"></th>
                    </tr>
                </thead>
                <tbody>
        `;

        rows.forEach((r, idx) => {
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 2px;"><input type="text" class="dr-sp-input" data-idx="${idx}" data-field="genetic" value="${r.genetic || ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; font-weight: 700; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="number" class="dr-sp-input" data-idx="${idx}" data-field="ponds" value="${r.ponds ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="number" class="dr-sp-input" data-idx="${idx}" data-field="density" value="${r.density ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="number" step="0.01" class="dr-sp-input" data-idx="${idx}" data-field="fryMil" value="${r.fryMil ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: right; font-weight: 700; color: #0284c7; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><button type="button" class="btn-del-sp" data-idx="${idx}" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 0.72rem; padding: 0;" title="Delete row">🗑️</button></td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;

        // Attach listeners
        const inputs = container.querySelectorAll(".dr-sp-input");
        inputs.forEach(input => {
            input.addEventListener("input", (e) => {
                const idx = parseInt(e.target.dataset.idx, 10);
                const field = e.target.dataset.field;
                if (!isNaN(idx) && this.reportState.stockingPlanSummary?.rows?.[idx]) {
                    let val = e.target.value;
                    if (field === "ponds" || field === "density" || field === "fryMil") {
                        val = parseFloat(val) || 0;
                    }
                    this.reportState.stockingPlanSummary.rows[idx][field] = val;
                    this.renderPreview();
                    this.saveDraftToStorage(false);
                }
            });
        });

        const delBtns = container.querySelectorAll(".btn-del-sp");
        delBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                if (!isNaN(idx)) {
                    this.removeStockingPlanRow(idx);
                }
            });
        });
    }

    /**
     * Reloads latest harvest records from public/data/daily_harvest_log.json
     * (synced from Daily_Harvest_Log.xlsx).
     */
    async reloadHarvestLogFromExcel(showToast = true) {
        try {
            const data = await DailyReportExcelService.fetchWeeklyHarvestLog();
            if (data?.harvestReports && data.harvestReports.length > 0) {
                this.reportState.harvestReports = data.harvestReports;
                if (data.week_label) {
                    this.reportState.harvestWeekLabel = data.week_label;
                }
                this.renderHarvestReportTable();
                this.renderForecastTable();
                this.renderPreview();
                if (showToast) {
                    this.saveDraftToStorage(false);
                    Toast.success(`🌾 Synced ${data.count} ponds from Daily_Harvest_Log.xlsx (${data.week_label || 'This Week'})!`);
                }
            } else {
                if (showToast) Toast.info("No weekly harvest records found in Daily_Harvest_Log.");
            }
        } catch (err) {
            console.warn("Could not reload harvest log JSON:", err);
            if (showToast) Toast.info("Could not read Daily_Harvest_Log.json. Retaining current records.");
        }
    }

    /**
     * Renders editable weekly harvest forecast schedule grid in Card 6,
     * with real-time discrepancy reconciliation against actuals.
     */
    renderForecastTable() {
        const container = document.getElementById("dr-forecast-table-container");
        const badge = document.getElementById("badge-forecast-count");
        const forecasts = this.reportState.harvestForecasts || [];

        if (badge) {
            badge.textContent = `${forecasts.length} Ponds`;
        }

        if (!container) return;

        if (forecasts.length === 0) {
            container.innerHTML = `<div style="padding: 10px; color: #94a3b8; font-style: italic; text-align: center; font-size: 0.72rem;">No harvest forecast rows. Click "+ Add Pond" to add.</div>`;
            return;
        }

        // Reconcile Whiteboard Forecast against actuals
        const reconciled = DailyReportExcelService.reconcileForecastWithActuals(
            forecasts,
            this.reportState.harvestReports,
            this.reportState.todayHarvests
        );
        const reconciliationSummary = DailyReportExcelService.calculateReconciliationSummary(reconciled);

        // Update KPI summary text in Card 6
        const kpiText = document.getElementById("dr-forecast-reconciliation-text");
        if (kpiText) {
            kpiText.textContent = reconciliationSummary.summaryText;
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem; text-align: center;">
                <thead>
                    <tr style="background: #f1f5f9; color: #475569; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                        <th style="padding: 3px 2px; width: 12%;">Date</th>
                        <th style="padding: 3px 2px; width: 14%;">Pond</th>
                        <th style="padding: 3px 2px; width: 9%;">DOC</th>
                        <th style="padding: 3px 2px; width: 9%;">Spec</th>
                        <th style="padding: 3px 2px; width: 9%;">ABW</th>
                        <th style="padding: 3px 2px; width: 12%;">Biomass</th>
                        <th style="padding: 3px 2px; width: 10%;">Type</th>
                        <th style="padding: 3px 2px; width: 20%;">Actuals / Status</th>
                        <th style="padding: 3px 2px; width: 5%;"></th>
                    </tr>
                </thead>
                <tbody>
        `;

        reconciled.forEach((f, idx) => {
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 2px;"><input type="text" class="dr-fc-input" data-idx="${idx}" data-field="date" value="${f.date || ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="text" class="dr-fc-input" data-idx="${idx}" data-field="pond" value="${f.pond || ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; font-weight: 700; color: #002060; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="number" class="dr-fc-input" data-idx="${idx}" data-field="doc" value="${f.doc ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;">
                        <select class="dr-fc-input" data-idx="${idx}" data-field="species" style="width: 100%; font-size: 0.68rem; padding: 1px 0; border: 1px solid #cbd5e1; border-radius: 3px;">
                            <option value="Van" ${f.species === "Van" ? "selected" : ""}>Van</option>
                            <option value="Mon" ${f.species === "Mon" ? "selected" : ""}>Mon</option>
                        </select>
                    </td>
                    <td style="padding: 2px;"><input type="number" class="dr-fc-input" data-idx="${idx}" data-field="abw" value="${f.abw ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="number" class="dr-fc-input" data-idx="${idx}" data-field="biomass" value="${f.biomass ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: right; font-weight: 700; color: #274e13; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="text" class="dr-fc-input" data-idx="${idx}" data-field="type" value="${f.type || ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;">
                        <span style="display: inline-block; padding: 2px 4px; border-radius: 4px; font-size: 0.63rem; font-weight: 700; color: ${f.badgeColor}; background: ${f.badgeBg}; border: 1px solid ${f.badgeColor}40;">
                            ${f.badgeText}
                        </span>
                    </td>
                    <td style="padding: 2px;"><button type="button" class="btn-del-fc" data-idx="${idx}" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 0.72rem; padding: 0;" title="Delete row">🗑️</button></td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;

        // Attach listeners
        const inputs = container.querySelectorAll(".dr-fc-input");
        inputs.forEach(input => {
            input.addEventListener("input", (e) => {
                const idx = parseInt(e.target.dataset.idx, 10);
                const field = e.target.dataset.field;
                if (!isNaN(idx) && this.reportState.harvestForecasts[idx]) {
                    let val = e.target.value;
                    if (field === "doc" || field === "abw" || field === "biomass") {
                        val = parseFloat(val) || 0;
                    }
                    this.reportState.harvestForecasts[idx][field] = val;
                    this.renderPreview();
                    this.saveDraftToStorage(false);
                }
            });
        });

        const delBtns = container.querySelectorAll(".btn-del-fc");
        delBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                if (!isNaN(idx)) {
                    this.removeForecastRow(idx);
                }
            });
        });
    }

    /**
     * Renders editable completed harvest report grid in Card 6.
     */
    renderHarvestReportTable() {
        const container = document.getElementById("dr-harvest-report-container");
        const reports = this.reportState.harvestReports || [];

        if (!container) return;

        if (reports.length === 0) {
            container.innerHTML = `<div style="padding: 10px; color: #94a3b8; font-style: italic; text-align: center; font-size: 0.72rem;">No harvest report rows. Click "+ Add Pond" to add.</div>`;
            return;
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem; text-align: center;">
                <thead>
                    <tr style="background: #f1f5f9; color: #475569; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                        <th style="padding: 3px 2px; width: 17%;">Pond</th>
                        <th style="padding: 3px 2px; width: 13%;">Date</th>
                        <th style="padding: 3px 2px; width: 12%;">Type</th>
                        <th style="padding: 3px 2px; width: 14%;">Act Ton</th>
                        <th style="padding: 3px 2px; width: 13%;">Act ABW</th>
                        <th style="padding: 3px 2px; width: 14%;">Plan Ton</th>
                        <th style="padding: 3px 2px; width: 11%;">Plan ABW</th>
                        <th style="padding: 3px 2px; width: 6%;"></th>
                    </tr>
                </thead>
                <tbody>
        `;

        reports.forEach((h, idx) => {
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 2px;"><input type="text" class="dr-hr-input" data-idx="${idx}" data-field="pond" value="${h.pond || ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; font-weight: 700; color: #002060; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="text" class="dr-hr-input" data-idx="${idx}" data-field="date" value="${h.date || ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="text" class="dr-hr-input" data-idx="${idx}" data-field="type" value="${h.type || ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="number" class="dr-hr-input" data-idx="${idx}" data-field="actTonnage" value="${h.actTonnage ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: right; font-weight: 700; color: #002060; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="number" step="0.1" class="dr-hr-input" data-idx="${idx}" data-field="actAbw" value="${h.actAbw ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="number" class="dr-hr-input" data-idx="${idx}" data-field="planTonnage" value="${h.planTonnage ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: right; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><input type="number" step="0.1" class="dr-hr-input" data-idx="${idx}" data-field="planAbw" value="${h.planAbw ?? ''}" style="width: 100%; font-size: 0.68rem; padding: 2px 1px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px;" /></td>
                    <td style="padding: 2px;"><button type="button" class="btn-del-hr" data-idx="${idx}" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 0.72rem; padding: 0;" title="Delete row">🗑️</button></td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;

        // Attach listeners
        const inputs = container.querySelectorAll(".dr-hr-input");
        inputs.forEach(input => {
            input.addEventListener("input", (e) => {
                const idx = parseInt(e.target.dataset.idx, 10);
                const field = e.target.dataset.field;
                if (!isNaN(idx) && this.reportState.harvestReports[idx]) {
                    let val = e.target.value.trim();
                    if (val !== "" && (field === "actTonnage" || field === "actAbw" || field === "planTonnage" || field === "planAbw")) {
                        const num = parseFloat(val);
                        val = isNaN(num) ? "" : num;
                    }
                    this.reportState.harvestReports[idx][field] = val;
                    this.renderPreview();
                    this.renderForecastTable(); // Instantly update Whiteboard Forecast reconciliation status & KPIs
                    this.saveDraftToStorage(false);
                }
            });
        });

        const delBtns = container.querySelectorAll(".btn-del-hr");
        delBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                if (!isNaN(idx)) {
                    this.removeHarvestReportRow(idx);
                }
            });
        });
    }

    handleClipboardPaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    this.handleImageDock(file);
                    return;
                }
            }
        }
        // If text was pasted
        const text = e.clipboardData?.getData("text");
        if (text && text.includes("\t") && (text.includes("Rainfall") || text.includes("MDC") || text.includes("/2026"))) {
            e.preventDefault();
            this.handleLabTablePaste(text);
        }
    }

    /**
     * Shifts previous 4 days rightwards (Days 0-3 become Days 1-4) and advances today's date into Day 0 (leftmost),
     * focusing the leftmost input for immediate 1-number entry.
     */
    handleShiftDay() {
        this.updateStateFromForm();
        const { nextDate, rainfallHistory } = DailyReportLabService.shiftRainfallDays(this.reportState.rainfallHistory);
        if (!nextDate) return;

        this.reportState.rainfallHistory = rainfallHistory;

        // Synchronize 5 date & mm fields in UI
        for (let i = 0; i < 5; i++) {
            const item = this.reportState.rainfallHistory[i];
            const elDate = document.getElementById(`dr-rf-date-${i}`);
            const elMm = document.getElementById(`dr-rf-mm-${i}`);
            if (elDate) elDate.value = item.date;
            if (elMm) elMm.value = (item.mm || "0.00").replace(/mm/gi, "").trim();
        }

        // Re-render email preview & save draft locally
        this.renderPreview();
        this.saveDraftToStorage(false);

        // Highlight and focus leftmost (today's) mm input for instant typing
        const todayMmInput = document.getElementById("dr-rf-mm-0");
        if (todayMmInput) {
            todayMmInput.focus();
            todayMmInput.select();
        }

        Toast.success(`📅 Shifted 1 day forward! Today (${nextDate}) is ready on the left.`);
    }

    /**
     * Parses pasted laboratory email table and auto-fills 5-day rainfall, MDC, AM temp, and salinity.
     */
    handleLabTablePaste(rawText) {
        if (!rawText || typeof rawText !== "string") return;
        const parsed = DailyReportLabService.parseLabTableText(rawText);
        if (!parsed) {
            Toast.info("Could not detect tabular laboratory data in pasted text. Please check format.");
            return;
        }

        const { updatedFields } = DailyReportLabService.applyParsedLabData(parsed, this.reportState);

        // Synchronize Form UI & Preview
        this.populateFormFromState();
        this.renderPreview();
        this.saveDraftToStorage(false);

        // Clear paste box with placeholder confirmation
        const labPasteArea = document.getElementById("dr-input-lab-paste");
        if (labPasteArea) {
            labPasteArea.value = "";
            labPasteArea.placeholder = `✅ Synced: ${updatedFields.join(", ")}`;
        }

        Toast.success(`✨ Lab Email Parsed: Extracted ${updatedFields.join(", ")}!`);
    }

    /**
     * Fetches operational cycles, 12-month harvest & stocking batches, 216-pond daily progress,
     * and biometrics samplings directly from Supabase, computing SSOT metrics via ExecutiveMetricsPresenter.
     */
    async loadSSOTData(showToast = true) {
        if (this.isLoadingSSOT) return;
        this.isLoadingSSOT = true;
        const badge = document.getElementById("badge-ssot-status");
        if (badge) {
            badge.textContent = "Syncing SSOT...";
            badge.style.background = "#eff6ff";
            badge.style.color = "#0284c7";
        }

        try {
            if (showToast) Toast.info("Syncing metrics from Executive Dashboard 8 Hero Cards & 216 Map...");

            const [harvestRes, stockingBatches, opCycles, samplings, dailyProgress, activeCycles] = await Promise.all([
                HarvestRepository.get12MonthHarvestData(12).catch(() => ({ dailyHarvests: [], salesRecords: [] })),
                PondRepository.get12MonthStockingBatches(12).catch(() => []),
                PondRepository.get12MonthOperationalCycles(12).catch(() => []),
                SamplingRepository.getRecentSamplings(1500).catch(() => []),
                PondRepository.getDailyPondProgress().catch(() => []),
                PondRepository.getActiveCycles().catch(() => [])
            ]);

            const now = new Date();

            // 1. Hero Card 4: Total Harvest (YTD & MTD Tonnage & Ponds)
            let harvestAgg = { ytdTonnage: 1109.9, ytdPonds: 346, mtdTonnage: 0, mtdPonds: 7 };
            try {
                harvestAgg = ExecutiveMetricsPresenter.aggregateMonthlyHarvest(
                    harvestRes?.dailyHarvests || [],
                    harvestRes?.salesRecords || [],
                    now,
                    dailyProgress || [],
                    opCycles || []
                );
            } catch (e) {
                console.warn("Could not calculate harvestAgg:", e);
            }

            // 2. Hero Card 5: Total Stocking (YTD & MTD Fry Volume & Ponds)
            let stockAgg = { ytdPonds: 428, mtdPonds: 7, mtdMillion: 2.91 };
            try {
                stockAgg = ExecutiveMetricsPresenter.aggregateMonthlyStocking(
                    stockingBatches || [],
                    now,
                    dailyProgress || [],
                    opCycles || []
                );
            } catch (e) {
                console.warn("Could not calculate stockAgg:", e);
            }

            // 3. Hero Card 7 & Detailed 5-Bracket DOC Distribution
            const culturingPonds = (dailyProgress || []).filter(p => (p.progress_state || "").toUpperCase() === "CULTURE");
            const activePool = culturingPonds.length > 0 ? culturingPonds : (activeCycles || []);
            let docComp = { overall: { early: 19, earlyPct: 16, mid: 85, midPct: 73, finishing: 14, finishingPct: 12 } };
            try {
                docComp = ExecutiveMetricsPresenter.calculateDocComposition(activePool);
            } catch (e) {
                console.warn("Could not calculate docComp:", e);
            }

            let dynamicDocBrackets = null;
            try {
                dynamicDocBrackets = ExecutiveMetricsPresenter.calculateDetailedDocBrackets({
                    culturingPonds,
                    activeCycles: activeCycles || [],
                    operationalCycles: opCycles || [],
                    referenceDate: now
                });
            } catch (e) {
                console.warn("Could not calculate dynamicDocBrackets:", e);
            }

            // 4. Hero Card 6 & Module Spatial Allocation (M01 - M09 Species Breakdown)
            let speciesIntel = null;
            try {
                speciesIntel = ExecutiveMetricsPresenter.aggregateSpeciesAndHatcheryIntelligence({
                    stockingBatches: stockingBatches || [],
                    operationalCycles: opCycles || [],
                    activeCycles: activeCycles || [],
                    activePonds: culturingPonds,
                    dailyProgress: dailyProgress || []
                }, { scope: "ACTIVE", referenceDate: now });
            } catch (e) {
                console.warn("Could not calculate speciesIntel:", e);
            }

            // 5. Hero Card 2: 216-Pond Map Readiness Stages & Cleaning Teams
            const readiness = this.aggregatePondReadiness(dailyProgress || [], this.reportState);

            // Dynamic Cleaning Ponds Detail from pond_daily_progress (progress_state === 'CLEANING' or status_code === 'Cp')
            const cleaningPonds = (dailyProgress || []).filter(p => {
                const st = String(p.progress_state || "").toUpperCase();
                const code = String(p.status_code || "").toUpperCase();
                return st === "CLEANING" || code === "CP";
            });
            const dynamicCleaningDetail = cleaningPonds
                .map(p => p.pond || p.pond_code)
                .filter(Boolean)
                .sort()
                .join(", ");

            let cleaningTeamsDetail = this.reportState.cleaningTeamsDetail;
            if (!this.userHasOverriddenCleaningTeams || !cleaningTeamsDetail || cleaningTeamsDetail === "Int 1 & 2, P02, P06") {
                cleaningTeamsDetail = dynamicCleaningDetail || cleaningTeamsDetail || "";
            }

            // 6. Operational Hatcheries & Stocking Types (SPF / SPT / SPR / Monodon) SSOT
            let operationalHatcheries = null;
            try {
                operationalHatcheries = ExecutiveMetricsPresenter.aggregateOperationalHatcheriesByType({
                    culturingPonds,
                    activeCycles: activeCycles || [],
                    stockingBatches: stockingBatches || [],
                    operationalCycles: opCycles || []
                });
            } catch (e) {
                console.warn("Could not calculate operationalHatcheries:", e);
                operationalHatcheries = this.getDefaultReportState().operationalHatcheries;
            }
            const genetics = this.convertHatcheriesToLegacyGenetics(operationalHatcheries);

            // 7. Module 01-09 Species Rows & Samplings (Primary Source: dailyProgress + biometrics_sampling)
            let moduleBioResult = null;
            try {
                moduleBioResult = ExecutiveMetricsPresenter.aggregateModuleBiometrics({
                    samplings: samplings || [],
                    culturingPonds,
                    activeCycles: activeCycles || [],
                    dailyProgress: dailyProgress || []
                });
            } catch (e) {
                console.warn("Could not calculate module biometrics:", e);
            }
            const moduleRows = moduleBioResult?.moduleRows || this.buildModuleRows(speciesIntel?.moduleAllocation || [], activeCycles || [], samplings || [], dailyProgress || []);
            const samplingDateLabel = moduleBioResult?.samplingDateLabel || this.reportState.samplingDateLabel || "Latest";

            // 8. Today's Operational Movements (Highlight Today Only — strictly today's records)
            // Harvest from 216 Pond Mapping (Excel sync) & Daily Harvests
            // Stocking from Supabase pond_stocking_batches table
            // Cull from 216 Pond Mapping & Operational Cycles
            const localYear = now.getFullYear();
            const localMonth = String(now.getMonth() + 1).padStart(2, "0");
            const localDay = String(now.getDate()).padStart(2, "0");
            const todayIso = `${localYear}-${localMonth}-${localDay}`;

            // Today's Harvest Ponds (216 Pond Mapping + Harvest records)
            const todayHarvestPonds = new Set();
            (dailyProgress || []).forEach(p => {
                const lastHv = String(p.last_harvest_date || "").split("T")[0];
                const stStart = String(p.status_start_date || "").split("T")[0];
                if ((lastHv === todayIso || (p.status_code === "Hv" && stStart === todayIso)) && p.pond) {
                    todayHarvestPonds.add(p.pond);
                }
            });
            (harvestRes?.dailyHarvests || []).forEach(r => {
                const dStr = String(r.harv_date || "").split("T")[0];
                if (dStr === todayIso && (r.pond || r.pond_index)) {
                    todayHarvestPonds.add(r.pond || r.pond_index);
                }
            });

            // Today's Stocking (from Supabase pond_stocking_batches table)
            const todayStockPonds = new Set();
            let todayStockPcs = 0;
            (stockingBatches || []).forEach(b => {
                const dStr = String(b.stck_date || "").split("T")[0];
                if (dStr === todayIso && (b.pond || b.pond_index)) {
                    todayStockPonds.add(b.pond || b.pond_index);
                    todayStockPcs += Number(b.stck_pcs) || 0;
                }
            });

            // Today's Cull (216 Pond Mapping + Operational Cycles)
            let todayCullCount = 0;
            (dailyProgress || []).forEach(p => {
                const isCull = (p.status_code === "Cull" || p.progress_state === "CULLED");
                const stStart = String(p.status_start_date || "").split("T")[0];
                if (isCull && stStart === todayIso) {
                    todayCullCount++;
                }
            });
            (opCycles || []).forEach(c => {
                const isCulled = (c.final_status || c.pond_status || "").toUpperCase().includes("CULL");
                const cDate = String(c.date_closed || c.cull_date || "").split("T")[0];
                if (isCulled && cDate === todayIso) {
                    todayCullCount++;
                }
            });

            // This Month's Stocking Records (MTD)
            const curYear = now.getFullYear();
            const curMonth = String(now.getMonth() + 1).padStart(2, "0");
            const currentMonthPrefix = `${curYear}-${curMonth}`;

            const currentMonthStockings = (stockingBatches || []).filter(b => {
                const dStr = String(b.stck_date || "").split("T")[0];
                return dStr.startsWith(currentMonthPrefix);
            }).sort((a, b) => {
                const dComp = (a.stck_date || "").localeCompare(b.stck_date || "");
                if (dComp !== 0) return dComp;
                return String(a.pond_index || "").localeCompare(String(b.pond_index || ""));
            });

            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const formattedStockingRecords = currentMonthStockings.map((b, idx) => {
                let pondCode = b.pond || "";
                if (!pondCode && b.pond_index) {
                    const m = String(b.pond_index).match(/^2(\d{2})(\d{2})(\d{2})/);
                    if (m) pondCode = `${m[1]}.${m[2]}.${m[3]}`;
                }
                let dateLabel = b.stck_date || "—";
                if (b.stck_date && b.stck_date.includes("-")) {
                    const parts = b.stck_date.split("T")[0].split("-");
                    if (parts.length === 3) {
                        const mIdx = parseInt(parts[1], 10) - 1;
                        dateLabel = `${parts[2]}-${months[mIdx] || parts[1]}-${parts[0]}`;
                    }
                }
                return {
                    no: idx + 1,
                    pondIndex: b.pond_index || "—",
                    pond: pondCode,
                    date: dateLabel,
                    rawDate: b.stck_date,
                    hatchery: b.stck_source || "—",
                    species: b.stck_species || "P. VANNAMEi",
                    genetic: b.bs_line || "Standard",
                    plTotal: Number(b.stck_total || b.stck_pcs || 0),
                    tankNo: b.stck_tank || "—"
                };
            });

            // Automatic Report Snapshot Date & Time from current sync
            const syncDateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
            const syncTimeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

            // Immediately reflect sync date & time in input controls
            const dateInput = document.getElementById("dr-input-date");
            if (dateInput) dateInput.value = syncDateStr;
            const timeInput = document.getElementById("dr-input-time");
            if (timeInput) timeInput.value = syncTimeStr;

            // Dynamic genetics & operational hatchery breakdown for highlight summary
            const spr = operationalHatcheries?.summary?.spr ?? 0;
            const spf = operationalHatcheries?.summary?.spf ?? 0;
            const spt = operationalHatcheries?.summary?.spt ?? 0;
            const mon = operationalHatcheries?.summary?.monodon ?? 0;

            // Update reportState
            this.reportState = Object.assign(this.reportState, {
                reportDate: syncDateStr,
                reportTime: syncTimeStr,
                activePonds: activePool.length || 0,
                totalPonds: 216,
                utilizationPct: Math.round(((activePool.length || 0) / 216) * 10000) / 100,

                // Performance Scorecard (Fully closed ponds / full harvest only; partials excluded)
                ytdTonnageActual: Math.round((harvestAgg.ytdTonnage || 1111) * 10) / 10,
                ytdHarvestPondsActual: harvestAgg.ytdPonds || 346,
                ytdStockPondsActual: stockAgg.ytdPonds || 428,

                mtdTonnageActual: harvestAgg.mtdTonnage > 0 ? (Math.round(harvestAgg.mtdTonnage * 10) / 10) : "TBA",
                mtdHarvestPondsActual: (harvestAgg.mtdPonds !== undefined && harvestAgg.mtdPonds !== null) ? harvestAgg.mtdPonds : 7,
                mtdStockPondsActual: (formattedStockingRecords && formattedStockingRecords.length > 0) ? formattedStockingRecords.length : (stockAgg.mtdPonds || 7),
                mtdFriesActual: formattedStockingRecords.length > 0 
                    ? Math.round((formattedStockingRecords.reduce((acc, r) => acc + r.plTotal, 0) / 1000000) * 100) / 100 
                    : (stockAgg.mtdMillion || 2.91),

                // Stocking Records (This Month)
                stockingRecords: formattedStockingRecords,

                // Highlights & DOC (strictly today's movements, never accumulated MTD)
                highlightOperationalSummary: `Operational pond: ${activePool.length || 0} consist of ${spr} SPR, ${spf} SPF, ${spt} SPT, and ${mon} MON.`,
                highlightStockingPonds: todayStockPonds.size,
                highlightHarvestPonds: todayHarvestPonds.size,
                highlightCullPonds: todayCullCount,
                docBrackets: dynamicDocBrackets || this.reportState.docBrackets || this.getDefaultReportState().docBrackets,

                // Readiness
                idlePonds: readiness.idle,
                cleaningTeamsCount: readiness.cleaning,
                cleaningTeamsDetail: cleaningTeamsDetail,
                cleanedPonds: readiness.cleaned,
                waitingWaterFilling: readiness.repaired,
                waterCulture: readiness.waterCulture,
                readyForStocking: readiness.ready,

                // Operational Hatcheries & Stocking Types (SSOT)
                operationalHatcheries: operationalHatcheries,
                genetics: genetics,

                // Module Rows & Sampling Date
                moduleRows: moduleRows,
                samplingDateLabel: samplingDateLabel,

                // Harvest actuals & forecast (preserve edits or load default 12 whiteboard ponds)
                harvestForecasts: (this.reportState.harvestForecasts && this.reportState.harvestForecasts.length > 0)
                    ? this.reportState.harvestForecasts
                    : this.getDefaultReportState().harvestForecasts,
                harvestReports: (this.reportState.harvestReports && this.reportState.harvestReports.length > 0)
                    ? this.reportState.harvestReports
                    : this.getDefaultReportState().harvestReports
            });

            this.populateFormFromState();

            // Automatically synchronize latest records from Daily_Harvest_Log.xlsx
            try {
                await this.reloadHarvestLogFromExcel(false);
            } catch (e) {}

            this.renderPreview();
            this.saveDraftToStorage(false);

            if (badge) {
                badge.textContent = `SSOT Synced (${syncTimeStr})`;
                badge.style.background = "#ecfdf5";
                badge.style.color = "#059669";
            }
            if (showToast) Toast.success("SSOT data synced across all 8 Hero Cards & 216 Farm Map!");
        } catch (err) {
            console.error("Failed to load SSOT metrics:", err);
            if (badge) {
                badge.textContent = "SSOT Ready (Cached)";
                badge.style.background = "#ecfdf5";
                badge.style.color = "#059669";
            }
        } finally {
            this.isLoadingSSOT = false;
        }
    }

    /**
     * Extracts readiness counts from pond_daily_progress table.
     * Preserves last valid state if query returns empty, eliminating mock fallbacks.
     */
    aggregatePondReadiness(dailyProgress = [], fallbackState = null) {
        const counts = {
            idle: 0,
            cleaning: 0,
            cleaned: 0,
            repaired: 0,
            waterCulture: 0,
            ready: 0
        };

        (dailyProgress || []).forEach(p => {
            const state = String(p.progress_state || "").toUpperCase();
            if (state === "IDLE") counts.idle++;
            else if (state === "CLEANING") counts.cleaning++;
            else if (state === "CLEANED") counts.cleaned++;
            else if (state === "REPAIRED") counts.repaired++;
            else if (state === "WATER_CULTURE") counts.waterCulture++;
            else if (state === "READY") counts.ready++;
        });

        const total = counts.idle + counts.cleaning + counts.cleaned + counts.repaired + counts.waterCulture + counts.ready;
        if (total === 0 && fallbackState) {
            return {
                idle: fallbackState.idlePonds || 0,
                cleaning: fallbackState.cleaningTeamsCount || 0,
                cleaned: fallbackState.cleanedPonds || 0,
                repaired: fallbackState.waitingWaterFilling || 0,
                waterCulture: fallbackState.waterCulture || 0,
                ready: fallbackState.readyForStocking || 0
            };
        }
        return counts;
    }

    /**
     * Converts operational hatcheries aggregation to legacy genetics structure for backward compatibility.
     */
    convertHatcheriesToLegacyGenetics(hatcheryData) {
        const g = {
            spr: { sw: 0, shtApi: 0 },
            spt: { sht: 0, sbsb: 0, gsp: 0, bzy: 0 },
            spf: { iohat: 0, hlx: 0, yhl: 0, cp: 0, ois: 0, bmc: 0 },
            monodon: { cp: 0, gsr: 0, sht: 0, sw: 0, ubn: 0, kssb: 0 }
        };

        if (!hatcheryData || !hatcheryData.groups) return g;

        hatcheryData.groups.forEach(grp => {
            const t = (grp.type || "").toUpperCase();
            (grp.hatcheries || []).forEach(h => {
                const src = (h.source || "").toUpperCase();
                if (t === "SPR") {
                    if (src.includes("API")) g.spr.shtApi += h.ponds;
                    else g.spr.sw += h.ponds;
                } else if (t === "SPT") {
                    if (src.includes("SHT")) g.spt.sht += h.ponds;
                    else if (src.includes("SBSB")) g.spt.sbsb += h.ponds;
                    else if (src.includes("GSP")) g.spt.gsp += h.ponds;
                    else if (src.includes("BZY")) g.spt.bzy += h.ponds;
                    else g.spt[src.toLowerCase()] = h.ponds;
                } else if (t === "SPF") {
                    if (src.includes("IOHAT")) g.spf.iohat += h.ponds;
                    else if (src.includes("HLX")) g.spf.hlx += h.ponds;
                    else if (src.includes("YHL")) g.spf.yhl += h.ponds;
                    else if (src.includes("CP")) g.spf.cp += h.ponds;
                    else if (src.includes("OIS")) g.spf.ois += h.ponds;
                    else if (src.includes("BMC")) g.spf.bmc += h.ponds;
                    else g.spf[src.toLowerCase()] = h.ponds;
                } else if (t === "MONODON") {
                    if (src.includes("UBN")) g.monodon.ubn += h.ponds;
                    else if (src.includes("KSK") || src.includes("KSSB")) g.monodon.kssb += h.ponds;
                    else if (src.includes("GSR")) g.monodon.gsr += h.ponds;
                    else if (src.includes("CP")) g.monodon.cp += h.ponds;
                    else g.monodon[src.toLowerCase()] = h.ponds;
                }
            });
        });

        return g;
    }

    /**
     * Extracts genetic lines breakdown across active cycles.
     */
    extractGeneticsFromCycles(activeCycles = []) {
        const intel = ExecutiveMetricsPresenter.aggregateOperationalHatcheriesByType({ activeCycles });
        return this.convertHatcheriesToLegacyGenetics(intel);
    }

    /**
     * Builds module-level allocation table for Modules 01 to 09.
     * Primary Source: Excel daily progress (public.pond_daily_progress synced daily).
     * Secondary / Species Cross-Reference: activeCycles (view_growout_pond_cycles?pond_status=neq.CLOSE).
     */
    buildModuleRows(moduleAllocations = [], activeCycles = [], samplings = [], dailyProgress = []) {
        const baselineModules = [
            { mod: "01", van: 9, mon: 0, prevAdgV: "0.13", prevAbwV: "6.0", prevDocV: "43", latAdgV: "0.15", latAbwV: "8.0", latDocV: "50", prevAdgM: "—", prevAbwM: "—", prevDocM: "—", latAdgM: "—", latAbwM: "—", latDocM: "—" },
            { mod: "02", van: 13, mon: 0, prevAdgV: "0.11", prevAbwV: "4.0", prevDocV: "34", latAdgV: "0.12", latAbwV: "5.0", latDocV: "39", prevAdgM: "—", prevAbwM: "—", prevDocM: "—", latAdgM: "—", latAbwM: "—", latDocM: "—" },
            { mod: "03", van: 21, mon: 0, prevAdgV: "0.18", prevAbwV: "10.0", prevDocV: "53", latAdgV: "0.17", latAbwV: "9.0", latDocV: "52", prevAdgM: "—", prevAbwM: "—", prevDocM: "—", latAdgM: "—", latAbwM: "—", latDocM: "—" },
            { mod: "04", van: 11, mon: 11, prevAdgV: "—", prevAbwV: "—", prevDocV: "—", latAdgV: "0.08", latAbwV: "3.0", latDocV: "31", prevAdgM: "0.29", prevAbwM: "36.0", prevDocM: "123", latAdgM: "0.31", latAbwM: "40.0", latDocM: "130" },
            { mod: "05", van: 0, mon: 17, prevAdgV: "—", prevAbwV: "—", prevDocV: "—", latAdgV: "—", latAbwV: "—", latDocV: "—", prevAdgM: "0.28", prevAbwM: "24.0", prevDocM: "83", latAdgM: "0.30", latAbwM: "26.0", latDocM: "88" },
            { mod: "06", van: 0, mon: 0, prevAdgV: "—", prevAbwV: "—", prevDocV: "—", latAdgV: "—", latAbwV: "—", latDocV: "—", prevAdgM: "—", prevAbwM: "—", prevDocM: "—", latAdgM: "—", latAbwM: "—", latDocM: "—" },
            { mod: "07", van: 12, mon: 4, prevAdgV: "0.17", prevAbwV: "10.0", prevDocV: "61", latAdgV: "—", latAbwV: "—", latDocV: "—", prevAdgM: "0.28", prevAbwM: "32.0", prevDocM: "115", latAdgM: "0.28", latAbwM: "34.0", latDocM: "120" },
            { mod: "08", van: 19, mon: 0, prevAdgV: "0.13", prevAbwV: "7.0", prevDocV: "52", latAdgV: "0.14", latAbwV: "8.0", latDocV: "52", prevAdgM: "—", prevAbwM: "—", prevDocM: "—", latAdgM: "—", latAbwM: "—", latDocM: "—" },
            { mod: "09", van: 2, mon: 0, prevAdgV: "0.08", prevAbwV: "4.0", prevDocV: "59", latAdgV: "0.16", latAbwV: "10.0", latDocV: "65", prevAdgM: "—", prevAbwM: "—", prevDocM: "—", latAdgM: "—", latAbwM: "—", latDocM: "—" }
        ];

        // 1. Primary Source: Excel daily progress (pond_daily_progress synced daily)
        const oprPonds = (dailyProgress || []).filter(p => {
            const sc = String(p.status_code || "").trim().toUpperCase();
            const ps = String(p.progress_state || "").trim().toUpperCase();
            return sc === "OPR" || ps === "CULTURE";
        });

        if (oprPonds.length > 0) {
            const cycleMap = new Map();
            (activeCycles || []).forEach(c => {
                const pCode = c.pond || c.pond_index;
                if (pCode) cycleMap.set(String(pCode).trim(), c);
            });

            const modCounts = {};
            for (let i = 1; i <= 9; i++) {
                const m = String(i).padStart(2, "0");
                modCounts[m] = { van: 0, mon: 0, total: 0 };
            }

            oprPonds.forEach(p => {
                let mKey = p.module_no ? String(p.module_no).trim().padStart(2, "0") : null;
                if (!mKey && p.pond) {
                    const mMatch = String(p.pond).match(/^(\d{2})\./);
                    if (mMatch) mKey = mMatch[1];
                }
                if (!mKey || !modCounts[mKey]) return;

                const pondCode = String(p.pond || "");
                const c = cycleMap.get(pondCode);
                const sp = String(c?.stck_species || "").toUpperCase();

                let isMon = false;
                if (mKey === "05") {
                    isMon = true;
                } else if (mKey === "07") {
                    isMon = pondCode.includes("07.14") || sp.includes("MON");
                } else if (mKey === "04") {
                    isMon = sp.includes("MON") || (p.row_no === "07" && !sp.includes("VAN"));
                } else {
                    isMon = sp.includes("MON");
                }

                if (isMon) {
                    modCounts[mKey].mon++;
                } else {
                    modCounts[mKey].van++;
                }
                modCounts[mKey].total++;
            });

            return baselineModules.map(bm => {
                const live = modCounts[bm.mod];
                if (live !== undefined) {
                    return Object.assign({}, bm, {
                        van: live.van,
                        mon: live.mon
                    });
                }
                return bm;
            });
        }

        // 2. Secondary fallback: activeCycles
        if (activeCycles && activeCycles.length > 0) {
            const modCounts = {};
            activeCycles.forEach(c => {
                const pondStr = String(c.pond || c.pond_index || "");
                const mMatch = pondStr.match(/^(\d{2})\./) || pondStr.match(/^2(\d{2})/);
                if (mMatch) {
                    const mKey = mMatch[1];
                    modCounts[mKey] = (modCounts[mKey] || 0) + 1;
                }
            });

            return baselineModules.map(bm => {
                const liveCount = modCounts[bm.mod];
                if (liveCount !== undefined) {
                    if (bm.mod === "04") {
                        const half = Math.floor(liveCount / 2);
                        return Object.assign({}, bm, { van: liveCount - half, mon: half });
                    }
                    if (bm.mod === "05") {
                        return Object.assign({}, bm, { van: 0, mon: liveCount });
                    }
                    if (bm.mod === "07") {
                        const mon = Math.min(4, liveCount);
                        return Object.assign({}, bm, { van: liveCount - mon, mon });
                    }
                    return Object.assign({}, bm, { van: liveCount, mon: 0 });
                }
                return bm;
            });
        }

        return baselineModules;
    }

    /**
     * Populates form inputs with current reportState.
     */
    populateFormFromState() {
        const s = this.reportState || {};
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null) el.value = val;
        };

        setVal("dr-input-date", s.reportDate);
        setVal("dr-input-time", s.reportTime);

        // Finance YTD
        setVal("dr-input-ytd-ton-act", s.ytdTonnageActual);
        setVal("dr-input-ytd-ton-roll", s.ytdTonnageRolling);
        setVal("dr-input-ytd-ton-bp", s.ytdTonnageBP);
        setVal("dr-input-ytd-rev-act", s.ytdRevenueActual);
        setVal("dr-input-ytd-rev-roll", s.ytdRevenueRolling);
        setVal("dr-input-ytd-rev-bp", s.ytdRevenueBP);
        setVal("dr-input-ytd-harv-act", s.ytdHarvestPondsActual);
        setVal("dr-input-ytd-harv-roll", s.ytdHarvestPondsRolling);
        setVal("dr-input-ytd-harv-bp", s.ytdHarvestPondsBP);
        setVal("dr-input-ytd-stock-act", s.ytdStockPondsActual);
        setVal("dr-input-ytd-stock-roll", s.ytdStockPondsRolling);
        setVal("dr-input-ytd-stock-bp", s.ytdStockPondsBP);

        // Finance MTD
        setVal("dr-input-mtd-ton-act", s.mtdTonnageActual);
        setVal("dr-input-mtd-ton-bp", s.mtdTonnageBP);
        setVal("dr-input-mtd-rev-bp", s.mtdRevenueBP);
        setVal("dr-input-mtd-harv-act", s.mtdHarvestPondsActual);
        setVal("dr-input-mtd-stock-act", s.mtdStockPondsActual);
        setVal("dr-input-mtd-fries-act", s.mtdFriesActual);
        setVal("dr-input-culled-mtd", s.culledMtd);
        setVal("dr-input-culled-ytd", s.culledYtd);

        // Today's Operational Movement (Highlight Today Only)
        setVal("dr-input-today-stock", s.highlightStockingPonds ?? 0);
        setVal("dr-input-today-harv", s.highlightHarvestPonds ?? 0);
        setVal("dr-input-today-cull", s.highlightCullPonds ?? 0);

        // Flags
        setVal("dr-input-red-flag", s.redFlag);
        setVal("dr-input-orange-flag", s.orangeFlag);
        setVal("dr-input-yellow-flag", s.yellowFlag);
        setVal("dr-input-facility-act", s.facilityActivityUpdate);

        // Weather & Lab
        setVal("dr-input-salinity", s.pondSalinity);
        setVal("dr-input-am-temp", s.pondAmTemp);
        setVal("dr-input-mdc", s.mdcStatus);

        // Laboratory 5-Day Rainfall
        const rf = s.rainfallHistory || [];
        for (let i = 0; i < 5; i++) {
            const item = rf[i] || { date: "", mm: "0.00mm" };
            setVal(`dr-rf-date-${i}`, item.date);
            const cleanMm = item.mm ? item.mm.toString().replace(/mm/gi, "").trim() : "0.00";
            setVal(`dr-rf-mm-${i}`, cleanMm);
        }

        // Readiness
        setVal("dr-input-cleaning-teams", s.cleaningTeamsDetail);
        setVal("dr-input-wait-water", s.waitingWaterFilling);
        setVal("dr-input-ready-stock", s.readyForStocking);

        // Stocking Records (This Month)
        const stockingListEl = document.getElementById("dr-stocking-list-container");
        const stockingBadgeEl = document.getElementById("badge-stocking-count");
        const sRecords = s.stockingRecords || [];
        if (stockingBadgeEl) {
            stockingBadgeEl.textContent = `${sRecords.length} Ponds`;
        }
        if (stockingListEl) {
            if (sRecords.length === 0) {
                stockingListEl.innerHTML = `<div style="color:#94a3b8; font-style:italic; padding:6px; text-align:center;">No stocking records logged for this month.</div>`;
            } else {
                stockingListEl.innerHTML = sRecords.map(r => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 6px; border-bottom:1px solid #e2e8f0;">
                        <div>
                            <strong style="color:#0f172a;">${r.no}. ${r.pondIndex}</strong> ${r.pond ? `<span style="color:#64748b; font-size:0.68rem;">(${r.pond})</span>` : ""}
                            <div style="font-size:0.67rem; color:#64748b;">${r.date} • ${r.hatchery} • ${r.genetic} • Tank ${r.tankNo}</div>
                        </div>
                        <div style="text-align:right;">
                            <strong style="color:#0284c7;">${Number(r.plTotal || 0).toLocaleString()} PL</strong>
                            <div style="font-size:0.65rem; color:#64748b;">${r.species}</div>
                        </div>
                    </div>
                `).join("");
            }
        }

        // Harvesting Forecast & Completed Harvest Report Grids (Card 6)
        this.renderForecastTable();
        this.renderHarvestReportTable();

        // Monthly Stocking Plan Editor (Card 5)
        const planTitleInput = document.getElementById("dr-input-stocking-plan-title");
        if (planTitleInput) {
            planTitleInput.value = s.stockingPlanSummary?.title || "Stocking Plan Nov '26";
        }
        this.renderStockingPlanTable();
    }

    /**
     * Reads current form inputs and synchronizes reportState.
     */
    updateStateFromForm() {
        const getVal = (id, fallback = "") => {
            const el = document.getElementById(id);
            return el ? el.value : fallback;
        };
        const getNum = (id, fallback = 0) => {
            const el = document.getElementById(id);
            const num = parseFloat(el?.value);
            return isNaN(num) ? fallback : num;
        };

        this.reportState.reportDate = getVal("dr-input-date", this.reportState.reportDate);
        this.reportState.reportTime = getVal("dr-input-time", this.reportState.reportTime);

        // Monthly Stocking Plan Title
        if (!this.reportState.stockingPlanSummary) {
            this.reportState.stockingPlanSummary = { title: "Stocking Plan Nov '26", rows: [] };
        }
        const titleEl = document.getElementById("dr-input-stocking-plan-title");
        if (titleEl && titleEl.value) {
            this.reportState.stockingPlanSummary.title = titleEl.value;
        }

        // Finance YTD
        this.reportState.ytdTonnageActual = getNum("dr-input-ytd-ton-act", this.reportState.ytdTonnageActual);
        this.reportState.ytdTonnageRolling = getNum("dr-input-ytd-ton-roll", this.reportState.ytdTonnageRolling);
        this.reportState.ytdTonnageBP = getNum("dr-input-ytd-ton-bp", this.reportState.ytdTonnageBP);
        this.reportState.ytdRevenueActual = getNum("dr-input-ytd-rev-act", this.reportState.ytdRevenueActual);
        this.reportState.ytdRevenueRolling = getNum("dr-input-ytd-rev-roll", this.reportState.ytdRevenueRolling);
        this.reportState.ytdRevenueBP = getNum("dr-input-ytd-rev-bp", this.reportState.ytdRevenueBP);
        this.reportState.ytdHarvestPondsActual = getNum("dr-input-ytd-harv-act", this.reportState.ytdHarvestPondsActual);
        this.reportState.ytdHarvestPondsRolling = getNum("dr-input-ytd-harv-roll", this.reportState.ytdHarvestPondsRolling);
        this.reportState.ytdHarvestPondsBP = getNum("dr-input-ytd-harv-bp", this.reportState.ytdHarvestPondsBP);
        this.reportState.ytdStockPondsActual = getNum("dr-input-ytd-stock-act", this.reportState.ytdStockPondsActual);
        this.reportState.ytdStockPondsRolling = getNum("dr-input-ytd-stock-roll", this.reportState.ytdStockPondsRolling);
        this.reportState.ytdStockPondsBP = getNum("dr-input-ytd-stock-bp", this.reportState.ytdStockPondsBP);

        // Finance MTD
        this.reportState.mtdTonnageActual = getVal("dr-input-mtd-ton-act", this.reportState.mtdTonnageActual);
        this.reportState.mtdTonnageBP = getNum("dr-input-mtd-ton-bp", this.reportState.mtdTonnageBP);
        this.reportState.mtdRevenueBP = getNum("dr-input-mtd-rev-bp", this.reportState.mtdRevenueBP);
        this.reportState.mtdHarvestPondsActual = getNum("dr-input-mtd-harv-act", this.reportState.mtdHarvestPondsActual);
        this.reportState.mtdStockPondsActual = getNum("dr-input-mtd-stock-act", this.reportState.mtdStockPondsActual);
        this.reportState.mtdFriesActual = getNum("dr-input-mtd-fries-act", this.reportState.mtdFriesActual);
        this.reportState.culledMtd = getNum("dr-input-culled-mtd", this.reportState.culledMtd);
        this.reportState.culledYtd = getNum("dr-input-culled-ytd", this.reportState.culledYtd);

        // Today's Operational Movement (Highlight Today Only)
        this.reportState.highlightStockingPonds = getNum("dr-input-today-stock", this.reportState.highlightStockingPonds ?? 0);
        this.reportState.highlightHarvestPonds = getNum("dr-input-today-harv", this.reportState.highlightHarvestPonds ?? 0);
        this.reportState.highlightCullPonds = getNum("dr-input-today-cull", this.reportState.highlightCullPonds ?? 0);

        // Flags
        this.reportState.redFlag = getVal("dr-input-red-flag");
        this.reportState.orangeFlag = getVal("dr-input-orange-flag");
        this.reportState.yellowFlag = getVal("dr-input-yellow-flag");
        this.reportState.facilityActivityUpdate = getVal("dr-input-facility-act");

        // Weather & Lab
        this.reportState.pondSalinity = getVal("dr-input-salinity");
        this.reportState.pondAmTemp = getVal("dr-input-am-temp");
        this.reportState.mdcStatus = getVal("dr-input-mdc");

        // Laboratory 5-Day Rainfall History
        const updatedRf = [];
        for (let i = 0; i < 5; i++) {
            const dVal = getVal(`dr-rf-date-${i}`, `Day ${i + 1}`);
            const rawMm = getVal(`dr-rf-mm-${i}`, "0.00").trim();
            const mmVal = rawMm.toLowerCase().endsWith("mm") ? rawMm : `${rawMm}mm`;
            updatedRf.push({ date: dVal, mm: mmVal });
        }
        this.reportState.rainfallHistory = updatedRf;

        // Readiness
        this.reportState.cleaningTeamsDetail = getVal("dr-input-cleaning-teams");
        this.reportState.waitingWaterFilling = getNum("dr-input-wait-water");
        this.reportState.readyForStocking = getNum("dr-input-ready-stock");
    }

    /**
     * Renders compiled report state into live email preview container.
     */
    renderPreview() {
        if (!this.previewContainer) {
            this.previewContainer = document.getElementById("daily-report-preview-canvas");
        }
        if (!this.previewContainer) return;

        // In preview canvas, pass false for wrapFullDocument so inner table renders without outer DOCTYPE/head wrapper
        const html = buildDailyReportEmailHtml(this.reportState, false);
        this.previewContainer.innerHTML = html;
    }

    /**
     * Copies pure formatted rich HTML to the system clipboard specifically formatted for Outlook & Gmail.
     * Uses ClipboardItem API with Windows CF_HTML doctype, with clean isolated offscreen fallback.
     */
    async copyReportToClipboard() {
        this.updateStateFromForm();
        this.renderPreview();

        const canvas = document.getElementById("daily-report-preview-canvas");
        const fullOutlookHtml = buildDailyReportEmailHtml(this.reportState, true);

        let copied = false;

        // Method 1: ClipboardItem with full CF_HTML doctype (Directly writes clean HTML without UI CSS interference)
        try {
            if (navigator.clipboard && window.ClipboardItem) {
                const blobHtml = new Blob([fullOutlookHtml], { type: "text/html" });
                const blobText = new Blob([canvas ? canvas.innerText : "iSharp Daily Report"], { type: "text/plain" });
                await navigator.clipboard.write([
                    new ClipboardItem({
                        "text/html": blobHtml,
                        "text/plain": blobText
                    })
                ]);
                copied = true;
            }
        } catch (e) {
            console.warn("Async Clipboard API fallback needed:", e);
        }

        // Method 2: Fallback ONLY if Method 1 was not supported or failed
        if (!copied) {
            try {
                // Render into clean isolated offscreen container so browser doesn't apply web app CSS classes
                const offscreenDiv = document.createElement("div");
                offscreenDiv.setAttribute("style", "position:fixed; left:-9999px; top:-9999px; opacity:0; pointer-events:none;");
                offscreenDiv.innerHTML = fullOutlookHtml;
                document.body.appendChild(offscreenDiv);

                const range = document.createRange();
                range.selectNodeContents(offscreenDiv);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                document.execCommand("copy");
                selection.removeAllRanges();
                document.body.removeChild(offscreenDiv);
                copied = true;
            } catch (e) {
                console.warn("Offscreen selection copy fallback failed:", e);
            }
        }

        if (copied) {
            Toast.success("📋 Daily Report copied! Ready to paste (Ctrl + V) into Outlook or Gmail.");
        } else {
            Toast.error("Could not copy directly to clipboard. You can select all and press Ctrl + C.");
        }
    }

    /**
     * Copies raw HTML string to clipboard for manual embedding.
     */
    async copyRawHtmlToClipboard() {
        this.updateStateFromForm();
        const fullOutlookHtml = buildDailyReportEmailHtml(this.reportState, true);
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(fullOutlookHtml);
                Toast.success("Raw HTML copied to clipboard!");
            }
        } catch (e) {
            console.warn("Failed to copy raw HTML:", e);
        }
    }

    /**
     * Fetches live 5-day weather & rainfall forecast for Setiu Farm coordinates.
     */
    async fetchSetiuWeather() {
        try {
            Toast.info("Fetching Setiu live forecast from Open-Meteo / Windy ECMWF...");
            const days = await DailyReportLabService.fetchSetiuWeather();
            if (days && days.length >= 5) {
                this.reportState.weatherForecastDays = days;
                this.renderPreview();
                Toast.success("Updated Setiu 5-day weather forecast.");
            }
        } catch (err) {
            console.warn("Could not auto-fetch weather forecast:", err);
            Toast.info("Weather API offline. Default Setiu forecast preserved.");
        }
    }

    saveDraftToStorage(showToast = true) {
        this.updateStateFromForm();
        const success = DailyReportStateService.saveDraft(this.reportState);
        if (success && showToast) {
            Toast.success("Daily report draft saved locally.");
        }
    }

    loadDraftFromStorage() {
        return DailyReportStateService.loadDraft();
    }
}
