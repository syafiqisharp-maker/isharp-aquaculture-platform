/**
 * iSHARP DBMS 2.0 — Pond Repository
 * Data Access Layer for growout_pond_master, view_growout_pond_cycles, and active_operational_ponds
 */

import { supabase } from "../supabase.js";
import { sanitizeIdlePrepDate } from "../../domain/rollover.js";

export class PondRepository {
    /**
     * Fetches pond cycles matching executive filters from the unified view.
     * @param {object} filters 
     * @param {string} [filters.status] e.g. "PRODUCTION", "IDLE", "CLOSE", or "ALL"
     * @param {string} [filters.module] e.g. "MODULE 1", "MODULE 2", or "ALL"
     * @param {string} [filters.active] e.g. "ACTIVE", "INACTIVE", or "ALL"
     * @returns {Promise<Array<object>>}
     */
    static async getCycles(filters = {}) {
        let queryParams = [
            "select=pond_index,pond,modl,row_no,cycle_no,crop_no,pond_status,pond_active,stck_date,date_close,aerator_1hp,aerator_2hp,area,stck_species,bs_line,stck_source,stck_size,stck_tank,stck_pcs,stck_allow,stck_total,batch_count,final_status,disease_status,date_disease",
            "order=pond_index.asc"
        ];

        const status = (filters.status || "ALL").toUpperCase();
        const moduleVal = filters.module || "ALL";
        const rawActive = (filters.active || "ALL").toUpperCase().replace(/\s+/g, "");

        if (status !== "ALL") {
            if (["PRODUCTION", "IDLE", "MAINTENANCE", "RESERVOIR", "PREPARATION", "NOT IN USE"].includes(status)) {
                queryParams.push(`pond_status=eq.${encodeURIComponent(status)}`);
            }
        } else {
            // When viewing all statuses in the operational explorer, exclude closed cycles
            queryParams.push("pond_status=neq.CLOSE");
        }
        if (moduleVal !== "ALL") {
            queryParams.push(`modl=eq.${encodeURIComponent(moduleVal)}`);
        }
        if (rawActive !== "ALL") {
            if (rawActive === "ACTIVE") {
                queryParams.push("pond_active=eq.ACTIVE");
            } else if (rawActive === "INACTIVE") {
                queryParams.push("pond_active=eq.INACTIVE");
            }
        }

        const endpoint = `view_growout_pond_cycles?${queryParams.join("&")}&limit=1000`;
        const records = await supabase.request(endpoint);

        // Normalize schema fields for consistent UI consumption
        return (records || []).map(r => {
            const isProd = (r.pond_status || "").toUpperCase() === "PRODUCTION";
            return {
                ...r,
                status: r.pond_status || "PRODUCTION",
                active: r.pond_active || "ACTIVE",
                module: r.modl || "MODULE 1",
                species: r.stck_species || (isProd ? "P. VANNAMEi" : "—"),
                genetic_line: r.bs_line || (isProd ? "Standard" : "—"),
                pl_origin: r.stck_source || (isProd ? "Hatchery" : "—"),
                stck_size: isProd ? r.stck_size : null,
                stck_tank: isProd ? r.stck_tank : null,
                stck_netto: isProd ? (r.stck_pcs || 0) : 0,
                stck_total: isProd ? (r.stck_total || (parseFloat(r.stck_pcs || 0) + parseFloat(r.stck_allow || 0))) : 0,
                batch_count: r.batch_count || 0
            };
        });
    }

    /**
     * Fetches all active non-closed pond cycles across all modules (PRODUCTION, IDLE, RESERVOIR, etc.)
     * @returns {Promise<Array<object>>}
     */
    static async getActiveCycles() {
        const endpoint = `view_growout_pond_cycles?pond_status=neq.CLOSE&order=pond_index.asc&limit=1000`;
        const records = await supabase.request(endpoint);
        return (records || []).map(r => {
            const isProd = (r.pond_status || "").toUpperCase() === "PRODUCTION";
            return {
                ...r,
                status: r.pond_status || "PRODUCTION",
                active: r.pond_active || "ACTIVE",
                module: r.modl || "MODULE 1",
                species: r.stck_species || (isProd ? "P. VANNAMEi" : "—"),
                genetic_line: r.bs_line || (isProd ? "Standard" : "—"),
                pl_origin: r.stck_source || (isProd ? "Hatchery" : "—"),
                stck_size: isProd ? r.stck_size : null,
                stck_tank: isProd ? r.stck_tank : null,
                stck_netto: isProd ? (r.stck_pcs || 0) : 0,
                stck_total: isProd ? (r.stck_total || (parseFloat(r.stck_pcs || 0) + parseFloat(r.stck_allow || 0))) : 0,
                batch_count: r.batch_count || 0
            };
        });
    }

