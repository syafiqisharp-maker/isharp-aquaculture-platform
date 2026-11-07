/**
 * iSHARP DBMS 2.0 — Executive 12-Month Performance Ledger BI Test Suite
 * Validates domain analytics enrichment, presentation formatting,
 * interactive sorting, time-horizon filtering, and audited summary totals.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { aggregate12MonthMovingHarvest } from "../src/domain/biometrics/harvestForecast.js";
import { renderPerformanceLedgerSectionHtml, getExecutiveBiomassHtml } from "../src/modules/executive/templates/executiveBiomassTemplate.js";

describe("Executive 12-Month Performance Ledger BI Redesign", () => {
    // Mock harvest and sales datasets across 3 months
    const mockDailyHarvests = [
        // 2026-08: 2 runs Vannamei termination (10,000 kg, ABW 20g, Rev RM 200,000)
        { pond_index: "P01_C1", harv_date: "2026-08-10", harv_status: "TERMINATION", harv_weight: 5000, harv_abw: 20, harv_revenue: 100000, species: "VAN" },
        { pond_index: "P02_C1", harv_date: "2026-08-20", harv_status: "TERMINATION", harv_weight: 5000, harv_abw: 20, harv_revenue: 100000, species: "VAN" },
        // 2026-09: 1 run Monodon termination (8,000 kg, ABW 30g, Rev RM 240,000) + 1 run VAN partial (2,000 kg, ABW 18g, Rev RM 40,000)
        { pond_index: "P03_C1", harv_date: "2026-09-05", harv_status: "TERMINATION", harv_weight: 8000, harv_abw: 30, harv_revenue: 240000, species: "MON" },
        { pond_index: "P04_C1", harv_date: "2026-09-15", harv_status: "PARTIAL", harv_weight: 2000, harv_abw: 18, harv_revenue: 40000, species: "VAN" },
        // 2026-10: 1 run Monodon termination (12,000 kg, ABW 32g, Rev RM 360,000)
        { pond_index: "P05_C1", harv_date: "2026-10-12", harv_status: "TERMINATION", harv_weight: 12000, harv_abw: 32, harv_revenue: 360000, species: "MON" }
    ];

    const mockSalesRecords = [
        { pond_index: "P01_C1", hvt_date: "2026-08-10", hvt_buyer: "SBH Marine", good_wgt: 5000, good_prc: 20, raw_wgt: 5000, net_sales: 100000, species: "VAN" },
        { pond_index: "P02_C1", hvt_date: "2026-08-20", hvt_buyer: "SBH Marine", good_wgt: 5000, good_prc: 20, raw_wgt: 5000, net_sales: 100000, species: "VAN" },
        { pond_index: "P03_C1", hvt_date: "2026-09-05", hvt_buyer: "BAB Plant", good_wgt: 8000, good_prc: 30, raw_wgt: 8000, net_sales: 240000, species: "MON" },
        { pond_index: "P04_C1", hvt_date: "2026-09-15", hvt_buyer: "Navar", good_wgt: 2000, good_prc: 20, raw_wgt: 2000, net_sales: 40000, species: "VAN" },
        { pond_index: "P05_C1", hvt_date: "2026-10-12", hvt_buyer: "BAB Plant", good_wgt: 12000, good_prc: 30, raw_wgt: 12000, net_sales: 360000, species: "MON" }
    ];

    test("aggregate12MonthMovingHarvest enriches monthlyBuckets with BI metrics", () => {
        const agg = aggregate12MonthMovingHarvest(mockDailyHarvests, mockSalesRecords, "ALL");
        assert.ok(agg.monthlyBuckets, "Must return monthlyBuckets");
        assert.equal(agg.monthlyBuckets.length, 12, "Must return 12 monthly buckets");

        const bAug = agg.monthlyBuckets.find(b => b.month === "2026-08");
        const bSep = agg.monthlyBuckets.find(b => b.month === "2026-09");
        const bOct = agg.monthlyBuckets.find(b => b.month === "2026-10");

        assert.ok(bAug, "August bucket must exist");
        assert.ok(bSep, "September bucket must exist");
        assert.ok(bOct, "October bucket must exist");

        // 2026-08 metrics
        assert.equal(bAug.tonnage, 10.0, "August tonnage must be 10.0 MT");
        assert.equal(bAug.grossRevenue, 200000, "August gross revenue RM 200,000");
        assert.equal(bAug.blendedPricePerKg, 20.0, "August blended price must be RM 20.0/kg");
        assert.equal(bAug.vanSharePct, 100.0, "August 100% Vannamei");
        assert.equal(bAug.monSharePct, 0.0, "August 0% Monodon");
        assert.equal(bAug.runs, 2, "August 2 harvest runs");

        // 2026-09 metrics
        assert.equal(bSep.tonnage, 10.0, "September tonnage must be 10.0 MT (8T MON + 2T VAN)");
        assert.equal(bSep.vanTons, 2.0, "September VAN 2.0 MT");
        assert.equal(bSep.monTons, 8.0, "September MON 8.0 MT");
        assert.equal(bSep.vanSharePct, 20.0, "September VAN share 20%");
        assert.equal(bSep.monSharePct, 80.0, "September MON share 80%");
        assert.equal(bSep.partialTons, 2.0, "September Partial Thinning 2.0 MT");
        assert.equal(bSep.terminationTons, 8.0, "September Termination 8.0 MT");
        assert.equal(bSep.grossRevenue, 280000, "September gross revenue RM 280,000");
        assert.equal(bSep.blendedPricePerKg, 28.0, "September blended price RM 28.0/kg");

        // 2026-10 metrics & MoM Delta
        assert.equal(bOct.tonnage, 12.0, "October tonnage must be 12.0 MT");
        assert.equal(bOct.momDeltaPct, 20.0, "October MoM delta must be +20.0% vs September (12 MT vs 10 MT)");
        assert.equal(bOct.peakRatio, 100, "October is peak month (12 MT) so peakRatio = 100%");
    });

    test("aggregate12MonthMovingHarvest enriches totals with farm-wide blended metrics and species ABW", () => {
        const agg = aggregate12MonthMovingHarvest(mockDailyHarvests, mockSalesRecords, "ALL");
        const t = agg.totals;

        assert.equal(t.totalTonnage, 32.0, "Total tonnage 32.0 MT");
        assert.equal(t.totalRevenue, 840000, "Total revenue RM 840,000");
        assert.equal(t.blendedPricePerKg, 26.25, "Blended realized price 840,000 / 32,000 = RM 26.25/kg");
        assert.equal(t.vanTons, 12.0, "Total VAN 12.0 MT");
        assert.equal(t.monTons, 20.0, "Total MON 20.0 MT");
        assert.equal(t.vanSharePct, 37.5, "VAN share 37.5%");
        assert.equal(t.monSharePct, 62.5, "MON share 62.5%");
        assert.equal(t.totalRuns, 5, "Total runs = 5");
        assert.equal(t.peakMonthlyTonnage, 12.0, "Peak monthly tonnage 12.0 MT");

        // Species ABW and sizing ranges
        assert.equal(t.vanAbw, 19.67, "Vannamei weighted ABW is 19.67g");
        assert.equal(t.vanMinAbw, 18.0, "Vannamei min ABW is 18.0g");
        assert.equal(t.vanMaxAbw, 20.0, "Vannamei max ABW is 20.0g");
        assert.equal(t.monAbw, 31.2, "Monodon weighted ABW is 31.2g");
        assert.equal(t.monMinAbw, 30.0, "Monodon min ABW is 30.0g");
        assert.equal(t.monMaxAbw, 32.0, "Monodon max ABW is 32.0g");
    });

    test("renderPerformanceLedgerSectionHtml outputs 4-card KPI strip and species-separated table structure", () => {
        const agg = aggregate12MonthMovingHarvest(mockDailyHarvests, mockSalesRecords, "ALL");
        const html = renderPerformanceLedgerSectionHtml({
            buckets: agg.monthlyBuckets,
            totals: agg.totals,
            cohortFilter: "ALL",
            ledgerTimeHorizon: "ALL",
            hideEmptyMonths: false,
            sortKey: "month",
            sortDirection: "desc"
        });

        // 1. Verify Card Header & Finance Badge
        assert.ok(html.includes("Commercial Harvest &amp; Revenue Ledger"), "Must have professional ledger title");
        assert.ok(html.includes("FINANCE"), "Must have FINANCE status badge");

        // 2. Verify 4 KPI Summary Cards
        assert.ok(html.includes("Harvested Biomass"), "KPI Card 1: Volume");
        assert.ok(html.includes("32.0 MT"), "KPI 1 Volume value");
        assert.ok(html.includes("Gross Revenue"), "KPI Card 2: Revenue");
        assert.ok(html.includes("RM 840,000"), "KPI 2 Revenue value");
        assert.ok(html.includes("Realized Species Pricing"), "KPI Card 3: Species Pricing");
        assert.ok(html.includes("VAN: RM 20.00"), "KPI 3 VAN price");
        assert.ok(html.includes("MON: RM 30.00"), "KPI 3 MON price");
        assert.ok(html.includes("Species Portfolio Mix"), "KPI Card 4: Mix");

        // 3. Verify Horizon Switchers & Hide Empty Controls
        assert.ok(html.includes("btn-ledger-horizon"), "Must render horizon buttons");
        assert.ok(html.includes("chk-ledger-hide-empty"), "Must render hide empty checkbox");
        assert.ok(html.includes("btn-export-exec-ledger"), "Must render CSV export button");

        // 4. Verify Column Headers with Data Attributes
        assert.ok(html.includes('data-ledger-sort="month"'), "Sortable Month header");
        assert.ok(html.includes('data-ledger-sort="tonnage"'), "Sortable Tonnage header");
        assert.ok(html.includes('data-ledger-sort="runs"'), "Sortable Harvest Events header");
        assert.ok(html.includes("Events"), "Must label column Events");
        assert.ok(html.includes('data-ledger-sort="grossRevenue"'), "Sortable Gross Revenue header");

        // 5. Verify Species Grouped Headers & Subheaders (No combined Weighted ABW or Farm Avg columns)
        assert.ok(html.includes("L. VANNAMEI (WHITE SHRIMP)"), "Must have Vannamei grouped column header");
        assert.ok(html.includes("P. MONODON (TIGER PRAWN)"), "Must have Monodon grouped column header");
        assert.ok(html.includes('data-ledger-sort="vanTons"'), "Sortable VAN MT header");
        assert.ok(html.includes('data-ledger-sort="vanAbw"'), "Sortable VAN ABW header");
        assert.ok(html.includes('data-ledger-sort="vanPricePerKg"'), "Sortable VAN RM/kg header");
        assert.ok(html.includes('data-ledger-sort="monTons"'), "Sortable MON MT header");
        assert.ok(html.includes('data-ledger-sort="monAbw"'), "Sortable MON ABW header");
        assert.ok(html.includes('data-ledger-sort="monPricePerKg"'), "Sortable MON RM/kg header");

        // Ensure combined columns are not present in table header
        assert.ok(!html.includes("Farm Avg RM/kg"), "Must NOT have Farm Avg RM/kg column in species-separated ledger");

        // 6. Verify Visual Sparkbar and Species Breakdowns
        assert.ok(html.includes("12.0 MT"), "Summary must report 12.0 MT Vannamei");
        assert.ok(html.includes("20.0 MT"), "Summary must report 20.0 MT Monodon");
        assert.ok(html.includes("Partial"), "Must show Partial harvest breakdown");

        // 7. Verify Accounting Summary Footer (tfoot)
        assert.ok(html.includes('id="exec-ledger-tfoot"'), "Must have dedicated tfoot summary");
        assert.ok(html.includes("FINANCE TOTAL / AVG"), "Must show FINANCE TOTAL / AVG in footer");
        assert.ok(html.includes("19.67 g"), "Must display Vannamei weighted ABW in footer");
        assert.ok(html.includes("18.0 – 20.0 g"), "Must display Vannamei size range in footer");
        assert.ok(html.includes("31.20 g"), "Must display Monodon weighted ABW in footer");
        assert.ok(html.includes("30.0 – 32.0 g"), "Must display Monodon size range in footer");
    });

    test("renderPerformanceLedgerSectionHtml respects hideEmptyMonths filter", () => {
        const agg = aggregate12MonthMovingHarvest(mockDailyHarvests, mockSalesRecords, "ALL");
        
        // Without hiding empty: returns all 12 months
        const fullHtml = renderPerformanceLedgerSectionHtml({
            buckets: agg.monthlyBuckets,
            totals: agg.totals,
            hideEmptyMonths: false
        });
        assert.ok(fullHtml.includes("12 Months"), "Footer should show 12 Months");

        // With hiding empty: returns only 3 active months
        const filteredHtml = renderPerformanceLedgerSectionHtml({
            buckets: agg.monthlyBuckets,
            totals: agg.totals,
            hideEmptyMonths: true
        });
        assert.ok(filteredHtml.includes("3 Months (3 Active)"), "Footer should show 3 Months (3 Active)");
    });

    test("renderPerformanceLedgerSectionHtml supports custom sorting", () => {
        const agg = aggregate12MonthMovingHarvest(mockDailyHarvests, mockSalesRecords, "ALL");
        
        // Sort by Gross Revenue descending
        const html = renderPerformanceLedgerSectionHtml({
            buckets: agg.monthlyBuckets,
            totals: agg.totals,
            sortKey: "grossRevenue",
            sortDirection: "desc",
            hideEmptyMonths: true
        });

        // October (RM 360,000) should appear before September (RM 280,000) and August (RM 200,000)
        const idxOct = html.indexOf("Oct 2026");
        const idxSep = html.indexOf("Sep 2026");
        const idxAug = html.indexOf("Aug 2026");

        assert.ok(idxOct < idxSep, "Oct (highest rev) should precede Sep");
        assert.ok(idxSep < idxAug, "Sep should precede Aug");
    });

    test("getExecutiveBiomassHtml seamlessly embeds the redesigned ledger in #exec-ledger-container", () => {
        const agg = aggregate12MonthMovingHarvest(mockDailyHarvests, mockSalesRecords, "ALL");
        const html = getExecutiveBiomassHtml({
            cohortFilter: "ALL",
            pipelineFilter: "ALL",
            evaluatedPonds: [],
            forecast14d: { candidatePonds: [], totalProjectedBiomassTons: 0 },
            aggregated12m: agg
        });

        assert.ok(html.includes('id="exec-ledger-container"'), "Must wrap ledger in #exec-ledger-container");
        assert.ok(html.includes("Commercial Harvest &amp; Revenue Ledger"), "Must render audited ledger in view");
        assert.ok(html.includes("exec-ledger-table"), "Must render table with .exec-ledger-table class");
    });
});
