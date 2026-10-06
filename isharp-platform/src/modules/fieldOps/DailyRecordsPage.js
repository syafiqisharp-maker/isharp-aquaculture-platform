/**
 * iSHARP DBMS 2.0 — Field Operations: Pond Daily Records Logbook Page
 * Clean, modular orchestrator coordinating:
 * - Data fetching & cycle aggregation via Repositories
 * - Continuous timeline ledger from stocking date to today
 * - Mobile responsive 14-day paging (+ "Load More")
 * - Subcomponents: DailyEntryModal & TreatmentSummaryModal
 */

import { DailyRecordsRepository } from "../../infrastructure/repositories/dailyRecordsRepository.js";
import { MineralProbioticRepository } from "../../infrastructure/repositories/mineralProbioticRepository.js";
import { calculateDOC } from "../../domain/biometrics.js";
import { getLocalDateStr, parseLocalDate } from "./dailyRecords/dailyRecordsConstants.js";
import {
    renderNavBar,
    renderMetricsSummaryGrid,
    renderTableRow,
    renderMobileCard
} from "./dailyRecords/dailyRecordsTemplates.js";
import { TreatmentSummaryModal } from "./dailyRecords/TreatmentSummaryModal.js";
import { DailyEntryModal } from "./dailyRecords/DailyEntryModal.js";

export class DailyRecordsPage {
    /**
     * @param {string} containerId Parent mount container ID
     * @param {object} callbacks Navigation & lifecycle hooks
     */
    constructor(containerId = "field-ops-daily-records-mount", callbacks = {}) {
        this.container = document.getElementById(containerId);
        this.callbacks = callbacks;

        this.currentPond = null;
        this.activePondsList = [];
        this.records = [];
        this.treatments = [];
        this.usageSummary = { minerals: [], probiotics: [], totalMineralKg: 0, totalProbioticL: 0 };
        this.treatmentsByDate = new Map();

        this.mobileVisibleCount = 14;
        this.isModalOnlyMode = false;
        this._hasBoundResize = false;

        // Subcomponents
        this.entryModal = new DailyEntryModal(this.container, {
            onRecordSaved: () => {
                if (this.callbacks.onRecordSaved) this.callbacks.onRecordSaved();
            },
            onClose: () => {
                if (this.isModalOnlyMode && this.callbacks.onCloseQuickModal) {
                    this.callbacks.onCloseQuickModal();
                }
            },
            onPondSwitched: async (nextPond) => {
                await this.loadPondData(nextPond);
                this.entryModal.initContext(
                    nextPond,
                    this.activePondsList,
                    this.records,
                    this.treatmentsByDate,
                    this.isModalOnlyMode
                );
                const todayStr = getLocalDateStr();
                const existing = this.records.find(r => r.log_date === todayStr) || null;
                this.entryModal.openEntryModal(todayStr, existing, { autoFocusFeed: false });
            },
            onReloadView: async () => {
                await this.render(this.currentPond, this.activePondsList);
            },
            onOpenFullBook: () => {
                this.renderView();
            }
        });

        this.treatmentModal = new TreatmentSummaryModal(this.container);
    }

    /**
     * Loads records, treatments, and cycle summary for a pond
     * @param {object} pond
     */
    async loadPondData(pond) {
        this.currentPond = pond;
        try {
            const [records, treatments, summary] = await Promise.all([
                DailyRecordsRepository.getRecordsForPond(pond.pond_index),
                MineralProbioticRepository.getTreatmentsForPond(pond.pond_index),
                MineralProbioticRepository.getCycleUsageSummary(pond.pond_index)
            ]);

            this.records = records || [];
            this.treatments = treatments || [];
            this.usageSummary = summary || { minerals: [], probiotics: [], totalMineralKg: 0, totalProbioticL: 0 };

            this.treatmentsByDate.clear();
            this.treatments.forEach(t => {
                const list = this.treatmentsByDate.get(t.log_date) || [];
                list.push(t);
                this.treatmentsByDate.set(t.log_date, list);
            });
        } catch (err) {
            console.error("Failed to load records & treatments:", err);
            this.records = [];
            this.treatments = [];
        }
    }

