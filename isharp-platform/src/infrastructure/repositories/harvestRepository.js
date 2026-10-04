/**
 * iSHARP DBMS 2.0 — Harvest Repository
 * Data Access Layer for pond_harvest_daily and pond_harvest_sales
 */

import { supabase } from "../supabase.js";

export class HarvestRepository {
    /**
     * Fetches daily harvest records for a pond cycle.
     * @param {string} pondIndex 
     * @returns {Promise<Array<object>>}
     */
    static async getHarvestDaily(pondIndex) {
        if (!pondIndex) return [];
        const endpoint = `pond_harvest_daily?select=id,pond_index,harv_date,harv_status,harv_weight,harv_abw,harv_revenue,harv_method&pond_index=eq.${encodeURIComponent(pondIndex)}&order=harv_date.asc`;
        return (await supabase.request(endpoint)) || [];
    }

    /**
     * Fetches sales transactions associated with a pond harvest.
     * @param {string} pondIndex 
     * @returns {Promise<Array<object>>}
     */
    static async getHarvestSales(pondIndex) {
        if (!pondIndex) return [];
        const endpoint = `pond_harvest_sales?select=id,pond_index,hvt_date,hvt_buyer,hvt_abw,good_wgt,good_prc,second_grade_wgt,second_grade_prc,small_wgt,below_wgt,rubbish_wgt,net_sales&pond_index=eq.${encodeURIComponent(pondIndex)}&order=hvt_date.asc`;
        return (await supabase.request(endpoint)) || [];
    }

    /**
     * Computes cumulative harvest summary (total kg and total revenue) for a cycle.
     * @param {string} pondIndex 
     * @returns {Promise<{totalWeightKg: number, totalRevenue: number, hasHarvest: boolean}>}
     */
    static async getHarvestSummary(pondIndex) {
        const records = await this.getHarvestDaily(pondIndex);
        if (!records || records.length === 0) {
            return { totalWeightKg: 0, totalRevenue: 0, hasHarvest: false };
        }
        let totalWeightKg = 0;
        let totalRevenue = 0;
        records.forEach(r => {
            totalWeightKg += parseFloat(r.harv_weight || 0);
            totalRevenue += parseFloat(r.harv_revenue || 0);
        });
        return {
            totalWeightKg: Math.round(totalWeightKg * 10) / 10,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            hasHarvest: totalWeightKg > 0
        };
    }

    /**
     * Inserts a batch of harvest daily records.
     * @param {Array<object>} records 
     * @returns {Promise<any>}
     */
    static async insertBatch(records) {
        if (!records || records.length === 0) return [];
        return await supabase.request("pond_harvest_daily", {
            method: "POST",
            body: JSON.stringify(records)
        });
    }

