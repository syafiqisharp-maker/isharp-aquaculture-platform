/**
 * iSHARP DBMS 2.0 — Sampling Repository
 * Data Access Layer for biometrics_sampling
 */

import { supabase } from "../supabase.js";

export class SamplingRepository {
    /**
     * Fetches all biometrics sampling records for a given pond cycle.
     * @param {string} pondIndex 
     * @param {string} [order='asc'] 'asc' for chronological, 'desc' for latest first
     * @returns {Promise<Array<object>>}
     */
    static async getSamplingByPond(pondIndex, order = 'asc') {
        if (!pondIndex) return [];
        const endpoint = `biometrics_sampling?pond_index=eq.${encodeURIComponent(pondIndex)}&order=smpl_doc.${order},smpl_date.${order}`;
        const raw = await supabase.request(endpoint) || [];

        // Defensive deduplication by smpl_date / smpl_doc
        const map = new Map();
        for (const item of raw) {
            const key = item.smpl_date || `doc_${item.smpl_doc}`;
            if (!map.has(key) || (item.id && (!map.get(key).id || item.id > map.get(key).id))) {
                map.set(key, item);
            }
        }
        return Array.from(map.values());
    }

    /**
     * Fetches the single latest biometrics sampling record for a pond cycle.
     * @param {string} pondIndex 
     * @returns {Promise<object|null>}
     */
    static async getLatestSampling(pondIndex) {
        if (!pondIndex) return null;
        const endpoint = `biometrics_sampling?pond_index=eq.${encodeURIComponent(pondIndex)}&order=smpl_doc.desc,smpl_date.desc&limit=1`;
        const res = await supabase.request(endpoint);
        return (res && res.length > 0) ? res[0] : null;
    }

    /**
     * Fetches recent biometrics sampling records across all ponds, ordered latest first.
     * @param {number} [limit=1500] 
     * @returns {Promise<Array<object>>}
     */
    static async getRecentSamplings(limit = 1500) {
        try {
            const endpoint = `biometrics_sampling?select=pond_index,smpl_date,smpl_doc,smpl_abw,smpl_surv,smpl_bms&order=smpl_date.desc&limit=${limit}`;
            return await supabase.request(endpoint) || [];
        } catch (err) {
            console.warn("Failed to fetch recent samplings:", err);
            return [];
        }
    }

    /**
     * Inserts or updates a batch of parsed sampling records into biometrics_sampling.
     * Uses on_conflict=pond_index,smpl_date to guarantee idempotency.
     * @param {Array<object>} records 
     * @returns {Promise<any>}
     */
    static async insertBatch(records) {
        if (!records || records.length === 0) return [];
        return await supabase.request("biometrics_sampling?on_conflict=pond_index,smpl_date", {
            method: "POST",
            body: JSON.stringify(records)
        });
    }
}
