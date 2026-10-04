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
        const endpoint = `biometrics_sampling?pond_index=eq.${encodeURIComponent(pondIndex)}&order=smpl_doc.${order},smpl_date.${order},index_no.${order}`;
        return await supabase.request(endpoint) || [];
    }

    /**
     * Fetches the single latest biometrics sampling record for a pond cycle.
     * @param {string} pondIndex 
     * @returns {Promise<object|null>}
     */
    static async getLatestSampling(pondIndex) {
        if (!pondIndex) return null;
        const endpoint = `biometrics_sampling?pond_index=eq.${encodeURIComponent(pondIndex)}&order=smpl_doc.desc,smpl_date.desc,index_no.desc&limit=1`;
        const res = await supabase.request(endpoint);
        return (res && res.length > 0) ? res[0] : null;
    }

    /**
     * Inserts a batch of parsed sampling records into biometrics_sampling.
     * @param {Array<object>} records 
     * @returns {Promise<any>}
     */
    static async insertBatch(records) {
        if (!records || records.length === 0) return [];
        return await supabase.request("biometrics_sampling", {
            method: "POST",
            body: JSON.stringify(records)
        });
    }
}
