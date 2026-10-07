/**
 * iSHARP DBMS 2.0 — Feeding Tab Module (Tab 4)
 * Dual Tables: Supervisor Daily Feeding Logbook & Official Cumulative SAP Feed Usage.
 */

import { appState } from "../../state/appState.js";
import { FeedRepository } from "../../infrastructure/repositories/feedRepository.js";
import { Toast } from "../../components/Toast.js";
import { DOM_IDS } from "../../config/domContracts.js";

export class FeedingTab {
    constructor(onOpenExcel) {
        this.onOpenExcel = onOpenExcel;
        this.dom = {
            tbodyDaily: document.getElementById(DOM_IDS.FEEDING.TBODY_FEED),
            tbodySap: document.getElementById(DOM_IDS.FEEDING.TBODY_SAP_FEED),
            snapTotalFeed: document.getElementById(DOM_IDS.MASTER.SNAP_TOTAL_FEED),
            snapSapTotalFeed: document.getElementById(DOM_IDS.FEEDING.SNAP_SAP_TOTAL_FEED)
        };

        this.injectExcelButtonIfMissing();
        appState.subscribe("pondChanged", (pond) => this.loadData(pond ? pond.pond_index : null));
    }

    injectExcelButtonIfMissing() {
        const tabPane = document.getElementById("tab-feeding");
        if (!tabPane) return;

        let btn = document.getElementById("btn-excel-feeding-tab");
        if (!btn) {
            const cardHeader = tabPane.querySelector(".card-header") || tabPane.querySelector(".glass-card");
            if (cardHeader) {
                btn = document.createElement("button");
                btn.id = "btn-excel-feeding-tab";
                btn.type = "button";
                btn.className = "btn-action btn-excel";
                btn.style.cssText = "margin-bottom: 0.75rem;";
                btn.innerHTML = `<span>📋 Paste Feeding Sheet (Excel)</span>`;
                btn.addEventListener("click", () => {
                    if (this.onOpenExcel) this.onOpenExcel("feed");
                });
                cardHeader.prepend(btn);
            }
        }
    }

