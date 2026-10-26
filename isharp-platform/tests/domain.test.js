import { test } from 'node:test';
import assert from 'node:assert/strict';

import { 
    calculateDOC, 
    calculateBiomass, 
    calculateADG,
    getStandardABW,
    getEffectiveBiomassGain,
    getLatestSurvivalRate,
    getOperationalPondState
} from '../src/domain/biometrics.js';
import { 
    calculateTotalActiveHP, 
    calculateAerationDensity 
} from '../src/domain/aeration.js';
import { 
    calculateFCR 
} from '../src/domain/feeding.js';
import { 
    formatPondLabel, 
    isCycleClosed, 
    parsePondIndex,
    formatFinalStatus,
    evaluateBiosecurityStatus,
    sanitizeIdlePrepDate
} from '../src/domain/rollover.js';

test('Domain: calculateDOC', async (t) => {
    await t.test('returns 0 for empty or invalid date', () => {
        assert.equal(calculateDOC(null), 0);
        assert.equal(calculateDOC(''), 0);
        assert.equal(calculateDOC('invalid-date'), 0);
    });

    await t.test('calculates correct days of culture between two dates', () => {
        const start = '2026-01-01';
        const ref = '2026-01-11';
        assert.equal(calculateDOC(start, ref), 10);
    });

    await t.test('handles same day stocking as DOC 0', () => {
        assert.equal(calculateDOC('2026-05-10', '2026-05-10'), 0);
    });
});

test('Domain: calculateBiomass', async (t) => {
    await t.test('calculates biomass accurately in kg', () => {
        // 100,000 pcs stocked, 80% survival = 80,000 shrimp
        // 80,000 shrimp * 15g ABW = 1,200,000g = 1,200kg
        const biomass = calculateBiomass(100000, 80, 15);
        assert.equal(biomass, 1200);
    });

    await t.test('returns 0 for non-positive or missing inputs', () => {
        assert.equal(calculateBiomass(0, 80, 15), 0);
        assert.equal(calculateBiomass(100000, 0, 15), 0);
        assert.equal(calculateBiomass(100000, 80, 0), 0);
    });
});

test('Domain: calculateADG', async (t) => {
    await t.test('calculates average daily gain', () => {
        // Gained 5 grams over 10 days = 0.50 g/day
        const adg = calculateADG(10, 15, 10);
        assert.equal(adg, 0.5);
    });

    await t.test('returns 0 if doc interval is zero', () => {
        assert.equal(calculateADG(10, 15, 0), 0);
    });
});

test('Domain: calculateAeration', async (t) => {
    await t.test('calculates total active horsepower', () => {
        // 2 units of 1HP, 4 units of 2HP = 2 + 8 = 10 HP
        const total = calculateTotalActiveHP(2, 4);
        assert.equal(total, 10);
    });

    await t.test('calculates aeration density (HP/Ha)', () => {
        // 10 HP in 0.5 Ha = 20 HP/Ha
        const density = calculateAerationDensity(10, 0.5);
        assert.equal(density, 20);
    });
});

test('Domain: calculateFCR', async (t) => {
    await t.test('calculates feed conversion ratio', () => {
        // 1500 kg feed for 1000 kg shrimp produced = 1.50 FCR
        const fcr = calculateFCR(1500, 1000);
        assert.equal(fcr, 1.5);
    });

    await t.test('returns 0 for zero biomass gain', () => {
        assert.equal(calculateFCR(1500, 0), 0);
    });
});

test('Domain: rollover & pond formatting', async (t) => {
    await t.test('formatPondLabel cleans up raw pond string', () => {
        assert.equal(formatPondLabel('01.01.01'), '01.01.01');
    });

    await t.test('isCycleClosed identifies closed and inactive states', () => {
        assert.equal(isCycleClosed({ pond_status: 'CLOSE' }), true);
        assert.equal(isCycleClosed({ active: 'iN ACTiVE' }), true);
        assert.equal(isCycleClosed({ pond_status: 'PRODUCTION', active: 'ACTiVE' }), false);
    });

    await t.test('parsePondIndex extracts pond and cycle components', () => {
        const parsed = parsePondIndex('2010101.40');
        assert.equal(parsed.cycle, 40);
    });
});

