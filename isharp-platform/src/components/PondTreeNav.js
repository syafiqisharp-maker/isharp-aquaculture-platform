/**
 * iSHARP DBMS 2.0 — Pond Tree Navigator Component
 * Spatial hierarchical explorer for Left Command Sidebar.
 * Displays modules, pond status dots, DOC badges, and handles single-click pond switching.
 */

import { appState } from "../state/appState.js";
import { calculateDOC } from "../domain/biometrics.js";
import { formatPondLabel } from "../domain/rollover.js";

export class PondTreeNav {
    constructor(onSelectPond) {
        this.onSelectPond = onSelectPond;
        this.container = document.getElementById("sidebar-pond-tree");
        this.sidebarEl = document.getElementById("command-sidebar");
        this.toggleBtn = document.getElementById("btn-toggle-sidebar");
        this.searchInput = document.getElementById("sidebar-pond-search");
        this.countBadge = document.getElementById("sidebar-pond-count");
        this.btnToggleAll = document.getElementById("btn-toggle-all-modules");
        this.labelToggleAll = document.getElementById("label-toggle-all-modules");

        this.collapsedModules = new Set();
        this.searchQuery = "";
        this.allModulesList = [];

        this.initSidebarToggle();
        this.initToggleAll();
        this.initSearch();
        this.bindSubscriptions();
    }