    async loadData(pondIndex) {
        // Refresh DOM elements in case tab re-rendered
        this.dom.tbodyDaily = document.getElementById(DOM_IDS.FEEDING.TBODY_FEED);
        this.dom.tbodySap = document.getElementById(DOM_IDS.FEEDING.TBODY_SAP_FEED);
        this.dom.snapTotalFeed = document.getElementById(DOM_IDS.MASTER.SNAP_TOTAL_FEED);
        this.dom.snapSapTotalFeed = document.getElementById(DOM_IDS.FEEDING.SNAP_SAP_TOTAL_FEED);

        if (!pondIndex) {
            if (this.dom.tbodyDaily) {
                this.dom.tbodyDaily.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 1.5rem;">Select a pond to view feeding records.</td></tr>`;
            }
            if (this.dom.tbodySap) {
                this.dom.tbodySap.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 1.5rem;">Select a pond to view SAP feed records.</td></tr>`;
            }
            if (this.dom.snapSapTotalFeed) this.dom.snapSapTotalFeed.textContent = "0 kg";
            return;
        }

        try {
            const [dailyData, sapData] = await Promise.all([
                FeedRepository.getDailyRecords(pondIndex).catch(err => {
                    console.warn("Could not load daily feed records:", err);
                    return [];
                }),
                FeedRepository.getSapFeedRecords(pondIndex).catch(err => {
                    console.warn("Could not load SAP feed records:", err);
                    return [];
                })
            ]);

            // -------------------------------------------------------------
            // 1. RENDER TABLE 1: Supervisor Daily Feeding Records
            // -------------------------------------------------------------
            if (this.dom.tbodyDaily) {
                if (!dailyData || dailyData.length === 0) {
                    this.dom.tbodyDaily.innerHTML = `
                        <tr>
                            <td colspan="8" class="text-center text-muted" style="padding: 2rem;">
                                No daily feeding records logged for this cycle.<br>
                                <span style="font-size: 0.78rem;">Click <strong>"Paste Feeding Sheet"</strong> above to upload Excel records.</span>
                            </td>
                        </tr>
                    `;
                    if (this.dom.snapTotalFeed) this.dom.snapTotalFeed.textContent = "0.0 kg";
                } else {
                    const totalDaily = dailyData.reduce((acc, row) => acc + (parseFloat(row.feed_kg) || 0), 0);
                    if (this.dom.snapTotalFeed) {
                        this.dom.snapTotalFeed.textContent = `${Math.round(totalDaily).toLocaleString()} kg`;
                    }

                    this.dom.tbodyDaily.innerHTML = dailyData.map(r => `
                        <tr>
                            <td class="font-mono">${r.log_date || '—'}</td>
                            <td>${r.shift || 'Full Day'}</td>
                            <td class="font-mono font-bold text-success">${parseFloat(r.feed_kg || 0).toFixed(1)} kg</td>
                            <td class="font-mono">${r.feed_tray_remnant_pct || 0}%</td>
                            <td class="font-mono">${r.water_level_cm ? r.water_level_cm + ' cm' : '—'}</td>
                            <td><span class="status-badge status-production">${r.water_colour || 'Healthy Green'}</span></td>
                            <td class="font-mono ${((r.mortality_kg || r.mortality_count) > 0) ? 'text-danger font-bold' : ''}">
                                ${(r.mortality_kg !== undefined && r.mortality_kg !== null) ? parseFloat(r.mortality_kg).toFixed(1) + ' kg' : (r.mortality_count ? r.mortality_count + ' kg' : '0 kg')}
                            </td>
                            <td>${r.remarks || '—'}</td>
                        </tr>
                    `).join("");
                }
            }

            // -------------------------------------------------------------
            // 2. RENDER TABLE 2: Official SAP Feed Usage & Cumulative Ledger
            // -------------------------------------------------------------
            if (this.dom.tbodySap) {
                if (!sapData || sapData.length === 0) {
                    this.dom.tbodySap.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center text-muted" style="padding: 2rem;">
                                No SAP feed records found for this cycle.
                            </td>
                        </tr>
                    `;
                    if (this.dom.snapSapTotalFeed) this.dom.snapSapTotalFeed.textContent = "0 kg";
                } else {
                    let runningCumulative = 0;
                    this.dom.tbodySap.innerHTML = sapData.map(r => {
                        const amount = parseFloat(r.amount_kg) || 0;
                        runningCumulative += amount;
                        const cumKgFormatted = Math.round(runningCumulative).toLocaleString();
                        const amountFormatted = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                        const isReversal = (r.sap_movement == 262 || amount < 0);

                        return `
                            <tr>
                                <td class="font-mono">${r.sap_post_date || '—'}</td>
                                <td>
                                    <span class="badge-brand font-bold" style="background: rgba(2, 132, 199, 0.08); color: #0284c7; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(2, 132, 199, 0.2);">
                                        ${r.sap_feed_name || '—'}
                                    </span>
                                </td>
                                <td class="font-mono font-bold ${isReversal ? 'text-danger' : 'text-success'}">
                                    ${isReversal ? '-' : '+'}${amountFormatted} kg
                                </td>
                                <td class="font-mono font-bold" style="color: var(--text-primary);">
                                    ${cumKgFormatted} kg
                                </td>
                                <td class="font-mono text-muted">${r.order_no || '—'}</td>
                                <td>
                                    ${isReversal
                                        ? '<span class="status-badge" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;">262 Reversal</span>'
                                        : '<span class="status-badge" style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0;">261 Issue</span>'}
                                </td>
                            </tr>
                        `;
                    }).join("");

                    if (this.dom.snapSapTotalFeed) {
                        this.dom.snapSapTotalFeed.textContent = `${Math.round(runningCumulative).toLocaleString()} kg`;
                    }
                }
            }

        } catch (err) {
            console.error("Feeding load error:", err);
            Toast.error(`Could not load feeding records: ${err.message}`);
        }
    }
}
