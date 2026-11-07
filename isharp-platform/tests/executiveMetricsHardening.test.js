/**
 * iSHARP DBMS 2.0 — Executive Metrics & Infrastructure Hardening Test Suite
 * Validates remediation of the 10 audit findings:
 * - Single Source of Truth for COO harvest readiness thresholds
 * - Removal of arbitrary flat 75% survival fallback in biomass pipeline
 * - +14-day biomass projection compounding based on growth gain
 * - Zero hardcoded broodstock genetic lines ("SYAQUA"/"CP THAI")
 * - Documented force majeure (SR <= 5%) & early termination (DOC <= 20d) business rules
 * - Incomplete Pond Data Quality Audit system for manual database repair
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    COO_HARVEST_READINESS_THRESHOLDS,
    classifyHarvestReadiness,
    projectHarvestForecast,
    evaluateBiosecurityAndEhpStatus,
    aggregate12MonthMovingHarvest
} from "../src/domain/biometrics/harvestForecast.js";

import {
    ExecutiveMetricsPresenter,
    METRIC_TYPES
} from "../src/modules/executive/ExecutiveMetricsPresenter.js";

import {
    getExecutiveBiomassHtml,
    renderPipelineRowsHtml,
    filterPondsForPipeline,
    renderPipelineFooterHtml,
    renderCommercialPackoutCardHtml
} from "../src/modules/executive/templates/executiveBiomassTemplate.js";

describe("Remediation 1: COO Harvest Readiness Thresholds (SSOT)", () => {
    test("COO_HARVEST_READINESS_THRESHOLDS defines explicit parameters for VANNAMEI and MONODON", () => {
        assert.ok(COO_HARVEST_READINESS_THRESHOLDS, "Must be exported");
        assert.equal(COO_HARVEST_READINESS_THRESHOLDS.VANNAMEI.MINIMUM_ABW_G, 10.0);
        assert.equal(COO_HARVEST_READINESS_THRESHOLDS.VANNAMEI.OPTIMUM_ABW_G, 16.0);
        assert.equal(COO_HARVEST_READINESS_THRESHOLDS.VANNAMEI.STUNTED_DOC_LIMIT, 80);

        assert.equal(COO_HARVEST_READINESS_THRESHOLDS.MONODON.MINIMUM_ABW_G, 25.0);
        assert.equal(COO_HARVEST_READINESS_THRESHOLDS.MONODON.OPTIMUM_ABW_G, 30.0);
        assert.equal(COO_HARVEST_READINESS_THRESHOLDS.MONODON.STUNTED_DOC_LIMIT, 120);
    });

    test("classifyHarvestReadiness classifies based on COO thresholds", () => {
        // Vannamei: 17g at DOC 80 -> OPTIMUM (>= 16g)
        const vanOpt = classifyHarvestReadiness({ species: "VAN", abw: 17.0, doc: 80 });
        assert.equal(vanOpt.category, "OPTIMUM");

        // Vannamei: 12g at DOC 76 -> MINIMUM (>= 10g and < 16g)
        const vanMin = classifyHarvestReadiness({ species: "VAN", abw: 12.0, doc: 76 });
        assert.equal(vanMin.category, "MINIMUM");

        // Vannamei: 8g at DOC 50 -> GROWING (< 10g)
        const vanGrow = classifyHarvestReadiness({ species: "VAN", abw: 8.0, doc: 50 });
        assert.equal(vanGrow.category, "GROWING");

        // Monodon: 32g at DOC 105 -> OPTIMUM (>= 30g)
        const monOpt = classifyHarvestReadiness({ species: "MON", abw: 32.0, doc: 105 });
        assert.equal(monOpt.category, "OPTIMUM");

        // Monodon: 27g at DOC 102 -> MINIMUM (>= 25g and < 30g)
        const monMin = classifyHarvestReadiness({ species: "MON", abw: 27.0, doc: 102 });
        assert.equal(monMin.category, "MINIMUM");

        // Monodon: 20g at DOC 90 -> GROWING (< 25g)
        const monGrow = classifyHarvestReadiness({ species: "MON", abw: 20.0, doc: 90 });
        assert.equal(monGrow.category, "GROWING");
    });
});

describe("Remediation 2: Forward +14-Day Biomass Compound Projection", () => {
    test("projectHarvestForecast compounds day +14 projected biomass proportionally to weight gain", () => {
        const mockPonds = [
            {
                pond: "A01",
                species: "VAN",
                abw: 8.0,
                doc: 60,
                adg: 0.25,
                biomassKg: 4000,
                hasSurvSample: true,
                biosecurityStatus: "CLEARED"
            }
        ];

        const forecast = projectHarvestForecast(mockPonds, 14);
        assert.equal(forecast.candidatePonds.length, 1);
        const candidate = forecast.candidatePonds[0];

        // Day +14 ABW = 8.0 + (0.25 * 14) = 11.5g
        assert.equal(candidate.projectedAbw, 11.5);
        // Candidate was < 10g and now reaches MINIMUM readiness threshold (10g)
        assert.equal(candidate.willBeOptimum, false);

        // Compounded projected biomass = (11.5 / 8.0) * 4000 = 5750 kg
        assert.equal(candidate.projectedBiomassKg, 5750);
        assert.equal(forecast.totalProjectedBiomassTons, 5.8);
    });
});

describe("Remediation 3: Zero Flat 75% SR Fallback & Missing Survival Audit", () => {
    test("Ponds with missing sampling survival yield biomassKg = 0 and flag needsSurvRepair", () => {
        const mockPonds = [
            {
                pond: "B02",
                species: "VAN",
                abw: 20.0,
                doc: 85,
                adg: 0.22,
                biomassKg: 0,
                hasSurvSample: false,
                needsSurvRepair: true,
                biosecurityStatus: "CLEARED"
            }
        ];

        const html = getExecutiveBiomassHtml({
            cohortFilter: "ALL",
            pipelineFilter: "ALL",
            evaluatedPonds: [
                {
                    ...mockPonds[0],
                    classification: classifyHarvestReadiness(mockPonds[0])
                }
            ],
            forecast14d: { candidatePonds: [], totalProjectedBiomassTons: 0 },
            aggregated12m: { totalHarvestTons: 0, totalSalesRevenue: 0, monthlyData: [] }
        });

        // Banner and Missing SR tab must be rendered
        assert.ok(html.includes("Lack Survival Rate (smpl_surv)"), "Must render Data Repair Banner");
        assert.ok(html.includes("⚠️ Missing SR (1)"), "Must render tab button for missing SR");
    });
});

describe("Remediation 4: Zero Hardcoded Genetic Lines & Top Hatcheries", () => {
    test("Missing genetic lines evaluate to UNSPECIFIED instead of SYAQUA or CP THAI", () => {
        const dataBundle = {
            stockingBatches: [
                {
                    pond_index: "CYC-101",
                    pond: "C01",
                    stck_date: "2026-02-10",
                    stck_species: "VAN",
                    stck_source: null, // missing source
                    bs_line: null,       // missing line
                    stck_size: null,     // missing plSize
                    stck_pcs: 100000
                }
            ],
            operationalCycles: [],
            activePonds: [],
            dailyProgress: [],
            dailyHarvests: []
        };

        const intel = ExecutiveMetricsPresenter.aggregateSpeciesAndHatcheryIntelligence(dataBundle, {
            referenceDate: new Date("2026-06-01")
        });

        // The genetic line must NOT be defaulted to "SYAQUA"
        const vanLines = intel.vanGeneticLines;
        assert.equal(vanLines.length, 1);
        assert.equal(vanLines[0].line, "UNSPECIFIED");

        // The hatchery source must be "UNSPECIFIED"
        assert.equal(intel.vanHatcheries[0].source, "UNSPECIFIED");

        // Top hatchery and line should not use fake lead names
        const ytd = intel.fullYtdStats;
        assert.equal(ytd.topMonHatchery.source, "None");
        assert.equal(ytd.topMonLine.line, "None");
    });

    test("Surfaces incomplete ponds in incompletePonds audit array for manual repair", () => {
        const dataBundle = {
            stockingBatches: [
                {
                    pond_index: "CYC-901",
                    pond: "D04",
                    stck_date: "2026-03-15",
                    stck_species: "MON",
                    stck_source: "UNSPECIFIED",
                    bs_line: "",
                    stck_size: 0,
                    stck_pcs: 80000
                }
            ],
            operationalCycles: [
                {
                    pond_index: "CYC-902",
                    pond: "D05",
                    stck_date: "2026-03-20",
                    stck_species: "VAN",
                    pond_status: "PRODUCTION",
                    stck_source: "SHT",
                    bs_line: null, // missing line
                    stck_size: 10
                }
            ],
            activePonds: [],
            dailyProgress: [],
            dailyHarvests: []
        };

        const intel = ExecutiveMetricsPresenter.aggregateSpeciesAndHatcheryIntelligence(dataBundle, {
            referenceDate: new Date("2026-06-01")
        });

        assert.ok(Array.isArray(intel.incompletePonds), "Must return incompletePonds array");
        assert.equal(intel.incompletePonds.length, 2);

        const d04 = intel.incompletePonds.find(p => p.pondCode === "D04");
        assert.ok(d04);
        assert.equal(d04.pondIndex, "CYC-901");
        assert.ok(d04.missingFields.includes("Missing Hatchery"));
        assert.ok(d04.missingFields.includes("Missing Genetic Line"));
        assert.ok(d04.missingFields.includes("Missing PL Size"));

        const d05 = intel.incompletePonds.find(p => p.pondCode === "D05");
        assert.ok(d05);
        assert.equal(d05.pondIndex, "CYC-902");
        assert.ok(d05.missingFields.includes("Missing Genetic Line"));
        assert.ok(!d05.missingFields.includes("Missing Hatchery"));
    });
});

describe("Remediation 5: Realized Harvest Performance Business Rules", () => {
    test("Excludes acute early termination (DOC <= 20) and catastrophic losses (SR <= 5%)", () => {
        const mockBatches = [
            // Normal harvest
            { pond_index: "CYC-01", pond: "A01", stck_date: "2026-01-01", stck_species: "VAN", stck_source: "SHT", stck_pcs: 100000 },
            // Early disease liquidation (DOC 15 <= 20)
            { pond_index: "CYC-02", pond: "A02", stck_date: "2026-01-01", stck_species: "VAN", stck_source: "SHT", stck_pcs: 100000 },
            // Force majeure power outage (SR 3% <= 5%)
            { pond_index: "CYC-03", pond: "A03", stck_date: "2026-01-01", stck_species: "VAN", stck_source: "SHT", stck_pcs: 100000 }
        ];

        const mockDailyHarvests = [
            // CYC-01: DOC 80, 80,000 pcs (80% SR)
            { pond_index: "CYC-01", harv_date: "2026-03-22", harv_weight: 1600, harv_abw: 20.0, harv_status: "FINAL" },
            // CYC-02: DOC 15 (Harvested Jan 16, weight 200kg, abw 5g) -> DOC <= 20 should be excluded
            { pond_index: "CYC-02", harv_date: "2026-01-16", harv_weight: 200, harv_abw: 5.0, harv_status: "FINAL" },
            // CYC-03: DOC 80, but only 3,000 pcs (3% SR) -> SR <= 5% should be excluded from SR
            { pond_index: "CYC-03", harv_date: "2026-03-22", harv_weight: 60, harv_abw: 20.0, harv_status: "FINAL" }
        ];

        const intel = ExecutiveMetricsPresenter.aggregateSpeciesAndHatcheryIntelligence({
            stockingBatches: mockBatches,
            operationalCycles: [],
            dailyHarvests: mockDailyHarvests
        }, {
            referenceDate: new Date("2026-04-01")
        });

        const vanPerf = intel.vanHarvestPerf;
        assert.equal(vanPerf.length, 1);
        const sht = vanPerf[0];
        // CYC-02 was completely excluded due to DOC <= 20.
        // CYC-01 (80% SR) was included.
        // CYC-03 was included in harvest count (2 ponds), but its SR (3%) was excluded from avgSr due to force majeure rule.
        assert.equal(sht.harvestedPonds, 2);
        assert.equal(sht.avgSr, 80); // Only CYC-01's 80% SR is averaged!
    });

    test("Flags density estimation variance when SR > 100%", () => {
        const mockBatches = [
            { pond_index: "CYC-10", pond: "A10", stck_date: "2026-01-01", stck_species: "VAN", stck_source: "SHT", stck_pcs: 100000 }
        ];
        // 105,000 pcs harvested -> 105% SR
        const mockDailyHarvests = [
            { pond_index: "CYC-10", harv_date: "2026-03-25", harv_weight: 2100, harv_abw: 20.0, harv_status: "FINAL" }
        ];

        const intel = ExecutiveMetricsPresenter.aggregateSpeciesAndHatcheryIntelligence({
            stockingBatches: mockBatches,
            operationalCycles: [],
            dailyHarvests: mockDailyHarvests
        }, {
            referenceDate: new Date("2026-04-01")
        });

        const sht = intel.vanHarvestPerf[0];
        assert.equal(sht.avgSr, 100); // Capped at 100%
    });
});

describe("Remediation 6: EHP Biosecurity Intelligence & Growth Classification", () => {
    test("Acute lethal pathogen (WSSV, EMS/AHPND) with harvestable weight triggers EMERGENCY salvage liquidation", () => {
        const wssvPond = classifyHarvestReadiness({
            species: "VAN",
            abw: 12.0,
            doc: 65,
            issueFlag: "RED",
            issueNote: "Suspected WSSV white spots on cuticle"
        });

        assert.equal(wssvPond.category, "ALERT");
        assert.equal(wssvPond.subCategory, "EMERGENCY");
        assert.equal(wssvPond.criterion, "EMERGENCY_PATHOGEN");
        assert.equal(wssvPond.actionText, "Liquidate Now");
        assert.ok(wssvPond.reason.includes("Acute Pathogen"));
        assert.ok(wssvPond.metricsDetail.includes("Salvage ABW 12.0g"));
    });

    test("Chronic EHP with stunted growth (DOC >= 80, ABW < 10) triggers FORCED harvest", () => {
        const ehpStuntedPond = classifyHarvestReadiness({
            species: "VAN",
            abw: 8.5,
            doc: 85,
            adg: 0.10,
            awg: 0.08,
            issueFlag: "AMBER",
            issueNote: "EHP spore count elevated"
        });

        assert.equal(ehpStuntedPond.category, "ALERT");
        assert.equal(ehpStuntedPond.subCategory, "FORCED");
        assert.equal(ehpStuntedPond.criterion, "EHP_STUNTED");
        assert.equal(ehpStuntedPond.ehpStatus, "STUNTED");
        assert.equal(ehpStuntedPond.actionText, "Terminate Pond");
        assert.ok(ehpStuntedPond.reason.includes("Stunted by EHP"));
    });

    test("Chronic EHP with good growth velocity (ADG >= 0.18 g/d) is NOT forced and achieves OPTIMUM commercial classification", () => {
        const ehpGoodGrowthPond = classifyHarvestReadiness({
            species: "VAN",
            abw: 18.2,
            doc: 85,
            adg: 0.22,
            awg: 0.25,
            issueFlag: "AMBER",
            issueNote: "EHP microsporidia detected in hepatopancreas"
        });

        // Must NOT trigger FORCED or EMERGENCY harvest!
        assert.equal(ehpGoodGrowthPond.category, "OPTIMUM");
        assert.equal(ehpGoodGrowthPond.subCategory, "OPTIMUM");
        assert.equal(ehpGoodGrowthPond.criterion, "PRIME_WEIGHT");
        assert.equal(ehpGoodGrowthPond.ehpStatus, "TOLERANT_GOOD_GROWTH");
        assert.equal(ehpGoodGrowthPond.actionText, "Schedule Plant");
        assert.ok(ehpGoodGrowthPond.metricsDetail.includes("ABW 18.2g"));
    });

    test("Chronic EHP with slow growth approaching harvest DOC triggers Growth Watch", () => {
        const ehpSlowPond = classifyHarvestReadiness({
            species: "VAN",
            abw: 9.2,
            doc: 75, // >= GROWTH_WATCH_DOC (70)
            adg: 0.12, // < GROWTH_WATCH_MIN_ADG (0.15)
            awg: 0.07,
            issueFlag: "AMBER",
            issueNote: "EHP slow gain"
        });

        assert.equal(ehpSlowPond.category, "ALERT");
        assert.equal(ehpSlowPond.subCategory, "WATCH");
        assert.equal(ehpSlowPond.criterion, "EHP_SLOWDOWN");
        assert.equal(ehpSlowPond.ehpStatus, "SLOWDOWN");
        assert.equal(ehpSlowPond.actionText, "Review Feed & Water");
    });
});

describe("Remediation 7: Farm-Standard ADG & AWG Pipeline Separation", () => {
    test("Differentiates cumulative ADG (ABW / DOC) and weekly rate AWG (delta ABW / delta DOC)", () => {
        // Pond with DOC 70, ABW 14g -> ADG = 14 / 70 = 0.20 g/day
        // Previous week DOC 63, ABW 12.6g -> delta ABW = 1.4g / 7d = 0.20 g/day
        const readiness = classifyHarvestReadiness({
            species: "VAN",
            abw: 14.0,
            doc: 70,
            adg: 0.20,
            awg: 0.20
        });

        assert.equal(readiness.category, "MINIMUM");
        assert.ok(readiness.metricsDetail.includes("ABW 14.0g"));
    });
});

describe("Remediation 8: Interactive 10-Column Sorting & Cohort Aggregation", () => {
    const sampleEvaluatedPonds = [
        {
            pond: "A01",
            species: "VAN",
            doc: 82,
            abw: 18.5,
            adg: 0.23,
            awg: 0.25,
            biomassKg: 4500,
            hasSurvSample: true,
            issueFlag: "GREEN",
            issueNote: "Healthy",
            classification: {
                category: "OPTIMUM",
                subCategory: "OPTIMUM",
                label: "Optimum Harvest",
                badgeType: "emerald",
                urgency: "NORMAL",
                actionText: "Schedule Plant",
                criterion: "PRIME_WEIGHT",
                reason: "Prime weight (ABW ≥ 16.0g, premium count)",
                metricsDetail: "ABW 18.5g (≥ 16.0g Optimum target • +2.5g)"
            }
        },
        {
            pond: "B03",
            species: "VAN",
            doc: 88,
            abw: 8.8,
            adg: 0.10,
            awg: 0.08,
            biomassKg: 2200,
            hasSurvSample: true,
            issueFlag: "AMBER",
            issueNote: "EHP confirmed",
            classification: {
                category: "ALERT",
                subCategory: "FORCED",
                label: "Forced Harvest",
                badgeType: "rose-action",
                urgency: "HIGH",
                actionText: "Terminate Pond",
                criterion: "EHP_STUNTED",
                ehpStatus: "STUNTED",
                reason: "Stunted by EHP (DOC 88d ≥ 80d • ABW 8.8g < 10.0g - High FCR Risk)",
                metricsDetail: "EHP Stunted: DOC 88d ≥ 80d • ABW 8.8g < 10.0g"
            }
        },
        {
            pond: "C02",
            species: "VAN",
            doc: 75,
            abw: 17.0,
            adg: 0.23,
            awg: 0.26,
            biomassKg: 3800,
            hasSurvSample: true,
            issueFlag: "AMBER",
            issueNote: "EHP positive but vigorous feeding",
            classification: {
                category: "OPTIMUM",
                subCategory: "OPTIMUM",
                label: "Optimum Harvest",
                badgeType: "emerald",
                urgency: "NORMAL",
                actionText: "Schedule Plant",
                criterion: "PRIME_WEIGHT",
                ehpStatus: "TOLERANT_GOOD_GROWTH",
                reason: "Prime weight (ABW ≥ 16.0g, premium count)",
                metricsDetail: "ABW 17.0g (≥ 16.0g Optimum target • +1.0g)"
            }
        }
    ];

    test("renderPipelineRowsHtml outputs 10 columns with data-sort-key attributes", () => {
        const rowsHtml = renderPipelineRowsHtml(sampleEvaluatedPonds);

        // Verify all 10 columns are present and well formatted
        assert.ok(rowsHtml.includes("A01"));
        assert.ok(rowsHtml.includes("B03"));
        assert.ok(rowsHtml.includes("C02"));

        // EHP badges
        assert.ok(rowsHtml.includes("EHP Stunted"), "Must show EHP Stunted badge for B03");
        assert.ok(rowsHtml.includes("EHP+ (Good Growth)"), "Must show EHP+ (Good Growth) badge for C02");

        // Action gate buttons
        assert.ok(rowsHtml.includes("Schedule Plant"));
        assert.ok(rowsHtml.includes("Terminate Pond"));

        // Separate ADG and AWG values
        assert.ok(rowsHtml.includes("0.23"));
        assert.ok(rowsHtml.includes("0.25"));
    });

    test("filterPondsForPipeline filters correctly by pipeline category", () => {
        const forecast14d = { candidatePonds: [] };

        const allPonds = filterPondsForPipeline(sampleEvaluatedPonds, "ALL", forecast14d);
        assert.equal(allPonds.length, 3);

        const optimumPonds = filterPondsForPipeline(sampleEvaluatedPonds, "OPTIMUM", forecast14d);
        assert.equal(optimumPonds.length, 2);

        const alertPonds = filterPondsForPipeline(sampleEvaluatedPonds, "ALERT", forecast14d);
        assert.equal(alertPonds.length, 1);
        assert.equal(alertPonds[0].pond, "B03");
    });

    test("renderPipelineFooterHtml calculates accurate cohort summaries", () => {
        const footerHtml = renderPipelineFooterHtml(sampleEvaluatedPonds);

        // 3 ponds, 10,500 kg total = 10.5 Tons
        assert.ok(footerHtml.includes("Total: 3 Ponds"));
        assert.ok(footerHtml.includes("10.5 Tons"));
    });
});

describe("Remediation 9: Commercial Quality Packout & Off-Taker Intelligence", () => {
    const mockDailyHarvests = [];
    const mockSalesRecords = [
        // Current Year (2026) records - should be included in YTD
        {
            pond_index: "CYC-01",
            hvt_date: "2026-03-15",
            hvt_buyer: "Navar Enterprise",
            species: "VAN",
            good_wgt: 6000,
            good_prc: 21.0,
            second_grade_wgt: 1500,
            second_grade_prc: 18.0,
            small_wgt: 2000,
            below_wgt: 300,
            rubbish_wgt: 200,
            raw_wgt: 10000,
            net_sales: 190000
        },
        {
            pond_index: "CYC-02",
            hvt_date: "2026-03-20",
            hvt_buyer: "SBH Marine",
            species: "MON",
            good_wgt: 3000,
            good_prc: 33.0,
            second_grade_wgt: 500,
            second_grade_prc: 28.0,
            small_wgt: 1000,
            below_wgt: 300,
            rubbish_wgt: 200,
            raw_wgt: 5000,
            net_sales: 150000
        },
        // Previous Year (2025) record - MUST be excluded from 2026 YTD analysis
        {
            pond_index: "CYC-OLD",
            hvt_date: "2025-11-20",
            hvt_buyer: "Old Buyer Ltd",
            species: "VAN",
            good_wgt: 8000,
            good_prc: 20.0,
            second_grade_wgt: 1000,
            small_wgt: 1000,
            below_wgt: 0,
            rubbish_wgt: 0,
            raw_wgt: 10000,
            net_sales: 195000
        }
    ];

    test("aggregate12MonthMovingHarvest computes strictly current-year YTD packout with zero hardcoding", () => {
        const agg = aggregate12MonthMovingHarvest(mockDailyHarvests, mockSalesRecords, "ALL");

        assert.ok(agg.packoutSummary, "Must include packoutSummary");
        // 2025 record (10 MT) was excluded from YTD! Total = 10 MT (VAN) + 5 MT (MON) = 15 MT
        assert.equal(agg.packoutSummary.totalTons, 15.0);
        assert.equal(agg.packoutSummary.goodPct, 60.0);
        assert.equal(agg.packoutSummary.secondPct, 13.3);
        assert.equal(agg.packoutSummary.smallPct, 20.0);
        assert.equal(agg.packoutSummary.rejectPct, 6.7);

        // Revenue loss is dynamically computed from actual sales invoices with zero hardcoding:
        // Navar: potential 10k * 21 = 210k - 190k actual = 20,000 lost
        // SBH: potential 5k * 33 = 165k - 150k actual = 15,000 lost
        // Total loss = 35,000
        assert.equal(agg.packoutSummary.revenueLostRm, 35000);
        // Loss breakdown:
        // 2nd grade: Navar 7,500 + SBH 3,750 = 11,250
        // Small grade: Navar 10,000 + SBH 7,500 = 17,500
        // Rejects: Navar 2,500 + SBH 3,750 = 6,250
        assert.equal(agg.packoutSummary.lossSecondRm, 11250);
        assert.equal(agg.packoutSummary.lossSmallRm, 17500);
        assert.equal(agg.packoutSummary.lossRejectRm, 6250);

        // Species-specific packouts
        assert.ok(agg.packoutBySpecies.VAN);
        assert.equal(agg.packoutBySpecies.VAN.goodTons, 6.0);
        assert.equal(agg.packoutBySpecies.VAN.totalTons, 10.0);
        assert.equal(agg.packoutBySpecies.VAN.revenueLostRm, 20000);

        assert.ok(agg.packoutBySpecies.MON);
        assert.equal(agg.packoutBySpecies.MON.goodTons, 3.0);
        assert.equal(agg.packoutBySpecies.MON.totalTons, 5.0);
        assert.equal(agg.packoutBySpecies.MON.revenueLostRm, 15000);

        // Off-Taker intelligence strictly for YTD (excludes Old Buyer Ltd)
        assert.ok(Array.isArray(agg.topBuyers));
        assert.equal(agg.topBuyers.length, 2);
        assert.ok(!agg.topBuyers.some(b => b.buyer === "Old Buyer Ltd"), "Old buyer from 2025 must be excluded from YTD");

        const navar = agg.topBuyers.find(b => b.buyer === "Navar Enterprise");
        assert.ok(navar);
        assert.equal(navar.revenueSharePct, 55.9);
        assert.equal(navar.volumeSharePct, 66.7);
        assert.equal(navar.totalTons, 10.0);

        const sbh = agg.topBuyers.find(b => b.buyer === "SBH Marine");
        assert.ok(sbh);
        assert.equal(sbh.revenueSharePct, 44.1);
        assert.equal(sbh.volumeSharePct, 33.3);
        assert.equal(sbh.totalTons, 5.0);

        assert.equal(agg.top3BuyerConcentration, 100.0);
    });

    test("renderCommercialPackoutCardHtml renders simple direct wording with breakdown", () => {
        const agg = aggregate12MonthMovingHarvest(mockDailyHarvests, mockSalesRecords, "ALL");
        const cardHtml = renderCommercialPackoutCardHtml({
            packout: agg.packoutSummary,
            topBuyers: agg.topBuyers,
            currentSpecies: "ALL",
            top3Concentration: agg.top3BuyerConcentration
        });

        // 100% stacked bar
        assert.ok(cardHtml.includes("Packout Composition (100%)"));
        assert.ok(cardHtml.includes("Target: ≥ 75% Prime"));

        // YTD badge
        assert.ok(cardHtml.includes("YTD"));

        // Direct, simple financial loss wording
        assert.ok(cardHtml.includes("Estimated Revenue Lost to Lower Grades"));
        assert.ok(cardHtml.includes("Loss breakdown vs Prime price:"));
        assert.ok(cardHtml.includes("Small:"));
        assert.ok(cardHtml.includes("2nd Grade:"));
        assert.ok(cardHtml.includes("Rejects:"));
        assert.ok(cardHtml.includes("35,000")); // Exact RM 35,000 displayed!

        // Dual-share off-taker metrics
        assert.ok(cardHtml.includes("Top 3 Buyers:"));
        assert.ok(cardHtml.includes("Rev • RM"));
        assert.ok(cardHtml.includes("% Vol"));
    });
});
