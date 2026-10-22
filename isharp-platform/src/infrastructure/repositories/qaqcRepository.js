/**
 * iSHARP DBMS 2.0 — QA/QC Inspection Repository
 * Data Access Layer for QA/QC inspections and pond turnaround events
 */

import { supabase } from "../supabase.js";
import { PondRepository } from "./pondRepository.js";

const LOCAL_STORAGE_KEY = "isharp_qaqc_cleaning_inspections";

export class QaqcRepository {
    /**
     * Retrieves all candidate non-production pond cycles across the farm
     * (Filters out ponds currently in PRODUCTION)
     * @returns {Promise<Array<object>>}
     */
    static async getCandidateCleaningPonds() {
        try {
            const cycles = await PondRepository.getActiveCycles();
            if (!Array.isArray(cycles)) return [];
            return cycles.filter(c => {
                const s = (c.pond_status || "").toUpperCase();
                return s !== "PRODUCTION";
            });
        } catch (err) {
            console.error("QaqcRepository: Failed to load candidate ponds:", err);
            return [];
        }
    }

    /**
     * Saves a cleaning inspection record to the cloud and updates pond_event_date
     * @param {Object} record 
     * @returns {Promise<{ success: boolean, record: Object, source: string }>}
     */
    static async saveCleaningInspection(record) {
        if (!record.pond_index || !record.inspection_date) {
            throw new Error("Pond Index and Inspection Date are required.");
        }

        const payload = {
            pond_index: record.pond_index,
            pond: record.pond,
            inspection_type: "POND_CLEANING",
            inspection_date: record.inspection_date,
            inspector_staff_no: record.inspector_staff_no || null,
            inspector_name: record.inspector_name || "Rosdi",
            team: record.team || "Int 2",
            status: record.status || "PASSED",
            remarks: record.remarks || "",
            checklist_data: record.checklist_data || {},
            whatsapp_text: record.whatsapp_text || "",
            created_at: new Date().toISOString()
        };

        let savedCloud = false;

        // 1. Try persisting to Supabase
        try {
            const res = await supabase.request("qaqc_inspections", {
                method: "POST",
                headers: { "Prefer": "return=representation" },
                body: JSON.stringify([payload])
            });
            if (res && res.length > 0) {
                savedCloud = true;
            }
        } catch (cloudErr) {
            console.warn("QaqcRepository: Cloud table qaqc_inspections save fallback to local:", cloudErr.message);
        }

        // 2. If PASSED, also update cleaning event date in pond_event_date
        if (record.status === "PASSED" && record.inspection_date) {
            try {
                await supabase.request("pond_event_date?on_conflict=pond_index,event_name", {
                    method: "POST",
                    headers: { "Prefer": "resolution=merge-duplicates" },
                    body: JSON.stringify([{
                        pond_index: record.pond_index,
                        event_name: "cleaning",
                        event_date: record.inspection_date
                    }])
                });
            } catch (eventErr) {
                console.warn("QaqcRepository: Could not update pond_event_date:", eventErr.message);
            }
        }

        // 3. Always mirror to local cache for 0ms retrieval and offline resilience
        this._saveToLocalCache(payload);

        return {
            success: true,
            record: payload,
            source: savedCloud ? "cloud" : "local"
        };
    }

    /**
     * Retrieves cleaning inspection history for a specific pond
     * @param {string} pondIndex 
     * @returns {Promise<Array<object>>}
     */
    static async getCleaningHistory(pondIndex) {
        if (!pondIndex) return [];
        let cloudRecords = [];
        try {
            const endpoint = `qaqc_inspections?pond_index=eq.${encodeURIComponent(pondIndex)}&inspection_type=eq.POND_CLEANING&order=inspection_date.desc&limit=20`;
            cloudRecords = await supabase.request(endpoint);
        } catch (err) {
            // Table might not exist yet before migration
        }

        if (Array.isArray(cloudRecords) && cloudRecords.length > 0) {
            return cloudRecords;
        }

        // Local cache fallback
        const local = this._getLocalCache();
        return local
            .filter(r => r.pond_index === pondIndex && r.inspection_type === "POND_CLEANING")
            .sort((a, b) => new Date(b.inspection_date) - new Date(a.inspection_date));
    }

    /**
     * Retrieves recent cleaning inspections across all farm ponds
     * @param {number} limit 
     * @returns {Promise<Array<object>>}
     */
    static async getRecentFarmInspections(limit = 20) {
        let cloudRecords = [];
        try {
            const endpoint = `qaqc_inspections?inspection_type=eq.POND_CLEANING&order=inspection_date.desc&limit=${limit}`;
            cloudRecords = await supabase.request(endpoint);
        } catch (err) {
            // Table might not exist yet
        }

        if (Array.isArray(cloudRecords) && cloudRecords.length > 0) {
            return cloudRecords;
        }

        const local = this._getLocalCache();
        return local
            .filter(r => r.inspection_type === "POND_CLEANING")
            .sort((a, b) => new Date(b.created_at || b.inspection_date) - new Date(a.created_at || a.inspection_date))
            .slice(0, limit);
    }

    // ── Local Storage Helpers ───────────────────────────────────────────────

    static _getLocalCache() {
        if (typeof window === "undefined" || !window.localStorage) return [];
        try {
            const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    static _saveToLocalCache(record) {
        if (typeof window === "undefined" || !window.localStorage) return;
        try {
            const current = this._getLocalCache();
            // Prepend new record
            current.unshift(record);
            // Cap at 200 records
            const capped = current.slice(0, 200);
            window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(capped));
        } catch (e) {
            console.warn("Failed to write to local cache:", e);
        }
    }
}
