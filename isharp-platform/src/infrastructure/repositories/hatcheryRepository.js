/**
 * iSHARP DBMS 2.0 — Telaga Putat Hatchery (TPH) Repository
 * Data Access Layer for 64 PL Tanks, Broodstock Batches, Daily Monitoring, and Pond Traceability
 */

import { supabase } from "../supabase.js";

export class HatcheryRepository {
    /**
     * Retrieves the 64-tank interactive matrix telemetry from view
     * @returns {Promise<Array<object>>}
     */
    static async getTankMap() {
        try {
            const data = await supabase.request("v_hatchery_tank_map?order=tank_code.asc");
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error("HatcheryRepository.getTankMap failed:", err);
            return [];
        }
    }

    /**
     * Retrieves full historical runs, events, and pond links for a given tank
     * @param {string} tankCode e.g. 'A01'
     * @returns {Promise<{ tank: object, runs: Array<object>, events: Array<object>, pondLinks: Array<object> }>}
     */
    static async getTankHistory(tankCode) {
        if (!tankCode) return { tank: null, runs: [], events: [], pondLinks: [] };

        try {
            const [tankRes, runsRes, eventsRes, linksRes] = await Promise.all([
                supabase.request(`v_hatchery_tank_map?tank_code=eq.${encodeURIComponent(tankCode)}`),
                supabase.request(`hatchery_tank_runs?tank_code=eq.${encodeURIComponent(tankCode)}&order=stock_date.desc`),
                supabase.request(`hatchery_run_events?tank_code=eq.${encodeURIComponent(tankCode)}&order=event_date.desc`),
                supabase.request(`hatchery_pond_links?tank_code=eq.${encodeURIComponent(tankCode)}&order=pond_stck_date.desc`)
            ]);

            return {
                tank: Array.isArray(tankRes) && tankRes.length > 0 ? tankRes[0] : null,
                runs: Array.isArray(runsRes) ? runsRes : [],
                events: Array.isArray(eventsRes) ? eventsRes : [],
                pondLinks: Array.isArray(linksRes) ? linksRes : []
            };
        } catch (err) {
            console.error(`HatcheryRepository.getTankHistory for ${tankCode} failed:`, err);
            return { tank: null, runs: [], events: [], pondLinks: [] };
        }
    }

    /**
     * Retrieves monthly PL production roll-up for PL Harvest Report
     * @returns {Promise<Array<object>>}
     */
    static async getPlMonthlyRollup() {
        try {
            const data = await supabase.request("v_hatchery_pl_monthly?order=month_key.desc");
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error("HatcheryRepository.getPlMonthlyRollup failed:", err);
            return [];
        }
    }

    /**
     * Retrieves all PL culture runs with traceability data
     * @returns {Promise<Array<object>>}
     */
    static async getAllTankRuns(limit = 500) {
        try {
            const data = await supabase.request(`hatchery_tank_runs?order=stock_date.desc&limit=${limit}`);
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error("HatcheryRepository.getAllTankRuns failed:", err);
            return [];
        }
    }

    /**
     * Retrieves all master Broodstock Batches
     * @returns {Promise<Array<object>>}
     */
    static async getBroodstockBatches() {
        try {
            const data = await supabase.request("broodstock_batches?order=arrival_date.desc");
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error("HatcheryRepository.getBroodstockBatches failed:", err);
            return [];
        }
    }

    /**
     * Retrieves daily monitoring records for a specific broodstock batch
     * @param {string} batchCode e.g. 'S1/2026'
     * @returns {Promise<Array<object>>}
     */
    static async getBroodstockDailyRecords(batchCode) {
        if (!batchCode) return [];
        try {
            const data = await supabase.request(`broodstock_daily?batch_code=eq.${encodeURIComponent(batchCode)}&order=rec_date.asc`);
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error(`HatcheryRepository.getBroodstockDailyRecords for ${batchCode} failed:`, err);
            return [];
        }
    }

    /**
     * Retrieves the latest active spawning batch info for Maturation Block A or B
     * @param {string} block 'A' or 'B'
     * @returns {Promise<object|null>}
     */
    static async getActiveMaturationBlock(block) {
        try {
            const blk = block.toUpperCase();
            // Derive latest spawning batch for block
            const data = await supabase.request(`broodstock_daily?spawn_block=eq.SH${blk}&order=rec_date.desc&limit=1`);
            if (Array.isArray(data) && data.length > 0) {
                return data[0];
            }
            return null;
        } catch (err) {
            console.error(`HatcheryRepository.getActiveMaturationBlock for ${block} failed:`, err);
            return null;
        }
    }

    /**
     * Retrieves Hatchery Origin & Broodstock Traceability for a farm growout pond
     * @param {string} pondIndex e.g. '2010101.36'
     * @returns {Promise<Array<object>>}
     */
    static async getPondHatcheryOrigin(pondIndex) {
        if (!pondIndex) return [];
        try {
            const data = await supabase.request(`v_hatchery_pond_origin?pond_index=eq.${encodeURIComponent(pondIndex)}`);
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error(`HatcheryRepository.getPondHatcheryOrigin for ${pondIndex} failed:`, err);
            return [];
        }
    }
}
