/**
 * iSHARP DBMS 2.0 — Centralized DOM Element Contracts
 * Defines and validates all DOM IDs across the application to prevent silent runtime errors.
 */

export const DOM_IDS = Object.freeze({
    // Navigation & Command Bar
    NAV: {
        SELECT_POND: "select-pond-index",
        BTN_PREV: "btn-prev-pond",
        BTN_NEXT: "btn-next-pond",
        BTN_REFRESH: "btn-refresh-master",
        BTN_EXCEL: "btn-open-excel-modal",
        SELECT_ROLE: "select-user-role",
        CYCLE_HISTORY: "select-cycle-history",
        SEARCH_INPUT: "input-pond-search",
        SIDEBAR_SEARCH: "sidebar-pond-search"
    },

    // Master KPI Banner / Command OS Header Pills
    BANNER: {
        BADGE_POND_INDEX: "badge-pond-index",
        BADGE_POND_LABEL: "badge-pond-label",
        BADGE_POND_STATUS: "badge-pond-status",
        BADGE_POND_ACTIVE: "badge-pond-active",
        BADGE_SPECIES: "badge-species",
        BADGE_GENETIC: "badge-genetic",
        BADGE_DOC: "badge-doc",
        BADGE_DISEASE_STATUS: "badge-disease-status",
        BADGE_TOTAL_HP: "badge-total-hp"
    },

    // Sidebar & Tree Navigator
    SIDEBAR: {
        CONTAINER: "command-sidebar",
        TREE_ROOT: "sidebar-pond-tree",
        TOGGLE_BTN: "btn-toggle-sidebar",
        TOGGLE_ALL_BTN: "btn-toggle-all-modules",
        TOGGLE_ALL_LABEL: "label-toggle-all-modules",
        COUNT_BADGE: "sidebar-pond-count",
        RESET_FILTERS: "btn-reset-filters",
        FILTER_STATUS: "filter-pond-status",
        FILTER_MODULE: "filter-pond-module",
        FILTER_ACTIVE: "filter-pond-active"
    },

    // Tab 1: Master
    MASTER: {
        INPUT_DATE_CYCLE: "input-date-cycle",
        INPUT_DATE_CLEANING: "input-date-cleaning",
        INPUT_DATE_REPAIR: "input-date-repair",
        INPUT_DATE_FILLING: "input-date-filling",
        INPUT_DATE_CULTURE: "input-date-culture",
        INPUT_DATE_BABYBOX: "input-date-babybox",
        INPUT_DATE_QAQC: "input-date-qaqc",
        INPUT_DATE_READY: "input-date-ready",
        INPUT_DATE_PLAN_STOCK: "input-date-plan-stock",
        INPUT_IDLE_DAYS: "input-idle-days",
        INPUT_IDLE_STATUS: "input-idle-status",
        INPUT_WATER_TYPE: "input-water-type",
        AERATOR_1HP: "aerator-1hp-units",
        AERATOR_2HP: "aerator-2hp-units",
        AERATOR_4HP: "aerator-4hp-units",
        SUMMARY_ACTIVE_HP: "summary-total-active-hp",
        BTN_SAVE_MASTER: "btn-save-master",
        BTN_SAVE_AERATORS: "btn-save-aerators",
        SNAP_SPECIES: "snap-species-line",
        SNAP_SPECIES_FOOT: "snap-species-foot",
        SNAP_HATCHERY_SOURCE: "snap-hatchery-source",
        SNAP_HATCHERY_FOOT: "snap-hatchery-foot",
        SNAP_DOC: "snap-doc-val",
        SNAP_DOC_FOOT: "snap-doc-foot",
        SNAP_LATEST_ABW: "snap-latest-abw",
        SNAP_ABW_FOOT: "snap-abw-foot",
        SNAP_FCR: "snap-fcr-val",
        SNAP_FCR_FOOT: "snap-fcr-foot",
        SNAP_BIOMASS_HARVEST: "snap-biomass-harvest-val",
        SNAP_BIOMASS_HARVEST_TITLE: "snap-biomass-harvest-title",
        SNAP_BIOMASS_HARVEST_FOOT: "snap-biomass-harvest-foot",
        SNAP_DISEASE_STATUS: "snap-disease-status-val",
        SNAP_DISEASE_STATUS_FOOT: "snap-disease-status-foot",
        SNAP_INITIATIVE: "snap-initiative-val",
        SNAP_INITIATIVE_FOOT: "snap-initiative-foot",
        SNAP_STOCKED_PCS: "snap-stocked-pcs",
        SNAP_STOCKED_FOOT: "snap-stocked-foot",
        SNAP_TOTAL_FEED: "snap-total-feed",
        SNAP_FEED_FOOT: "snap-feed-foot",
        SNAP_TOTAL_HARVEST: "snap-total-harvest",
        SNAP_HARVEST_FOOT: "snap-harvest-foot",
        SNAP_CYCLE_STATUS: "snap-cycle-status"
    },

    // Tab 2: Laboratory
    LABORATORY: {
        TAB_PANE: "tab-laboratory",
        TBODY_ISSUES: "tbody-issues",
        BTN_ADD_LAB: "btn-add-lab-record"
    },

    // Tab 3: Stocking
    STOCKING: {
        TAB_PANE: "tab-stocking",
        STCK_DATE: "input-stck-date",
        STCK_SOURCE: "input-stck-source",
        STCK_SPECIES: "input-stck-species",
        STCK_NETTO: "input-stck-netto",
        STCK_ALLOW: "input-stck-allow",
        STCK_GROSS: "input-stck-gross",
        STCK_LINE: "input-stck-line",
        STCK_SIZE: "input-stck-size",
        STCK_TANK: "input-stck-tank",
        TBODY_BATCHES: "tbody-stocking-batches",
        BTN_SAVE: "btn-save-stocking"
    },

    // Tab 4: Feeding
    FEEDING: {
        TAB_PANE: "tab-feeding",
        TBODY_FEED: "tbody-feed",
        SNAP_TOTAL_FEED: "snap-total-feed"
    },

    // Tab 5: Sampling
    SAMPLING: {
        TAB_PANE: "tab-sampling",
        TBODY_SAMPLING: "tbody-sampling",
        SNAP_LATEST_ABW: "snap-latest-abw",
        BTN_EXCEL_TAB: "btn-excel-sampling-tab"
    },

    // Tab 6: Performance
    PERFORMANCE: {
        TAB_PANE: "tab-performance",
        CANVAS: "growthChart",
        KPI_ADG: "kpi-adg",
        KPI_ADG_SUB: "kpi-adg-sub",
        KPI_FCR: "kpi-fcr",
        KPI_FCR_SUB: "kpi-fcr-sub",
        KPI_BIOMASS: "kpi-biomass",
        KPI_BIOMASS_SUB: "kpi-biomass-sub",
        KPI_PROJ_DOC: "kpi-proj-doc",
        KPI_PROJ_DOC_SUB: "kpi-proj-doc-sub"
    },

    // Tab 7: Harvest
    HARVEST: {
        TAB_PANE: "tab-harvest",
        TBODY_HARVEST: "tbody-harvest",
        TBODY_SALES: "tbody-harvest-sales",
        TOTAL_WEIGHT: "stat-harvest-weight",
        TOTAL_REVENUE: "stat-harvest-revenue",
        MEAN_ABW: "stat-harvest-abw",
        BTN_ADD_HARVEST: "btn-add-harvest-event"
    },

    // Tab 8: Lifecycle & Modals
    LIFECYCLE: {
        TAB_PANE: "tab-lifecycle",
        CURRENT_INDEX: "lifecycle-current-index",
        CURRENT_POND: "lifecycle-current-pond",
        STATUS_BADGE: "lifecycle-status-badge",
        ACTIVE_BADGE: "lifecycle-active-badge",
        DOC_VAL: "lifecycle-doc-val",
        STOCK_DATE: "lifecycle-stock-date",
        CLOSE_DATE: "lifecycle-close-date",
        AREA_VAL: "lifecycle-area-val",
        BTN_TERMINATE_ROLLOVER: "btn-lifecycle-terminate-rollover",
        BTN_TERMINATE_ONLY: "btn-lifecycle-terminate-only",
        BTN_REVIVE_ACTION: "btn-lifecycle-revive-action",
        CALLOUT_TITLE: "lifecycle-callout-title",
        CALLOUT_DESC: "lifecycle-callout-desc",
        MODAL_TERMINATE: "modal-terminate-options",
        MODAL_REVIVE: "modal-revive-cycle",
        TERMINATE_POND_INDEX: "terminate-modal-pond-index",
        TERMINATE_DATE_INPUT: "terminate-date-input",
        TERMINATE_STATUS_SELECT: "terminate-status-select",
        RADIO_ROLLOVER_YES: "radio-rollover-yes",
        RADIO_ROLLOVER_NO: "radio-rollover-no",
        BTN_CONFIRM_TERMINATE: "btn-confirm-terminate-execution",
        BTN_CANCEL_TERMINATE: "btn-cancel-terminate-modal",
        BTN_CLOSE_TERMINATE_ICON: "btn-close-terminate-icon",
        REVIVE_POND_INDEX: "revive-modal-pond-index",
        REVIVE_POND_NAME: "revive-modal-pond-name",
        REVIVE_CYCLE_CODE: "revive-modal-cycle-code",
        REVIVE_NEXT_CYCLE: "revive-modal-next-cycle",
        BTN_CONFIRM_REVIVE_DELETE: "btn-confirm-revive-delete",
        BTN_CONFIRM_REVIVE_KEEP: "btn-confirm-revive-keep",
        BTN_CLOSE_REVIVE_MODAL: "btn-close-revive-modal",
        BTN_CLOSE_REVIVE_MODAL_ICON: "btn-close-revive-modal-icon",
        SELECT_CREATE_POND: "select-create-pond",
        INPUT_CUSTOM_POND: "input-create-custom-pond",
        WRAP_CUSTOM_POND: "wrap-create-custom-pond",
        INPUT_CYCLE_NO: "input-create-cycle-no",
        HINT_CYCLE_SUGGESTION: "hint-create-cycle-suggestion",
        SELECT_CREATE_STATUS: "select-create-status",
        INPUT_CREATE_AREA: "input-create-area",
        INPUT_CREATE_STOCK_DATE: "input-create-stock-date",
        BTN_SUBMIT_CREATE_CYCLE: "btn-submit-create-cycle",
        TABLE_REGISTRY: "table-cycle-registry",
        TBODY_REGISTRY: "tbody-cycle-registry",
        REGISTRY_POND_TITLE: "registry-pond-title"
    },

    // Tab 9: Staff & Remarks
    STAFF: {
        TAB_PANE: "tab-staff",
        CYCLE_BADGE: "staff-cycle-badge",
        DATALIST: "staff-directory-datalist",
        INPUT_PM_ID: "input-pm-id",
        INPUT_PM_NAME: "input-pm-name",
        INPUT_SV_ID: "input-sv-id",
        INPUT_SV_NAME: "input-sv-name",
        INPUT_RL_ID: "input-rl-id",
        INPUT_RL_NAME: "input-rl-name",
        INPUT_PO_ID: "input-po-id",
        INPUT_PO_NAME: "input-po-name",
        INPUT_SUPPORT_ID: "input-support-id",
        INPUT_SUPPORT_NAME: "input-support-name",
        BTN_SAVE: "btn-save-staff",
        BTN_RESET: "btn-reset-staff",
        INPUT_INITIATIVE: "input-initiative",
        INPUT_INITIATIVE1: "input-initiative1",
        INPUT_INITIATIVE2: "input-initiative2",
        BTN_SAVE_INITIATIVE: "btn-save-initiatives",
        NOTES_CONTAINER: "notes-feed-container",
        TEXTAREA_NOTES: "textarea-notes"
    },

    // Tab 10: Utilities
    UTILITIES: {
        TAB_PANE: "tab-utilities"
    },

    // Universal Excel Modal
    EXCEL_MODAL: {
        MODAL: "modal-excel-paste",
        CATEGORY_SELECT: "excel-target-category",
        TEXTAREA: "excel-paste-textarea",
        PARSED_COUNT: "excel-parsed-count",
        THEAD: "thead-excel-preview",
        TBODY: "tbody-excel-preview",
        BTN_COMMIT: "btn-commit-excel",
        BTN_CLOSE: "btn-close-excel-modal",
        BTN_CLOSE_ICON: "btn-modal-close-icon"
    }
});

/**
 * Diagnostic helper to verify whether required DOM elements exist.
 * Logs a helpful, readable warning if any element is absent.
 * @param {string} componentName 
 * @param {object} contractGroup 
 * @returns {boolean} True if all contract elements exist
 */
export function validateContract(componentName, contractGroup) {
    let allValid = true;
    for (const [key, id] of Object.entries(contractGroup)) {
        if (!document.getElementById(id)) {
            console.warn(`[DOM Contract Warning] ${componentName}: Missing expected DOM element #${id} (${key})`);
            allValid = false;
        }
    }
    return allValid;
}
