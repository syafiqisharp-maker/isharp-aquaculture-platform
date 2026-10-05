import { test } from 'node:test';
import assert from 'node:assert/strict';

import { 
    calculateDOC, 
    calculateBiomass, 
    calculateADG,
    getStandardABW 
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
    parsePondIndex 
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
