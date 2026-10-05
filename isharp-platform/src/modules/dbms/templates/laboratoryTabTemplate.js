/**
 * iSHARP DBMS 2.0 — Laboratory Tab HTML Template (Tab 2)
 * Biosecurity & Disease Pathology Logbook.
 */

export function getLaboratoryTabHtml() {
    return `
    <div id="tab-laboratory" class="tab-pane" role="tabpanel">
        <div class="card panel-card">
            <div class="card-header flex-between">
                <div>
                    <h3>Biosecurity & Disease Pathology Logbook</h3>
                    <span class="card-sub">Laboratory PCR tests, microscopy findings, and quarantine flags</span>
                </div>
                <button id="btn-add-lab-record" class="btn-action btn-secondary">
                    + Add / Paste Lab Record
                </button>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="table-issues">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Category</th>
                            <th>Pathogen / Status</th>
                            <th>Test Method</th>
                            <th>Flag Alert</th>
                            <th>Grade</th>
                            <th>Result / Note</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-issues">
                        <tr><td colspan="8" class="text-center text-muted">No pathology issues recorded for this cycle (Pond is clean).</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}
