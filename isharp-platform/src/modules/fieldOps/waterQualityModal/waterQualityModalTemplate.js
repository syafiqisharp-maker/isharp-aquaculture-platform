/**
 * iSHARP DBMS 2.0 & Field Operations — Water Quality History Modal Template
 * Pure HTML template with semantic ARIA dialog roles and zero inline backdrop-filter.
 */

export function getWaterQualityModalHtml(pondLabel = "", cycleNo = "") {
    const cycleText = cycleNo ? ` (Cycle ${cycleNo})` : "";

    return `
    <div id="modal-field-ops-lab-wq" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 9999;" role="dialog" aria-modal="true" aria-labelledby="modal-lab-wq-title">
        <div class="modal-dialog modal-glass" style="max-width: 960px; width: 95%; max-height: 88vh; display: flex; flex-direction: column; padding: 1.5rem 1.75rem; border-radius: 20px; box-sizing: border-box;">
            
            <!-- Modal Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.85rem; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span style="font-size: 1.35rem;">🧪</span>
                        <h3 id="modal-lab-wq-title" style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #072642; letter-spacing: -0.01em;">
                            Laboratory Water Chemistry &amp; Mineral Balance
                        </h3>
                    </div>
                    <div style="font-size: 0.82rem; color: #475569; margin-top: 0.25rem;">
                        Historical cycle logbook &bull; <strong id="modal-lab-wq-pond-label" style="color: #0369a1;">Pond ${pondLabel}${cycleText}</strong>
                    </div>
                </div>

                <!-- Header Actions & Badges -->
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span id="modal-lab-wq-badge-count" style="font-size: 0.76rem; font-weight: 800; background: #f0fdf4; color: #166534; padding: 0.28rem 0.75rem; border-radius: 999px; border: 1px solid #bbf7d0;">
                        0 Records
                    </span>
                    <span id="modal-lab-wq-badge-date" style="font-size: 0.76rem; font-weight: 800; background: #eff6ff; color: #1e40af; padding: 0.28rem 0.75rem; border-radius: 999px; border: 1px solid #bfdbfe;">
                        Last Sample: —
                    </span>
                    <button type="button" id="btn-export-lab-wq-csv" class="btn-action" style="font-size: 0.78rem; font-weight: 800; padding: 0.35rem 0.85rem; border-radius: 8px; background: #0284c7; color: #ffffff; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 1px 3px rgba(2, 132, 199, 0.3);" title="Export all records to CSV">
                        <span>📥</span> Export CSV
                    </button>
                    <button type="button" id="btn-close-lab-wq-modal" style="background: none; border: none; font-size: 1.4rem; color: #64748b; cursor: pointer; padding: 0.2rem 0.5rem; line-height: 1; border-radius: 6px;" aria-label="Close modal">
                        ✕
                    </button>
                </div>
            </div>

            <!-- Table Container (Horizontal Touch Scroll + Sticky Header) -->
            <div class="table-responsive" style="flex: 1 1 auto; overflow: auto; max-height: calc(88vh - 180px); border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff;">
                <table class="data-table" id="table-field-ops-lab-wq" style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.84rem;">
                    <thead style="position: sticky; top: 0; z-index: 2; background: #f8fafc;">
                        <tr style="border-bottom: 2px solid #cbd5e1; text-align: center; color: #334155;">
                            <th style="padding: 0.65rem 0.75rem; text-align: left; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">Date</th>
                            <th style="padding: 0.65rem 0.5rem; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">DOC</th>
                            <th style="padding: 0.65rem 0.6rem; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">Salinity<br/><span style="font-size: 0.68rem; font-weight: 600; color: #64748b;">ppt (15–35)</span></th>
                            <th style="padding: 0.65rem 0.6rem; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">Alkalinity<br/><span style="font-size: 0.68rem; font-weight: 600; color: #64748b;">mg/L (100–160)</span></th>
                            <th style="padding: 0.65rem 0.6rem; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">Ammonia<br/><span style="font-size: 0.68rem; font-weight: 600; color: #64748b;">mg/L (&lt; 1.0)</span></th>
                            <th style="padding: 0.65rem 0.6rem; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">Nitrite<br/><span style="font-size: 0.68rem; font-weight: 600; color: #64748b;">mg/L (&le; 0.5)</span></th>
                            <th style="padding: 0.65rem 0.6rem; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">Calcium<br/><span style="font-size: 0.68rem; font-weight: 600; color: #64748b;">mg/L (&gt; 200)</span></th>
                            <th style="padding: 0.65rem 0.6rem; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">Magnesium<br/><span style="font-size: 0.68rem; font-weight: 600; color: #64748b;">mg/L (&gt; 600)</span></th>
                            <th style="padding: 0.65rem 0.6rem; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">Ca : Mg Ratio<br/><span style="font-size: 0.68rem; font-weight: 600; color: #64748b;">Target 1:2.5–3.5</span></th>
                            <th style="padding: 0.65rem 0.6rem; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">Turbidity<br/><span style="font-size: 0.68rem; font-weight: 600; color: #64748b;">NTU (&lt; 30)</span></th>
                        </tr>
                    </thead>
                    <tbody id="tbody-field-ops-lab-wq">
                        <tr>
                            <td colspan="10" style="padding: 2.5rem 1rem; text-align: center; color: #64748b;">
                                Loading water quality records...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Modal Footer -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                <div style="font-size: 0.72rem; color: #64748b;">
                    Values colored according to SSOT optimum thresholds (<span style="color: #15803d; font-weight: 700;">Green = Optimal</span>, <span style="color: #b45309; font-weight: 700;">Yellow = Warning</span>, <span style="color: #b91c1c; font-weight: 700;">Red = Critical</span>).
                </div>
                <button type="button" id="btn-close-lab-wq-bottom" class="btn-action btn-secondary" style="font-size: 0.84rem; padding: 0.45rem 1.4rem; border-radius: 8px; cursor: pointer;">
                    Close
                </button>
            </div>

        </div>
    </div>
    `;
}