test('Domain: getStandardABW species differentiation', async (t) => {
    await t.test('calculates standard Vannamei growth curve', () => {
        assert.equal(getStandardABW(30, 'VAN'), 3.6);
        assert.equal(getStandardABW(60, 'VAN'), 10.2);
        assert.equal(getStandardABW(90, 'VAN'), 18.6);
        assert.equal(getStandardABW(110, 'VAN'), 25.0);
    });

    await t.test('calculates standard Monodon growth curve', () => {
        // Monodon starts slower in nursery, but accelerates to >35g in later DOC
        assert.equal(getStandardABW(35, 'MON'), 2.8);
        assert.equal(getStandardABW(70, 'MON'), 11.2);
        assert.equal(getStandardABW(105, 'MON'), 24.5);
        assert.equal(getStandardABW(130, 'MON'), 35.0);
    });

    await t.test('defaults to Vannamei when species is omitted', () => {
        assert.equal(getStandardABW(60), 10.2);
    });
});

test('Domain: getEffectiveBiomassGain & True FCR with partial harvest', async (t) => {
    await t.test('active pond with partial harvest adds current biomass + partial harvest amount', () => {
        const pond = { pond_status: 'PRODUCTION', active: 'ACTIVE' };
        const latestSampling = { smpl_bms: 3913.1, smpl_tfed: 7809 };
        const harvestSummary = {
            hasHarvest: true,
            hasPartialHarvest: true,
            hasFinalHarvest: false,
            partialWeightKg: 1372.12,
            totalWeightKg: 1372.12
        };

        const result = getEffectiveBiomassGain(pond, latestSampling, harvestSummary);
        assert.equal(result.isFinal, false);
        assert.equal(result.hasPartial, true);
        assert.equal(result.currentBiomassKg, 3913.1);
        assert.equal(result.partialWeightKg, 1372.12);
        // Effective Gain = 3913.1 + 1372.12 = 5285.2 kg
        assert.equal(result.effectiveGainKg, 5285.2);

        // True FCR = 7809 / 5285.2 = 1.48 (NOT 7809 / 1372.12 = 5.69!)
        const fcr = calculateFCR(latestSampling.smpl_tfed, result.effectiveGainKg);
        assert.equal(fcr, 1.48);
    });

    await t.test('active pond without harvest uses current biomass only', () => {
        const pond = { pond_status: 'PRODUCTION', active: 'ACTIVE' };
        const latestSampling = { smpl_bms: 2500, smpl_tfed: 3500 };
        const harvestSummary = {
            hasHarvest: false,
            hasPartialHarvest: false,
            hasFinalHarvest: false,
            partialWeightKg: 0,
            totalWeightKg: 0
        };

        const result = getEffectiveBiomassGain(pond, latestSampling, harvestSummary);
        assert.equal(result.isFinal, false);
        assert.equal(result.hasPartial, false);
        assert.equal(result.effectiveGainKg, 2500);

        const fcr = calculateFCR(latestSampling.smpl_tfed, result.effectiveGainKg);
        assert.equal(fcr, 1.4);
    });

    await t.test('closed pond with both partial and termination harvest uses total harvested weight', () => {
        const pond = { pond_status: 'CLOSE', active: 'INACTIVE' };
        const latestSampling = { smpl_bms: 4251.36, smpl_tfed: 8913 };
        const harvestSummary = {
            hasHarvest: true,
            hasPartialHarvest: true,
            hasFinalHarvest: true,
            partialWeightKg: 1502.05,
            finalWeightKg: 3072.65,
            totalWeightKg: 4574.7
        };

        const result = getEffectiveBiomassGain(pond, latestSampling, harvestSummary);
        assert.equal(result.isFinal, true);
        assert.equal(result.effectiveGainKg, 4574.7);

        // FCR = 8913 / 4574.7 = 1.95
        const fcr = calculateFCR(latestSampling.smpl_tfed, result.effectiveGainKg);
        assert.equal(fcr, 1.95);
    });
});

test('Domain: getLatestSurvivalRate SSOT', async (t) => {
    await t.test('extracts smpl_surv correctly as float', () => {
        assert.equal(getLatestSurvivalRate({ smpl_surv: 82.5 }), 82.5);
        assert.equal(getLatestSurvivalRate({ smpl_surv: '78.4' }), 78.4);
    });

    await t.test('extracts smpl_srv fallback correctly', () => {
        assert.equal(getLatestSurvivalRate({ smpl_srv: 91.2 }), 91.2);
    });

    await t.test('returns null for missing, null, or invalid records', () => {
        assert.equal(getLatestSurvivalRate(null), null);
        assert.equal(getLatestSurvivalRate({}), null);
        assert.equal(getLatestSurvivalRate({ smpl_surv: null }), null);
        assert.equal(getLatestSurvivalRate({ smpl_surv: 'invalid' }), null);
    });
});

