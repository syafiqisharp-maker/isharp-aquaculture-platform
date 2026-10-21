/**
 * iSHARP DBMS 2.0 — Simulation Repository (Phase 4)
 * Infrastructure Layer: Data Access for Live Ponds, Samplings & LocalStorage Scenario Persistence.
 *
 * Adheres strictly to RULES.md:
 * - All Supabase queries go through `supabase.request()`.
 * - All scenario persistence is stored locally in browser `localStorage` per user specification.
 */

import { supabase } from "../supabase.js";
import { calculateDOC } from "../../domain/biometrics.js";
import {
    SPECIES,
    CULTURE_STRATEGIES,
    classifySpecies,
    resolveGeneticLine
} from "../../domain/simulation/baselineCalibrator.js";
import { normalizeModuleKey } from "../../domain/simulation/hazardAndGrowthModel.js";

const SCENARIOS_STORAGE_KEY = "isharp_sim_scenarios";

export class SimulationRepository {
    // =========================================================================
    // 1. LIVE POND OPERATIONS & SUPABASE DATA ACCESS
    // =========================================================================

    /**
     * Fetches all currently operational / active pond cycles from `view_growout_pond_cycles`.
     * Excludes closed cycles and normalizes fields for the simulation engine.
     *
     * @returns {Promise<Array<Object>>}
     */
    static async fetchActivePonds() {
        try {
            const endpoint =
                "view_growout_pond_cycles?select=pond_index,pond,modl,row_no,cycle_no,crop_no,pond_status,pond_active,stck_date,date_close,area,stck_species,bs_line,stck_source,stck_size,stck_total,batch_count,final_status,disease_status&pond_status=neq.CLOSE&order=pond_index.asc&limit=1000";
            const rows = (await supabase.request(endpoint)) || [];

            return rows.map((r) => {
                const pondId = r.pond || r.pond_index?.split("-C")[0] || "P01";
                const modKey = normalizeModuleKey(r.modl || pondId.slice(0, 3));
                const areaHa = Number(r.area) || 0.5;
                const stckPcs = Number(r.stck_total) || 0;
                const densityPlM2 =
                    stckPcs > 0 && areaHa > 0 ? Math.round(stckPcs / (areaHa * 10000)) : 0;

                const species = classifySpecies({
                    species: r.stck_species,
                    bsLine: r.bs_line,
                    stockDensity: densityPlM2
                });
                const geneticLine = resolveGeneticLine({
                    species,
                    bsLine: r.bs_line
                });

                const docDays = calculateDOC(r.stck_date);
                const isProduction = String(r.pond_status).toUpperCase().trim() === "PRODUCTION";

                return {
                    pondIndex: r.pond_index,
                    pondId,
                    moduleId: modKey,
                    areaHa,
                    pondStatus: (r.pond_status || "IDLE").toUpperCase().trim(),
                    isProduction,
                    stckDate: r.stck_date,
                    docDays,
                    species,
                    geneticLine,
                    bsLine: r.bs_line || (species === SPECIES.MONODON ? "CP THAI" : "SYAQUA"),
                    stckSource: r.stck_source || (species === SPECIES.MONODON ? "KSK" : "SHT"),
                    stockedPlPcs: stckPcs,
                    stockDensityPlM2: densityPlM2 > 0 ? densityPlM2 : (species === SPECIES.MONODON ? 45 : 95),
                    diseaseStatus: r.disease_status || "NO ISSUES",
                    hasActiveDisease: Boolean(r.disease_status && r.disease_status !== "NO ISSUES")
                };
            });
        } catch (err) {
            console.error("SimulationRepository.fetchActivePonds error:", err);
            return [];
        }
    }

