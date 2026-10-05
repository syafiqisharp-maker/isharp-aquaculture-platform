/**
 * iSHARP DBMS 2.0 — DBMS Full Shell Template
 * Assembles Command Sidebar, Top Command Bar, 10 Tab Panes, and Universal Modals.
 */

import { getMasterTabHtml } from "./masterTabTemplate.js";
import { getLaboratoryTabHtml } from "./laboratoryTabTemplate.js";
import { getStockingTabHtml } from "./stockingTabTemplate.js";
import { getFeedingTabHtml } from "./feedingTabTemplate.js";
import { getSamplingTabHtml } from "./samplingTabTemplate.js";
import { getPerformanceTabHtml } from "./performanceTabTemplate.js";
import { getHarvestTabHtml } from "./harvestTabTemplate.js";
import { getLifecycleTabHtml } from "./lifecycleTabTemplate.js";
import { getStaffTabHtml } from "./staffTabTemplate.js";
import { getUtilitiesTabHtml } from "./utilitiesTabTemplate.js";
import { getModalsHtml } from "./modalsTemplate.js";

export function getDbmsShellHtml() {
    return `
    <!-- App Container: Concept A Command OS Layout -->
    <div class="command-os-layout" id="app-shell">
        
        <!-- ================================================================
             1. LEFT COMMAND SIDEBAR (Collapsible Navigator)
             ================================================================ -->
        <aside class="command-sidebar" id="command-sidebar" role="navigation">
            <!-- Top Brand Badge & Collapse Toggle -->
            <div class="sidebar-brand-block">
                <a class="brand-capsule-row" data-nav-view="portal" title="Return to Portal Landing">
                    <div class="brand-logo-glass">
                        <img src="/assets/blue-archipelago-logo.png" alt="Blue Archipelago" onerror="this.onerror=null; this.src='https://www.bluearchipelago.com/wp-content/uploads/2022/06/blue-archipelago-logo-color.png';">
                    </div>
                    <div class="brand-titles-col">
                        <div class="brand-title-wrap">
                            <span class="title">iSHARP</span>
                            <span class="badge-v2">DBMS 2.0</span>
                        </div>
                        <span class="brand-subline">Setiu Farm (SETiU)</span>
                    </div>
                </a>
                <button id="btn-toggle-sidebar" class="btn-sidebar-collapse" title="Collapse / Expand Sidebar (Toggle Compact Rail)">
                    ☰
                </button>
            </div>

            <!-- Scrollable Body: Filters, Pond Tree, and 10 Workstreams -->
            <div class="sidebar-scroll-body">
                
                <!-- Section A: Search & Farm Filters -->
                <div class="sidebar-filters-panel">
                    <div class="sidebar-search-wrap">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" id="sidebar-pond-search" class="sidebar-search-input" placeholder="Filter ponds in tree..." />
                    </div>
                    <div class="sidebar-filter-row">
                        <select id="filter-pond-status" class="sidebar-filter-select" title="Filter by Culture Status">
                            <option value="ALL">All Statuses</option>
                            <option value="PRODUCTION" selected>PRODUCTION</option>
                            <option value="iDLE">IDLE</option>
                            <option value="CLOSE">CLOSE</option>
                            <option value="MAINTENANCE">MAINTENANCE</option>
                            <option value="RESERVOIR">RESERVOIR</option>
                            <option value="PREPARATION">PREPARATION</option>
                        </select>
                        <select id="filter-pond-module" class="sidebar-filter-select" title="Filter by Module">
                            <option value="ALL">All Mod</option>
                            <option value="01">Mod 01</option>
                            <option value="02">Mod 02</option>
                            <option value="03">Mod 03</option>
                            <option value="04">Mod 04</option>
                            <option value="05">Mod 05</option>
                            <option value="06">Mod 06</option>
                            <option value="07">Mod 07</option>
                            <option value="08">Mod 08</option>
                            <option value="09">Mod 09</option>
                            <option value="10">Mod 10</option>
                            <option value="11">Mod 11</option>
                        </select>
                    </div>
                    <div class="sidebar-filter-row">
                        <select id="filter-pond-active" class="sidebar-filter-select" title="Filter Active / Archived">
                            <option value="ALL">All States</option>
                            <option value="ACTiVE" selected>Active Only</option>
                            <option value="iN ACTiVE">Archived</option>
                        </select>
                        <button id="btn-reset-filters" class="btn-filter-reset" title="Reset all filters" style="padding: 2px 6px; font-size: 0.68rem; border-radius: 6px;">
                            <span>Reset</span>
                        </button>
                        <span id="filtered-count-badge" class="filter-count-badge" style="display:none;"></span>
                    </div>
                </div>

                <!-- Section B: Spatial Pond Tree Navigator -->
                <div>
                    <div class="sidebar-section-title">
                        <span>Pond Explorer</span>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span id="sidebar-pond-count">Loading...</span>
                            <button id="btn-toggle-all-modules" class="btn-micro-toggle" title="Collapse or Expand all modules in Pond Explorer" type="button">
                                <span id="label-toggle-all-modules">⊟ Collapse</span>
                            </button>
                        </div>
                    </div>
                    <div class="pond-explorer-box" id="sidebar-pond-tree">
                        <div style="padding: 1rem 0.5rem; text-align: center; color: #94a3b8; font-size: 0.75rem;">
                            Loading pond tree...
                        </div>
                    </div>
                </div>

                <!-- Section C: 10 Operational Modules -->
                <div>
                    <div class="sidebar-section-title">Logs &amp; Records</div>
                    <div class="nav-category" role="tablist">
                        <button class="tab-btn active" data-tab="tab-master" role="tab" id="btn-tab-master" title="Master Cycle &amp; Prep">
                            <span class="tab-icon">📊</span>
                            <span class="tab-label">Master Cycle</span>
                        </button>
                        <button class="tab-btn" data-tab="tab-laboratory" role="tab" id="btn-tab-laboratory" title="Biosecurity &amp; Pathology">
                            <span class="tab-icon">🔬</span>
                            <span class="tab-label">Laboratory</span>
                        </button>
                        <button class="tab-btn" data-tab="tab-stocking" role="tab" id="btn-tab-stocking" title="Stocking &amp; Hatchery Batches">
                            <span class="tab-icon">🦐</span>
                            <span class="tab-label">Stocking</span>
                        </button>
                        <button class="tab-btn" data-tab="tab-feeding" role="tab" id="btn-tab-feeding" title="Daily Feeding &amp; Tray Checks">
                            <span class="tab-icon">🌾</span>
                            <span class="tab-label">Feeding</span>
                        </button>
                        <button class="tab-btn" data-tab="tab-sampling" role="tab" id="btn-tab-sampling" title="Weekly Biometrics &amp; Sampling">
                            <span class="tab-icon">⚖️</span>
                            <span class="tab-label">Sampling</span>
                        </button>
                        <button class="tab-btn" data-tab="tab-performance" role="tab" id="btn-tab-performance" title="Performance Curves &amp; FCR">
                            <span class="tab-icon">📈</span>
                            <span class="tab-label">Performance</span>
                        </button>
                        <button class="tab-btn" data-tab="tab-harvest" role="tab" id="btn-tab-harvest" title="Partial &amp; Final Harvest Log">
                            <span class="tab-icon">🚜</span>
                            <span class="tab-label">Harvest</span>
                        </button>
                        <button class="tab-btn" data-tab="tab-lifecycle" role="tab" id="btn-tab-lifecycle" title="Pond Rollover &amp; Cycle Transition">
                            <span class="tab-icon">🔄</span>
                            <span class="tab-label">Lifecycle</span>
                        </button>
                        <button class="tab-btn" data-tab="tab-staff" role="tab" id="btn-tab-staff" title="Staff Allocation &amp; Field Notes">
                            <span class="tab-icon">👔</span>
                            <span class="tab-label">Staff &amp; Remarks</span>
                        </button>
                        <button class="tab-btn" data-tab="tab-utilities" role="tab" id="btn-tab-utilities" title="Power &amp; Water Utilities">
                            <span class="tab-icon">⚙️</span>
                            <span class="tab-label">Utilities</span>
                        </button>
                    </div>
                </div>

            </div>

            <!-- Sidebar Footer: Role Frame & Quick Portal Switchers -->
            <div class="sidebar-footer">
                <div class="role-pill-frame">
                    <span style="font-size: 0.8rem; margin-right: 0.3rem;">👑</span>
                    <select id="select-user-role" class="role-select-sidebar" aria-label="Select User Role">
                        <option value="PLANNER">Planner (100% Edit)</option>
                        <option value="SUPERVISOR">Supervisor (Inventory)</option>
                        <option value="LAB_TECH">Lab Tech (Lab Only)</option>
                        <option value="VIEWER">Viewer (Read Only)</option>
                    </select>
                </div>
                <div class="portal-switch-cluster">
                    <button id="btn-back-to-portal-dbms" class="btn-portal-micro" type="button" data-nav-view="portal" title="Return to Portal Landing Page">
                        <span>◂</span>
                        <span>Portal</span>
                    </button>
                    <button id="btn-to-executive-map" class="btn-portal-micro" type="button" data-nav-view="executive" title="Switch to Executive 216-Pond Farm Map">
                        <span>🗺️</span>
                        <span>216-Map</span>
                    </button>
                    <button id="btn-to-field-ops" class="btn-portal-micro" type="button" data-nav-view="field-ops" title="Switch to Supervisor Field Operations">
                        <span>💧</span>
                        <span>Field Ops</span>
                    </button>
                </div>
            </div>
        </aside>

        <!-- ================================================================
             2. MAIN COMMAND STAGE (Full Viewport Workspace)
             ================================================================ -->
        <main class="main-stage">
            
            <!-- Ultra-Slim Top Command Bar (48px) -->
            <header class="command-bar">
                <!-- Left: Breadcrumb & Pond Status -->
                <div class="command-bar-left">
                    <div class="breadcrumb-trail">
                        <span>Setiu</span>
                        <span>/</span>
                        <span class="current-pond" id="badge-pond-label">Pond —</span>
                        <span id="badge-pond-index" style="font-size:0.75rem; color:#64748b; font-family:var(--font-mono);">—</span>
                    </div>
                    <span id="badge-pond-status" class="status-pill status-production" style="font-size:0.68rem; padding:2px 8px;">PRODUCTION</span>
                    <span id="badge-pond-active" class="active-pill active-yes" style="font-size:0.65rem; padding:2px 6px;">ACTIVE</span>
                </div>

                <!-- Center: Spotlight Search & Pond Stepper -->
                <div class="command-bar-center">
                    <div class="spotlight-search-pill" title="Press Ctrl + K to jump to any pond">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" id="input-pond-search" class="pond-search-input" placeholder="Jump to pond #..." />
                        <kbd>Ctrl K</kbd>
                    </div>
                    <div class="pond-dropdown-capsule">
                        <select id="select-pond-index" class="pond-master-dropdown" aria-label="Select Pond Cycle">
                            <option value="" disabled selected>Loading...</option>
                        </select>
                    </div>
                    <button id="btn-prev-pond" class="btn-nav-step" title="Previous Pond (Ctrl + Left)">‹</button>
                    <button id="btn-next-pond" class="btn-nav-step" title="Next Pond (Ctrl + Right)">›</button>
                    <button id="btn-refresh-master" class="btn-icon" style="width:26px; height:26px;" title="Refresh all data from cloud">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"/>
                        </svg>
                    </button>
                    <div style="display:flex; align-items:center;">
                        <select id="select-cycle-history" class="cycle-history-dropdown" title="Historical Cycles for this Pond" style="font-size:0.72rem; padding:2px 6px; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff;">
                            <option value="">Loading cycles...</option>
                        </select>
                    </div>
                </div>

                <!-- Right: Quick Telemetry Chips & Actions -->
                <div class="command-bar-right">
                    <span class="doc-box" style="font-size:0.75rem; padding:2px 8px;">DOC <span id="badge-doc">0</span></span>
                    <div class="disease-block" title="Click to view Biosecurity & Disease Pathology Logbook" style="cursor:pointer;">
                        <span id="badge-disease-status" class="disease-pill disease-ok" style="font-size:0.7rem; padding:2px 8px;">Pathogen Negative</span>
                    </div>
                    <button id="btn-open-excel-modal" class="btn-action btn-excel" style="padding:0.3rem 0.75rem; font-size:0.75rem;" title="Paste Excel Data">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>Paste Excel</span>
                    </button>
                </div>
            </header>

            <!-- Workspace Canvas Area: Contains all 10 Tab Panes -->
            <div class="workspace-canvas">
                <main class="master-tab-content">
                    ${getMasterTabHtml()}
                    ${getLaboratoryTabHtml()}
                    ${getStockingTabHtml()}
                    ${getFeedingTabHtml()}
                    ${getSamplingTabHtml()}
                    ${getPerformanceTabHtml()}
                    ${getHarvestTabHtml()}
                    ${getLifecycleTabHtml()}
                    ${getStaffTabHtml()}
                    ${getUtilitiesTabHtml()}
                </main>
            </div>
        </main>
    </div>

    ${getModalsHtml()}
    `;
}
