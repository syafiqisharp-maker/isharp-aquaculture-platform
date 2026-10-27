/**
 * iSHARP DBMS 2.0 — Finance Repository
 * Data Access Layer for growout_pond_finance and historical cycle unit economics
 *
 * Adheres strictly to AGENTS.md rules:
 * - Zero index_no columns requested or sent
 * - Passes x-isharp-passcode for Row-Level Security (RLS) authorization
 * - Caches 12-month operational dataset in memory for high-performance interactive calculations
 */

import { supabase } from "../supabase.js";
import {
    buildHistoricalFeatures,
    calculateUnitEconomics,
    normaliseSpecies,
    ESTIMATOR_SPECIES
} from "../../domain/ebitdaEstimator.js";

export class FinanceRepository {
    // In-memory cache for past-12-months cycles
    static _cachedFeatures = null;
    static _cacheTimestamp = 0;
    static CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

    /**
     * Clears the in-memory cache to force re-fetching from Supabase Cloud.
     */
    static clearCache() {
        this._cachedFeatures = null;
        this._cacheTimestamp = 0;
    }

    /**
     * Checks if the active user session has an authenticated passcode.
     * @returns {boolean}
     */
    static hasActivePasscode() {
        const pass = supabase.getAuthPasscode();
        return !!pass && pass.trim().length > 0;
    }

    /**
     * Fetches audited cycle financial records and related operational datasets for the past 12 months.
     *
     * @param {Object} options
     * @param {boolean} [options.forceRefresh=false]
     * @param {number} [options.months=12]
     * @returns {Promise<Array<object>>} Cleaned historical cycle feature objects
     */
    static async getPastYearCycleFeatures({ forceRefresh = false, months = 12 } = {}) {
        const now = Date.now();
        if (!forceRefresh && this._cachedFeatures && (now - this._cacheTimestamp < this.CACHE_TTL_MS)) {
            return this._cachedFeatures;
        }

        // Calculate date cutoff (12 months prior to today)
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - Math.max(1, months));
        const cutoffStr = cutoffDate.toISOString().split("T")[0];

        // 1. Fetch recent harvest records to identify completed cycles
        // Zero index_no requested
        const harvEndpoint = `pond_harvest_daily?select=pond_index,harv_date,harv_weight,harv_abw,harv_status&harv_date=gte.${cutoffStr}&order=harv_date.asc&limit=2500`;
        const harvRows = (await supabase.request(harvEndpoint)) || [];

        if (!Array.isArray(harvRows) || harvRows.length === 0) {
            this._cachedFeatures = [];
            this._cacheTimestamp = now;
            return [];
        }

        // Deduplicate and aggregate harvest daily by pond_index
        const harvestMap = new Map();
        for (const h of harvRows) {
            const pIdx = h.pond_index;
            if (!pIdx) continue;

            if (!harvestMap.has(pIdx)) {
                harvestMap.set(pIdx, {
                    pond_index: pIdx,
                    lastHarvestDate: h.harv_date,
                    firstHarvestDate: h.harv_date,
                    totalHarvestKg: 0,
                    weightedAbwSum: 0,
                    finalAbw: Number(h.harv_abw || 0)
                });
            }

            const c = harvestMap.get(pIdx);
            const w = Number(h.harv_weight || 0);
            const abw = Number(h.harv_abw || 0);

            c.totalHarvestKg += w;
            c.weightedAbwSum += (w * abw);
            if (h.harv_date >= c.lastHarvestDate) {
                c.lastHarvestDate = h.harv_date;
                if (abw > 0) c.finalAbw = abw;
            }
            if (h.harv_date < c.firstHarvestDate) {
                c.firstHarvestDate = h.harv_date;
            }
        }

        const pondIndices = Array.from(harvestMap.keys());
        if (pondIndices.length === 0) {
            this._cachedFeatures = [];
            this._cacheTimestamp = now;
            return [];
        }

