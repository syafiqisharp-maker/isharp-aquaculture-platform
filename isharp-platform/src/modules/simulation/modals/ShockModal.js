/**
 * iSHARP DBMS 2.0 — Shock Modal (Phase 5)
 * Allows management to inject time-scoped macro-economic, climate, or biosecurity shocks.
 */

import { simulationStore } from "../../../state/simulationStore.js";

const PRESET_SHOCKS = [
    {
        name: "⚡ Middle East Conflict Energy Surge",
        category: "MACRO_ENERGY",
        startWeek: 40,
        durationWeeks: 26,
        impactModifiers: {
            electricityTariffMultiplier: 1.30,
            feedCostMultiplier: 1.00,
            shrimpPriceShiftRM: 0.00,
            adgMultiplier: 1.00,
            survivalMultiplier: 1.00,
            mineralCostMultiplier: 1.00
        }
    },
    {
        name: "🌾 Global Soymeal Shortage Feed Inflation",
        category: "COMMODITY_FEED",
        startWeek: 26,
        durationWeeks: null, // Permanent
        impactModifiers: {
            electricityTariffMultiplier: 1.00,
            feedCostMultiplier: 1.15,
            shrimpPriceShiftRM: 0.00,
            adgMultiplier: 1.00,
            survivalMultiplier: 1.00,
            mineralCostMultiplier: 1.00
        }
    },
    {
        name: "🌧️ Unseasonal Torrential Monsoon Salinity Crash",
        category: "CLIMATE",
        startWeek: 8,
        durationWeeks: 4,
        impactModifiers: {
            electricityTariffMultiplier: 1.00,
            feedCostMultiplier: 1.00,
            shrimpPriceShiftRM: 0.00,
            adgMultiplier: 0.70,
            survivalMultiplier: 0.85,
            mineralCostMultiplier: 1.35
        }
    },
    {
        name: "🦠 EHP Slow-Growth Pathogen Wave",
        category: "BIOSECURITY",
        startWeek: 18,
        durationWeeks: 14,
        impactModifiers: {
            electricityTariffMultiplier: 1.00,
            feedCostMultiplier: 1.10,
            shrimpPriceShiftRM: 0.00,
            adgMultiplier: 0.60,
            survivalMultiplier: 0.80,
            mineralCostMultiplier: 1.25
        }
    },
    {
        name: "📉 Global Export Shrimp Market Price Slump",
        category: "MACRO_ENERGY",
        startWeek: 30,
        durationWeeks: 18,
        impactModifiers: {
            electricityTariffMultiplier: 1.00,
            feedCostMultiplier: 1.00,
            shrimpPriceShiftRM: -3.00,
            adgMultiplier: 1.00,
            survivalMultiplier: 1.00,
            mineralCostMultiplier: 1.00
        }
    }
];

export class ShockModal {
    constructor(modalId = "modal-sim-shock") {
        this.modalId = modalId;
    }