    /**
     * Fetches complete details of a single pond cycle by pond_index.
     * @param {string} pondIndex 
     * @returns {Promise<object|null>}
     */
    static async getCycleDetails(pondIndex) {
        if (!pondIndex) return null;
        const endpoint = `view_growout_pond_cycles?select=*&pond_index=eq.${encodeURIComponent(pondIndex)}&limit=1`;
        const res = await supabase.request(endpoint);
        if (!res || res.length === 0) return null;
        const r = res[0];
        const isProd = (r.pond_status || "").toUpperCase() === "PRODUCTION";
        const isIdle = (r.pond_status || "").toUpperCase() === "IDLE";
        
        // Idle pond rule: if pond is IDLE, preparation dates must not reflect previous cycle events.
        // If event date occurred before date_cycle (or if date_cycle is absent for IDLE pond), show null/empty.
        const sanitizePrepDate = (dateVal) => sanitizeIdlePrepDate(dateVal, r.date_cycle, isIdle);

        return {
            ...r,
            status: r.pond_status || "PRODUCTION",
            active: r.pond_active || "ACTIVE",
            module: r.modl || "MODULE 1",
            species: r.stck_species || (isProd ? "P. VANNAMEi" : "—"),
            genetic_line: r.bs_line || (isProd ? "Standard" : "—"),
            pl_origin: r.stck_source || (isProd ? "Hatchery" : "—"),
            stck_netto: isProd ? (r.stck_pcs || 0) : 0,
            stck_size: isProd ? r.stck_size : null,
            stck_tank: isProd ? r.stck_tank : null,
            stck_allow: isProd ? (r.stck_allow || 0) : 0,
            stck_total: isProd ? (r.stck_total || (parseFloat(r.stck_pcs || 0) + parseFloat(r.stck_allow || 0))) : 0,
            date_cleaning: sanitizePrepDate(r.date_cleaning),
            date_repair: sanitizePrepDate(r.date_repair),
            date_filling: sanitizePrepDate(r.date_filling),
            date_culture: sanitizePrepDate(r.date_culture),
            date_baby_box: sanitizePrepDate(r.date_baby_box),
            date_babybox: sanitizePrepDate(r.date_baby_box || r.date_babybox),
            date_qaqc: sanitizePrepDate(r.date_qaqc),
            date_ready: sanitizePrepDate(r.date_ready),
            date_plan_stock: sanitizePrepDate(r.date_plan_stock),
            batch_count: r.batch_count || 0
        };
    }

    /**
     * Fetches individual stocking batch records for a cycle from pond_stocking_batches.
     * @param {string} pondIndex 
     * @returns {Promise<Array<object>>}
     */
    static async getStockingBatches(pondIndex) {
        if (!pondIndex) return [];
        const endpoint = `pond_stocking_batches?pond_index=eq.${encodeURIComponent(pondIndex)}&order=stck_date.asc,index_no.asc`;
        try {
            return await supabase.request(endpoint);
        } catch (err) {
            console.warn("Could not fetch stocking batches:", err);
            return [];
        }
    }

    /**
     * Fetches all historical cycles for a physical pond (e.g. "01.02.12").
     * @param {string} physicalPond 
     * @returns {Promise<Array<object>>}
     */
    static async getCycleHistory(physicalPond) {
        if (!physicalPond) return [];
        const endpoint = `view_growout_pond_cycles?select=pond_index,pond,crop_no,cycle_no,pond_status,pond_active,stck_date,date_close,area&pond=eq.${encodeURIComponent(physicalPond)}&order=pond_index.desc`;
        const records = await supabase.request(endpoint);
        return (records || []).map(r => ({
            ...r,
            status: r.pond_status || "PRODUCTION",
            active: r.pond_active || "ACTIVE"
        }));
    }

