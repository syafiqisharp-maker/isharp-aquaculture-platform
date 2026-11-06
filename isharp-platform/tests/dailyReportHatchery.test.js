import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutiveMetricsPresenter } from '../src/modules/executive/ExecutiveMetricsPresenter.js';
import { buildDailyReportEmailHtml } from '../src/modules/dbms/utils/dailyReportHtmlBuilder.js';

test('SSOT: aggregateOperationalHatcheriesByType', async (t) => {
    await t.test('aggregates operational culturing ponds by stck_type and hatchery source', () => {
        const culturingPonds = [
            { pond: '01.01.01', progress_state: 'CULTURE' },
            { pond: '01.01.02', progress_state: 'CULTURE' },
            { pond: '01.01.03', progress_state: 'CULTURE' },
            { pond: '02.03.01', progress_state: 'CULTURE' },
            { pond: '05.10.01', progress_state: 'CULTURE' },
            { pond: '09.17.03', progress_state: 'CULTURE' }
        ];

        const activeCycles = [
            { pond: '01.01.01', pond_index: '2010101.40', pond_status: 'PRODUCTION', stck_species: 'P. VANNAMEi' },
            { pond: '01.01.02', pond_index: '2010102.40', pond_status: 'PRODUCTION', stck_species: 'P. VANNAMEi' },
            { pond: '01.01.03', pond_index: '2010103.40', pond_status: 'PRODUCTION', stck_species: 'P. VANNAMEi' },
            { pond: '02.03.01', pond_index: '2020301.42', pond_status: 'PRODUCTION', stck_species: 'P. VANNAMEi' },
            { pond: '05.10.01', pond_index: '2051001.35', pond_status: 'PRODUCTION', stck_species: 'P. MONODON' },
            { pond: '09.17.03', pond_index: '2091703.40', pond_status: 'PRODUCTION', stck_species: 'P. VANNAMEi' }
        ];

        const stockingBatches = [
            { pond_index: '2010101.40', stck_type: 'SPT', stck_source: 'SHT', stck_species: 'P. VANNAMEi', stck_pcs: 400000 },
            { pond_index: '2010102.40', stck_type: 'SPT', stck_source: 'SHT', stck_species: 'P. VANNAMEi', stck_pcs: 400000 },
            { pond_index: '2010103.40', stck_type: 'SPT', stck_source: 'GS', stck_species: 'P. VANNAMEi', stck_pcs: 450000 },
            { pond_index: '2020301.42', stck_type: 'SPF', stck_source: 'BZYR', stck_species: 'P. VANNAMEi', stck_pcs: 450000 },
            { pond_index: '2051001.35', stck_type: 'P.M', stck_source: 'KSK', stck_species: 'P. MONODON', stck_pcs: 200000 },
            { pond_index: '2091703.40', stck_type: 'SPR', stck_source: 'SPR', stck_species: 'P. VANNAMEi', stck_pcs: 420000 }
        ];

        const result = ExecutiveMetricsPresenter.aggregateOperationalHatcheriesByType({
            culturingPonds,
            activeCycles,
            stockingBatches
        });

        assert.equal(result.totalOperation, 6);
        assert.equal(result.summary.spr, 1);
        assert.equal(result.summary.spt, 3);
        assert.equal(result.summary.spf, 1);
        assert.equal(result.summary.monodon, 1);

        const sprGroup = result.groups.find(g => g.type === 'SPR');
        assert.ok(sprGroup);
        assert.equal(sprGroup.label, 'SPR');
        assert.equal(sprGroup.totalPonds, 1);
        assert.deepEqual(sprGroup.hatcheries, [{ source: 'SPR', ponds: 1 }]);

        const sptGroup = result.groups.find(g => g.type === 'SPT');
        assert.ok(sptGroup);
        assert.equal(sptGroup.label, 'SPT');
        assert.equal(sptGroup.totalPonds, 3);
        assert.equal(sptGroup.hatcheries.find(h => h.source === 'SHT')?.ponds, 2);
        assert.equal(sptGroup.hatcheries.find(h => h.source === 'GS')?.ponds, 1);

        const spfGroup = result.groups.find(g => g.type === 'SPF');
        assert.ok(spfGroup);
        assert.equal(spfGroup.label, 'SPF');
        assert.equal(spfGroup.totalPonds, 1);
        assert.deepEqual(spfGroup.hatcheries, [{ source: 'BZYR', ponds: 1 }]);

        const monGroup = result.groups.find(g => g.type === 'MONODON');
        assert.ok(monGroup);
        assert.equal(monGroup.label, 'Monodon');
        assert.equal(monGroup.totalPonds, 1);
        assert.deepEqual(monGroup.hatcheries, [{ source: 'KSK', ponds: 1 }]);
    });

    await t.test('handles fallback to cycle metadata when stocking batch record is missing', () => {
        const culturingPonds = [
            { pond: '03.05.01', progress_state: 'CULTURE' }
        ];

        const activeCycles = [
            { pond: '03.05.01', pond_index: '2030501.40', pond_status: 'PRODUCTION', stck_species: 'P. VANNAMEi', stck_source: 'SHT,KS', bs_line: 'SYAQUA' }
        ];

        const result = ExecutiveMetricsPresenter.aggregateOperationalHatcheriesByType({
            culturingPonds,
            activeCycles,
            stockingBatches: []
        });

        assert.equal(result.totalOperation, 1);
        assert.equal(result.summary.spt, 1);
        const sptGroup = result.groups.find(g => g.type === 'SPT');
        assert.ok(sptGroup);
        assert.equal(sptGroup.hatcheries[0].source, 'SHT,KS');
        assert.equal(sptGroup.hatcheries[0].ponds, 1);
    });

    await t.test('handles fallback to activeCycles in PRODUCTION when culturingPonds is empty', () => {
        const activeCycles = [
            { pond: '04.07.07', pond_index: '2040707.39', pond_status: 'PRODUCTION', stck_species: 'P. MONODON' }
        ];

        const stockingBatches = [
            { pond_index: '2040707.39', stck_type: 'P.M', stck_source: 'CPS', stck_species: 'P. MONODON', stck_pcs: 200000 }
        ];

        const result = ExecutiveMetricsPresenter.aggregateOperationalHatcheriesByType({
            culturingPonds: [],
            activeCycles,
            stockingBatches
        });

        assert.equal(result.totalOperation, 1);
        assert.equal(result.summary.monodon, 1);
        const monGroup = result.groups.find(g => g.type === 'MONODON');
        assert.ok(monGroup);
        assert.equal(monGroup.hatcheries[0].source, 'CPS');
        assert.equal(monGroup.hatcheries[0].ponds, 1);
    });
});