    /**
     * Fetches harvest daily and sales transactions for the past 12 rolling months.
     * @param {number} [monthsBack=12] 
     * @returns {Promise<{dailyHarvests: Array<object>, salesRecords: Array<object>}>}
     */
    static async get12MonthHarvestData(monthsBack = 12) {
        const now = new Date();
        // Go back monthsBack + 1 to ensure full coverage of the 12-month window
        const past = new Date(now.getFullYear(), now.getMonth() - (monthsBack + 1), 1);
        const fromDate = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-01`;

        // Stocking date may precede harvest by several months
        const stockPast = new Date(now.getFullYear(), now.getMonth() - (monthsBack + 8), 1);
        const stockFrom = `${stockPast.getFullYear()}-${String(stockPast.getMonth() + 1).padStart(2, '0')}-01`;

        try {
            const [dailyHarvests, salesRecords, stockings] = await Promise.all([
                supabase.request(`pond_harvest_daily?select=pond_index,harv_date,harv_status,harv_weight,harv_abw,harv_revenue&harv_date=gte.${fromDate}&order=harv_date.asc&limit=3000`),
                supabase.request(`pond_harvest_sales?select=pond_index,hvt_date,hvt_buyer,good_wgt,second_grade_wgt,small_wgt,below_wgt,rubbish_wgt,raw_wgt,net_sales&hvt_date=gte.${fromDate}&order=hvt_date.asc&limit=3000`),
                supabase.request(`pond_stocking_batches?select=pond_index,stck_species&stck_date=gte.${stockFrom}&limit=5000`)
            ]);

            // Species is not stored on harvest tables; resolve from the stocking batch of the same cycle (pond_index)
            const speciesMap = new Map();
            (stockings || []).forEach(s => {
                if (!s.pond_index || !s.stck_species || speciesMap.has(s.pond_index)) return;
                speciesMap.set(s.pond_index, String(s.stck_species).toUpperCase().includes('MONODON') ? 'MON' : 'VAN');
            });
            const tag = r => ({ ...r, species: speciesMap.get(r.pond_index) || 'UNK' });

            return {
                dailyHarvests: (dailyHarvests || []).map(tag),
                salesRecords: (salesRecords || []).map(tag)
            };
        } catch (err) {
            console.error("Error fetching 12-month harvest data:", err);
            return { dailyHarvests: [], salesRecords: [] };
        }
    }

    /**
     * Gathers live production ponds across all 9 modules, binds their latest biometrics sampling
     * and biosecurity lab issues, and returns an evaluated harvest readiness dataset.
     * @returns {Promise<Array<object>>}
     */
    static async getLiveHarvestPipeline() {
        try {
            const [cycles, samplings, issues] = await Promise.all([
                supabase.request("view_growout_pond_cycles?pond_status=eq.PRODUCTION&select=pond_index,pond,stck_species,stck_date,stck_total,stck_pcs&order=pond.asc&limit=300"),
                supabase.request("biometrics_sampling?select=pond_index,smpl_date,smpl_doc,smpl_abw,smpl_surv,smpl_bms&order=smpl_date.desc&limit=600"),
                supabase.request("pond_issues?select=pond_index,issue_flag,issue_note,issue_status,issue_test&order=issue_date.desc&limit=300")
            ]);


            // Index issues by pond_index
            const issuesMap = new Map();
            (issues || []).forEach(iss => {
                if (!iss.pond_index) return;
                const idx = String(iss.pond_index);
                if (!issuesMap.has(idx)) issuesMap.set(idx, []);
                issuesMap.get(idx).push(iss);
            });

            // Index latest sampling by pond_index
            const sampleMap = new Map();
            (samplings || []).forEach(s => {
                if (!s.pond_index) return;
                const idx = String(s.pond_index);
                if (!sampleMap.has(idx)) {
                    sampleMap.set(idx, s);
                }
            });

            return (cycles || []).map(cycle => {
                const pIdx = String(cycle.pond_index);
                const s = sampleMap.get(pIdx) || null;
                const pIssues = issuesMap.get(pIdx) || [];

                // Determine biosecurity flag
                let issueFlag = 'GREEN';
                let issueNote = 'Clean';
                for (const iss of pIssues) {
                    const flg = (iss.issue_flag || '').toUpperCase();
                    const note = (iss.issue_note || '').toUpperCase();
                    const pcr = (iss.pcr_result || '').toUpperCase();
                    if (flg === 'RED' || note.includes('POSITIVE') || pcr === 'POSITIVE') {
                        issueFlag = 'RED';
                        issueNote = `${iss.issue_status || 'Disease'} (${iss.issue_test || 'PCR'})`;
                        break;
                    } else if (flg === 'YELLOW' || flg === 'WARN' || note.includes('SUSPICIOUS')) {
                        issueFlag = 'YELLOW';
                        issueNote = `${iss.issue_status || 'Observation Warning'}`;
                    }
                }

                // Compute DOC
                let doc = 0;
                if (cycle.stck_date) {
                    const st = new Date(cycle.stck_date);
                    if (!isNaN(st.getTime())) {
                        const now = new Date();
                        doc = Math.max(0, Math.floor((now.getTime() - st.getTime()) / (1000 * 60 * 60 * 24)));
                    }
                }
                if (s && s.smpl_doc && Number(s.smpl_doc) > doc) {
                    doc = Number(s.smpl_doc);
                }

                const abw = s && s.smpl_abw ? parseFloat(s.smpl_abw) : 0;
                const surv = s && s.smpl_surv ? parseFloat(s.smpl_surv) : 75;
                const pcs = cycle.stck_total || cycle.stck_pcs || 0;

                // Biomass (kg)
                let biomassKg = s && s.smpl_bms ? parseFloat(s.smpl_bms) : 0;
                if (!biomassKg && pcs > 0 && abw > 0 && surv > 0) {
                    biomassKg = Math.round((pcs * (surv / 100) * abw) / 1000);
                }

                // ADG pace
                let adg = 0.22;
                if (s && s.smpl_abw && doc > 0) {
                    adg = Math.round((parseFloat(s.smpl_abw) / doc) * 100) / 100;
                }

                const species = (cycle.stck_species || 'P. VANNAMEI').toUpperCase().includes('MON') ? 'MON' : 'VAN';

                return {
                    pondIndex: cycle.pond_index,
                    pond: cycle.pond,
                    species,
                    stckDate: cycle.stck_date,
                    doc,
                    abw,
                    surv,
                    biomassKg,
                    adg,
                    issueFlag,
                    issueNote,
                    hasSample: abw > 0
                };
            });
        } catch (err) {
            console.error("Error generating live harvest pipeline:", err);
            return [];
        }
    }
}