    /**
     * Updates cycle metadata in growout_pond_master and lifecycle event dates in pond_event_date.
     * @param {string} pondIndex 
     * @param {object} updates 
     * @returns {Promise<object>}
     */
    static async updateCycle(pondIndex, updates) {
        if (!pondIndex) throw new Error("pondIndex is required for update.");
        
        const dateFieldMap = {
            date_cycle: "cycle",
            date_cleaning: "cleaning",
            date_repair: "repair",
            date_filling: "filling",
            date_culture: "culture",
            date_baby_box: "baby_box",
            date_babybox: "baby_box",
            date_qaqc: "qaqc",
            date_ready: "ready",
            date_plan_stock: "plan_stock",
            date_disease: "disease",
            date_close: "close"
        };

        const masterUpdates = {};
        const datePromises = [];

        for (const [key, value] of Object.entries(updates)) {
            if (key in dateFieldMap) {
                const eventName = dateFieldMap[key];
                if (value) {
                    datePromises.push(
                        supabase.request("pond_event_date?on_conflict=pond_index,event_name", {
                            method: "POST",
                            headers: { "Prefer": "resolution=merge-duplicates" },
                            body: JSON.stringify([{
                                pond_index: pondIndex,
                                event_name: eventName,
                                event_date: value
                            }])
                        })
                    );
                } else {
                    datePromises.push(
                        supabase.request(`pond_event_date?pond_index=eq.${encodeURIComponent(pondIndex)}&event_name=eq.${encodeURIComponent(eventName)}`, {
                            method: "DELETE"
                        }).catch(() => {})
                    );
                }
            } else {
                masterUpdates[key] = value;
            }
        }

        const masterPromise = Object.keys(masterUpdates).length > 0
            ? supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}`, {
                method: "PATCH",
                body: JSON.stringify(masterUpdates)
            })
            : Promise.resolve(null);

        const [masterRes] = await Promise.all([masterPromise, ...datePromises]);
        return masterRes;
    }

    /**
     * Saves or updates a stocking batch in pond_stocking_batches (Single Source of Truth).
     * @param {string} pondIndex 
     * @param {object} batchData 
     * @returns {Promise<object>}
     */
    static async saveStockingBatch(pondIndex, batchData) {
        if (!pondIndex) throw new Error("pondIndex is required.");
        
        const existingBatches = await this.getStockingBatches(pondIndex);
        if (existingBatches && existingBatches.length > 0) {
            const primaryId = existingBatches[0].id;
            return await supabase.request(`pond_stocking_batches?id=eq.${encodeURIComponent(primaryId)}`, {
                method: "PATCH",
                body: JSON.stringify(batchData)
            });
        } else {
            return await supabase.request("pond_stocking_batches", {
                method: "POST",
                body: JSON.stringify({
                    pond_index: pondIndex,
                    ...batchData
                })
            });
        }
    }

    /**
     * Terminates a pond cycle with option to create next cycle or close only.
     * @param {string} pondIndex 
     * @param {string} [harvestDate] 
     * @param {string} [finalStatus] 
     * @param {boolean} [createNextCycle=true]
     * @returns {Promise<object>}
     */
    static async terminateCycle(pondIndex, harvestDate, finalStatus = "NORMAL HARVEST", createNextCycle = true) {
        if (!pondIndex) throw new Error("pondIndex is required for termination.");
        const dateStr = harvestDate || new Date().toISOString().split("T")[0];
        try {
            return await supabase.rpc("fn_terminate_cycle", {
                p_pond_index: pondIndex,
                p_harvest_date: dateStr,
                p_final_status: finalStatus,
                p_create_next_cycle: createNextCycle
            });
        } catch (rpcErr) {
            console.warn("RPC fn_terminate_cycle failed, executing client-side Phase 4 fallback:", rpcErr.message);
            // 1. Fetch current pond record
            const pondRes = await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}`);
            if (!pondRes || pondRes.length === 0) throw new Error(`Pond cycle ${pondIndex} not found.`);
            const curPond = pondRes[0];

            // 2. Close current cycle in growout_pond_master
            await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}`, {
                method: "PATCH",
                body: JSON.stringify({
                    pond_status: "CLOSE",
                    pond_active: "INACTIVE",
                    final_status: finalStatus || "NORMAL HARVEST"
                })
            });

            // 3. Save close date to pond_event_date
            await supabase.request("pond_event_date?on_conflict=pond_index,event_name", {
                method: "POST",
                headers: { "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify([{
                    pond_index: pondIndex,
                    event_name: "close",
                    event_date: dateStr
                }])
            }).catch(() => {});

            // 4. Remove from active operational ponds gatekeeper
            await supabase.request(`active_operational_ponds?pond_index=eq.${encodeURIComponent(pondIndex)}`, {
                method: "DELETE"
            }).catch(() => {});

            let action = "TERMINATE_ONLY";
            let nextPondIndex = null;

            if (createNextCycle) {
                const parts = pondIndex.split(".");
                const base = parts[0];
                const curCycle = parseInt(parts[1] || curPond.cycle_no || 0, 10);
                const nextCycle = curCycle + 1;
                nextPondIndex = `${base}.${nextCycle}`;

                // Check if next cycle already exists
                const existingNext = await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(nextPondIndex)}`);
                if (existingNext && existingNext.length > 0) {
                    action = "TERMINATE_EXISTING_NEXT";
                } else {
                    const nextRow = {
                        pond_index: nextPondIndex,
                        pond: curPond.pond,
                        farm: curPond.farm || "SETIU",
                        modl: curPond.modl,
                        row_no: curPond.row_no,
                        area: curPond.area,
                        pond_type: curPond.pond_type,
                        pond_usage: curPond.pond_usage,
                        crop_no: curPond.crop_no,
                        cycle_no: String(nextCycle),
                        pond_status: "IDLE",
                        pond_active: "INACTIVE",
                        culture_status: null,
                        strategy: curPond.strategy,
                        final_status: null,
                        disease_status: "NO ISSUES",
                        idle_days: 0,
                        idle_status: "NORMAL",
                        water_type: curPond.water_type
                    };

                    await supabase.request("growout_pond_master", {
                        method: "POST",
                        body: JSON.stringify(nextRow)
                    });

                    await supabase.request("pond_event_date?on_conflict=pond_index,event_name", {
                        method: "POST",
                        headers: { "Prefer": "resolution=merge-duplicates" },
                        body: JSON.stringify([{
                            pond_index: nextPondIndex,
                            event_name: "cycle",
                            event_date: dateStr
                        }])
                    }).catch(() => {});

                    action = "TERMINATE_AND_ROLLOVER";
                }
            }

            return {
                success: true,
                pond: curPond.pond,
                pond_index: pondIndex,
                new_pond_index: nextPondIndex,
                action: action
            };
        }
    }

    /**
     * Backward-compatible alias for executeRollover.
     */
    static async executeRollover(pondIndex, harvestDate, finalStatus = "NORMAL HARVEST") {
        return await this.terminateCycle(pondIndex, harvestDate, finalStatus, true);
    }

    /**
     * Reopens an accidentally closed cycle and optionally deletes the next cycle spawned during rollover.
     * @param {string} pondIndex 
     * @param {boolean} [deleteNextCycle=false]
     * @returns {Promise<{ success: boolean, revived_pond_index: string, next_pond_index: string, next_cycle_deleted: boolean, status: string }>}
     */
    static async reviveCycle(pondIndex, deleteNextCycle = false) {
        if (!pondIndex) throw new Error("pondIndex is required for revive.");
        try {
            return await supabase.rpc("fn_revive_cycle", {
                p_pond_index: pondIndex,
                p_delete_next_cycle: deleteNextCycle
            });
        } catch (rpcErr) {
            console.warn("RPC fn_revive_cycle failed, executing client-side Phase 4 fallback:", rpcErr.message);
            const pondRes = await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}`);
            if (!pondRes || pondRes.length === 0) throw new Error(`Pond cycle ${pondIndex} not found.`);
            const curPond = pondRes[0];

            // 1. Reopen current cycle in growout_pond_master
            await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}`, {
                method: "PATCH",
                body: JSON.stringify({
                    pond_status: "PRODUCTION",
                    pond_active: "ACTIVE",
                    final_status: null
                })
            });

            // 2. Remove close date
            await supabase.request(`pond_event_date?pond_index=eq.${encodeURIComponent(pondIndex)}&event_name=eq.close`, {
                method: "DELETE"
            }).catch(() => {});

            // 3. Restore in gatekeeper
            await supabase.request("active_operational_ponds?on_conflict=pond", {
                method: "POST",
                headers: { "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify([{
                    pond: curPond.pond,
                    pond_index: pondIndex
                }])
            }).catch(() => {});

            // 4. Optionally delete next cycle
            let nextCycleDeleted = false;
            const parts = pondIndex.split(".");
            const base = parts[0];
            const curCycle = parseInt(parts[1] || curPond.cycle_no || 0, 10);
            const nextPondIndex = `${base}.${curCycle + 1}`;

            if (deleteNextCycle) {
                const nextRes = await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(nextPondIndex)}&pond_status=eq.IDLE`);
                if (nextRes && nextRes.length > 0) {
                    await this.deleteIdleCycle(nextPondIndex).catch(() => {});
                    nextCycleDeleted = true;
                }
            }

            return {
                success: true,
                revived_pond_index: pondIndex,
                next_pond_index: nextPondIndex,
                next_cycle_deleted: nextCycleDeleted,
                status: "PRODUCTION"
            };
        }
    }

    /**
     * Creates a customized pond cycle with custom pond code and cycle number.
     * @param {object} params
     * @param {string} params.pond
     * @param {number} params.cycleNo
     * @param {number} [params.area=0.50]
     * @param {string} [params.status="IDLE"]
     * @param {string|null} [params.planStockDate=null]
     * @returns {Promise<object>}
     */
    static async createCustomCycle({ pond, cycleNo, area = 0.50, status = "IDLE", planStockDate = null }) {
        if (!pond) throw new Error("Pond code is required.");
        if (!cycleNo) throw new Error("Cycle number is required.");
        try {
            return await supabase.rpc("fn_create_custom_cycle", {
                p_pond: pond,
                p_cycle_no: parseInt(cycleNo, 10),
                p_area: parseFloat(area) || 0.50,
                p_status: status,
                p_plan_stock_date: planStockDate || null
            });
        } catch (rpcErr) {
            console.warn("RPC fn_create_custom_cycle failed, executing client-side Phase 4 fallback:", rpcErr.message);
            const cleanPond = String(pond).trim();
            const existingRes = await supabase.request(`growout_pond_master?pond=eq.${encodeURIComponent(cleanPond)}&limit=1`);
            const template = (existingRes && existingRes.length > 0) ? existingRes[0] : null;

            let baseIndex = template ? template.pond_index.split(".")[0] : null;
            if (!baseIndex) {
                baseIndex = "2" + cleanPond.replace(/[^0-9]/g, "");
            }
            const pondIndex = `${baseIndex}.${parseInt(cycleNo, 10)}`;

            const upperStatus = String(status).trim().toUpperCase();
            const masterRow = {
                pond_index: pondIndex,
                pond: cleanPond,
                farm: template?.farm || "SETIU",
                modl: template?.modl || "MODULE 01",
                row_no: template?.row_no || "ROW 01",
                area: parseFloat(area) || template?.area || 0.50,
                pond_type: template?.pond_type || "FULL LINING",
                pond_usage: template?.pond_usage || "COMMERCIAL",
                crop_no: template?.crop_no || String(new Date().getFullYear()),
                cycle_no: String(cycleNo),
                pond_status: upperStatus,
                pond_active: upperStatus === "PRODUCTION" ? "ACTIVE" : "INACTIVE",
                culture_status: upperStatus === "PRODUCTION" ? "NORMAL" : null,
                strategy: template?.strategy || "STANDARD",
                final_status: null,
                disease_status: "NO ISSUES",
                idle_days: 0,
                idle_status: upperStatus === "IDLE" ? "NORMAL" : null,
                water_type: template?.water_type || "FULL SEA WATER"
            };

            await supabase.request("growout_pond_master", {
                method: "POST",
                body: JSON.stringify(masterRow)
            });

            if (planStockDate) {
                await supabase.request("pond_event_date?on_conflict=pond_index,event_name", {
                    method: "POST",
                    headers: { "Prefer": "resolution=merge-duplicates" },
                    body: JSON.stringify([{
                        pond_index: pondIndex,
                        event_name: "plan_stock",
                        event_date: planStockDate
                    }])
                }).catch(() => {});
            }

            if (upperStatus === "PRODUCTION") {
                await supabase.request("active_operational_ponds?on_conflict=pond", {
                    method: "POST",
                    headers: { "Prefer": "resolution=merge-duplicates" },
                    body: JSON.stringify([{
                        pond: cleanPond,
                        pond_index: pondIndex
                    }])
                }).catch(() => {});
            }

            return {
                success: true,
                pond_index: pondIndex,
                status: upperStatus,
                message: `Cycle ${pondIndex} successfully initialized.`
            };
        }
    }

    /**
     * Safely deletes an empty/idle cycle.
     * @param {string} pondIndex 
     * @returns {Promise<object>}
     */
    static async deleteIdleCycle(pondIndex) {
        if (!pondIndex) throw new Error("pondIndex is required for deletion.");
        try {
            return await supabase.rpc("fn_delete_idle_cycle", {
                p_pond_index: pondIndex
            });
        } catch (rpcErr) {
            console.warn("RPC fn_delete_idle_cycle failed, executing client-side Phase 4 fallback:", rpcErr.message);
            const pondRes = await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}`);
            if (!pondRes || pondRes.length === 0) throw new Error(`Cycle ${pondIndex} not found.`);
            const p = pondRes[0];
            if (p.pond_status !== "IDLE") {
                throw new Error(`Cannot delete cycle ${pondIndex} with status ${p.pond_status} (only IDLE cycles can be removed).`);
            }

            // Cascade delete child config records
            await supabase.request(`pond_event_date?pond_index=eq.${encodeURIComponent(pondIndex)}`, { method: "DELETE" }).catch(() => {});
            await supabase.request(`pond_initiatives?pond_index=eq.${encodeURIComponent(pondIndex)}`, { method: "DELETE" }).catch(() => {});
            await supabase.request(`pond_aerator_inventory?pond_index=eq.${encodeURIComponent(pondIndex)}`, { method: "DELETE" }).catch(() => {});
            await supabase.request(`pond_inventories?pond_index=eq.${encodeURIComponent(pondIndex)}`, { method: "DELETE" }).catch(() => {});
            await supabase.request(`active_operational_ponds?pond_index=eq.${encodeURIComponent(pondIndex)}`, { method: "DELETE" }).catch(() => {});
            await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}`, { method: "DELETE" });

            return {
                success: true,
                pond_index: pondIndex,
                message: `Idle cycle ${pondIndex} safely deleted.`
            };
        }
    }

    /**
     * Fetches distinct physical pond codes across all cycles.
     * @returns {Promise<Array<{pond: string, modl: string, area: number}>>}
     */
    static async getDistinctPonds() {
        const endpoint = `growout_pond_master?select=pond,modl,area&order=pond.asc`;
        const data = await supabase.request(endpoint);
        const unique = new Map();
        (data || []).forEach(r => {
            if (r.pond && !unique.has(r.pond)) {
                unique.set(r.pond, {
                    pond: r.pond,
                    modl: r.modl || "",
                    area: parseFloat(r.area) || 0.50
                });
            }
        });
        return Array.from(unique.values());
    }

    /**
     * Fetches active operational ponds from the gatekeeper table.
     * @returns {Promise<Array<object>>}
     */
    static async getActiveOperationalPonds() {
        const endpoint = `active_operational_ponds?select=pond,pond_index&limit=500`;
        try {
            return await supabase.request(endpoint) || [];
        } catch (err) {
            console.warn("Could not fetch active operational ponds:", err);
            return [];
        }
    }
}


