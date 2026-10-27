import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    POND_PROGRESS_STATES,
    normalizePondProgressState,
    calculateProgressDays,
    resolveHybridPondState
} from '../src/domain/biometrics.js';
import { getFarmMapShellHtml, renderPondTileHtml } from '../src/modules/executive/templates/pondGridCellTemplate.js';
import { getDrawerHtml } from '../src/modules/executive/templates/pondDrawerTemplate.js';

test('Pond Progress: normalizePondProgressState', async (t) => {
    await t.test('normalizes raw Excel codes and template strings correctly', () => {
        // Core preparation codes
        assert.equal(normalizePondProgressState('Idle', 'Hv'), 'IDLE');
        assert.equal(normalizePondProgressState('Cleaning', 'Cp'), 'CLEANING');
        assert.equal(normalizePondProgressState('Cleaned', 'Cr'), 'CLEANED');
        assert.equal(normalizePondProgressState('Repaired', 'Rw'), 'REPAIRED');
        assert.equal(normalizePondProgressState('Repair progress', 'Rp'), 'REPAIRED');
        assert.equal(normalizePondProgressState('Repaired', 'RW'), 'REPAIRED');
        assert.equal(normalizePondProgressState('Water Culture', 'Wc'), 'WATER_CULTURE');
        assert.equal(normalizePondProgressState('Water Filling', 'Fw'), 'WATER_CULTURE');
        assert.equal(normalizePondProgressState('Culture', 'Opr'), 'CULTURE');
        
        // Ready for stocking via template name or map code
        assert.equal(normalizePondProgressState('Ready for Stocking', 'Wc'), 'READY');
        assert.equal(normalizePondProgressState('Water Culture', 'Wc', 'Wc+21 & BioA'), 'READY');
    });

    await t.test('falls back to IDLE for unknown or empty status', () => {
        assert.equal(normalizePondProgressState(null, null), 'IDLE');
        assert.equal(normalizePondProgressState('', ''), 'IDLE');
        assert.equal(normalizePondProgressState('Unknown Status', 'Xx'), 'IDLE');
    });
});

test('Pond Progress: calculateProgressDays', async (t) => {
    await t.test('clamps negative days in status to 0', () => {
        const rec = { days_in_status: -1, status_start_date: null };
        assert.equal(calculateProgressDays(rec), 0);
    });

    await t.test('dynamically calculates days from status_start_date when provided', () => {
        const rec = { status_start_date: '2026-10-20', days_in_status: 3 };
        const refDate = '2026-10-25';
        assert.equal(calculateProgressDays(rec, refDate), 5);
    });

    await t.test('clamps future status_start_date to 0', () => {
        const rec = { status_start_date: '2026-10-28', days_in_status: -2 };
        const refDate = '2026-10-26';
        assert.equal(calculateProgressDays(rec, refDate), 0);
    });

    await t.test('falls back to days_in_status if status_start_date is invalid or null', () => {
        const rec = { status_start_date: 'invalid', days_in_status: 12 };
        assert.equal(calculateProgressDays(rec), 12);
    });

    await t.test('returns 0 for null record', () => {
        assert.equal(calculateProgressDays(null), 0);
    });
});

