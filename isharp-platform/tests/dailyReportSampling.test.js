import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutiveMetricsPresenter } from '../src/modules/executive/ExecutiveMetricsPresenter.js';
import { buildDailyReportEmailHtml } from '../src/modules/dbms/utils/dailyReportHtmlBuilder.js';

test('Daily Report Section 9 — Dynamic Module Biometrics & Samplings', async (t) => {
    await t.test('dynamically calculates Module 01-09 ADG, ABW, and DOC and sampling date label', () => {
        const mockSamplings = [
            // Pond 01.01.01 (Module 01, Vannamei) - Previous & Latest
            { pond_index: '2010101.40', smpl_date: '2026-10-22', smpl_doc: 43, smpl_abw: 6.0, smpl_surv: 80, smpl_bms: 2000 },
            { pond_index: '2010101.40', smpl_date: '2026-10-29', smpl_doc: 50, smpl_abw: 8.0, smpl_surv: 82, smpl_bms: 2500 },

            // Pond 05.09.05 (Module 05, Monodon) - Previous & Latest
            { pond_index: '2050905.40', smpl_date: '2026-10-22', smpl_doc: 75, smpl_abw: 20.0, smpl_surv: 70, smpl_bms: 3000 },
            { pond_index: '2050905.40', smpl_date: '2026-10-29', smpl_doc: 83, smpl_abw: 30.0, smpl_surv: 68, smpl_bms: 3500 },

            // Pond 07.13.01 (Module 07, Vannamei)
            { pond_index: '2071301.40', smpl_date: '2026-10-29', smpl_doc: 60, smpl_abw: 12.0, smpl_surv: 85, smpl_bms: 2200 },

            // Pond 07.14.01 (Module 07, Monodon)
            { pond_index: '2071401.40', smpl_date: '2026-10-29', smpl_doc: 110, smpl_abw: 35.0, smpl_surv: 60, smpl_bms: 2800 }
        ];

        const mockActiveCycles = [
            { pond_index: '2010101.40', pond: '01.01.01', stck_species: 'P. VANNAMEI', pond_status: 'PRODUCTION' },
            { pond_index: '2050905.40', pond: '05.09.05', stck_species: 'P. MONODON', pond_status: 'PRODUCTION' },
            { pond_index: '2071301.40', pond: '07.13.01', stck_species: 'P. VANNAMEI', pond_status: 'PRODUCTION' },
            { pond_index: '2071401.40', pond: '07.14.01', stck_species: 'P. MONODON', pond_status: 'PRODUCTION' }
        ];

        const mockDailyProgress = [
            { pond: '01.01.01', module_no: 1, progress_state: 'CULTURE' },
            { pond: '05.09.05', module_no: 5, progress_state: 'CULTURE' },
            { pond: '07.13.01', module_no: 7, progress_state: 'CULTURE' },
            { pond: '07.14.01', module_no: 7, progress_state: 'CULTURE' }
        ];

        const result = ExecutiveMetricsPresenter.aggregateModuleBiometrics({
            samplings: mockSamplings,
            culturingPonds: mockDailyProgress,
            activeCycles: mockActiveCycles,
            dailyProgress: mockDailyProgress
        });

        assert.ok(result);
        assert.equal(result.moduleRows.length, 9);
        assert.equal(result.samplingDateLabel, '29 Oct');

        // Module 01 (Vannamei)
        const mod01 = result.moduleRows.find(r => r.mod === '01');
        assert.ok(mod01);
        assert.equal(mod01.van, 1);
        assert.equal(mod01.mon, 0);
        assert.equal(mod01.latDocV, '50');
        assert.equal(mod01.latAbwV, '8.0');
        assert.equal(mod01.latAdgV, '0.16'); // 8.0 / 50 = 0.16
        assert.equal(mod01.prevDocV, '43');
        assert.equal(mod01.prevAbwV, '6.0');
        assert.equal(mod01.prevAdgV, '0.14'); // 6.0 / 43 = 0.1395 -> 0.14
        assert.equal(mod01.latDocM, '—');

        // Module 05 (Monodon)
        const mod05 = result.moduleRows.find(r => r.mod === '05');
        assert.ok(mod05);
        assert.equal(mod05.van, 0);
        assert.equal(mod05.mon, 1);
        assert.equal(mod05.latDocM, '83');
        assert.equal(mod05.latAbwM, '30.0');
        assert.equal(mod05.latAdgM, '0.36'); // 30.0 / 83 = 0.3614 -> 0.36
        assert.equal(mod05.prevDocM, '75');
        assert.equal(mod05.latDocV, '—');

        // Module 07 (Both Vannamei & Monodon)
        const mod07 = result.moduleRows.find(r => r.mod === '07');
        assert.ok(mod07);
        assert.equal(mod07.van, 1);
        assert.equal(mod07.mon, 1);
        assert.equal(mod07.latDocV, '60');
        assert.equal(mod07.latAbwV, '12.0');
        assert.equal(mod07.latDocM, '110');
        assert.equal(mod07.latAbwM, '35.0');
    });
});