    /**
     * Full page render for a pond
     * @param {object} pond
     * @param {Array} activePondsList
     */
    async render(pond, activePondsList = []) {
        this.isModalOnlyMode = false;
        this.mobileVisibleCount = 14;
        if (this.container) {
            this.container.classList.remove("daily-mount-modal-only");
        }
        if (activePondsList && activePondsList.length > 0) {
            this.activePondsList = activePondsList;
        }
        if (!this.container) return;

        this.container.innerHTML = `
            <div style="padding: 2.5rem 1.5rem; text-align: center; color: #0284c7; font-weight: 700;">
                <div class="spinner" style="margin: 0 auto 0.75rem auto;"></div>
                <span>Loading Daily Records Logbook for Pond ${pond.pond || pond.pond_index}...</span>
            </div>
        `;

        await this.loadPondData(pond);
        this.renderView();
    }

    /**
     * Opens Today's Entry Modal directly in 1-tap rapid mode over the 24-Pond Map
     * @param {object} pond
     * @param {Array} activePondsList
     */
    async openQuickModal(pond, activePondsList = []) {
        this.isModalOnlyMode = true;
        if (activePondsList && activePondsList.length > 0) {
            this.activePondsList = activePondsList;
        }
        if (!this.container) return;

        await this.loadPondData(pond);
        this.renderView();

        const todayStr = getLocalDateStr();
        const existing = this.records.find(r => r.log_date === todayStr) || null;
        this.openEntryModal(todayStr, existing, { autoFocusFeed: false });
    }

