/**
 * iSHARP DBMS 2.0 — Staff Repository
 * Data Access Layer for the Staff Master Directory (pond_staff)
 * and cycle-specific personnel allocations in growout_pond_master.
 */

import { supabase } from "../supabase.js";

export class StaffRepository {
    static _directoryCache = null;

    /**
     * Fetches all active personnel from the master staff directory.
     * Caches in memory for instant typing lookup.
     * @returns {Promise<Array<{ staff_no: string, staff_name: string, staff_position: string }>>}
     */
    static async getStaffDirectory() {
        if (this._directoryCache && this._directoryCache.length > 0) {
            return this._directoryCache;
        }

        try {
            const res = await supabase.request("pond_staff?select=staff_no,staff_name,staff_position,is_active&order=staff_name.asc");
            this._directoryCache = res || [];
            return this._directoryCache;
        } catch (err) {
            console.warn("Could not fetch staff directory from pond_staff:", err);
            return [];
        }
    }

    /**
     * Synchronous lookup of a staff member by ID number or Name from in-memory cache.
     * Supports:
     *  - Exact ID ("0042", "1638")
     *  - Unpadded ID ("42", "397")
     *  - Datalist formatted selection ("0042 - Bujang Slamat (Deputy Farm Manager)")
     *  - Full or partial staff name match
     * @param {string} query 
     * @returns {object|null}
     */
    static findStaffByNo(query) {
        return this.findStaff(query);
    }

    /**
     * Flexible lookup supporting ID (padded or unpadded) or Name
     * @param {string} query
     * @returns {object|null}
     */
    static findStaff(query) {
        if (!query || !this._directoryCache || this._directoryCache.length === 0) return null;
        const q = String(query).trim();
        if (!q) return null;

        // 1. If user selected from datalist or format like "0042 - Name..."
        const prefixIdMatch = q.match(/^(\d{1,6})\s*[-–:]/);
        if (prefixIdMatch) {
            const extractedId = prefixIdMatch[1].padStart(4, "0");
            const match = this._directoryCache.find(s => s.staff_no === extractedId);
            if (match) return match;
        }

        // 2. Numeric ID search (handles "42" -> "0042", exact "0042", "1638")
        if (/^\d+$/.test(q)) {
            const normalized = q.padStart(4, "0");
            const match = this._directoryCache.find(s => s.staff_no === q || s.staff_no === normalized);
            if (match) return match;
        }

        // 3. Exact staff_no match
        const exactIdMatch = this._directoryCache.find(s => s.staff_no.toLowerCase() === q.toLowerCase());
        if (exactIdMatch) return exactIdMatch;

        // 4. Exact staff_name match (case-insensitive)
        const exactNameMatch = this._directoryCache.find(s => s.staff_name.toLowerCase() === q.toLowerCase());
        if (exactNameMatch) return exactNameMatch;

        // 5. Partial name search: starts with or contains
        const cleanQuery = q.toLowerCase();
        const startsWithName = this._directoryCache.find(s => s.staff_name.toLowerCase().startsWith(cleanQuery));
        if (startsWithName) return startsWithName;

        const containsName = this._directoryCache.find(s => s.staff_name.toLowerCase().includes(cleanQuery));
        if (containsName) return containsName;

        return null;
    }

    /**
     * Normalizes a staff number input to a 4-digit zero-padded string or matched staff_no.
     * @param {string|number|null|undefined} rawVal
     * @returns {string|null}
     */
    static normalizeStaffNo(rawVal) {
        if (!rawVal) return null;
        const s = String(rawVal).trim();
        if (!s) return null;

        // Try directory lookup first if cache is populated
        const found = this.findStaff(s);
        if (found && found.staff_no) {
            return found.staff_no;
        }

        // Check if starts with digits before dash (datalist item: "0042 - Name")
        const prefixIdMatch = s.match(/^(\d{1,6})\s*[-–:]/);
        if (prefixIdMatch) {
            return prefixIdMatch[1].padStart(4, "0");
        }

        // Pure digits: pad to 4 digits
        if (/^\d+$/.test(s)) {
            return s.padStart(4, "0");
        }

        return s;
    }

    /**
     * Fetches current personnel assignments for a specific culture cycle (pond_index)
     * from growout_pond_master.
     * @param {string} pondIndex 
     * @returns {Promise<{ pm_staff_no: string, sv_staff_no: string, rl_staff_no: string, po_staff_no: string, support_staff_no: string }|null>}
     */
    static async getCycleStaff(pondIndex) {
        if (!pondIndex) return null;
        try {
            const res = await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}&select=pond_index,pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no`);
            return (res && res.length > 0) ? res[0] : null;
        } catch (err) {
            console.warn("Could not fetch cycle staff from growout_pond_master:", err);
            return null;
        }
    }

    /**
     * Saves personnel assignments for a specific culture cycle to growout_pond_master.
     * @param {string} pondIndex 
     * @param {object} assignments { pm_staff_no, sv_staff_no, rl_staff_no, po_staff_no, support_staff_no }
     * @returns {Promise<any>}
     */
    static async saveCycleStaff(pondIndex, assignments) {
        if (!pondIndex) throw new Error("Missing pond index for staff assignment.");

        const payload = {
            pm_staff_no: this.normalizeStaffNo(assignments.pm_staff_no),
            sv_staff_no: this.normalizeStaffNo(assignments.sv_staff_no),
            rl_staff_no: this.normalizeStaffNo(assignments.rl_staff_no),
            po_staff_no: this.normalizeStaffNo(assignments.po_staff_no),
            support_staff_no: this.normalizeStaffNo(assignments.support_staff_no)
        };

        return await supabase.request(`growout_pond_master?pond_index=eq.${encodeURIComponent(pondIndex)}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        });
    }

    /**
     * Fetches personnel assignments from the most recent prior cycle of the same pond.
     * Looks for prior cycles where at least one staff member was assigned.
     * @param {string} pondLabel e.g. "01.01.01"
     * @param {string} [excludePondIndex] Current cycle pond_index to exclude
     * @returns {Promise<object|null>}
     */
    static async getLastCycleStaff(pondLabel, excludePondIndex = null) {
        if (!pondLabel) return null;
        try {
            let filter = `pond=eq.${encodeURIComponent(pondLabel)}`;
            if (excludePondIndex) {
                filter += `&pond_index=neq.${encodeURIComponent(excludePondIndex)}`;
            }
            filter += `&order=date_cycle.desc.nullslast,cycle_no.desc.nullslast&limit=5`;
            filter += `&select=pond_index,pond,cycle_no,crop_no,date_cycle,pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no`;

            const rows = await supabase.request(`view_growout_pond_cycles?${filter}`);
            if (Array.isArray(rows) && rows.length > 0) {
                const found = rows.find(r =>
                    Boolean(r.pm_staff_no || r.sv_staff_no || r.rl_staff_no || r.po_staff_no || r.support_staff_no)
                );
                return found || null;
            }
            return null;
        } catch (err) {
            console.warn("Could not fetch last cycle staff from view_growout_pond_cycles:", err);
            return null;
        }
    }
}