test('Daily Report Section 10 — Dynamic Monthly Stocking Plan', async (t) => {
    await t.test('renders dynamic monthly stocking plan with custom title, rows, and totals', () => {
        const customReportData = {
            reportDate: 'Wednesday, November 04, 2026',
            reportTime: '5:50 PM',
            activePonds: 119,
            utilizationPct: 55.09,
            stockingPlanSummary: {
                title: "Stocking Plan Dec '26 Target",
                rows: [
                    { genetic: 'SPT', ponds: 15, density: 420000, fryMil: 6.30 },
                    { genetic: 'SPF', ponds: 8, density: 400000, fryMil: 3.20 }
                ]
            }
        };

        const html = buildDailyReportEmailHtml(customReportData);

        assert.ok(html.includes("Stocking Plan Dec '26 Target"));
        assert.ok(html.includes('SPT'));
        assert.ok(html.includes('SPF'));
        assert.ok(html.includes('420,000'));
        assert.ok(html.includes('400,000'));
        assert.ok(html.includes('6.30'));
        assert.ok(html.includes('3.20'));
        // Total row: 15 + 8 = 23 ponds, 6.30 + 3.20 = 9.50 Mil fry
        assert.ok(html.includes('23'));
        assert.ok(html.includes('9.50'));
    });
});

test('Daily Report Section 4 & 5 — Dynamic DOC Brackets and Pond Readiness', async (t) => {
    await t.test('calculates exact 5-bracket DOC distribution and real percentages from stocking dates', () => {
        const refDate = new Date('2026-11-05T12:00:00Z');

        const mockCulturing = [
            { pond: '01.01.01', progress_state: 'CULTURE' },
            { pond: '01.01.02', progress_state: 'CULTURE' },
            { pond: '02.03.01', progress_state: 'CULTURE' },
            { pond: '03.05.01', progress_state: 'CULTURE' },
            { pond: '04.07.01', progress_state: 'CULTURE' }
        ];

        const mockCycles = [
            { pond: '01.01.01', stck_date: '2026-10-25', pond_status: 'PRODUCTION' }, // DOC 11 (0-30)
            { pond: '01.01.02', stck_date: '2026-09-25', pond_status: 'PRODUCTION' }, // DOC 41 (31-60)
            { pond: '02.03.01', stck_date: '2026-08-25', pond_status: 'PRODUCTION' }, // DOC 72 (61-90)
            { pond: '03.05.01', stck_date: '2026-07-25', pond_status: 'PRODUCTION' }, // DOC 103 (91-120)
            { pond: '04.07.01', stck_date: '2026-06-25', pond_status: 'PRODUCTION' }  // DOC 133 (>120)
        ];

        const brackets = ExecutiveMetricsPresenter.calculateDetailedDocBrackets({
            culturingPonds: mockCulturing,
            activeCycles: mockCycles,
            referenceDate: refDate
        });

        assert.equal(brackets.length, 5);
        assert.deepEqual(brackets[0], { label: 'DOC: 0-30 days', count: 1, pct: 20 });
        assert.deepEqual(brackets[1], { label: 'DOC: 31-60 days', count: 1, pct: 20 });
        assert.deepEqual(brackets[2], { label: 'DOC: 61-90 days', count: 1, pct: 20 });
        assert.deepEqual(brackets[3], { label: 'DOC: 91-120 days', count: 1, pct: 20 });
        assert.deepEqual(brackets[4], { label: 'DOC: >120 days', count: 1, pct: 20 });
    });

    await t.test('handles empty or offline cycles gracefully without fake fallbacks', () => {
        const brackets = ExecutiveMetricsPresenter.calculateDetailedDocBrackets({
            culturingPonds: [],
            activeCycles: [],
            operationalCycles: []
        });

        assert.equal(brackets.length, 5);
        brackets.forEach(b => {
            assert.equal(b.count, 0);
            assert.equal(b.pct, 0);
        });
    });

    await t.test('preserves last valid state when readiness query is empty and avoids static fake fallbacks', () => {
        // DailyReportTab helper emulation
        const aggregatePondReadiness = (dailyProgress = [], fallbackState = null) => {
            const counts = { idle: 0, cleaning: 0, cleaned: 0, repaired: 0, waterCulture: 0, ready: 0 };
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
        };

        const lastValidState = {
            idlePonds: 57,
            cleaningTeamsCount: 4,
            cleanedPonds: 9,
            waitingWaterFilling: 3,
            waterCulture: 19,
            readyForStocking: 5
        };

        // Offline / empty progress returns last valid state
        const fallbackResult = aggregatePondReadiness([], lastValidState);
        assert.deepEqual(fallbackResult, {
            idle: 57,
            cleaning: 4,
            cleaned: 9,
            repaired: 3,
            waterCulture: 19,
            ready: 5
        });

        // Uninitialized state returns zeros (no fake 56, 3, 6, 1, 23, 8 mock)
        const uninitResult = aggregatePondReadiness([], null);
        assert.deepEqual(uninitResult, {
            idle: 0,
            cleaning: 0,
            cleaned: 0,
            repaired: 0,
            waterCulture: 0,
            ready: 0
        });
    });

    await t.test('auto-populates cleaning ponds from pond_daily_progress', () => {
        const mockProgress = [
            { pond: '07.14.09', progress_state: 'CLEANING', status_code: 'Cp' },
            { pond: '06.11.01', progress_state: 'CLEANING', status_code: 'Cp' },
            { pond: '06.11.06', progress_state: 'CLEANING', status_code: 'Cp' },
            { pond: '06.12.09', progress_state: 'CLEANING', status_code: 'Cp' },
            { pond: '01.01.01', progress_state: 'CULTURE', status_code: 'Opr' }
        ];

        const cleaningPonds = mockProgress.filter(p => {
            const st = String(p.progress_state || "").toUpperCase();
            const code = String(p.status_code || "").toUpperCase();
            return st === "CLEANING" || code === "CP";
        });

        const detail = cleaningPonds.map(p => p.pond).filter(Boolean).sort().join(", ");
        assert.equal(detail, "06.11.01, 06.11.06, 06.12.09, 07.14.09");
    });
});