    open() {
        let modalEl = document.getElementById(this.modalId);
        if (!modalEl) {
            modalEl = document.createElement("div");
            modalEl.id = this.modalId;
            modalEl.className = "sim-modal-backdrop";
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sim-modal-dialog" role="dialog" aria-modal="true">
                <div class="sim-modal-header">
                    <div>
                        <h3 class="sim-modal-title">⚡ Inject Time-Scoped Disruption Shock</h3>
                        <span style="font-size: 0.72rem; color: #92400e; font-weight: 600;">
                            War Room Stress Testing • Temporal Timeline Evaluation (W01–W156)
                        </span>
                    </div>
                    <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-close-shock-modal" style="padding: 0.2rem 0.5rem; font-size: 1.1rem; border-radius: 6px;">&times;</button>
                </div>

                <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 0.75rem 1rem;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: #92400e; margin-bottom: 0.5rem;">
                        ⚡ Quick Pre-Packaged Stress Scenarios:
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                        ${PRESET_SHOCKS.map((p, idx) => `
                            <button type="button" class="btn-sim-action btn-sim-secondary btn-preset-shock" data-preset-idx="${idx}" style="font-size: 0.72rem; padding: 0.3rem 0.6rem;">
                                <span>${p.name}</span>
                            </button>
                        `).join("")}
                    </div>
                </div>

                <div class="sim-form-grid">
                    <div class="sim-form-group" style="grid-column: 1 / -1;">
                        <label class="sim-form-label">Shock Event Name</label>
                        <input type="text" class="sim-form-input" id="shock-name-input" value="Middle East Energy Tariff Spike" />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Category</label>
                        <select class="sim-form-input" id="shock-category-select">
                            <option value="MACRO_ENERGY">Macro Energy &amp; Power</option>
                            <option value="COMMODITY_FEED">Commodity &amp; Feed Inflation</option>
                            <option value="CLIMATE">Climate &amp; Monsoon Flood</option>
                            <option value="BIOSECURITY">Biosecurity &amp; Epidemic</option>
                            <option value="LOGISTICS">Supply Chain &amp; Logistics</option>
                        </select>
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Start Week Index (W01 to W156)</label>
                        <input type="number" class="sim-form-input" id="shock-startweek-input" value="40" min="1" max="156" />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Duration (Weeks) [Blank = Permanent]</label>
                        <input type="number" class="sim-form-input" id="shock-duration-input" value="26" min="1" max="156" placeholder="Permanent" />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">TNB Electricity Multiplier (e.g. 1.30 = +30%)</label>
                        <input type="number" class="sim-form-input" id="shock-electricity-input" value="1.30" step="0.05" min="0.5" max="3.0" />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Feed Cost Multiplier (e.g. 1.15 = +15%)</label>
                        <input type="number" class="sim-form-input" id="shock-feed-input" value="1.00" step="0.05" min="0.5" max="3.0" />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Growth ADG Multiplier (e.g. 0.70 = -30%)</label>
                        <input type="number" class="sim-form-input" id="shock-adg-input" value="1.00" step="0.05" min="0.3" max="1.5" />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Survival Multiplier (e.g. 0.85 = -15%)</label>
                        <input type="number" class="sim-form-input" id="shock-survival-input" value="1.00" step="0.05" min="0.2" max="1.2" />
                    </div>

                    <div class="sim-form-group">
                        <label class="sim-form-label">Selling Price Shift (RM/kg, e.g. -2.00)</label>
                        <input type="number" class="sim-form-input" id="shock-price-input" value="0.00" step="0.50" min="-15" max="15" />
                    </div>
                </div>

                <div class="sim-modal-footer">
                    <button type="button" class="btn-sim-action btn-sim-secondary" id="btn-cancel-shock-modal">
                        <span>Cancel</span>
                    </button>
                    <button type="button" class="btn-sim-action btn-sim-primary" id="btn-inject-shock-modal">
                        <span>⚡ Inject Shock &amp; Recalculate</span>
                    </button>
                </div>
            </div>
        `;

        modalEl.style.display = "flex";
        this._bindEvents(modalEl);
    }

    close() {
        const modalEl = document.getElementById(this.modalId);
        if (modalEl) modalEl.style.display = "none";
    }

    _bindEvents(modalEl) {
        const btnClose = modalEl.querySelector("#btn-close-shock-modal");
        const btnCancel = modalEl.querySelector("#btn-cancel-shock-modal");
        const btnInject = modalEl.querySelector("#btn-inject-shock-modal");

        const dismiss = () => this.close();
        if (btnClose) btnClose.onclick = dismiss;
        if (btnCancel) btnCancel.onclick = dismiss;

        // Preset buttons
        const presetBtns = modalEl.querySelectorAll(".btn-preset-shock");
        presetBtns.forEach((btn) => {
            btn.onclick = () => {
                const idx = Number(btn.getAttribute("data-preset-idx"));
                const p = PRESET_SHOCKS[idx];
                if (!p) return;

                modalEl.querySelector("#shock-name-input").value = p.name;
                modalEl.querySelector("#shock-category-select").value = p.category;
                modalEl.querySelector("#shock-startweek-input").value = p.startWeek;
                modalEl.querySelector("#shock-duration-input").value = p.durationWeeks || "";
                modalEl.querySelector("#shock-electricity-input").value = p.impactModifiers.electricityTariffMultiplier;
                modalEl.querySelector("#shock-feed-input").value = p.impactModifiers.feedCostMultiplier;
                modalEl.querySelector("#shock-adg-input").value = p.impactModifiers.adgMultiplier;
                modalEl.querySelector("#shock-survival-input").value = p.impactModifiers.survivalMultiplier;
                modalEl.querySelector("#shock-price-input").value = p.impactModifiers.shrimpPriceShiftRM;
            };
        });

        if (btnInject) {
            btnInject.onclick = () => {
                const name = modalEl.querySelector("#shock-name-input").value.trim() || "Custom Shock";
                const category = modalEl.querySelector("#shock-category-select").value;
                const startWeek = Number(modalEl.querySelector("#shock-startweek-input").value) || 1;
                const durationVal = modalEl.querySelector("#shock-duration-input").value.trim();
                const durationWeeks = durationVal ? Number(durationVal) : null;

                const electricityTariffMultiplier = Number(modalEl.querySelector("#shock-electricity-input").value) || 1.0;
                const feedCostMultiplier = Number(modalEl.querySelector("#shock-feed-input").value) || 1.0;
                const adgMultiplier = Number(modalEl.querySelector("#shock-adg-input").value) || 1.0;
                const survivalMultiplier = Number(modalEl.querySelector("#shock-survival-input").value) || 1.0;
                const shrimpPriceShiftRM = Number(modalEl.querySelector("#shock-price-input").value) || 0.0;

                const shockEvent = {
                    id: "shock_" + Date.now(),
                    name,
                    category,
                    startWeek,
                    durationWeeks,
                    targetScope: { type: "FARM_WIDE", species: "ALL" },
                    impactModifiers: {
                        electricityTariffMultiplier,
                        feedCostMultiplier,
                        adgMultiplier,
                        survivalMultiplier,
                        shrimpPriceShiftRM,
                        mineralCostMultiplier: 1.0
                    }
                };

                simulationStore.injectShock(shockEvent);
                this.close();
            };
        }

        modalEl.onclick = (e) => {
            if (e.target === modalEl) this.close();
        };
    }
}