        // 2. Batch fetch matching records in chunks of 50 to avoid URL length & timeout limits
        const batchSize = 50;
        const financeRecords = [];
        const stockRecords = [];
        const feedRecords = [];

        for (let i = 0; i < pondIndices.length; i += batchSize) {
            const batch = pondIndices.slice(i, i + batchSize);
            const inList = `in.(${batch.map(p => `"${p}"`).join(",")})`;

            // A. growout_pond_finance (requires x-isharp-passcode, NO index_no)
            try {
                const finEndpoint = `growout_pond_finance?pond_index=${inList}&select=pond_index,revenue,cons_of_fries,cons_of_feed,cons_of_chem_fert,cons_of_supplies,wages_direct,wages_indirect,electricity,repair_maintenance,consultant,rental,travel_entertainment,training_seminar,depreciation_fc,harvest_expenses,security_charges,other_utilities_ins,other_charges,total_cost,gross_profit,sag,ebit,depreciation_with_sag,ebitda,cost_per_kg,cash_cost_per_kg,revenue_per_kg&limit=150`;
                const fRows = await supabase.request(finEndpoint);
                if (Array.isArray(fRows)) financeRecords.push(...fRows);
            } catch (err) {
                console.warn("[FinanceRepository] Warning fetching finance batch:", err.message);
            }

            // B. pond_stocking_batches
            try {
                const stckEndpoint = `pond_stocking_batches?pond_index=${inList}&select=pond_index,stck_species,stck_date,stck_pcs&limit=250`;
                const sRows = await supabase.request(stckEndpoint);
                if (Array.isArray(sRows)) stockRecords.push(...sRows);
            } catch (err) {
                console.warn("[FinanceRepository] Warning fetching stocking batch:", err.message);
            }

            // C. growout_pond_feed_sap
            try {
                const feedEndpoint = `growout_pond_feed_sap?pond_index=${inList}&select=pond_index,amount_kg&limit=1000`;
                const fdRows = await supabase.request(feedEndpoint);
                if (Array.isArray(fdRows)) feedRecords.push(...fdRows);
            } catch (err) {
                console.warn("[FinanceRepository] Warning fetching feed batch:", err.message);
            }
        }

        // Aggregate stocking by pond_index
        const stockMap = new Map();
        for (const s of stockRecords) {
            if (!s.pond_index) continue;
            if (!stockMap.has(s.pond_index)) {
                stockMap.set(s.pond_index, {
                    pond_index: s.pond_index,
                    stck_date: s.stck_date,
                    stck_species: s.stck_species,
                    stck_pcs: 0
                });
            }
            const item = stockMap.get(s.pond_index);
            item.stck_pcs += (Number(s.stck_pcs) || 0);
            if (s.stck_date && (!item.stck_date || s.stck_date < item.stck_date)) {
                item.stck_date = s.stck_date;
            }
            if (s.stck_species) item.stck_species = s.stck_species;
        }

        // Aggregate feed SAP by pond_index
        const feedMap = new Map();
        for (const f of feedRecords) {
            if (!f.pond_index) continue;
            const current = feedMap.get(f.pond_index) || 0;
            feedMap.set(f.pond_index, current + (Number(f.amount_kg) || 0));
        }

        // Construct clean historical features
        const features = buildHistoricalFeatures({
            financeRecords,
            harvestMap,
            stockMap,
            feedMap
        });

        this._cachedFeatures = features;
        this._cacheTimestamp = now;
        return features;
    }

    /**
     * Computes calibrated unit economics for a species and target ABW using 12-month data.
     * @param {"VANNAMEI"|"MONODON"} species 
     * @param {number} targetAbw 
     * @returns {Promise<object>}
     */
    static async getCalibratedEconomics(species = ESTIMATOR_SPECIES.VANNAMEI, targetAbw = 16.5) {
        const features = await this.getPastYearCycleFeatures();
        return calculateUnitEconomics(features, species, targetAbw);
    }
}