test('Domain: formatFinalStatus', async (t) => {
    await t.test('formats NORMAL HARVEST with success badge', () => {
        const res = formatFinalStatus('NORMAL HARVEST');
        assert.equal(res.label, 'Normal Harvest');
        assert.equal(res.className, 'status-pill status-production');
    });

    await t.test('formats default empty or null as Normal Harvest', () => {
        const res = formatFinalStatus(null);
        assert.equal(res.label, 'Normal Harvest');
        assert.equal(res.className, 'status-pill status-production');
    });

    await t.test('formats CULLED POND / action with danger badge', () => {
        const res = formatFinalStatus('CULLED POND');
        assert.equal(res.label, 'Culled Pond');
        assert.equal(res.className, 'status-pill status-danger');
    });

    await t.test('formats FORCED HARVEST with warning badge', () => {
        const res = formatFinalStatus('FORCED HARVEST');
        assert.equal(res.label, 'Forced Harvest');
        assert.equal(res.className, 'status-pill status-warning');
    });

    await t.test('formats NO PRODUCTION with close neutral badge', () => {
        const res = formatFinalStatus('NO PRODUCTION');
        assert.equal(res.label, 'No Production');
        assert.equal(res.className, 'status-pill status-close');
    });
});

test('Domain: evaluateBiosecurityStatus', async (t) => {
    await t.test('evaluates clean pond without issues as Pathogen Negative', () => {
        const pond = { disease_status: 'NO ISSUES' };
        const res = evaluateBiosecurityStatus(pond, []);
        assert.equal(res.label, 'Pathogen Negative');
        assert.equal(res.className, 'disease-pill disease-ok');
    });

    await t.test('prioritizes critical laboratory alert over master clean record', () => {
        const pond = { disease_status: 'NO ISSUES' };
        const issues = [
            { issue_flag: 'RED', issue_test: 'PCR', issue_status: 'WSSV', issue_grade: 'G3', issue_date: '2026-09-10' }
        ];
        const res = evaluateBiosecurityStatus(pond, issues);
        assert.match(res.label, /WSSV Alert/);
        assert.equal(res.className, 'disease-pill disease-danger');
        assert.equal(res.isAlert, true);
    });

    await t.test('reflects master register disease_status when laboratory has no records', () => {
        const pond = { disease_status: 'EHP', date_disease: '2026-09-08' };
        const res = evaluateBiosecurityStatus(pond, []);
        assert.equal(res.label, '⚠️ EHP Alert');
        assert.equal(res.className, 'disease-pill disease-danger');
        assert.match(res.footText, /2026-09-08/);
        assert.equal(res.isAlert, true);
    });

    await t.test('reflects master register mortality or non-critical issue properly', () => {
        const pond = { disease_status: 'SLOW GROWTH', date_disease: '2026-08-20' };
        const res = evaluateBiosecurityStatus(pond, []);
        assert.equal(res.label, '🟡 SLOW GROWTH');
        assert.equal(res.className, 'disease-pill disease-warning');
        assert.equal(res.isAlert, false);
    });
});