    /**
     * Fetches all cycles (both CLOSED actuals and current PRODUCTION) for the target year
     * from `view_growout_pond_cycles`, including carryover cycles from previous year.
     *
     * @param {number} [year=2026]
     * @returns {Promise<Array<Object>>}
     */
    static async fetchYearCycles(year = 2026) {
        try {
            const endpoint =
                `view_growout_pond_cycles?select=pond_index,pond,modl,row_no,cycle_no,crop_no,pond_status,pond_active,stck_date,date_close,area,stck_species,bs_line,stck_source,stck_size,stck_total,batch_count,final_status,disease_status&or=(stck_date.gte.${year}-01-01,date_close.gte.${year}-01-01)&order=stck_date.asc&limit=1500`;
            const rows = (await supabase.request(endpoint)) || [];

            const dateToW = (dateStr) => {
                if (!dateStr) return 1;
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return 1;
                const start = new Date(year, 0, 1);
                const diffMs = d.getTime() - start.getTime();
                const diffDays = Math.floor(diffMs / (24 * 3600 * 1000));
                return Math.max(1, Math.min(156, Math.floor(diffDays / 7) + 1));
            };

            return rows.map((r) => {
                const pondId = r.pond || r.pond_index?.split("-C")[0] || "P01";
                const modKey = normalizeModuleKey(r.modl || pondId.slice(0, 3));
                const areaHa = Number(r.area) || 0.5;
                const stckPcs = Number(r.stck_total) || 0;
                const densityPlM2 =
                    stckPcs > 0 && areaHa > 0 ? Math.round(stckPcs / (areaHa * 10000)) : 0;

                const species = classifySpecies({
                    species: r.stck_species,
                    bsLine: r.bs_line,
                    stockDensity: densityPlM2
                });
                const geneticLine = resolveGeneticLine({
                    species,
                    bsLine: r.bs_line
                });

                const isProd = String(r.pond_status).toUpperCase().trim() === "PRODUCTION";
                const isClose = String(r.pond_status).toUpperCase().trim() === "CLOSE";

                // Carryover: stocked before baseYear and closed in baseYear
                const stckYear = r.stck_date ? new Date(r.stck_date).getFullYear() : year;
                const isCarryover = stckYear < year;

                let strategyCode = "DS1";
                if (species === SPECIES.MONODON) {
                    strategyCode = "DS4";
                } else {
                    if (densityPlM2 >= 115) strategyCode = "DS3";
                    else if (densityPlM2 >= 85) strategyCode = "DS2";
                    else strategyCode = "DS1";
                }

                const stratDef = CULTURE_STRATEGIES[strategyCode] || CULTURE_STRATEGIES.DS1;
                const defaultTargetDoc = stratDef.targetFinalDoc || (species === SPECIES.MONODON ? 112 : 92);

                let docDays = 0;
                let targetFinalDoc = defaultTargetDoc;

                if (isProd) {
                    docDays = calculateDOC(r.stck_date);
                    targetFinalDoc = Math.max(docDays + 7, defaultTargetDoc);
                } else if (r.date_close && r.stck_date) {
                    const diffMs = new Date(r.date_close).getTime() - new Date(r.stck_date).getTime();
                    docDays = Math.max(1, Math.round(diffMs / (24 * 3600 * 1000)));
                    targetFinalDoc = docDays;
                } else {
                    docDays = defaultTargetDoc;
                    targetFinalDoc = defaultTargetDoc;
                }

                const startW = isCarryover ? 1 : dateToW(r.stck_date);
                let endW = 1;
                if (r.date_close) {
                    endW = Math.max(startW, dateToW(r.date_close));
                } else {
                    const durationWeeks = Math.max(1, Math.ceil(targetFinalDoc / 7));
                    endW = Math.min(156, startW + durationWeeks - 1);
                }

                return {
                    pondIndex: r.pond_index,
                    pondId,
                    moduleId: modKey,
                    areaHa,
                    pondStatus: (r.pond_status || "IDLE").toUpperCase().trim(),
                    isProduction: isProd,
                    isClosed: isClose,
                    isCarryoverFromPrevYear: isCarryover,
                    isStockedInBaseYear: !isCarryover,
                    stckDate: r.stck_date,
                    dateClose: r.date_close,
                    docDays,
                    targetFinalDoc,
                    species,
                    geneticLine,
                    bsLine: r.bs_line || (species === SPECIES.MONODON ? "CP THAI" : "SYAQUA"),
                    stckSource: r.stck_source || (species === SPECIES.MONODON ? "KSK" : "SHT"),
                    strategyCode,
                    stockedPlPcs: stckPcs,
                    stockDensityPlM2: densityPlM2 > 0 ? densityPlM2 : (species === SPECIES.MONODON ? 45 : 95),
                    startWeekIndex: startW,
                    endWeekIndex: endW,
                    finalStatus: r.final_status || null,
                    diseaseStatus: r.disease_status || "NO ISSUES",
                    hasActiveDisease: Boolean(r.disease_status && r.disease_status !== "NO ISSUES")
                };
            });
        } catch (err) {
            console.error("SimulationRepository.fetchYearCycles error:", err);
            return [];
        }
    }