    /**
     * Renders logbook ledger page and initializes modal subcomponents
     */
    renderView() {
        const pond = this.currentPond;
        if (!pond || !this.container) return;

        const pondLabel = pond.pond || pond.pond_index || "Pond";
        const doc = calculateDOC(pond.stck_date, pond.date_close);
        const areaHa = parseFloat(pond.area) || 0.50;
        const cycleNo = pond.cycle_no || (pond.pond_index ? pond.pond_index.split(".")[1] : "—");
        const stckDateStr = pond.stck_date
            ? new Date(pond.stck_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : "Not Stocked";

        // Aggregate cycle totals
        let totalFeedKg = 0;
        let trayRemnantSum = 0;
        let trayRemnantCount = 0;
        let totalMortalitiesKg = 0;

        this.records.forEach(r => {
            if (r.feed_kg) totalFeedKg += parseFloat(r.feed_kg || 0);
            if (r.feed_tray_remnant_pct !== null && r.feed_tray_remnant_pct !== undefined) {
                trayRemnantSum += parseInt(r.feed_tray_remnant_pct, 10);
                trayRemnantCount++;
            }
            const mortVal = (r.mortality_kg !== undefined && r.mortality_kg !== null)
                ? parseFloat(r.mortality_kg)
                : (r.mortality_count ? parseFloat(r.mortality_count) : 0);
            if (!isNaN(mortVal)) totalMortalitiesKg += mortVal;
        });

        const avgTrayRemnant = trayRemnantCount > 0 ? Math.round(trayRemnantSum / trayRemnantCount) : 0;
        const timelineRows = this.buildTimelineRows();

        const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
        const visibleMobileRows = timelineRows.slice(0, this.mobileVisibleCount);
        const hasMoreMobileRows = timelineRows.length > this.mobileVisibleCount;
        const displayedCountText = isMobile
            ? `${visibleMobileRows.length} of ${timelineRows.length} Days Displayed`
            : `${timelineRows.length} Days Displayed`;

        this.container.innerHTML = `
            <div class="daily-records-page-wrapper" style="padding: 1.25rem 2rem; max-width: 1350px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.4rem;">
                
                <!-- 1. Breadcrumbs & Top Navigation Bar -->
                ${renderNavBar({ pondLabel, cycleNo, doc })}

                <!-- 2. Page Header & Quick Log Action -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.85rem; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                            <span style="font-size: 1.6rem;">📖</span>
                            <h1 style="margin: 0; font-size: 1.45rem; font-weight: 900; color: #0f172a;">
                                Growout Book Records
                            </h1>
                        </div>
                    </div>

                    <div class="daily-quick-actions" style="display: flex; align-items: center; gap: 0.75rem;">
                        <button type="button" id="btn-view-usage-summary" class="btn-action btn-secondary" style="font-size: 0.84rem; font-weight: 700; padding: 0.52rem 1.15rem; display: flex; align-items: center; gap: 0.4rem;">
                            <span class="btn-text-full">📊 Treatment Totals</span>
                            <span class="btn-text-short">📊 Totals</span>
                        </button>
                        <button type="button" id="btn-quick-log-today" class="btn-action btn-primary" style="font-size: 0.88rem; font-weight: 800; padding: 0.55rem 1.35rem; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3);">
                            <span class="btn-text-full">➕ Log Today (DOC ${doc})</span>
                            <span class="btn-text-short">➕ Log Today</span>
                        </button>
                    </div>
                </div>

                <!-- 3. Cycle Metrics Summary Bar -->
                ${renderMetricsSummaryGrid({
                    stckDateStr,
                    areaHa,
                    totalFeedKg,
                    recordsCount: this.records.length,
                    avgTrayRemnant,
                    usageSummary: this.usageSummary,
                    totalMortalitiesKg
                })}

                <!-- 4. CONTINUOUS SCROLLABLE LOGBOOK LEDGER -->
                <section class="glass-card logbook-ledger-card" style="background: rgba(255, 255, 255, 0.95); border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.25rem 1.4rem; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                            <h2 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0284c7;">
                                Logbook Timeline (DOC 1 → DOC ${doc})
                            </h2>
                            <span id="daily-timeline-header-count" style="font-size: 0.72rem; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 0.15rem 0.55rem; border-radius: 6px;">
                                ${displayedCountText}
                            </span>
                        </div>
                        <span style="font-size: 0.76rem; color: #64748b;">
                            Click any row or <strong>✏️ Edit</strong> to view or modify that day's entry.
                        </span>
                    </div>

                    <!-- Mobile Timeline Card View (Screens <= 768px: Recent 14 Days + Load More) -->
                    <div class="daily-mobile-timeline show-mobile" style="display: ${isMobile ? 'flex' : 'none'}; flex-direction: column; gap: 0.65rem;">
                        ${isMobile ? visibleMobileRows.map(row => renderMobileCard(row)).join("") : ""}
                    </div>

                    ${(isMobile && hasMoreMobileRows) ? `
                        <div class="daily-load-more-container show-mobile" style="text-align: center; margin: 0.75rem 0 0.5rem 0;">
                            <button type="button" id="btn-load-more-daily" class="btn-action btn-secondary" style="font-size: 0.82rem; font-weight: 800; padding: 0.65rem 1.4rem; min-height: 48px; border-radius: 999px; width: 100%; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.12); display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <span>📜 Load More Records (${timelineRows.length - this.mobileVisibleCount} earlier days)</span>
                            </button>
                        </div>
                    ` : ''}

                    <!-- Scrollable Responsive Table Container (Screens > 768px Only) -->
                    <div class="logbook-table-container hide-mobile" style="overflow-x: auto; max-height: 650px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px; display: ${isMobile ? 'none' : 'block'};">
                        ${!isMobile ? `
                            <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.82rem; text-align: left;">
                                <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                                    <tr style="color: #475569; font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; width: 75px;">DOC</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; width: 105px;">Date</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; width: 95px;">Feed (kg)</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; width: 100px;">Tray Left</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; width: 95px;">Water Lvl</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; min-width: 130px;">Colour</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; min-width: 200px;">Minerals Applied</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; min-width: 200px;">Probiotics Applied</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; width: 95px;">Mort. (kg)</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; min-width: 140px;">Remarks</th>
                                        <th style="padding: 0.75rem 0.85rem; border-bottom: 2px solid #cbd5e1; width: 85px; text-align: center;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${timelineRows.map(row => renderTableRow(row)).join("")}
                                </tbody>
                            </table>
                        ` : ''}
                    </div>
                </section>

                <!-- 5. ENTRY / EDIT MODAL -->
                ${DailyEntryModal.renderMarkup(pond, this.activePondsList, this.isModalOnlyMode)}

                <!-- 6. TREATMENT TOTALS SUMMARY MODAL -->
                ${TreatmentSummaryModal.renderMarkup(this.usageSummary, pondLabel)}

            </div>
        `;

        this.bindEvents();
    }

    /**
     * Builds continuous array of daily timeline rows from DOC 1 to today
     */
    buildTimelineRows() {
        const pond = this.currentPond;
        const recordsMap = new Map();
        this.records.forEach(r => recordsMap.set(r.log_date, r));

        const rows = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = getLocalDateStr(today);

        let startDate;
        if (pond.stck_date) {
            startDate = parseLocalDate(pond.stck_date);
            startDate.setHours(0, 0, 0, 0);
        } else {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 14);
        }

        let cur = new Date(startDate);
        while (cur <= today) {
            const dateStr = getLocalDateStr(cur);
            const doc = pond.stck_date ? calculateDOC(pond.stck_date, dateStr) : 0;
            const existing = recordsMap.get(dateStr) || null;

            rows.push({
                dateStr,
                doc,
                isToday: dateStr === todayStr,
                record: existing,
                treatments: this.treatmentsByDate.get(dateStr) || []
            });

            cur.setDate(cur.getDate() + 1);
        }

        this.records.forEach(r => {
            if (!rows.find(x => x.dateStr === r.log_date)) {
                rows.push({
                    dateStr: r.log_date,
                    doc: pond.stck_date ? calculateDOC(pond.stck_date, r.log_date) : 0,
                    isToday: r.log_date === todayStr,
                    record: r,
                    treatments: this.treatmentsByDate.get(r.log_date) || []
                });
            }
        });

        rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
        return rows;
    }