    initToggleAll() {
        if (!this.btnToggleAll) return;
        this.btnToggleAll.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleAllModules();
        });
    }

    toggleAllModules() {
        if (!this.allModulesList || this.allModulesList.length === 0) return;

        // If not all modules are collapsed, collapse them all. Otherwise, expand them all.
        const shouldCollapseAll = this.collapsedModules.size < this.allModulesList.length;

        if (shouldCollapseAll) {
            this.allModulesList.forEach(mod => this.collapsedModules.add(mod));
            if (this.labelToggleAll) this.labelToggleAll.textContent = "⊞ Expand";
            if (this.btnToggleAll) this.btnToggleAll.title = "Expand all modules in Pond Explorer";
            if (this.container) {
                this.container.querySelectorAll(".module-group").forEach(el => {
                    el.classList.add("collapsed");
                    const arrow = el.querySelector(".arrow-indicator");
                    if (arrow) arrow.textContent = "▶";
                });
            }
        } else {
            this.collapsedModules.clear();
            if (this.labelToggleAll) this.labelToggleAll.textContent = "⊟ Collapse";
            if (this.btnToggleAll) this.btnToggleAll.title = "Collapse all modules in Pond Explorer";
            if (this.container) {
                this.container.querySelectorAll(".module-group").forEach(el => {
                    el.classList.remove("collapsed");
                    const arrow = el.querySelector(".arrow-indicator");
                    if (arrow) arrow.textContent = "▼";
                });
            }
        }
    }

    updateToggleAllButton() {
        if (!this.labelToggleAll || !this.allModulesList || this.allModulesList.length === 0) return;
        const isAllCollapsed = this.allModulesList.length > 0 && this.collapsedModules.size >= this.allModulesList.length;
        this.labelToggleAll.textContent = isAllCollapsed ? "⊞ Expand" : "⊟ Collapse";
        if (this.btnToggleAll) {
            this.btnToggleAll.title = isAllCollapsed ? "Expand all modules in Pond Explorer" : "Collapse all modules in Pond Explorer";
        }
    }

    initSidebarToggle() {
        if (!this.toggleBtn || !this.sidebarEl) return;

        // Restore saved collapsed preference
        const saved = localStorage.getItem("isharp_sidebar_collapsed");
        if (saved === "true") {
            this.sidebarEl.classList.add("collapsed");
        }

        this.toggleBtn.addEventListener("click", () => {
            const isCollapsed = this.sidebarEl.classList.toggle("collapsed");
            localStorage.setItem("isharp_sidebar_collapsed", isCollapsed ? "true" : "false");
        });
    }

    initSearch() {
        if (this.searchInput) {
            this.searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.render();
            });
        }
    }

    bindSubscriptions() {
        appState.subscribe("filteredCyclesChanged", () => this.render());
        appState.subscribe("cyclesLoaded", () => this.render());
        appState.subscribe("pondChanged", (pond) => this.onPondChanged(pond));
    }

    getCycles() {
        const cycles = appState.filteredCycles.length > 0 ? appState.filteredCycles : appState.allCycles;
        if (!this.searchQuery) return cycles;
        return cycles.filter(c => {
            const pondName = String(c.pond || "").toLowerCase();
            const pondIdx = String(c.pond_index || "").toLowerCase();
            return pondName.includes(this.searchQuery) || pondIdx.includes(this.searchQuery);
        });
    }

    getModuleName(modNum) {
        return `Module ${modNum}`;
    }

    render() {
        if (!this.container) return;

        const cycles = this.getCycles();

        if (this.countBadge) {
            this.countBadge.textContent = `${cycles.length} Ponds`;
        }

        if (!cycles || cycles.length === 0) {
            this.container.innerHTML = `
                <div style="padding: 1rem 0.5rem; text-align: center; color: #94a3b8; font-size: 0.75rem;">
                    No ponds match filter
                </div>
            `;
            return;
        }

        // Group cycles by module (first 2 digits of pond code)
        const groups = {};
        cycles.forEach(c => {
            const pondCode = String(c.pond || "");
            const mod = pondCode.split(".")[0] || "01";
            if (!groups[mod]) groups[mod] = [];
            groups[mod].push(c);
        });

        const activePondIdx = String(appState.currentPondIndex || "");

        // Build HTML
        let html = "";
        const moduleKeys = Object.keys(groups).sort();
        this.allModulesList = moduleKeys;

        moduleKeys.forEach(mod => {
            const pondList = groups[mod];
            const isCollapsed = this.collapsedModules.has(mod);
            const modTitle = this.getModuleName(mod);
            const hasActivePond = pondList.some(c => String(c.pond_index) === activePondIdx);

            // Auto-expand module if it contains the active pond
            const showCollapsed = isCollapsed && !hasActivePond;

            html += `
                <div class="module-group ${showCollapsed ? 'collapsed' : ''}" data-mod="${mod}">
                    <div class="module-group-header" data-toggle-mod="${mod}">
                        <span>
                            <span class="arrow-indicator">${showCollapsed ? '▶' : '▼'}</span>
                            ${modTitle}
                        </span>
                        <span style="font-size: 0.65rem; color: #0284c7; font-weight: 700;">${pondList.length} Ponds</span>
                    </div>
                    <div class="pond-tree-list">
            `;

            pondList.forEach(c => {
                const isActive = String(c.pond_index) === activePondIdx;
                const status = (c.status || "PRODUCTION").toLowerCase();
                const formattedPond = formatPondLabel(c.pond);

                let docText = "DOC —";
                if (c.stck_date && String(c.stck_date).trim() !== "") {
                    const doc = calculateDOC(c.stck_date, c.date_close);
                    docText = `DOC ${doc}`;
                }

                html += `
                    <div class="pond-tree-item status-${status} ${isActive ? 'active' : ''}" 
                         data-pond-index="${c.pond_index}" 
                         title="Pond ${formattedPond} — ${c.status || 'Active'} (${docText})">
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <span class="status-dot"></span>
                            <span class="pond-name-text">Pond ${formattedPond}</span>
                        </div>
                        <span class="doc-tag">${docText}</span>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        this.container.innerHTML = html;
        this.updateToggleAllButton();

        // Bind click events on module headers
        this.container.querySelectorAll("[data-toggle-mod]").forEach(header => {
            header.addEventListener("click", (e) => {
                e.stopPropagation();
                const mod = header.getAttribute("data-toggle-mod");
                if (this.collapsedModules.has(mod)) {
                    this.collapsedModules.delete(mod);
                } else {
                    this.collapsedModules.add(mod);
                }
                const groupEl = header.closest(".module-group");
                if (groupEl) {
                    groupEl.classList.toggle("collapsed");
                    const arrow = header.querySelector(".arrow-indicator");
                    if (arrow) arrow.textContent = groupEl.classList.contains("collapsed") ? "▶" : "▼";
                }
                this.updateToggleAllButton();
            });
        });

        // Bind click events on pond tree items
        this.container.querySelectorAll(".pond-tree-item").forEach(item => {
            item.addEventListener("click", () => {
                const pIdx = item.getAttribute("data-pond-index");
                if (pIdx && this.onSelectPond) {
                    this.onSelectPond(pIdx);
                }
            });
        });
    }

    onPondChanged(pond) {
        if (!pond || !pond.pond_index) return;
        const pIdx = String(pond.pond_index);

        // Update active class in DOM
        if (this.container) {
            this.container.querySelectorAll(".pond-tree-item").forEach(item => {
                if (item.getAttribute("data-pond-index") === pIdx) {
                    item.classList.add("active");
                    // Expand parent module if collapsed
                    const group = item.closest(".module-group");
                    if (group && group.classList.contains("collapsed")) {
                        group.classList.remove("collapsed");
                        const arrow = group.querySelector(".arrow-indicator");
                        if (arrow) arrow.textContent = "▼";
                    }
                    // Smoothly scroll active item into view
                    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
                } else {
                    item.classList.remove("active");
                }
            });
        }
    }
}