test('Pond Progress: resolveHybridPondState (Smart Hybrid SSOT)', async (t) => {
    const refDate = '2026-10-27';

    await t.test('Scenario 1: Established Culture pond in both Supabase and Excel', () => {
        const cycle = {
            pond: '01.01.01',
            pond_index: '2010101.40',
            pond_status: 'PRODUCTION',
            stck_date: '2026-09-03',
            stck_species: 'P. VANNAMEI'
        };
        const daily = {
            pond: '01.01.01',
            progress_state: 'CULTURE',
            raw_template_status: 'Culture',
            days_in_status: 54,
            stocking_date: '2026-09-03'
        };
        const issues = [{ issue_flag: 'GREEN' }];

        const result = resolveHybridPondState('01.01.01', cycle, daily, issues, refDate);
        assert.equal(result.isActive, true);
        assert.equal(result.progressState, 'CULTURE');
        assert.equal(result.speciesCode, 'VAN');
        assert.equal(result.health, 'GREEN');
        assert.equal(result.syncState, 'SYNCED');
        assert.equal(result.doc, 54);
        assert.equal(result.docDisplay, '54');
    });

    await t.test('Scenario 2: Mid-Week newly stocked pond in Excel before Friday sync', () => {
        // Supabase still has IDLE (not yet updated from Access)
        const cycle = {
            pond: '07.13.10',
            pond_index: '2071310.35',
            pond_status: 'IDLE',
            stck_date: null
        };
        // Excel was updated daily and stocked on 2026-10-26
        const daily = {
            pond: '07.13.10',
            progress_state: 'CULTURE',
            raw_template_status: 'Culture',
            days_in_status: 1,
            stocking_date: '2026-10-26'
        };

        const result = resolveHybridPondState('07.13.10', cycle, daily, [], refDate);
        assert.equal(result.isActive, true);
        assert.equal(result.progressState, 'CULTURE');
        assert.equal(result.speciesCode, 'NEW');
        assert.equal(result.speciesLabel, 'NEW');
        assert.equal(result.speciesBadgeClass, 'sp-new');
        assert.equal(result.syncState, 'NEWLY_STOCKED_EXCEL');
        assert.equal(result.doc, 1);
        assert.equal(result.docDisplay, '1');
        assert.equal(result.cssClass, 'risk-green');
    });

    await t.test('Scenario 3: Mid-Week harvested pond in Excel before Friday sync closeout', () => {
        // Supabase still has old cycle in PRODUCTION from June
        const cycle = {
            pond: '04.07.01',
            pond_index: '2040701.38',
            pond_status: 'PRODUCTION',
            stck_date: '2026-06-21'
        };
        // Excel daily shows pond was harvested on 2026-10-26 (newer than June) and is now Idle
        const daily = {
            pond: '04.07.01',
            progress_state: 'IDLE',
            raw_template_status: 'Idle',
            days_in_status: 1,
            last_harvest_date: '2026-10-26',
            status_start_date: '2026-10-26'
        };

        const result = resolveHybridPondState('04.07.01', cycle, daily, [], refDate);
        assert.equal(result.isActive, false);
        assert.equal(result.progressState, 'IDLE');
        assert.equal(result.syncState, 'HARVESTED_MIDWEEK_EXCEL');
        assert.equal(result.progressDays, 1);
        assert.equal(result.docDisplay, '1d');
        assert.equal(result.speciesCode, 'IDLE');
    });

    await t.test('Scenario 4: Preparation states (Ready, Water Culture, Repaired, Cleaned, Cleaning)', () => {
        const prepCases = [
            { state: 'READY', label: 'READY', cls: 'progress-ready', days: 20 },
            { state: 'WATER_CULTURE', label: 'WATER CULT', cls: 'progress-water-culture', days: 4 },
            { state: 'REPAIRED', label: 'REPAIRED', cls: 'progress-repaired', days: 3 },
            { state: 'CLEANED', label: 'CLEANED', cls: 'progress-cleaned', days: 6 },
            { state: 'CLEANING', label: 'CLEANING', cls: 'progress-cleaning', days: 2 }
        ];

        for (const tc of prepCases) {
            const daily = {
                pond: '01.01.03',
                progress_state: tc.state,
                raw_template_status: tc.state,
                days_in_status: tc.days
            };
            const result = resolveHybridPondState('01.01.03', null, daily, [], refDate);
            assert.equal(result.isActive, false);
            assert.equal(result.progressState, tc.state);
            assert.equal(result.speciesLabel, tc.label);
            assert.equal(result.cssClass, tc.cls);
            assert.equal(result.docDisplay, `${tc.days}d`);
        }
    });

    await t.test('Scenario 5: Idle pond overdue > 30 days receives warning class', () => {
        const daily = {
            pond: '02.04.06',
            progress_state: 'IDLE',
            days_in_status: 45
        };
        const result = resolveHybridPondState('02.04.06', null, daily, [], refDate);
        assert.equal(result.progressDays, 45);
        assert.ok(result.cssClass.includes('idle-overdue'));
    });
});

test('Pond Progress: UI Template Contract Verification', async (t) => {
    await t.test('getFarmMapShellHtml contains Pond Progress filter row with count spans', () => {
        const html = getFarmMapShellHtml();
        assert.ok(html.includes('id="filter-group-pond-progress"'));
        assert.ok(html.includes('data-filter-val="CULTURE"'));
        assert.ok(html.includes('data-filter-val="READY"'));
        assert.ok(html.includes('data-filter-val="WATER_CULTURE"'));
        assert.ok(html.includes('data-filter-val="REPAIRED"'));
        assert.ok(html.includes('data-filter-val="CLEANED"'));
        assert.ok(html.includes('data-filter-val="CLEANING"'));
        assert.ok(html.includes('data-filter-val="IDLE"'));
        assert.ok(html.includes('data-count-key="ALL"'));
    });

    await t.test('renderPondTileHtml includes progress attributes and stage badges', () => {
        const pondData = {
            pondCode: '01.01.03',
            pondIndex: '2010103.12',
            speciesCode: 'WATER_CULTURE',
            speciesLabel: 'WATER CULT',
            speciesBadgeClass: 'sp-water-cult',
            health: 'IDLE',
            healthDescription: 'Water Culture (4 days)',
            stageCode: 'IDLE',
            progressState: 'WATER_CULTURE',
            progressLabel: 'Water Culture',
            progressBadgeText: 'WATER CULT',
            progressDays: 4,
            docDisplay: '4d',
            cssClass: 'progress-water-culture',
            syncState: 'SYNCED',
            doc: 0
        };

        const tileHtml = renderPondTileHtml(pondData, '03');
        assert.ok(tileHtml.includes('data-progress="WATER_CULTURE"'));
        assert.ok(tileHtml.includes('data-sync-state="SYNCED"'));
        assert.ok(tileHtml.includes('4d'));
        assert.ok(tileHtml.includes('WATER CULT'));
        assert.ok(tileHtml.includes('progress-water-culture'));
    });

    await t.test('getDrawerHtml renders Preparation Milestone Timeline and Sync Banners', () => {
        const dailyProgress = {
            last_harvest_date: '2026-10-20',
            cleaning_done_date: '2026-10-22',
            repair_done_date: '2026-10-23',
            filled_water_date: '2026-10-24',
            water_treat_date: '2026-10-25',
            pass_bioassay: true,
            bioassay_date: '2026-10-26',
            excel_as_of_date: '2026-10-26'
        };
        const pondData = {
            progressState: 'READY',
            progressLabel: 'Ready for Stocking',
            progressDays: 2,
            syncState: 'SYNCED'
        };

        const drawerHtml = getDrawerHtml({
            pondCode: '07.13.05',
            cycle: null,
            dailyProgress,
            pondData
        });

        assert.ok(drawerHtml.includes('Preparation &amp; Progress Milestones'));
        assert.ok(drawerHtml.includes('2026-10-20'));
        assert.ok(drawerHtml.includes('PASS'));
        assert.ok(drawerHtml.includes('Ready for Stocking'));
    });
});