    /**
     * Binds ledger page events and delegates modal events
     */
    bindEvents() {
        const pond = this.currentPond;
        if (!pond) return;

        // Navigation Back to Pond View
        const btnBackPond = this.container.querySelector("#btn-daily-back-pond");
        if (btnBackPond && this.callbacks.onBackToPond) {
            btnBackPond.addEventListener("click", () => this.callbacks.onBackToPond(pond));
        }

        // Navigation Back to Map
        const btnBackMap = this.container.querySelector("#btn-daily-back-map");
        if (btnBackMap && this.callbacks.onBackToMap) {
            btnBackMap.addEventListener("click", () => this.callbacks.onBackToMap());
        }

        // Treatment Summary Modal
        this.treatmentModal.bindEvents();
        const btnViewUsage = this.container.querySelector("#btn-view-usage-summary");
        if (btnViewUsage) {
            btnViewUsage.addEventListener("click", () => this.treatmentModal.open());
        }

        // Quick Log Today
        const btnQuickToday = this.container.querySelector("#btn-quick-log-today");
        if (btnQuickToday) {
            btnQuickToday.addEventListener("click", () => {
                const todayStr = getLocalDateStr();
                const existing = this.records.find(r => r.log_date === todayStr);
                this.openEntryModal(todayStr, existing);
            });
        }

        // Table / Card Edit Buttons
        this.container.querySelectorAll(".btn-edit-record").forEach(btn => {
            btn.addEventListener("click", () => {
                const dateStr = btn.getAttribute("data-date");
                const existing = this.records.find(r => r.log_date === dateStr);
                this.openEntryModal(dateStr, existing);
            });
        });

        // Table / Mobile "+ Log" Buttons for empty days
        this.container.querySelectorAll(".btn-log-day").forEach(btn => {
            btn.addEventListener("click", () => {
                const dateStr = btn.getAttribute("data-date");
                this.openEntryModal(dateStr, null);
            });
        });

        // Mobile "Load More Records" Button (+14 Days Chunk)
        const btnLoadMore = this.container.querySelector("#btn-load-more-daily");
        if (btnLoadMore) {
            btnLoadMore.addEventListener("click", () => {
                this.mobileVisibleCount += 14;
                const currentY = window.scrollY || window.pageYOffset || 0;
                this.renderView();
                window.scrollTo(0, currentY);
            });
        }

        // Adaptive Responsive Breakpoint Switcher
        if (!this._hasBoundResize) {
            this._hasBoundResize = true;
            let lastWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
            window.addEventListener("resize", () => {
                const wasMobile = lastWidth <= 768;
                const nowMobile = window.innerWidth <= 768;
                lastWidth = window.innerWidth;
                if (wasMobile !== nowMobile && this.container && this.currentPond && !this.isModalOnlyMode) {
                    this.renderView();
                }
            });
        }

        // Initialize & bind DailyEntryModal
        this.entryModal.initContext(
            this.currentPond,
            this.activePondsList,
            this.records,
            this.treatmentsByDate,
            this.isModalOnlyMode
        );
        this.entryModal.bindEvents();
    }

    /**
     * Helper to open entry modal
     */
    openEntryModal(targetDate, existingRecord = null, options = { autoFocusFeed: true }) {
        this.entryModal.initContext(
            this.currentPond,
            this.activePondsList,
            this.records,
            this.treatmentsByDate,
            this.isModalOnlyMode
        );
        this.entryModal.openEntryModal(targetDate, existingRecord, options);
    }

    /**
     * Helper to close entry modal
     */
    closeModal() {
        this.entryModal.closeModal();
    }
}
