/**
 * iSHARP DBMS 2.0 — Daily Report Tab HTML Template
 * Two-column Workstation: Smart Input Form (Left) & WYSIWYG Email Live Preview (Right).
 */

export function getDailyReportTabHtml() {
    return `
    <div id="tab-daily-report" class="tab-pane" role="tabpanel">
        
        <!-- Top Toolbar Header -->
        <div class="card panel-card" style="margin-bottom: 1rem; padding: 0.75rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #0284c7, #0369a1); display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 1.2rem; box-shadow: 0 2px 6px rgba(2,132,199,0.3);">
                    📧
                </div>
                <div>
                    <h2 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #0f172a; letter-spacing: -0.01em;">
                        Daily Farm Executive Report Generator
                    </h2>
                    <div style="font-size: 0.75rem; color: #64748b;">
                        Single Source of Truth (SSOT) • Executive Dashboard &amp; 216 Map Linked • 1-Click Email Paste
                    </div>
                </div>
            </div>

            <!-- Global Action Cluster -->
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" id="btn-daily-report-sync" class="btn-action btn-secondary" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 6px; cursor: pointer;" title="Re-sync data from Executive Hero Cards &amp; 216 Map">
                    <span>🔄</span>
                    <span>Sync Farm SSOT</span>
                </button>
                <button type="button" id="btn-daily-report-save" class="btn-action btn-secondary" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 6px; cursor: pointer;" title="Save current form draft to browser local storage">
                    <span>💾</span>
                    <span>Save Draft</span>
                </button>
                <button type="button" id="btn-daily-report-copy-html" class="btn-action btn-secondary" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 6px; cursor: pointer;" title="Copy raw HTML markup to clipboard">
                    <span>📄</span>
                    <span>Copy HTML</span>
                </button>
                <button type="button" id="btn-daily-report-copy" class="btn-action btn-primary" style="display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.45rem 1.15rem; font-size: 0.82rem; font-weight: 800; border-radius: 6px; background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; border: none; box-shadow: 0 2px 6px rgba(2,132,199,0.35); cursor: pointer;" title="Copy rich formatted table to clipboard for Outlook / Gmail">
                    <span>📋</span>
                    <span>Copy to Email Body</span>
                </button>
            </div>
        </div>

        <!-- Main Split Workspace Layout -->
        <div class="panel-layout" style="display: flex; gap: 1.25rem; align-items: flex-start;">
            
            <!-- ================= LEFT COLUMN: SMART INPUT FORM ================= -->
            <div class="side-column" style="width: 420px; flex-shrink: 0; display: flex; flex-direction: column; gap: 1rem;">
                
                <!-- Card 0: Report Snapshot Metadata -->
                <div class="card panel-card" style="padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.78rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>📅 Report Snapshot</span>
                        <span id="badge-ssot-status" style="font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;">SSOT Ready</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        <div>
                            <label style="font-size: 0.7rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 0.2rem;">Date</label>
                            <input type="text" id="dr-input-date" class="sidebar-search-input" style="width: 100%; font-size: 0.78rem; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="e.g. Wednesday, November 04, 2026" />
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 0.2rem;">Snapshot Time</label>
                            <input type="text" id="dr-input-time" class="sidebar-search-input" style="width: 100%; font-size: 0.78rem; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="e.g. 5:50 PM" />
                        </div>
                    </div>
                </div>

                <!-- Card 1: Finance, Biomass & BP Targets -->
                <div class="card panel-card" style="padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.78rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>💰 Finance &amp; Business Plan Targets</span>
                        <span style="font-size: 0.65rem; color: #64748b;">Daily Finance Email Sync</span>
                    </div>

                    <!-- YTD Table Inputs -->
                    <div style="font-size: 0.72rem; font-weight: 700; color: #0284c7; margin-bottom: 0.35rem;">YEAR-TO-DATE (YTD)</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; margin-bottom: 0.5rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">YTD Tonnes Act</label>
                            <input type="number" step="0.1" id="dr-input-ytd-ton-act" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Rolling Plan</label>
                            <input type="number" step="0.1" id="dr-input-ytd-ton-roll" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Business Plan</label>
                            <input type="number" step="0.1" id="dr-input-ytd-ton-bp" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; margin-bottom: 0.6rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">YTD Rev (RM M)</label>
                            <input type="number" step="0.01" id="dr-input-ytd-rev-act" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Rolling Plan</label>
                            <input type="number" step="0.01" id="dr-input-ytd-rev-roll" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Business Plan</label>
                            <input type="number" step="0.01" id="dr-input-ytd-rev-bp" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; margin-bottom: 0.6rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">YTD Harv Ponds</label>
                            <input type="number" id="dr-input-ytd-harv-act" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Rolling Plan</label>
                            <input type="number" step="0.01" id="dr-input-ytd-harv-roll" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Business Plan</label>
                            <input type="number" step="0.01" id="dr-input-ytd-harv-bp" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; margin-bottom: 0.6rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">YTD Stock Ponds</label>
                            <input type="number" id="dr-input-ytd-stock-act" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Rolling Plan</label>
                            <input type="number" step="0.01" id="dr-input-ytd-stock-roll" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Business Plan</label>
                            <input type="number" step="0.01" id="dr-input-ytd-stock-bp" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                    </div>

                    <!-- MTD Table Inputs -->
                    <div style="font-size: 0.72rem; font-weight: 700; color: #059669; margin-bottom: 0.35rem; padding-top: 0.4rem; border-top: 1px dashed #e2e8f0;">MONTH-TO-DATE (MTD)</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; margin-bottom: 0.5rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">MTD Tonnes Act</label>
                            <input type="text" id="dr-input-mtd-ton-act" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="TBA or number" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">MTD Tonnes BP</label>
                            <input type="number" step="0.1" id="dr-input-mtd-ton-bp" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">MTD Rev BP (M)</label>
                            <input type="number" step="0.01" id="dr-input-mtd-rev-bp" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; margin-bottom: 0.5rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">MTD Harv Ponds</label>
                            <input type="number" id="dr-input-mtd-harv-act" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">MTD Stock Ponds</label>
                            <input type="number" id="dr-input-mtd-stock-act" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">MTD Fries (Mil)</label>
                            <input type="number" step="0.01" id="dr-input-mtd-fries-act" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #991b1b;">Culled Ponds (MTD)</label>
                            <input type="number" id="dr-input-culled-mtd" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="0" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #991b1b;">Culled Ponds (YTD)</label>
                            <input type="number" id="dr-input-culled-ytd" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="1" />
                        </div>
                    </div>

                    <!-- Today's Operational Movement (Highlight Today Only) -->
                    <div style="font-size: 0.72rem; font-weight: 700; color: #0284c7; margin-top: 0.6rem; margin-bottom: 0.35rem; padding-top: 0.4rem; border-top: 1px dashed #e2e8f0;">
                        TODAY'S OPERATIONAL MOVEMENT (HIGHLIGHT TODAY ONLY)
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #0f172a;">Today Stocking</label>
                            <input type="number" id="dr-input-today-stock" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; color: #0284c7;" value="0" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #0f172a;">Today Harvest</label>
                            <input type="number" id="dr-input-today-harv" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; color: #0284c7;" value="0" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #991b1b;">Today Cull</label>
                            <input type="number" id="dr-input-today-cull" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; color: #991b1b;" value="0" />
                        </div>
                    </div>
                </div>

                <!-- Card 2: Risk Alert Center & Flags -->
                <div class="card panel-card" style="padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.78rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem;">
                        🚨 Risk Alert Center &amp; Incidents
                    </div>

                    <div style="margin-bottom: 0.5rem;">
                        <label style="font-size: 0.68rem; font-weight: 700; color: #dc2626; display: block; margin-bottom: 0.2rem;">🔴 Red Flag Alert</label>
                        <textarea id="dr-input-red-flag" class="sidebar-search-input" rows="2" style="width: 100%; font-size: 0.74rem; padding: 0.4rem; border: 1px solid #fecaca; border-radius: 6px; resize: vertical;" placeholder="Critical disease, mortality, power blackout, emergency culls..."></textarea>
                    </div>

                    <div style="margin-bottom: 0.5rem;">
                        <label style="font-size: 0.68rem; font-weight: 700; color: #ea580c; display: block; margin-bottom: 0.2rem;">🟠 Orange Flag Notice</label>
                        <textarea id="dr-input-orange-flag" class="sidebar-search-input" rows="2" style="width: 100%; font-size: 0.74rem; padding: 0.4rem; border: 1px solid #fed7aa; border-radius: 6px; resize: vertical;" placeholder="Water quality deviations, feed intake drops, delayed logistics..."></textarea>
                    </div>

                    <div style="margin-bottom: 0.5rem;">
                        <label style="font-size: 0.68rem; font-weight: 700; color: #ca8a04; display: block; margin-bottom: 0.2rem;">🟡 Yellow Flag Observation</label>
                        <textarea id="dr-input-yellow-flag" class="sidebar-search-input" rows="2" style="width: 100%; font-size: 0.74rem; padding: 0.4rem; border: 1px solid #fef08a; border-radius: 6px; resize: vertical;" placeholder="Watch-list ponds, routine aeration repairs, minor observations..."></textarea>
                    </div>

                    <div>
                        <label style="font-size: 0.68rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.2rem;">⚙️ Facility Daily Activity Update</label>
                        <textarea id="dr-input-facility-act" class="sidebar-search-input" rows="2" style="width: 100%; font-size: 0.74rem; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical;" placeholder="Main canal pumping, feed warehouse delivery, staff deployments..."></textarea>
                    </div>
                </div>

                <!-- Card 3: Environmental & Windy Weather Forecast -->
                <div class="card panel-card" style="padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.78rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>🌦️ Weather &amp; Lab Telemetry</span>
                        <button type="button" id="btn-fetch-weather" class="btn-action btn-secondary" style="padding: 2px 8px; font-size: 0.68rem; border-radius: 4px; cursor: pointer;" title="Fetch live 5-day Setiu forecast via Open-Meteo / Windy ECMWF">
                            Fetch Windy/Setiu
                        </button>
                    </div>

                    <!-- Lab Reference Picture & Table Dropzone -->
                    <div id="dr-lab-dock-container" style="background: #f8fafc; border: 2px dashed #93c5fd; border-radius: 6px; padding: 0.5rem; margin-bottom: 0.65rem;">
                        <input type="file" id="dr-lab-file-input" accept="image/*" style="display: none;" />
                        
                        <!-- Paste & Upload Prompt -->
                        <div id="dr-lab-image-placeholder" style="text-align: center; cursor: pointer; padding: 0.25rem 0;">
                            <div style="font-size: 1.1rem; margin-bottom: 0.15rem;">🖼️ / 📋</div>
                            <div style="font-size: 0.72rem; font-weight: 700; color: #0284c7;">
                                Paste Lab Email Picture or Table Here (Ctrl + V)
                            </div>
                            <div style="font-size: 0.64rem; color: #64748b; margin-top: 1px;">
                                Docks your lab picture right here for side-by-side reference • Click to upload
                            </div>
                        </div>

                        <!-- Docked Image Viewer (Shown when picture is pasted or uploaded) -->
                        <div id="dr-lab-docked-view" style="display: none;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem; font-size: 0.68rem; font-weight: 700; color: #0369a1;">
                                <span>📸 Docked Lab Email Reference</span>
                                <div style="display: flex; gap: 0.3rem;">
                                    <button type="button" id="btn-zoom-lab-img" class="btn-action btn-secondary" style="padding: 1px 6px; font-size: 0.63rem; border-radius: 3px; cursor: pointer;" title="Toggle 100% full scale zoom">🔍 Zoom</button>
                                    <button type="button" id="btn-clear-lab-img" class="btn-action btn-secondary" style="padding: 1px 6px; font-size: 0.63rem; border-radius: 3px; color: #dc2626; cursor: pointer;" title="Remove docked picture">✕ Clear</button>
                                </div>
                            </div>
                            <div style="max-height: 220px; overflow: auto; border: 1px solid #cbd5e1; border-radius: 4px; background: #ffffff;">
                                <img id="dr-lab-docked-img" src="" alt="Docked Lab Sheet" style="width: 100%; display: block; border-radius: 3px; transition: transform 0.2s;" />
                            </div>
                        </div>

                        <!-- Optional Text Table Paste Fallback -->
                        <div style="margin-top: 0.4rem; padding-top: 0.35rem; border-top: 1px dashed #cbd5e1; display: flex; align-items: center; gap: 0.3rem;">
                            <input type="text" id="dr-input-lab-paste" class="sidebar-search-input" style="flex: 1; font-size: 0.67rem; padding: 0.25rem 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px;" placeholder="Or paste text table (Ctrl + V)..." />
                            <button type="button" id="btn-sample-lab-data" class="btn-action btn-secondary" style="padding: 2px 6px; font-size: 0.65rem; border-radius: 4px; white-space: nowrap; cursor: pointer;" title="Load sample from Lab email to test extraction">
                                ✨ Sample
                            </button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-bottom: 0.5rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Pond Salinity</label>
                            <input type="text" id="dr-input-salinity" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="29 ppt" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">AM Water Temp</label>
                            <input type="text" id="dr-input-am-temp" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="30.45°C" />
                        </div>
                    </div>

                    <div style="margin-bottom: 0.5rem;">
                        <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Main Drainage Canal (MDC)</label>
                        <input type="text" id="dr-input-mdc" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="100 cm (No changes)" />
                    </div>

                    <!-- Laboratory 5-Day Rainfall History Entry -->
                    <div style="padding-top: 0.5rem; border-top: 1px dashed #cbd5e1;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <label style="font-size: 0.7rem; font-weight: 700; color: #0284c7; text-transform: uppercase;">
                                🌧️ Laboratory Rainfall (Past 5 Days)
                            </label>
                            <button type="button" id="btn-shift-day" class="btn-action btn-secondary" style="padding: 1px 7px; font-size: 0.65rem; font-weight: 700; border-radius: 4px; background: #e0f2fe; border: 1px solid #7dd3fc; color: #0284c7; cursor: pointer;" title="Roll previous days forward so you only need to enter today's new reading on the left">
                                ➕ Shift 1 Day
                            </button>
                        </div>
                        <div style="font-size: 0.65rem; color: #64748b; margin-bottom: 0.35rem;">
                            Enter dates &amp; daily total rainfall (mm) — <strong>Newest (Today) on Left</strong>:
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.25rem; text-align: center;">
                            <div>
                                <input type="text" id="dr-rf-date-0" class="sidebar-search-input" style="width: 100%; font-size: 0.67rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 600;" placeholder="Date" value="04-Nov" />
                                <input type="text" id="dr-rf-mm-0" class="sidebar-search-input" style="width: 100%; font-size: 0.72rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 2px; font-weight: 700; color: #b91c1c; background: #fff1f2;" placeholder="mm" value="1.00" />
                            </div>
                            <div>
                                <input type="text" id="dr-rf-date-1" class="sidebar-search-input" style="width: 100%; font-size: 0.67rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 600;" placeholder="Date" value="03-Nov" />
                                <input type="text" id="dr-rf-mm-1" class="sidebar-search-input" style="width: 100%; font-size: 0.72rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 2px; font-weight: 700; color: #b91c1c; background: #fff1f2;" placeholder="mm" value="4.20" />
                            </div>
                            <div>
                                <input type="text" id="dr-rf-date-2" class="sidebar-search-input" style="width: 100%; font-size: 0.67rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 600;" placeholder="Date" value="02-Nov" />
                                <input type="text" id="dr-rf-mm-2" class="sidebar-search-input" style="width: 100%; font-size: 0.72rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 2px; font-weight: 700; color: #b91c1c; background: #fff1f2;" placeholder="mm" value="8.60" />
                            </div>
                            <div>
                                <input type="text" id="dr-rf-date-3" class="sidebar-search-input" style="width: 100%; font-size: 0.67rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 600;" placeholder="Date" value="01-Nov" />
                                <input type="text" id="dr-rf-mm-3" class="sidebar-search-input" style="width: 100%; font-size: 0.72rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 2px; font-weight: 700; color: #0369a1;" placeholder="mm" value="0.00" />
                            </div>
                            <div>
                                <input type="text" id="dr-rf-date-4" class="sidebar-search-input" style="width: 100%; font-size: 0.67rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 600;" placeholder="Date" value="31-Oct" />
                                <input type="text" id="dr-rf-mm-4" class="sidebar-search-input" style="width: 100%; font-size: 0.72rem; padding: 0.25rem 0.15rem; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 2px; font-weight: 700; color: #0369a1;" placeholder="mm" value="0.00" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card 4: Pond Readiness & Turnaround Details -->
                <div class="card panel-card" style="padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.78rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem;">
                        🔄 Pond Readiness &amp; Cleaning Teams
                    </div>
                    <div style="margin-bottom: 0.5rem;">
                        <label style="font-size: 0.68rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 0.2rem;">Cleaning Team Assigned Ponds</label>
                        <input type="text" id="dr-input-cleaning-teams" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="" placeholder="e.g. 07.14.09, 06.11.01..." />
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #64748b;">Waiting Water Filling</label>
                            <input type="number" id="dr-input-wait-water" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="0" />
                        </div>
                        <div>
                            <label style="font-size: 0.67rem; font-weight: 600; color: #059669;">Ready for Stocking</label>
                            <input type="number" id="dr-input-ready-stock" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="0" />
                        </div>
                    </div>
                </div>

                <!-- Card 5: Stocking Records (This Month) -->
                <div class="card panel-card" style="padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.78rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>🌱 Stocking Records (This Month)</span>
                        <span id="badge-stocking-count" style="font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;">7 Ponds</span>
                    </div>
                    <div style="font-size: 0.7rem; color: #64748b; margin-bottom: 0.5rem;">
                        Auto-synchronized from <code>pond_stocking_batches</code> SSOT.
                    </div>
                    <div id="dr-stocking-list-container" style="max-height: 180px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.4rem; font-size: 0.72rem; background: #f8fafc;">
                        <!-- Auto-populated with stocking items -->
                    </div>

                    <!-- Monthly Stocking Plan Editor (Farm Plan) -->
                    <div style="margin-top: 0.75rem; padding-top: 0.6rem; border-top: 1px dashed #cbd5e1;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <label style="font-size: 0.72rem; font-weight: 700; color: #0f172a; text-transform: uppercase;">
                                🎯 Monthly Stocking Plan (Target)
                            </label>
                            <button type="button" id="btn-add-stocking-plan-row" class="btn-action btn-secondary" style="padding: 1px 7px; font-size: 0.65rem; font-weight: 700; border-radius: 4px; background: #e0f2fe; border: 1px solid #bae6fd; color: #0284c7; cursor: pointer;">
                                ➕ Add Row
                            </button>
                        </div>
                        <div style="margin-bottom: 0.4rem;">
                            <label style="font-size: 0.65rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 0.15rem;">Plan Title</label>
                            <input type="text" id="dr-input-stocking-plan-title" class="sidebar-search-input" style="width: 100%; font-size: 0.75rem; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; color: #002060;" placeholder="e.g. Stocking Plan Nov '26" />
                        </div>
                        <div id="dr-stocking-plan-container" style="max-height: 180px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">
                            <!-- Dynamically rendered editable rows -->
                        </div>
                    </div>
                </div>

                <!-- Card 6: Harvesting Schedule & Forecast (Whiteboard Reference & Editor) -->
                <div class="card panel-card" style="padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.78rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>📋 Harvesting Schedule &amp; Forecast</span>
                        <span id="badge-forecast-count" style="font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;">12 Ponds</span>
                    </div>

                    <!-- Whiteboard Photo Dock -->
                    <div style="margin-bottom: 0.75rem; padding: 0.5rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <label style="font-size: 0.7rem; font-weight: 700; color: #334155;">
                                📸 Farm Whiteboard Reference
                            </label>
                            <div style="display: flex; gap: 0.25rem;">
                                <label for="dr-whiteboard-upload" class="btn-action btn-secondary" style="padding: 1px 6px; font-size: 0.65rem; font-weight: 600; cursor: pointer; border-radius: 4px; background: #ffffff; border: 1px solid #cbd5e1; color: #334155;">
                                    📤 Upload Photo
                                </label>
                                <input type="file" id="dr-whiteboard-upload" accept="image/*" style="display: none;" />
                                <button type="button" id="btn-toggle-whiteboard-zoom" class="btn-action btn-secondary" style="padding: 1px 6px; font-size: 0.65rem; font-weight: 600; border-radius: 4px; background: #ffffff; border: 1px solid #cbd5e1; color: #334155;">
                                    🔍 Expand View
                                </button>
                            </div>
                        </div>
                        <div id="dr-whiteboard-preview-wrap" style="position: relative; max-height: 120px; overflow: hidden; border-radius: 4px; border: 1px solid #e2e8f0; text-align: center; background: #0f172a; cursor: pointer;" title="Click to expand/collapse image">
                            <img id="dr-whiteboard-img" src="/assets/whiteboard_harvest_schedule.jpg" alt="Whiteboard Harvest Schedule" style="width: 100%; max-height: 120px; object-fit: contain;" />
                        </div>
                        <div style="font-size: 0.65rem; color: #64748b; margin-top: 0.25rem;">
                            Extracted from Setiu farm weekly whiteboard. You can edit or add ponds below anytime.
                        </div>
                    </div>

                    <!-- Sub-section: Harvesting Forecast Table Editor -->
                    <div style="margin-bottom: 0.75rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <div style="font-size: 0.72rem; font-weight: 700; color: #2e7d32; text-transform: uppercase;">
                                📅 Forecast Schedule (All Days Visible)
                            </div>
                            <button type="button" id="btn-add-forecast-row" class="btn-action btn-secondary" style="padding: 1px 7px; font-size: 0.65rem; font-weight: 700; border-radius: 4px; background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; cursor: pointer;">
                                ➕ Add Pond
                            </button>
                        </div>
                        <div id="dr-forecast-reconciliation-kpi" style="margin-bottom: 0.35rem; padding: 4px 8px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; display: flex; justify-content: space-between; align-items: center;">
                            <span id="dr-forecast-reconciliation-text">Reconciliation: Loading...</span>
                        </div>
                        <div id="dr-forecast-table-container" style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">
                            <!-- Dynamically rendered forecast table -->
                        </div>
                    </div>

                    <!-- Sub-section: Harvest Report (This Week - Daily_Harvest_Log.xlsx) Editor -->
                    <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <div style="font-size: 0.72rem; font-weight: 700; color: #002060; text-transform: uppercase;">
                                🌾 Harvest Report (This Week Plan)
                            </div>
                            <div style="display: flex; gap: 0.25rem;">
                                <button type="button" id="btn-refresh-harvest-log" class="btn-action btn-secondary" style="padding: 1px 7px; font-size: 0.65rem; font-weight: 700; border-radius: 4px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; cursor: pointer;" title="Reload latest entries from Daily_Harvest_Log.xlsx">
                                    🔄 Sync Excel
                                </button>
                                <button type="button" id="btn-add-harvest-row" class="btn-action btn-secondary" style="padding: 1px 7px; font-size: 0.65rem; font-weight: 700; border-radius: 4px; background: #e0f2fe; border: 1px solid #bae6fd; color: #0284c7; cursor: pointer;">
                                    ➕ Add Pond
                                </button>
                            </div>
                        </div>
                        <div style="font-size: 0.65rem; color: #64748b; margin-bottom: 0.3rem;">
                            Sourced from <code>Daily_Harvest_Log.xlsx</code> • Weight &amp; ABW are Plan. Actuals left empty.
                        </div>
                        <div id="dr-harvest-report-container" style="max-height: 220px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">
                            <!-- Dynamically rendered completed harvest table -->
                        </div>
                    </div>
                </div>

            </div>

            <!-- ================= RIGHT COLUMN: LIVE EMAIL WYSIWYG PREVIEW ================= -->
            <div class="card panel-card" style="flex: 1; padding: 1.25rem; border-radius: 8px; overflow-x: auto;">
                <div style="margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                    <div style="font-size: 0.8rem; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.05em;">
                        👁️ Live Email Body Preview (As rendered in Outlook / Gmail)
                    </div>
                    <div style="font-size: 0.72rem; color: #64748b;">
                        Click <strong>"Copy to Email Body"</strong>, then press <kbd style="background:#f1f5f9; padding:2px 6px; border-radius:3px; border:1px solid #cbd5e1; font-weight:700;">Ctrl + V</kbd> in your email draft.
                    </div>
                </div>

                <!-- Email Container Canvas -->
                <div id="daily-report-preview-canvas" style="width: 100%; min-width: 780px;">
                    <!-- Rendered HTML will be injected here -->
                </div>
            </div>

        </div>

    </div>
    `;
}
