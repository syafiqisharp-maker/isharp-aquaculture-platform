/**
 * iSHARP DBMS 2.0 — Stocking Tab HTML Template (Tab 3)
 * Stocking Events, PL Delivery, Allowance, and Hatchery Batch Records.
 */

export function getStockingTabHtml() {
    return `
    <div id="tab-stocking" class="tab-pane" role="tabpanel">
        <div class="card panel-card">
            <div class="card-header flex-between">
                <div>
                    <h3>Stocking Events & PL Hatchery Records</h3>
                    <span class="card-sub">Pond PL delivery, allowance, density, and genetic lineage</span>
                </div>
                <div class="card-header-actions">
                    <button id="btn-save-stocking" class="btn-action btn-save" title="Save Stocking parameters to cloud">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        <span>Save Changes</span>
                    </button>
                    <button class="btn-action btn-secondary" onclick="app.openExcelModal('stocking')">
                        + Add Stocking Batch
                    </button>
                </div>
            </div>
            <div class="form-grid-3 mb-4">
                <div class="form-group">
                    <label for="input-stck-date">Stocking Date</label>
                    <input type="date" id="input-stck-date" class="form-control">
                </div>
                <div class="form-group">
                    <label for="input-stck-source">Hatchery / Source</label>
                    <input type="text" id="input-stck-source" class="form-control" placeholder="e.g. SHT / BAB Hatchery">
                </div>
                <div class="form-group">
                    <label for="input-stck-species">Species</label>
                    <select id="input-stck-species" class="form-control">
                        <option value="P. VANNAMEi">P. VANNAMEi</option>
                        <option value="P. MONODON">P. MONODON</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="input-stck-netto">Netto Fry (pcs)</label>
                    <input type="number" id="input-stck-netto" class="form-control font-mono" placeholder="410000">
                </div>
                <div class="form-group">
                    <label for="input-stck-allow">Allowance Fry (pcs)</label>
                    <input type="number" id="input-stck-allow" class="form-control font-mono" placeholder="46000">
                </div>
                <div class="form-group">
                    <label for="input-stck-gross">Total Gross Fry (pcs)</label>
                    <input type="number" id="input-stck-gross" class="form-control font-mono font-bold" placeholder="456000">
                </div>
                <div class="form-group">
                    <label for="input-stck-line">Broodstock Line</label>
                    <input type="text" id="input-stck-line" class="form-control" placeholder="e.g. Syaqua / Dragon">
                </div>
                <div class="form-group">
                    <label for="input-stck-size">PL Size</label>
                    <input type="number" id="input-stck-size" class="form-control font-mono" placeholder="15">
                </div>
                <div class="form-group">
                    <label for="input-stck-tank">Hatchery Tank Ref</label>
                    <input type="text" id="input-stck-tank" class="form-control" placeholder="e.g. C16, C4">
                </div>
            </div>

            <div class="divider mt-4"></div>
            <div class="card-header flex-between mt-3">
                <div>
                    <h4>Multi-Batch Stocking History (<code>GrowoutPondStocking</code>)</h4>
                    <span class="card-sub">Individual fry deliveries and partial stocking batches for this cycle</span>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="table-stocking-batches">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Source / Hatchery</th>
                            <th>Species</th>
                            <th>Netto Fry (pcs)</th>
                            <th>Allowance (pcs)</th>
                            <th>Total Gross (pcs)</th>
                            <th>Type</th>
                            <th>Broodstock</th>
                            <th>Tank</th>
                            <th>PL Size</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-stocking-batches">
                        <tr><td colspan="10" class="text-center text-muted">Loading stocking batches...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}