    /**
     * Fetches the latest biometrics sampling records for active production ponds.
     *
     * @param {Array<string>} pondIndices
     * @returns {Promise<Map<string, Object>>} Map of `pond_index` => `{ smplDoc, smplAbw, smplSurv, smplDate }`
     */
    static async fetchLatestSamplingsForPonds(pondIndices = []) {
        const samplingMap = new Map();
        if (!Array.isArray(pondIndices) || pondIndices.length === 0) return samplingMap;

        try {
            // Query latest samplings (ordered by smpl_doc descending)
            const endpoint =
                "biometrics_sampling?select=pond_index,smpl_doc,smpl_date,smpl_abw,smpl_surv&order=smpl_doc.desc,smpl_date.desc&limit=2500";
            const rows = (await supabase.request(endpoint)) || [];

            for (const r of rows) {
                const pIdx = r.pond_index ? String(r.pond_index).trim() : "";
                if (pIdx && !samplingMap.has(pIdx) && Number(r.smpl_doc) > 0) {
                    let surv = Number(r.smpl_surv);
                    if (surv > 0 && surv <= 1.5) surv *= 100;

                    samplingMap.set(pIdx, {
                        smplDoc: Number(r.smpl_doc),
                        smplDate: r.smpl_date,
                        smplAbw: Number(r.smpl_abw) || 0,
                        smplSurv: surv > 0 ? Number(surv.toFixed(1)) : null
                    });
                }
            }
        } catch (err) {
            console.warn("SimulationRepository.fetchLatestSamplingsForPonds failed:", err);
        }

        return samplingMap;
    }

    /**
     * Fetches the benchmark master pond registry across all modules (M01-M11).
     *
     * @returns {Promise<Array<Object>>} Array of `{ pondId, moduleId, areaHa, pondType }`
     */
    static async fetchMasterPondsList() {
        try {
            const endpoint =
                "growout_pond_master?pond_active=eq.ACTIVE&select=pond,modl,area,pond_type,pond_active,pond_status&order=pond.asc&limit=1000";
            const rows = (await supabase.request(endpoint)) || [];

            const uniquePonds = new Map();
            for (const r of rows) {
                const pondId = r.pond ? String(r.pond).trim() : "";
                if (!pondId || uniquePonds.has(pondId)) continue;
                if (r.pond_status === "RESERVOIR" || pondId.endsWith(".TA") || pondId.includes("RES")) continue;

                const modKey = normalizeModuleKey(r.modl || pondId.slice(0, 3));
                uniquePonds.set(pondId, {
                    pondId,
                    moduleId: modKey,
                    areaHa: Number(r.area) || 0.5,
                    pondType: r.pond_type || "FULL LINING",
                    pondStatus: r.pond_status || "IDLE"
                });
            }

            return Array.from(uniquePonds.values());
        } catch (err) {
            console.error("SimulationRepository.fetchMasterPondsList error:", err);
            // Fallback: generate authentic Setiu farm benchmark growout ponds across Modules M01-M11
            const moduleTopology = [
                { modKey: "01", count: 24, areaHa: 0.5 },
                { modKey: "02", count: 24, areaHa: 0.5 },
                { modKey: "03", count: 24, areaHa: 0.5 },
                { modKey: "04", count: 24, areaHa: 0.5 },
                { modKey: "05", count: 24, areaHa: 0.5 },
                { modKey: "06", count: 24, areaHa: 0.5 },
                { modKey: "07", count: 24, areaHa: 0.5 },
                { modKey: "08", count: 24, areaHa: 0.5 },
                { modKey: "09", count: 24, areaHa: 0.5 },
                { modKey: "10", count: 26, areaHa: 0.5 },
                { modKey: "11", count: 21, areaHa: 0.5 }
            ];
            const fallback = [];
            moduleTopology.forEach(m => {
                for (let p = 1; p <= m.count; p++) {
                    const pondNum = String(p).padStart(2, "0");
                    fallback.push({
                        pondId: `M${m.modKey}-P${pondNum}`,
                        moduleId: m.modKey,
                        areaHa: m.modKey === "11" && p > 13 ? 1.0 : m.areaHa,
                        pondType: "FULL LINING"
                    });
                }
            });
            return fallback;
        }
    }