test('Domain: sanitizeIdlePrepDate (Idle Pond Preparation Dates Rule)', async (t) => {
    await t.test('returns null for empty or null event date', () => {
        assert.equal(sanitizeIdlePrepDate(null, '2026-10-05', true), null);
        assert.equal(sanitizeIdlePrepDate('', '2026-10-05', true), null);
        assert.equal(sanitizeIdlePrepDate('   ', '2026-10-05', true), null);
    });

    await t.test('returns null if idle pond date is from previous cycle (prior to date_cycle)', () => {
        // e.g. Pond 2010107.43: Cycle started 2026-10-05, cleaning date was 2026-06-26 (from cycle 42)
        const ghostCleaningDate = '2026-06-26';
        const cycleStartDate = '2026-10-05';
        assert.equal(sanitizeIdlePrepDate(ghostCleaningDate, cycleStartDate, true), null);

        const ghostRepairDate = '2026-06-29';
        assert.equal(sanitizeIdlePrepDate(ghostRepairDate, cycleStartDate, true), null);

        const ghostStockPlanDate = '2026-07-19';
        assert.equal(sanitizeIdlePrepDate(ghostStockPlanDate, cycleStartDate, true), null);
    });

    await t.test('preserves genuine preparation date occurring on or after date_cycle for idle pond', () => {
        // e.g. Pond 2010108.43: Cycle started 2026-09-30, cleaning completed 2026-10-07
        const genuineCleaningDate = '2026-10-07';
        const cycleStartDate = '2026-09-30';
        assert.equal(sanitizeIdlePrepDate(genuineCleaningDate, cycleStartDate, true), '2026-10-07');
    });

    await t.test('returns null for idle pond with preparation date if date_cycle is missing', () => {
        assert.equal(sanitizeIdlePrepDate('2026-06-26', null, true), null);
        assert.equal(sanitizeIdlePrepDate('2026-06-26', '', true), null);
    });

    await t.test('does not filter dates when pond is not idle (e.g. PRODUCTION)', () => {
        assert.equal(sanitizeIdlePrepDate('2026-06-26', '2026-06-15', false), '2026-06-26');
    });
});

test('Domain: getOperationalPondState (Operational Status SSOT)', async (t) => {
    await t.test('null cycle returns default IDLE state', () => {
        const res = getOperationalPondState(null);
        assert.equal(res.isStocked, false);
        assert.equal(res.isProduction, false);
        assert.equal(res.isIdle, true);
        assert.equal(res.docDisplay, '—');
        assert.equal(res.speciesLabel, 'IDLE');
    });

    await t.test('cycle with pond_status PRODUCTION but no stck_date is treated as PREPARATION and NEVER 0 VAN', () => {
        const cycle = {
            pond: '01.01.03',
            pond_index: '2010103.43',
            pond_status: 'PRODUCTION',
            stck_date: null,
            species: 'P. VANNAMEi',
            date_cycle: '2026-09-24'
        };
        const res = getOperationalPondState(cycle);
        assert.equal(res.isStocked, false);
        assert.equal(res.isProduction, false);
        assert.equal(res.isPrep, true);
        assert.equal(res.docDisplay, 'PREP');
        assert.equal(res.speciesLabel, 'PREP');
        assert.equal(res.speciesCode, 'PREP');
        assert.equal(res.statusLabel, 'PREPARATION');
    });

    await t.test('cycle with pond_status IDLE displays idle days and IDLE species', () => {
        const cycle = {
            pond: '01.01.07',
            pond_index: '2010107.43',
            pond_status: 'IDLE',
            stck_date: null,
            idle_days: 7
        };
        const res = getOperationalPondState(cycle);
        assert.equal(res.isStocked, false);
        assert.equal(res.isProduction, false);
        assert.equal(res.isIdle, true);
        assert.equal(res.docDisplay, '7d');
        assert.equal(res.speciesLabel, 'IDLE');
        assert.equal(res.speciesCode, 'IDLE');
    });

    await t.test('stocked production cycle displays numeric DOC and correct species', () => {
        // Stocked 40 days ago (timezone-safe local date)
        const today = new Date();
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 40);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const stckDate = [y, m, day].join('-');
        const cycle = {
            pond: '01.01.01',
            pond_index: '2010101.40',
            pond_status: 'PRODUCTION',
            stck_date: stckDate,
            species: 'P. VANNAMEi'
        };
        const res = getOperationalPondState(cycle);
        assert.equal(res.isStocked, true);
        assert.equal(res.isProduction, true);
        assert.equal(res.isIdle, false);
        assert.equal(res.doc, 40);
        assert.equal(res.docDisplay, '40');
        assert.equal(res.speciesLabel, 'VAN');
    });

    await t.test('closed cycle displays CLOSE status', () => {
        const cycle = {
            pond: '01.01.01',
            pond_index: '2010101.39',
            pond_status: 'CLOSE',
            pond_active: 'INACTIVE',
            stck_date: '2026-03-01',
            date_close: '2026-05-15',
            species: 'P. VANNAMEi'
        };
        const res = getOperationalPondState(cycle);
        assert.equal(res.isClosed, true);
        assert.equal(res.isProduction, false);
        assert.equal(res.statusLabel, 'CLOSE');
    });
});



