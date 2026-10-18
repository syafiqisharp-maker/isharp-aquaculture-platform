/**
 * iSHARP DBMS 2.0 — Disruption Timeline Ribbon (Phase 5)
 * Displays time-scoped shocks across W01–W156 with click-to-inject and quick removals.
 */

import { simulationStore } from "../../state/simulationStore.js";

export class DisruptionTimelineRibbon {
    constructor(containerId = "sim-shock-ribbon-container", onAddShockClick = null) {
        this.containerId = containerId;
        this.onAddShockClick = onAddShockClick;
    }

    render(shocks = []) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (!shocks || shocks.length === 0) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #78350f; font-weight: 600;">
                        <span>🛡️ Operational Baseline Active</span>
                        <span style="color: #92400e; font-size: 0.7rem; font-weight: 500;">(No active macro or climate shocks applied)</span>
                    </div>
                    <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-ribbon-add-shock" style="padding: 0.25rem 0.65rem; font-size: 0.74rem;">
                        <span>⚡ Inject Temporal Shock</span>
                    </button>
                </div>
            `;
            this._bindButton(container);
            return;
        }

        const chipsHtml = shocks.map((s) => {
            let icon = "⚡";
            if (s.category === "CLIMATE") icon = "🌧️";
            else if (s.category === "COMMODITY_FEED") icon = "🌾";
            else if (s.category === "BIOSECURITY") icon = "🦠";

            const durationStr = s.durationWeeks ? `${s.durationWeeks} wks` : "Permanent";
            return `
                <div class="sim-shock-chip" title="${s.name} (Starts W${s.startWeek})">
                    <span>${icon} ${s.name} (W${s.startWeek}, ${durationStr})</span>
                    <button type="button" class="sim-shock-chip-del" data-shock-id="${s.id}" title="Remove shock">&times;</button>
                </div>
            `;
        }).join("");

        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; overflow-x: auto; padding-bottom: 2px;">
                    <span style="font-weight: 800; color: #92400e; white-space: nowrap;">⚡ Active Shocks:</span>
                    ${chipsHtml}
                </div>
                <div style="display: flex; align-items: center; gap: 0.4rem; white-space: nowrap;">
                    <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-ribbon-add-shock" style="padding: 0.25rem 0.65rem; font-size: 0.74rem;">
                        <span>+ Add Shock</span>
                    </button>
                    <button type="button" class="btn-sim-action btn-sim-danger" id="btn-ribbon-clear-shocks" style="padding: 0.25rem 0.5rem; font-size: 0.74rem;" title="Clear all shocks">
                        <span>Clear</span>
                    </button>
                </div>
            </div>
        `;

        this._bindButton(container);
        this._bindDeletes(container);
    }

    _bindButton(container) {
        const btn = container.querySelector("#btn-ribbon-add-shock");
        if (btn && this.onAddShockClick) {
            btn.onclick = () => this.onAddShockClick();
        }

        const btnClear = container.querySelector("#btn-ribbon-clear-shocks");
        if (btnClear) {
            btnClear.onclick = () => simulationStore.clearAllShocks();
        }
    }

    _bindDeletes(container) {
        const deleteButtons = container.querySelectorAll(".sim-shock-chip-del");
        deleteButtons.forEach((btn) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const shockId = btn.getAttribute("data-shock-id");
                if (shockId) {
                    simulationStore.removeShock(shockId);
                }
            };
        });
    }
}
