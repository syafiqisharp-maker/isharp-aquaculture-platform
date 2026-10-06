/**
 * iSHARP DBMS 2.0 — Field Operations: Treatment Usage Summary Modal
 * Displays cumulative mineral & probiotic usage tables across the pond cycle.
 */

export class TreatmentSummaryModal {
    /**
     * @param {HTMLElement} container Parent view container
     */
    constructor(container) {
        this.container = container;
        this.modal = null;
    }

    /**
     * Returns HTML markup for the Treatment Totals Modal
     * @param {object} usageSummary { minerals, probiotics, totalMineralKg, totalProbioticL }
     * @param {string} pondLabel
     * @returns {string}
     */
    static renderMarkup(usageSummary, pondLabel) {
        const { minerals = [], probiotics = [], totalMineralKg = 0, totalProbioticL = 0 } = usageSummary || {};

        return `
            <div id="modal-usage-summary" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 9999;">
                <div class="modal-dialog modal-glass" style="max-width: 650px; width: 92%; max-height: 85vh; overflow-y: auto; padding: 1.75rem 2rem; border-radius: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.4rem;">📊</span>
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; color: #0f172a;">
                                Cumulative Treatment Summary — Pond ${pondLabel}
                            </h3>
                        </div>
                        <button type="button" id="btn-close-usage-modal" style="background: none; border: none; font-size: 1.4rem; color: #64748b; cursor: pointer; padding: 0.2rem 0.5rem;">✕</button>
                    </div>

                    <!-- Minerals Table -->
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.92rem; font-weight: 800; color: #0284c7;">
                        🧪 Total Minerals Used (${totalMineralKg.toLocaleString()} kg total)
                    </h4>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.84rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569;">
                                <th style="padding: 0.5rem 0.75rem;">Mineral Item</th>
                                <th style="padding: 0.5rem 0.75rem; text-align: right;">Total Applied</th>
                                <th style="padding: 0.5rem 0.75rem; text-align: center;">Times Used</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${minerals.length > 0 ? minerals.map(m => `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 0.55rem 0.75rem; font-weight: 700; color: #0f172a;">${m.item_name}</td>
                                    <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 800; color: #0369a1;">${m.total_amount.toLocaleString()} ${m.unit}</td>
                                    <td style="padding: 0.55rem 0.75rem; text-align: center; color: #64748b;">${m.count} days</td>
                                </tr>
                            `).join("") : `
                                <tr>
                                    <td colspan="3" style="padding: 0.75rem; text-align: center; color: #94a3b8; font-style: italic;">No minerals applied yet</td>
                                </tr>
                            `}
                        </tbody>
                    </table>

                    <!-- Probiotics Table -->
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.92rem; font-weight: 800; color: #92400e;">
                        🦠 Total Probiotics &amp; Ferments Used (${totalProbioticL.toLocaleString()} L total)
                    </h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569;">
                                <th style="padding: 0.5rem 0.75rem;">Probiotic / Product</th>
                                <th style="padding: 0.5rem 0.75rem; text-align: right;">Total Applied</th>
                                <th style="padding: 0.5rem 0.75rem; text-align: center;">Times Used</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${probiotics.length > 0 ? probiotics.map(p => `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 0.55rem 0.75rem; font-weight: 700; color: #0f172a;">${p.item_name}</td>
                                    <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 800; color: #92400e;">${p.total_amount.toLocaleString()} ${p.unit}</td>
                                    <td style="padding: 0.55rem 0.75rem; text-align: center; color: #64748b;">${p.count} days</td>
                                </tr>
                            `).join("") : `
                                <tr>
                                    <td colspan="3" style="padding: 0.75rem; text-align: center; color: #94a3b8; font-style: italic;">No probiotics applied yet</td>
                                </tr>
                            `}
                        </tbody>
                    </table>

                    <div style="text-align: right; margin-top: 1.5rem;">
                        <button type="button" id="btn-close-usage-modal-bottom" class="btn-action btn-secondary" style="font-size: 0.84rem; padding: 0.45rem 1.25rem;">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Binds modal event listeners
     */
    bindEvents() {
        this.modal = this.container.querySelector("#modal-usage-summary");
        const btnClose = this.container.querySelector("#btn-close-usage-modal");
        const btnCloseBottom = this.container.querySelector("#btn-close-usage-modal-bottom");

        if (btnClose) btnClose.addEventListener("click", () => this.close());
        if (btnCloseBottom) btnCloseBottom.addEventListener("click", () => this.close());
        if (this.modal) {
            this.modal.addEventListener("click", (e) => {
                if (e.target === this.modal) this.close();
            });
        }
    }

    open() {
        if (!this.modal) this.modal = this.container.querySelector("#modal-usage-summary");
        if (this.modal) this.modal.style.display = "flex";
    }

    close() {
        if (!this.modal) this.modal = this.container.querySelector("#modal-usage-summary");
        if (this.modal) this.modal.style.display = "none";
    }
}
