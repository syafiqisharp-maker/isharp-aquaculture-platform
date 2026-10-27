import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    POND_PROGRESS_STATES,
    normalizePondProgressState,
    calculateProgressDays,
    resolveHybridPondState,
    buildPondProgressTimeline
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

test('Pond Progress: buildPondProgressTimeline (Compact 3-Column Timeline SSOT)', async (t) => {
    await t.test('calculates exact inter-event days delta matching the user hand-drawn sketch', () => {
        // Hand-drawn sketch scenario:
        // Last Harvest: 2026-07-30
        // Cleaning Start: 2026-08-10 (11 days)
        // Cleaned: 2026-08-12 (2 days)
        // Repaired: 2026-08-15 (3 days)
        const dailyProgress = {
            last_harvest_date: '2026-07-30',
            clean_progress_date: '2026-08-10',
            cleaning_done_date: '2026-08-12',
            repair_done_date: '2026-08-15',
            filled_water_date: null,
            water_treat_date: null,
            pass_bioassay: false,
            bioassay_date: null,
            stocking_date: null
        };
        const pondData = {
            progressState: 'REPAIRED',
            progressDays: 3
        };

        const timeline = buildPondProgressTimeline(dailyProgress, null, pondData);

        assert.equal(timeline.hasAnyDate, true);
        assert.equal(timeline.isStocked, false);
        assert.equal(timeline.steps.length, 8);

        // Step 0: Last Harvest
        assert.equal(timeline.steps[0].key, 'harvest');
        assert.equal(timeline.steps[0].date, '2026-07-30');
        assert.equal(timeline.steps[0].segmentDays, 11);
        assert.equal(timeline.steps[0].segmentLabel, '11 days');
        assert.equal(timeline.steps[0].segmentDone, true);
        assert.equal(timeline.steps[0].status, 'done');

        // Step 1: Cleaning Start
        assert.equal(timeline.steps[1].key, 'cleaning_start');
        assert.equal(timeline.steps[1].date, '2026-08-10');
        assert.equal(timeline.steps[1].segmentDays, 2);
        assert.equal(timeline.steps[1].segmentLabel, '2 days');
        assert.equal(timeline.steps[1].segmentDone, true);
        assert.equal(timeline.steps[1].status, 'done');

        // Step 2: Cleaned
        assert.equal(timeline.steps[2].key, 'cleaned');
        assert.equal(timeline.steps[2].date, '2026-08-12');
        assert.equal(timeline.steps[2].segmentDays, 3);
        assert.equal(timeline.steps[2].segmentLabel, '3 days');
        assert.equal(timeline.steps[2].segmentDone, true);
        assert.equal(timeline.steps[2].status, 'done');

        // Step 3: Repaired (Current Active Milestone)
        assert.equal(timeline.steps[3].key, 'repaired');
        assert.equal(timeline.steps[3].date, '2026-08-15');
        assert.equal(timeline.steps[3].segmentDays, null); // Next date is null
        assert.equal(timeline.steps[3].segmentLabel, null);
        assert.equal(timeline.steps[3].status, 'current');
        assert.equal(timeline.steps[3].nodeBadge, 'Active • 3d');

        // Step 4: Water Filled (Pending)
        assert.equal(timeline.steps[4].key, 'water_filled');
        assert.equal(timeline.steps[4].date, null);
        assert.equal(timeline.steps[4].status, 'pending');

        // Total turnaround from harvest to latest milestone (16 days: 2026-07-30 to 2026-08-15)
        assert.equal(timeline.totalTurnaroundDays, 16);
    });

    await t.test('formats singular "1 day" for 24h gap correctly', () => {
        const dailyProgress = {
            last_harvest_date: '2026-08-10',
            clean_progress_date: '2026-08-11'
        };
        const timeline = buildPondProgressTimeline(dailyProgress);
        assert.equal(timeline.steps[0].segmentDays, 1);
        assert.equal(timeline.steps[0].segmentLabel, '1 day');
    });

    await t.test('handles full culture cycle with turnaround and DOC badge', () => {
        const cycle = {
            pond: '01.01.01',
            pond_status: 'PRODUCTION',
            stck_date: '2026-09-03'
        };
        const dailyProgress = {
            last_harvest_date: '2026-07-30',
            clean_progress_date: '2026-08-10',
            cleaning_done_date: '2026-08-12',
            repair_done_date: '2026-08-15',
            filled_water_date: '2026-08-20',
            water_treat_date: '2026-08-22',
            pass_bioassay: true,
            bioassay_date: '2026-08-28',
            stocking_date: '2026-09-03'
        };
        const pondData = {
            isActive: true,
            progressState: 'CULTURE',
            docDisplay: '54'
        };

        const timeline = buildPondProgressTimeline(dailyProgress, cycle, pondData);

        assert.equal(timeline.isStocked, true);
        assert.equal(timeline.totalTurnaroundDays, 35); // 2026-07-30 to 2026-09-03 = 35 days
        assert.equal(timeline.steps[5].label, 'W. Culture Start'); // Renamed milestone
        assert.equal(timeline.steps[7].status, 'current');
        assert.equal(timeline.steps[7].nodeBadge, 'Current • 54 DOC');
        assert.equal(timeline.steps[6].nodeBadge, 'PASS');
    });

    await t.test('Option B: calculates elapsed days between two available events when intermediate event dates are missing', () => {
        // Real farm scenario (pond 01.01.11):
        // W. Culture Start is 2026-08-24
        // Bioassay & QAQC is unrecorded (null)
        // Stocked is 2026-09-09
        // Elapsed days between W. Culture Start and Stocked: 16 days
        const cycle = {
            pond: '01.01.11',
            pond_status: 'PRODUCTION',
            stck_date: '2026-09-09'
        };
        const dailyProgress = {
            last_harvest_date: '2026-07-28',
            clean_progress_date: '2026-08-20',
            cleaning_done_date: '2026-08-21',
            repair_done_date: '2026-08-22',
            filled_water_date: '2026-08-22',
            water_treat_date: '2026-08-24',
            pass_bioassay: false,
            bioassay_date: null, // Missing date
            stocking_date: '2026-09-09'
        };
        const pondData = {
            isActive: true,
            progressState: 'CULTURE',
            docDisplay: '48'
        };

        const timeline = buildPondProgressTimeline(dailyProgress, cycle, pondData);

        // Step 5: W. Culture Start -> Step 7: Stocked
        assert.equal(timeline.steps[5].label, 'W. Culture Start');
        assert.equal(timeline.steps[5].segmentDays, 16);
        assert.equal(timeline.steps[5].segmentLabel, '16 days');
        assert.equal(timeline.steps[5].segmentDone, true);

        // Step 6: Bioassay & QAQC (Skipped/unrecorded)
        assert.equal(timeline.steps[6].key, 'bioassay');
        assert.equal(timeline.steps[6].date, null);
        assert.equal(timeline.steps[6].status, 'skipped');
        assert.equal(timeline.steps[6].segmentDays, null);
        assert.equal(timeline.steps[6].segmentDone, true); // Continuous solid spine

        // Step 7: Stocked
        assert.equal(timeline.steps[7].key, 'stocked');
        assert.equal(timeline.steps[7].status, 'current');
    });

    await t.test('Option B: handles multiple missing intermediate event dates across a wide span', () => {
        // Last Harvest on 2026-09-20, Cleaning and Repair not entered, Water Filled on 2026-10-21 (31 days)
        const dailyProgress = {
            last_harvest_date: '2026-09-20',
            clean_progress_date: null,
            cleaning_done_date: null,
            repair_done_date: null,
            filled_water_date: '2026-10-21'
        };
        const pondData = {
            progressState: 'WATER_CULTURE',
            progressDays: 6
        };

        const timeline = buildPondProgressTimeline(dailyProgress, null, pondData);

        // Harvest -> Water Filled (31 days)
        assert.equal(timeline.steps[0].segmentDays, 31);
        assert.equal(timeline.steps[0].segmentLabel, '31 days');
        assert.equal(timeline.steps[0].segmentDone, true);

        // Skipped steps
        assert.equal(timeline.steps[1].status, 'skipped');
        assert.equal(timeline.steps[2].status, 'skipped');
        assert.equal(timeline.steps[3].status, 'skipped');
        assert.equal(timeline.steps[1].segmentDone, true);
        assert.equal(timeline.steps[2].segmentDone, true);
        assert.equal(timeline.steps[3].segmentDone, true);

        // Water Filled
        assert.equal(timeline.steps[4].key, 'water_filled');
        assert.equal(timeline.steps[4].date, '2026-10-21');
        assert.equal(timeline.steps[4].status, 'current');
    });

    await t.test('handles null/empty records gracefully without errors', () => {
        const timeline = buildPondProgressTimeline(null);
        assert.equal(timeline.hasAnyDate, false);
        assert.equal(timeline.totalTurnaroundDays, null);
        assert.equal(timeline.steps.length, 8);
        assert.equal(timeline.steps[0].status, 'pending');
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

    await t.test('getDrawerHtml renders Preparation Milestone Timeline matching sketch layout', () => {
        const dailyProgress = {
            last_harvest_date: '2026-07-30',
            clean_progress_date: '2026-08-10',
            cleaning_done_date: '2026-08-12',
            repair_done_date: '2026-08-15',
            filled_water_date: null,
            water_treat_date: null,
            pass_bioassay: false,
            bioassay_date: null,
            excel_as_of_date: '2026-10-26'
        };
        const pondData = {
            progressState: 'REPAIRED',
            progressLabel: 'Repaired',
            progressDays: 3,
            syncState: 'SYNCED'
        };

        const drawerHtml = getDrawerHtml({
            pondCode: '07.13.05',
            cycle: null,
            dailyProgress,
            pondData
        });

        // Title and Section
        assert.ok(drawerHtml.includes('Preparation &amp; Progress Timeline'));
        assert.ok(drawerHtml.includes('As of 2026-10-26'));

        // Compact Vertical Timeline 3-column elements
        assert.ok(drawerHtml.includes('compact-v-timeline'));
        assert.ok(drawerHtml.includes('v-tl-item'));
        assert.ok(drawerHtml.includes('v-tl-left'));
        assert.ok(drawerHtml.includes('v-tl-title'));
        assert.ok(drawerHtml.includes('v-tl-date'));
        assert.ok(drawerHtml.includes('v-tl-center'));
        assert.ok(drawerHtml.includes('v-tl-dot'));
        assert.ok(drawerHtml.includes('v-tl-line'));
        assert.ok(drawerHtml.includes('v-tl-right'));
        assert.ok(drawerHtml.includes('v-tl-segment-days'));

        // Values from sketch
        assert.ok(drawerHtml.includes('Last Harvest'));
        assert.ok(drawerHtml.includes('2026-07-30'));
        assert.ok(drawerHtml.includes('11 days'));
        assert.ok(drawerHtml.includes('2 days'));
        assert.ok(drawerHtml.includes('3 days'));
        assert.ok(drawerHtml.includes('W. Culture Start'));

        // Summary banner
        assert.ok(drawerHtml.includes('v-tl-summary-banner'));
        assert.ok(drawerHtml.includes('Elapsed Since Harvest:'));
        assert.ok(drawerHtml.includes('16 days'));
    });

    await t.test('getDrawerHtml renders elapsed days across unrecorded milestone dates (Option B)', () => {
        const dailyProgress = {
            last_harvest_date: '2026-07-28',
            clean_progress_date: '2026-08-20',
            cleaning_done_date: '2026-08-21',
            repair_done_date: '2026-08-22',
            filled_water_date: '2026-08-22',
            water_treat_date: '2026-08-24',
            pass_bioassay: false,
            bioassay_date: null,
            stocking_date: '2026-09-09',
            excel_as_of_date: '2026-10-26'
        };
        const pondData = {
            isActive: true,
            progressState: 'CULTURE',
            docDisplay: '48',
            syncState: 'SYNCED'
        };

        const drawerHtml = getDrawerHtml({
            pondCode: '01.01.11',
            cycle: { pond: '01.01.11', pond_status: 'PRODUCTION', stck_date: '2026-09-09' },
            dailyProgress,
            pondData
        });

        assert.ok(drawerHtml.includes('W. Culture Start'));
        assert.ok(drawerHtml.includes('16 days')); // 2026-08-24 to 2026-09-09
        assert.ok(drawerHtml.includes('Stocked'));
        assert.ok(drawerHtml.includes('Current • 48 DOC'));
        assert.ok(drawerHtml.includes('Turnaround (Harvest → Stocking):'));
        assert.ok(drawerHtml.includes('43 days'));
    });
});