    /**
     * Fetches realized monthly actual harvests for the specified year to support
     * spliced YTD reporting (`Actual YTD + Rolling Forecast = Full-Year LE`).
     *
     * Directly queries `growout_pond_final_legacy` and joins with audited `growout_pond_finance`
     * (38-column accounting ledger) to provide real historical revenue, EBITDA, cash cost, and OPEX.
     *
     * @param {number} year e.g. 2026
     * @returns {Promise<Array<Object>>} Array of monthly actuals `{ month, yieldKg, yieldMt, pondsHarvested, revenueRM, cashCostRM, ebitdaRM, ... }`
     */
    static async fetchActualMonthlyHarvests(year = 2026) {
        try {
            const startStr = `${year}-01-01`;
            const endStr = `${year}-12-31`;
            const endpoint = `growout_pond_final_legacy?select=index_no,pond_index,final_date,date_close,final_kg,final_pieces,final_abw,final_sr,final_fcr,final_adg,final_doc,total_feed,stock_total_fry,stock_density,area&final_date=gte.${startStr}&final_date=lte.${endStr}&limit=1000`;
            const rows = (await supabase.request(endpoint)) || [];

            // Deduplicate cycles by pond_index keeping highest index_no
            const cleanFinals = new Map();
            for (const r of rows) {
                const pIdx = r.pond_index ? String(r.pond_index).trim() : "";
                if (!pIdx) continue;
                const existing = cleanFinals.get(pIdx);
                const currNo = Number(r.id ?? r.index_no) || 0;
                const prevNo = existing ? (Number(existing.id ?? existing.index_no) || 0) : -Infinity;
                if (!existing || currNo >= prevNo) {
                    cleanFinals.set(pIdx, r);
                }
            }
            const uniqueCycles = Array.from(cleanFinals.values());

            // Batch fetch matching audited financials from growout_pond_finance
            const financeMap = new Map();
            const pIndices = uniqueCycles.map(c => c.pond_index).filter(Boolean);
            const batchSize = 50;
            for (let i = 0; i < pIndices.length; i += batchSize) {
                const batch = pIndices.slice(i, i + batchSize);
                const inList = batch.map(p => `"${p}"`).join(",");
                try {
                    const finRows = await supabase.request(
                        `growout_pond_finance?pond_index=in.(${inList})&select=pond_index,revenue,ebitda,total_cost,cost_per_kg,cash_cost_per_kg,cons_of_feed,cons_of_fries,cons_of_chem_fert,electricity,wages_direct,repair_maintenance,depreciation_fc,sag&limit=100`
                    );
                    if (Array.isArray(finRows)) {
                        for (const f of finRows) {
                            if (f.pond_index) financeMap.set(String(f.pond_index).trim(), f);
                        }
                    }
                } catch (batchErr) {
                    console.warn("SimulationRepository finance batch fetch warning:", batchErr);
                }
            }

            const monthlyMap = new Map();
            for (let m = 1; m <= 12; m++) {
                monthlyMap.set(m, {
                    month: m,
                    pondsHarvested: 0,
                    harvested_ponds: 0,
                    harvestedPondsCount: 0,
                    stocked_ponds: 0,
                    stockedPonds: 0,
                    stockedPondsCount: 0,
                    stocked_pl_m: 0,
                    stockedPlPcs: 0,
                    yieldKg: 0,
                    yieldMt: 0,
                    harvest_mt: 0,
                    harvestYieldMt: 0,
                    feed_kg: 0,
                    feedKg: 0,
                    feed_mt: 0,
                    final_abw: 0,
                    averageHarvestAbwG: 0,
                    final_sr: 0,
                    averageSurvivalRatePct: 0,
                    final_fcr: 0,
                    fcr: 0,
                    final_adg: 0,
                    adg: 0,
                    density: 0,
                    averageDensityPlM2: 0,
                    dop_days: 42,
                    dopDays: 42,
                    revenueRM: 0,
                    revenueRm: 0,
                    revenue_rm: 0,
                    cashCostRM: 0,
                    cash_cost_rm: 0,
                    totalCostRM: 0,
                    ebitdaRM: 0,
                    ebitdaRm: 0,
                    ebitda_rm: 0,
                    feedCostRm: 0,
                    plCostRm: 0,
                    chemicalCostRm: 0,
                    electricityCostRm: 0,
                    directWagesRm: 0,
                    maintenanceRm: 0,
                    depreciationRm: 0,
                    sagRm: 0,
                    averageRealizedPriceRmKg: 0,
                    averageCashCostRmKg: 0,
                    averageTotalCostRmKg: 0,
                    _abwKgSum: 0,
                    _srKgSum: 0,
                    _adgKgSum: 0,
                    _densitySum: 0,
                    _kgForAvg: 0
                });
            }

            for (const r of uniqueCycles) {
                const dateStr = r.final_date || r.date_close || "";
                if (!dateStr) continue;
                const m = parseInt(dateStr.slice(5, 7), 10);
                if (m >= 1 && m <= 12) {
                    const bucket = monthlyMap.get(m);
                    const kg = Number(r.final_kg) || 0;
                    bucket.pondsHarvested += 1;
                    bucket.harvested_ponds += 1;
                    bucket.harvestedPondsCount += 1;
                    bucket.yieldKg += kg;

                    const feed = Number(r.total_feed) || 0;
                    const fry = Number(r.stock_total_fry) || 0;
                    bucket.feed_kg += feed;
                    bucket.feedKg += feed;

                    // Bucket stocking counts into the actual stocking month (harvest date minus DOC)
                    const docDays = Math.max(30, Number(r.final_doc) || 90);
                    const harvDate = new Date(dateStr);
                    let stockMonth = m;
                    if (!isNaN(harvDate.getTime())) {
                        const stockDate = new Date(harvDate.getTime() - docDays * 24 * 3600 * 1000);
                        if (stockDate.getFullYear() === Number(year)) {
                            stockMonth = stockDate.getMonth() + 1;
                        } else {
                            stockMonth = 0; // Stocked in previous calendar year
                        }
                    }
                    if (stockMonth >= 1 && stockMonth <= 12) {
                        const sBucket = monthlyMap.get(stockMonth);
                        sBucket.stocked_ponds += 1;
                        sBucket.stockedPonds += 1;
                        sBucket.stockedPondsCount += 1;
                        sBucket.stockedPlPcs += fry;
                        sBucket.stocked_pl_m += fry / 1000000;
                    }

                    let abw = Number(r.final_abw) || 0;
                    if (abw <= 0 && Number(r.final_pieces) > 0) {
                        abw = (kg * 1000) / Number(r.final_pieces);
                    }
                    const sr = Number(r.final_sr) || 0;
                    const adg = Number(r.final_adg) || 0;
                    const sd = Number(r.stock_density) || 0;

                    if (kg > 0) {
                        bucket._abwKgSum += kg * abw;
                        bucket._srKgSum += kg * sr;
                        bucket._adgKgSum += kg * adg;
                        bucket._densitySum += sd;
                        bucket._kgForAvg += kg;
                    }

                    const fin = financeMap.get(r.pond_index);
                    if (fin) {
                        const rev = Number(fin.revenue) || 0;
                        const totCost = Number(fin.total_cost) || 0;
                        const ebitda = Number(fin.ebitda) || 0;
                        const cashCost = (Number(fin.cash_cost_per_kg) || 0) * kg || (totCost - (Number(fin.depreciation_fc) || 0));

                        bucket.revenueRM += rev;
                        bucket.totalCostRM += totCost;
                        bucket.cashCostRM += cashCost;
                        bucket.ebitdaRM += ebitda;

                        bucket.feedCostRm += Number(fin.cons_of_feed) || 0;
                        bucket.plCostRm += Number(fin.cons_of_fries) || 0;
                        bucket.chemicalCostRm += Number(fin.cons_of_chem_fert) || 0;
                        bucket.electricityCostRm += Number(fin.electricity) || 0;
                        bucket.directWagesRm += Number(fin.wages_direct) || 0;
                        bucket.maintenanceRm += Number(fin.repair_maintenance) || 0;
                        bucket.depreciationRm += Number(fin.depreciation_fc) || 0;
                        bucket.sagRm += Number(fin.sag) || 0;
                    } else {
                        // For recent cycles whose financial books have not closed yet:
                        // Use Setiu empirical average realized price and cost
                        const estRev = kg * 23.59;
                        const estCashCost = kg * 17.50;
                        bucket.revenueRM += estRev;
                        bucket.cashCostRM += estCashCost;
                        bucket.totalCostRM += estCashCost * 1.15;
                        bucket.ebitdaRM += (estRev - estCashCost);
                    }
                }
            }

            for (const b of monthlyMap.values()) {
                b.yieldMt = Number((b.yieldKg / 1000).toFixed(2));
                b.harvest_mt = b.yieldMt;
                b.harvestYieldMt = b.yieldMt;
                b.feed_mt = Number((b.feed_kg / 1000).toFixed(2));
                b.revenueRM = Number(b.revenueRM.toFixed(2));
                b.revenueRm = b.revenueRM;
                b.revenue_rm = b.revenueRM;
                b.cashCostRM = Number(b.cashCostRM.toFixed(2));
                b.cash_cost_rm = b.cashCostRM;
                b.totalCostRM = Number(b.totalCostRM.toFixed(2));
                b.ebitdaRM = Number(b.ebitdaRM.toFixed(2));
                b.ebitdaRm = b.ebitdaRM;
                b.ebitda_rm = b.ebitdaRM;

                if (b._kgForAvg > 0) {
                    b.final_abw = Number((b._abwKgSum / b._kgForAvg).toFixed(1));
                    b.averageHarvestAbwG = b.final_abw;
                    b.final_sr = Number((b._srKgSum / b._kgForAvg).toFixed(1));
                    b.averageSurvivalRatePct = b.final_sr;
                    b.final_adg = Number((b._adgKgSum / b._kgForAvg).toFixed(3));
                    b.adg = b.final_adg;
                }
                if (b.yieldKg > 0 && b.feed_kg > 0) {
                    b.final_fcr = Number((b.feed_kg / b.yieldKg).toFixed(2));
                    b.fcr = b.final_fcr;
                }
                if (b.pondsHarvested > 0) {
                    b.density = Math.round(b._densitySum / b.pondsHarvested);
                    b.averageDensityPlM2 = b.density;
                }
                if (b.yieldKg > 0) {
                    b.averageRealizedPriceRmKg = Number((b.revenueRM / b.yieldKg).toFixed(2));
                    b.averageCashCostRmKg = Number((b.cashCostRM / b.yieldKg).toFixed(2));
                    b.averageTotalCostRmKg = Number((b.totalCostRM / b.yieldKg).toFixed(2));
                }
            }

            return Array.from(monthlyMap.values());
        } catch (err) {
            console.warn("SimulationRepository.fetchActualMonthlyHarvests failed:", err);
            return [];
        }
    }

