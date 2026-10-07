import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getLocalDateStr,
    parseLocalDate,
    formatLocalDateDisplay,
    formatDateFull,
    formatNumber,
    formatKg,
    formatTons,
    formatPieces,
    formatCurrency,
    formatPercent
} from '../src/utils/formatters.js';

test('Formatters: getLocalDateStr & parseLocalDate', async (t) => {
    await t.test('formats Date object to YYYY-MM-DD local string', () => {
        const d = new Date(2026, 9, 6); // Note: month 9 is October (0-indexed)
        assert.equal(getLocalDateStr(d), '2026-10-06');
    });

    await t.test('handles invalid date input gracefully', () => {
        assert.equal(getLocalDateStr('invalid-date'), '');
    });

    await t.test('parseLocalDate parses YYYY-MM-DD safely without timezone skew', () => {
        const parsed = parseLocalDate('2026-10-06');
        assert.equal(parsed.getFullYear(), 2026);
        assert.equal(parsed.getMonth(), 9); // October
        assert.equal(parsed.getDate(), 6);
    });

    await t.test('parseLocalDate handles ISO date string with timestamp', () => {
        const parsed = parseLocalDate('2026-10-06T14:30:00Z');
        assert.equal(parsed.getFullYear(), 2026);
        assert.equal(parsed.getMonth(), 9);
        assert.equal(parsed.getDate(), 6);
    });
});

test('Formatters: display date formatting', async (t) => {
    await t.test('formatLocalDateDisplay returns "DD Mon" safely', () => {
        assert.equal(formatLocalDateDisplay('2026-10-06'), '06 Oct');
        assert.equal(formatLocalDateDisplay(null), '—');
        assert.equal(formatLocalDateDisplay(''), '—');
    });

    await t.test('formatDateFull returns "DD Mon YYYY" safely', () => {
        assert.equal(formatDateFull('2026-10-06'), '06 Oct 2026');
        assert.equal(formatDateFull(null), '—');
    });
});

test('Formatters: numeric & aquaculture metrics', async (t) => {
    await t.test('formatNumber formats commas and fixed decimals', () => {
        assert.equal(formatNumber(1234.56, 1), '1,234.6');
        assert.equal(formatNumber(1234567, 0), '1,234,567');
        assert.equal(formatNumber(null, 0, '—'), '—');
    });

    await t.test('formatKg formats weights with kg suffix', () => {
        assert.equal(formatKg(1450), '1,450 kg');
        assert.equal(formatKg(0), '0 kg');
        assert.equal(formatKg(null), '0 kg');
    });

    await t.test('formatTons converts kg to metric tons with 1 decimal place', () => {
        assert.equal(formatTons(14500), '14.5 Tons');
        assert.equal(formatTons(1200), '1.2 Tons');
        assert.equal(formatTons(0), '0.0 Tons');
        assert.equal(formatTons(null), '0.0 Tons');
    });

    await t.test('formatPieces formats shrimp count with pcs suffix', () => {
        assert.equal(formatPieces(120000), '120,000 pcs');
        assert.equal(formatPieces(0), '—');
        assert.equal(formatPieces(null), '—');
    });

    await t.test('formatCurrency formats MYR ringgit values', () => {
        assert.equal(formatCurrency(14250), 'RM 14,250.00');
        assert.equal(formatCurrency(0), 'RM 0.00');
        assert.equal(formatCurrency('invalid'), 'RM 0.00');
    });

    await t.test('formatPercent formats percentage values', () => {
        assert.equal(formatPercent(85.24, 1), '85.2%');
        assert.equal(formatPercent(100, 0), '100%');
        assert.equal(formatPercent(null), '0%');
    });
});
