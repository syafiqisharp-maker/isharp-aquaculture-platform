import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { DailyReportExcelService } from "../src/modules/dbms/services/DailyReportExcelService.js";
import { DailyReportLabService } from "../src/modules/dbms/services/DailyReportLabService.js";
import { DailyReportStateService, DAILY_REPORT_STORAGE_KEY, LEGACY_STORAGE_KEY } from "../src/modules/dbms/services/DailyReportStateService.js";

// Mock localStorage for Node test environment
const mockStorage = new Map();
global.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear()
};

describe("Daily Report Services & Harvest Reconciliation Test Suite", () => {

    beforeEach(() => {
        mockStorage.clear();
    });

    describe("DailyReportExcelService", () => {
        test("normalizePondCode formats raw codes into canonical dot notation", () => {
            assert.equal(DailyReportExcelService.normalizePondCode("040702"), "04.07.02");
            assert.equal(DailyReportExcelService.normalizePondCode("04.07.02"), "04.07.02");
            assert.equal(DailyReportExcelService.normalizePondCode("2040702.40"), "04.07.02");
            assert.equal(DailyReportExcelService.normalizePondCode("40702"), "04.07.02");
            assert.equal(DailyReportExcelService.normalizePondCode("04-07-02"), "04.07.02");
            assert.equal(DailyReportExcelService.normalizePondCode(""), "");
            assert.equal(DailyReportExcelService.normalizePondCode(null), "");
        });

        test("reconcileForecastWithActuals calculates COMPLETED, PLANNED, OVERDUE and variances", () => {
            const forecasts = [
                {
                    pond: "04.07.02",
                    targetDate: "03-Nov-2026",
                    targetDoc: "105",
                    biomass: "3000",
                    abw: "22.0",
                    status: "Full"
                },
                {
                    pond: "04.08.01",
                    targetDate: "30-Nov-2026",
                    targetDoc: "110",
                    biomass: "4000",
                    abw: "24.5",
                    status: "Full"
                },
                {
                    pond: "04.09.03",
                    targetDate: "01-Nov-2026", // past date with no actual harvest
                    targetDoc: "100",
                    biomass: "2500",
                    abw: "20.0",
                    status: "Full"
                },
                {
                    pond: "04.10.02",
                    targetDate: "",
                    targetDoc: "",
                    biomass: "2000",
                    abw: "18.0",
                    status: "TBD"
                }
            ];

            const actuals = [
                {
                    pond: "04.07.02",
                    harvestDate: "03-Nov-2026",
                    tonnage: 3.45, // entered in tonnes (< 100) -> 3450 kg
                    abw: 23.2,
                    type: "Full",
                    buyer: "Local Fishery"
                }
            ];

            const today = new Date("2026-11-06T10:00:00Z");
            const reconciled = DailyReportExcelService.reconcileForecastWithActuals(forecasts, actuals, today);

            assert.equal(reconciled.length, 4);

            // Item 1: COMPLETED with +450 kg variance
            const p1 = reconciled.find(r => r.pond === "04.07.02");
            assert.ok(p1);
            assert.equal(p1.reconciliationStatus, "COMPLETED");
            assert.equal(p1.actualBiomassKg, 3450);
            assert.equal(p1.diffBiomassKg, 450);
            assert.equal(p1.actualAbw, 23.2);
            assert.equal(p1.diffAbw, 1.2);

            // Item 2: PLANNED (future target date)
            const p2 = reconciled.find(r => r.pond === "04.08.01");
            assert.ok(p2);
            assert.equal(p2.reconciliationStatus, "PLANNED");
            assert.equal(p2.actualBiomassKg, 0);

            // Item 3: OVERDUE (past target date with no actuals)
            const p3 = reconciled.find(r => r.pond === "04.09.03");
            assert.ok(p3);
            assert.equal(p3.reconciliationStatus, "OVERDUE");

            // Item 4: PENDING (no valid target date)
            const p4 = reconciled.find(r => r.pond === "04.10.02");
            assert.ok(p4);
            assert.equal(p4.reconciliationStatus, "PENDING");
        });

        test("calculateReconciliationSummary aggregates all status counts and biomass variance", () => {
            const reconciledList = [
                { reconciliationStatus: "COMPLETED", forecastBiomassKg: 3000, actualBiomassKg: 3500, diffBiomassKg: 500 },
                { reconciliationStatus: "COMPLETED", forecastBiomassKg: 4000, actualBiomassKg: 3800, diffBiomassKg: -200 },
                { reconciliationStatus: "OVERDUE", forecastBiomassKg: 2000, actualBiomassKg: 0, diffBiomassKg: -2000 },
                { reconciliationStatus: "PLANNED", forecastBiomassKg: 5000, actualBiomassKg: 0, diffBiomassKg: 0 },
                { reconciliationStatus: "PENDING", forecastBiomassKg: 1000, actualBiomassKg: 0, diffBiomassKg: 0 }
            ];

            const summary = DailyReportExcelService.calculateReconciliationSummary(reconciledList);
            assert.equal(summary.totalCount, 5);
            assert.equal(summary.completedCount, 2);
            assert.equal(summary.overdueCount, 1);
            assert.equal(summary.plannedCount, 1);
            assert.equal(summary.pendingCount, 1);
            assert.equal(summary.totalForecastKg, 15000);
            assert.equal(summary.totalActualKg, 7300);
            assert.equal(summary.netVarianceKg, 300); // 500 + (-200) for completed
        });
    });

    describe("DailyReportLabService", () => {
        test("shiftRainfallDays advances date sequence and inserts today with 0.00mm", () => {
            const initialHistory = [
                { date: "04-Nov", mm: "12.5" },
                { date: "03-Nov", mm: "5.0" },
                { date: "02-Nov", mm: "0.0" },
                { date: "01-Nov", mm: "18.2" },
                { date: "31-Oct", mm: "2.1" }
            ];

            const { nextDate, rainfallHistory } = DailyReportLabService.shiftRainfallDays(initialHistory);

            assert.equal(nextDate, "05-Nov");
            assert.equal(rainfallHistory.length, 5);
            assert.equal(rainfallHistory[0].date, "05-Nov");
            assert.equal(rainfallHistory[0].mm, "0.00");
            assert.equal(rainfallHistory[1].date, "04-Nov");
            assert.equal(rainfallHistory[1].mm, "12.5");
            assert.equal(rainfallHistory[4].date, "01-Nov");
            assert.equal(rainfallHistory[4].mm, "18.2");
        });

        test("applyParsedLabData updates state fields cleanly", () => {
            const state = {
                rainfallHistory: [
                    { date: "01-Nov", mm: "0" },
                    { date: "02-Nov", mm: "0" },
                    { date: "03-Nov", mm: "0" },
                    { date: "04-Nov", mm: "0" },
                    { date: "05-Nov", mm: "0" }
                ],
                mdcStatus: "Low",
                pondAmTemp: "28.0",
                pondSalinity: "25 ppt"
            };

            const parsed = {
                dates: ["05-Nov", "04-Nov", "03-Nov", "02-Nov", "01-Nov"],
                rainfall: ["15.0", "8.5", "0.0", "12.0", "4.0"],
                mdc: "Optimal (1.2m)",
                amTemp: "29.2 °C",
                salinity: "28.5 ppt"
            };

            const { updatedFields, state: nextState } = DailyReportLabService.applyParsedLabData(parsed, state);

            assert.ok(updatedFields.length >= 4);
            assert.equal(nextState.mdcStatus, "Optimal (1.2m)");
            assert.equal(nextState.pondAmTemp, "29.2 °C");
            assert.equal(nextState.pondSalinity, "28.5 ppt");
            assert.equal(nextState.rainfallHistory[0].mm, "15.0");
        });
    });

    describe("DailyReportStateService", () => {
        test("getDefaultReportState provides zero-mock readiness and dynamic doc brackets", () => {
            const defState = DailyReportStateService.getDefaultReportState();

            assert.ok(defState);
            assert.equal(defState.totalPonds, 216);
            assert.equal(defState.cleaningTeamsCount, 0);
            assert.equal(defState.cleaningTeamsDetail, "");
            assert.equal(defState.samplingDateLabel, "29 Oct");
            assert.deepEqual(defState.moduleRows, []);
            assert.equal(defState.harvestForecasts.length, 12);
        });

        test("sanitizeDraft purges legacy mock ponds in cleaning and legacy placeholders", () => {
            const dirtyDraft = {
                reportDate: "Thursday, November 5, 2026",
                reportTime: "5:50 PM",
                cleaningTeamsDetail: "Int 1 & 2, P02, P06",
                highlightStockingPonds: 7,
                highlightHarvestPonds: 6
            };

            const cleaned = DailyReportStateService.sanitizeDraft(dirtyDraft);

            // Legacy fake cleaning strings and stale data purged
            assert.equal(cleaned.cleaningTeamsDetail, "");
            assert.equal(cleaned.highlightStockingPonds, 0);
            assert.equal(cleaned.highlightHarvestPonds, 0);
        });

        test("saveDraft and loadDraft round-trip works via localStorage", () => {
            const state = DailyReportStateService.getDefaultReportState();
            state.reportDate = "Friday, November 6, 2026";
            state.reportTime = "10:15 AM";

            const saved = DailyReportStateService.saveDraft(state);
            assert.equal(saved, true);

            const loaded = DailyReportStateService.loadDraft();
            assert.ok(loaded);
            assert.equal(loaded.reportDate, "Friday, November 6, 2026");
            assert.equal(loaded.reportTime, "10:15 AM");
        });

        test("loadDraft seamlessly falls back to legacy storage key v1", () => {
            const legacyState = DailyReportStateService.getDefaultReportState();
            legacyState.reportDate = "Wednesday, November 4, 2026";
            mockStorage.set(LEGACY_STORAGE_KEY, JSON.stringify(legacyState));

            const loaded = DailyReportStateService.loadDraft();
            assert.ok(loaded);
            assert.equal(loaded.reportDate, "Wednesday, November 4, 2026");
        });
    });
});