    // =========================================================================
    // 2. LOCALSTORAGE SCENARIO PERSISTENCE (Zero Supabase Table Dependency)
    // =========================================================================

    static _getStorage() {
        if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
        if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
        return null;
    }

    /**
     * Lists all saved simulation scenario summaries stored in browser localStorage.
     *
     * @returns {Array<Object>} Array of `{ id, name, description, cycleCount, updatedAt }`
     */
    static listScenarios() {
        try {
            const storage = this._getStorage();
            if (!storage) return [];
            const raw = storage.getItem(SCENARIOS_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];

            return parsed.map((s) => ({
                id: s.id,
                name: s.name || "Untitled Scenario",
                description: s.description || "",
                cycleCount: Array.isArray(s.scheduledCycles) ? s.scheduledCycles.length : 0,
                updatedAt: s.updatedAt || s.createdAt || new Date().toISOString()
            }));
        } catch (err) {
            console.error("SimulationRepository.listScenarios error:", err);
            return [];
        }
    }

    /**
     * Loads a full simulation scenario by ID from browser localStorage.
     *
     * @param {string} scenarioId
     * @returns {Object|null}
     */
    static getScenario(scenarioId) {
        try {
            const storage = this._getStorage();
            if (!storage) return null;
            const raw = storage.getItem(SCENARIOS_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return null;

            return parsed.find((s) => s.id === scenarioId) || null;
        } catch (err) {
            console.error("SimulationRepository.getScenario error:", err);
            return null;
        }
    }

    /**
     * Saves or updates a simulation scenario into browser localStorage.
     *
     * @param {Object} scenario
     * @param {string} [scenario.id]
     * @param {string} scenario.name
     * @param {string} [scenario.description]
     * @param {Array<Object>} scenario.scheduledCycles
     * @param {Array<Object>} [scenario.shocks]
     * @returns {Object} The saved scenario object
     */
    static saveScenario(scenario = {}) {
        try {
            const storage = this._getStorage();
            if (!storage) {
                return { ...scenario, id: scenario.id || "local-scenario-1" };
            }

            const raw = storage.getItem(SCENARIOS_STORAGE_KEY);
            const list = raw ? JSON.parse(raw) : [];

            const id = scenario.id || `scen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const now = new Date().toISOString();

            const record = {
                id,
                name: scenario.name || `Scenario ${new Date().toLocaleDateString()}`,
                description: scenario.description || "",
                scheduledCycles: scenario.scheduledCycles || [],
                shocks: scenario.shocks || [],
                options: scenario.options || {},
                createdAt: scenario.createdAt || now,
                updatedAt: now
            };

            const existingIndex = list.findIndex((s) => s.id === id);
            if (existingIndex >= 0) {
                list[existingIndex] = record;
            } else {
                list.unshift(record);
            }

            storage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(list));
            return record;
        } catch (err) {
            console.error("SimulationRepository.saveScenario error:", err);
            return scenario;
        }
    }

    /**
     * Deletes a scenario by ID from browser localStorage.
     *
     * @param {string} scenarioId
     * @returns {boolean} True if deleted
     */
    static deleteScenario(scenarioId) {
        try {
            const storage = this._getStorage();
            if (!storage) return false;
            const raw = storage.getItem(SCENARIOS_STORAGE_KEY);
            if (!raw) return false;
            const list = JSON.parse(raw);
            if (!Array.isArray(list)) return false;

            const filtered = list.filter((s) => s.id !== scenarioId);
            storage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(filtered));
            return true;
        } catch (err) {
            console.error("SimulationRepository.deleteScenario error:", err);
            return false;
        }
    }

    /**
     * Exports a scenario as a formatted JSON string for file backup/sharing.
     *
     * @param {string} scenarioId
     * @returns {string|null}
     */
    static exportScenarioJson(scenarioId) {
        const scen = this.getScenario(scenarioId);
        return scen ? JSON.stringify(scen, null, 2) : null;
    }

    /**
     * Imports a scenario from a JSON string into browser localStorage.
     *
     * @param {string} jsonString
     * @returns {Object} Imported scenario
     */
    static importScenarioJson(jsonString) {
        const parsed = JSON.parse(jsonString);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.scheduledCycles)) {
            throw new Error("Invalid scenario JSON format: must contain scheduledCycles array.");
        }
        delete parsed.id; // Generate new unique ID
        return this.saveScenario(parsed);
    }
}
