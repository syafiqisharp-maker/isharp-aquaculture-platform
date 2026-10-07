/**
 * iSHARP DBMS 2.0 — Laboratory Repository
 * Data Access Layer for pond_issues (disease pathology, PCR, biosecurity)
 */

import { supabase } from "../supabase.js";

export class LabRepository {
    /**
     * Fetches pathology and disease issues for a specific pond cycle.
     * @param {string} pondIndex 
     * @returns {Promise<Array<object>>}
     */
    static async getIssuesByPond(pondIndex) {
        if (!pondIndex) return [];
        const endpoint = `pond_issues?pond_index=eq.${encodeURIComponent(pondIndex)}&order=issue_date.desc`;
        try {
            return await supabase.request(endpoint);
        } catch (err) {
            console.warn("Could not fetch laboratory issues:", err);
            return [];
        }
    }

    /**
     * Fetches all recent pathology / disease issues across all active ponds in a single batch.
     * @param {number} [limit=1000]
     * @returns {Promise<Array<object>>}
     */
    static async getAllRecentIssues(limit = 1000) {
        const endpoint = `pond_issues?order=issue_date.desc&limit=${limit}`;
        try {
            return await supabase.request(endpoint) || [];
        } catch (err) {
            console.warn("Could not fetch batch laboratory issues:", err);
            return [];
        }
    }

    /**
     * Inserts a batch of pathology / lab issue records into pond_issues.
     * @param {Array<object>} records 
     * @returns {Promise<any>}
     */
    static async insertBatch(records) {
        if (!records || records.length === 0) return [];
        return await supabase.request("pond_issues", {
            method: "POST",
            body: JSON.stringify(records)
        });
    }

    /**
     * Fetches water chemistry telemetry (salinity, alkalinity, ammonia, nitrite, Ca, Mg, turbidity)
     * for a specific pond cycle from lab_water_quality.
     * @param {string} pondIndex 
     * @returns {Promise<Array<object>>}
     */
    static async getWaterQualityByPond(pondIndex) {
        if (!pondIndex) return [];
        const endpoint = `lab_water_quality?pond_index=eq.${encodeURIComponent(pondIndex)}&order=log_date.desc`;
        try {
            return await supabase.request(endpoint) || [];
        } catch (err) {
            console.warn("Could not fetch laboratory water quality:", err);
            return [];
        }
    }

    static _latestWqCache = new Map();

    /**
     * Fetches the latest water chemistry sample for all ponds in a module in a single query.
     * @param {string} modStr Module string like '01', '02', etc.
     * @returns {Promise<Map<string, object>>}
     */
    static async getLatestWaterQualityForModule(modStr) {
        const resultMap = new Map();
        if (!modStr) return resultMap;
        const endpoint = `lab_water_quality?pond_index=like.2${modStr}%25&order=log_date.desc&limit=200`;
        try {
            const records = await supabase.request(endpoint);
            if (Array.isArray(records)) {
                records.forEach(r => {
                    if (r && r.pond_index && !resultMap.has(r.pond_index)) {
                        resultMap.set(r.pond_index, r);
                        this._latestWqCache.set(r.pond_index, r);
                    }
                });
            }
        } catch (err) {
            console.warn("Could not fetch module lab water quality:", err);
        }
        return resultMap;
    }

    /**
     * Fetches the latest water chemistry sample for a specific pond cycle (ultra-fast, limit=1).
     * Uses in-memory cache to guarantee zero-latency re-renders in Field Ops.
     * @param {string} pondIndex 
     * @returns {Promise<object|null>}
     */
    static async getLatestWaterQuality(pondIndex) {
        if (!pondIndex) return null;
        if (this._latestWqCache.has(pondIndex)) {
            return this._latestWqCache.get(pondIndex);
        }
        const endpoint = `lab_water_quality?pond_index=eq.${encodeURIComponent(pondIndex)}&order=log_date.desc&limit=1`;
        try {
            const res = await supabase.request(endpoint);
            const record = res && res.length > 0 ? res[0] : null;
            this._latestWqCache.set(pondIndex, record);
            return record;
        } catch (err) {
            console.warn("Could not fetch latest lab water quality:", err);
            return null;
        }
    }

    /**
     * Inserts or upserts a batch of lab water quality records into lab_water_quality.
     * @param {Array<object>} records 
     * @returns {Promise<any>}
     */
    static async insertWaterQualityBatch(records) {
        if (!records || records.length === 0) return [];
        this._latestWqCache.clear();
        return await supabase.request("lab_water_quality?on_conflict=pond_index,log_date", {
            method: "POST",
            body: JSON.stringify(records)
        });
    }
}