test('HTML Email Builder: Section 8 Dynamic Operational Hatchery Table', async (t) => {
    await t.test('renders Option A category headers and dynamic hatchery columns', () => {
        const operationalHatcheries = {
            totalOperation: 119,
            groups: [
                { type: "SPR", label: "SPR", totalPonds: 1, hatcheries: [{ source: "SPR", ponds: 1 }] },
                { type: "SPT", label: "SPT", totalPonds: 82, hatcheries: [{ source: "SHT", ponds: 75 }, { source: "SHT,KS", ponds: 4 }, { source: "GS", ponds: 3 }] },
                { type: "SPF", label: "SPF", totalPonds: 4, hatcheries: [{ source: "BZYR", ponds: 4 }] },
                { type: "MONODON", label: "Monodon", totalPonds: 32, hatcheries: [{ source: "KSK", ponds: 18 }, { source: "UBN", ponds: 9 }, { source: "GSR", ponds: 3 }, { source: "CPS", ponds: 2 }] }
            ],
            summary: { spr: 1, spt: 82, spf: 4, monodon: 32 }
        };

        const html = buildDailyReportEmailHtml({
            activePonds: 119,
            operationalHatcheries
        }, false);

        // Section 8 table check
        assert.ok(html.includes('TOTAL OPERATION & HATCHERY COMPOSITION TABLE'));
        assert.ok(html.includes('>Total operation</td>'));

        // Option A category headers (without subtotals in headers)
        assert.ok(html.includes('colspan="1" bgcolor="#d9e1f2" style="background-color: #d9e1f2; border: 1px solid #b4c6e7; font-weight: bold; color: #002060; padding: 6px 4px;">\n                SPR\n            </td>'));
        assert.ok(html.includes('colspan="3" bgcolor="#d9e1f2" style="background-color: #d9e1f2; border: 1px solid #b4c6e7; font-weight: bold; color: #002060; padding: 6px 4px;">\n                SPT\n            </td>'));
        assert.ok(html.includes('colspan="1" bgcolor="#d9e1f2" style="background-color: #d9e1f2; border: 1px solid #b4c6e7; font-weight: bold; color: #002060; padding: 6px 4px;">\n                SPF\n            </td>'));
        assert.ok(html.includes('colspan="4" bgcolor="#d9e1f2" style="background-color: #d9e1f2; border: 1px solid #b4c6e7; font-weight: bold; color: #002060; padding: 6px 4px;">\n                Monodon\n            </td>'));

        // Hatchery sources in header row 2
        assert.ok(html.includes('>BZYR</td>'));
        assert.ok(html.includes('>SHT,KS</td>'));
        assert.ok(html.includes('>GS</td>'));
        assert.ok(html.includes('>KSK</td>'));
        assert.ok(html.includes('>CPS</td>'));

        // Pond counts in data row
        assert.ok(html.includes('>119</td>'));
        assert.ok(html.includes('>75</td>'));
        assert.ok(html.includes('>18</td>'));
        assert.ok(html.includes('>9</td>'));

        // Highlight Today summary line check
        assert.ok(html.includes('Operational pond: 119</strong> consist of 1 SPR, 4 SPF, 82 SPT, and 32 MON.'));
    });
});
