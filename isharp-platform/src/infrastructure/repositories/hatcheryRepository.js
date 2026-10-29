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
     * Retrieves all individual PL Harvest Dispatches with Tank Numbers, Destinations, and Linked Ponds
     * @param {number} limit
     * @returns {Promise<Array<object>>}
     */
    static async getHarvestDispatches(limit = 1200) {
        try {
            const [events, commercial, links, runs] = await Promise.all([
                supabase.request(`hatchery_run_events?event_type=eq.HARVEST&order=event_date.desc&limit=${limit}`),
                supabase.request(`hatchery_run_commercial?event_type=eq.HARVEST&limit=${limit}`),
                supabase.request(`hatchery_pond_links?select=tank_code,run_stock_date,pond_index,pond_stck_date&limit=2500`),
                supabase.request(`hatchery_tank_runs?select=tank_code,stock_date,species,source_code&limit=1500`)
            ]);

            const commMap = new Map();
            if (Array.isArray(commercial)) {
                commercial.forEach(c => {
                    const k = `${c.tank_code}_${c.stock_date}_${c.event_date}_${c.occurrence_no}`;
                    commMap.set(k, c);
                });
            }

            const linksMap = new Map();
            if (Array.isArray(links)) {
                links.forEach(l => {
                    const k = `${l.tank_code}_${l.run_stock_date}`;
                    if (!linksMap.has(k)) linksMap.set(k, []);
                    linksMap.get(k).push(l);
                });
            }

            const runsMap = new Map();
            if (Array.isArray(runs)) {
                runs.forEach(r => {
                    runsMap.set(`${r.tank_code}_${r.stock_date}`, r);
                });
            }

            if (!Array.isArray(events)) return [];

            return events.map(e => {
                const commKey = `${e.tank_code}_${e.stock_date}_${e.event_date}_${e.occurrence_no}`;
                const c = commMap.get(commKey) || {};
                const r = runsMap.get(`${e.tank_code}_${e.stock_date}`) || {};
                
                // Match linked ponds close to harvest date
                const runLinks = linksMap.get(`${e.tank_code}_${e.stock_date}`) || [];
                const eDate = new Date(e.event_date);
                const matchedPonds = runLinks.filter(l => {
                    const pDate = new Date(l.pond_stck_date);
                    const diffDays = Math.abs((pDate - eDate) / (1000 * 60 * 60 * 24));
                    return diffDays <= 1.5;
                }).map(l => l.pond_index);

                const rawBuyer = (c.buyer || "").trim().toUpperCase();
                let displayBuyer = "SGO (Setiu Farm)";
                let buyerType = "SGO";
                if (rawBuyer === "KGO") {
                    displayBuyer = "KGO (Kedah Farm)";
                    buyerType = "KGO";
                } else if (rawBuyer === "EXTERNAL" || c.external_buyer) {
                    displayBuyer = c.external_buyer ? `External: ${c.external_buyer}` : "External Buyer";
                    buyerType = "EXTERNAL";
                }

                return {
                    tank_code: e.tank_code,
                    stock_date: e.stock_date,
                    harvest_date: e.event_date,
                    pl_stage: e.pl_stage,
                    qty_k: e.qty_k,
                    sr_reported_pct: e.sr_reported_pct,
                    lot_no: e.lot_no,
                    buyer: displayBuyer,
                    buyer_type: buyerType,
                    do_number: c.do_number,
                    external_buyer: c.external_buyer,
                    species: r.species || "VAN",
                    source_code: r.source_code || "—",
                    linked_ponds: Array.from(new Set(matchedPonds))
                };
            });
        } catch (err) {
            console.error("HatcheryRepository.getHarvestDispatches failed:", err);
            return [];
        }
    }

    /**
     * Retrieves all PL tank flush events (discards/terminations)
     * @param {number} limit
     * @returns {Promise<Array<object>>}
     */
    static async getFlushEvents(limit = 600) {
        try {
            const data = await supabase.request(`hatchery_run_events?event_type=eq.FLUSH&order=event_date.desc&limit=${limit}`);
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error("HatcheryRepository.getFlushEvents failed:", err);
            return [];
        }
    }

    /**
     * Retrieves all PL culture runs with traceability data
     * @returns {Promise<Array<object>>}
     */
    static async getAllTankRuns(limit = 1500) {
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
