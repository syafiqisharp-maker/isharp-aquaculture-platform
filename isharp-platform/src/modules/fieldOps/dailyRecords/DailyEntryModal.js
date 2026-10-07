/**
 * iSHARP DBMS 2.0 — Field Operations: Daily Entry Sheet Modal Component
 * Orchestrates:
 * - 1-Tap Feed Steppers (-5, -1, +1, +5)
 * - 1-Tap Tray Remnant Chips (0%, 5%, 10%, 15%, 25%)
 * - 1-Tap Water Level Steppers (-5, -2, +2, +5)
 * - 3D Spherical Water Colour Swatches (4x2 Grid)
 * - Dynamic Multi-item Minerals Application Rows
 * - Dynamic Multi-item Probiotics Application Rows
 * - Smart Yesterday Carry-Forward Pre-fill
 * - Sequential "Save & Next Pond" rapid logging
 * - OfflineSync & Supabase persistence
 */

import { DailyRecordsRepository } from "../../../infrastructure/repositories/dailyRecordsRepository.js";
import { MineralProbioticRepository } from "../../../infrastructure/repositories/mineralProbioticRepository.js";
import { calculateDOC } from "../../../domain/biometrics.js";
import { Toast } from "../../../components/Toast.js";
import { OfflineSync } from "../offlineSync.js";
import {
    getLocalDateStr,
    formatLocalDateDisplay,
    getWaterColourMeta,
    STANDARD_MINERALS,
    STANDARD_PROBIOTICS,
    WATER_COLOUR_OPTIONS
} from "./dailyRecordsConstants.js";
import { renderDailyEntryModalMarkup } from "./dailyEntryModalTemplate.js";

export class DailyEntryModal {
    /**
     * @param {HTMLElement} container
     * @param {object} callbacks { onRecordSaved, onClose, onPondSwitched }
     */
    constructor(container, callbacks = {}) {
        this.container = container;
        this.callbacks = callbacks;

        this.currentPond = null;
        this.activePondsList = [];
        this.records = [];
        this.treatmentsByDate = new Map();

        this.activeModalRecord = null;
        this.isModalOnlyMode = false;
        this.isSaving = false;
        this._hasBoundEscapeKey = false;
    }

    /**
     * Generates modal HTML markup
     * @param {object} pond
     * @param {Array} activePondsList
     * @param {boolean} isModalOnlyMode
     * @returns {string}
     */
    static renderMarkup(pond, activePondsList = [], isModalOnlyMode = false) {
        return renderDailyEntryModalMarkup(pond, activePondsList, isModalOnlyMode);
    }

    /**
     * Initializes modal state with parent context
     */
    initContext(currentPond, activePondsList, records, treatmentsByDate, isModalOnlyMode = false) {
        this.currentPond = currentPond;
        this.activePondsList = activePondsList || [];
        this.records = records || [];
        this.treatmentsByDate = treatmentsByDate || new Map();
        this.isModalOnlyMode = isModalOnlyMode;
    }

    /**
     * Binds modal form interactions, steppers, chips, and submission handlers
     */
    bindEvents() {
        const modal = (this.container && this.container.querySelector("#modal-daily-entry")) || document.getElementById("modal-daily-entry");
        const btnClose = this.container ? this.container.querySelector("#btn-close-entry-modal") : document.getElementById("btn-close-entry-modal");
        const btnCancel = this.container ? this.container.querySelector("#btn-cancel-modal") : document.getElementById("btn-cancel-modal");
        
        if (btnClose) {
            btnClose.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeModal();
            });
        }
        if (btnCancel) {
            btnCancel.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeModal();
            });
        }
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal || e.target.closest("#btn-close-entry-modal") || e.target.closest("#btn-cancel-modal")) {
                    e.preventDefault();
                    this.closeModal();
                }
            });
        }

        if (!this._hasBoundEscapeKey) {
            this._hasBoundEscapeKey = true;
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    const m = (this.container && this.container.querySelector("#modal-daily-entry")) || document.getElementById("modal-daily-entry");
                    if (m && m.style.display !== "none" && !m.classList.contains("hidden")) {
                        this.closeModal();
                    }
                }
            });
        }

        // Sequential Pond Navigation inside Modal
        const btnPrevPond = this.container.querySelector("#btn-modal-prev-pond");
        const btnNextPond = this.container.querySelector("#btn-modal-next-pond");
        const btnOpenFullBook = this.container.querySelector("#btn-modal-open-full-book");
        if (btnPrevPond) btnPrevPond.addEventListener("click", () => this.switchPondInModal(-1));
        if (btnNextPond) btnNextPond.addEventListener("click", () => this.switchPondInModal(1));
        if (btnOpenFullBook) {
            btnOpenFullBook.addEventListener("click", () => {
                this.isModalOnlyMode = false;
                this.container.classList.remove("daily-mount-modal-only");
                const mapMount = document.getElementById("field-ops-map-mount");
                if (mapMount) mapMount.style.display = "none";
                this.closeModal();
                if (this.callbacks.onOpenFullBook) this.callbacks.onOpenFullBook();
            });
        }

        // 1-Tap Feed Steppers (-5, -1, +1, +5)
        const inputFeed = this.container.querySelector("#input-feed-kg");
        this.container.querySelectorAll(".btn-feed-stepper").forEach(btn => {
            btn.addEventListener("click", () => {
                if (!inputFeed) return;
                const step = parseFloat(btn.getAttribute("data-step") || "0");
                const curr = parseFloat(inputFeed.value || "0") || 0;
                const next = Math.max(0, Math.round((curr + step) * 10) / 10);
                inputFeed.value = next.toFixed(1).replace(/\.0$/, "");
            });
        });

        // 1-Tap Tray Remnant Preset Chips (0%, 5%, 10%, 15%, 25%)
        const inputTray = this.container.querySelector("#input-tray-pct");
        this.container.querySelectorAll(".btn-tray-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                if (!inputTray) return;
                inputTray.value = chip.getAttribute("data-pct") || "0";
                this.syncPresetHighlights();
            });
        });
        if (inputTray) inputTray.addEventListener("input", () => this.syncPresetHighlights());

        // 1-Tap Water Level Steppers (-5, -2, +2, +5)
        const inputWaterLevel = this.container.querySelector("#input-water-level");
        this.container.querySelectorAll(".btn-water-stepper").forEach(btn => {
            btn.addEventListener("click", () => {
                if (!inputWaterLevel) return;
                const step = parseInt(btn.getAttribute("data-step") || "0", 10);
                const curr = parseInt(inputWaterLevel.value || "110", 10) || 110;
                inputWaterLevel.value = String(Math.max(0, curr + step));
            });
        });

        // 1-Tap Water Colour 3D Spherical Swatches
        const inputWaterColour = this.container.querySelector("#input-water-colour");
        const colourLabel = this.container.querySelector("#selected-water-colour-label");
        this.container.querySelectorAll(".water-swatch-card").forEach(card => {
            card.addEventListener("click", () => {
                const val = card.getAttribute("data-val") || "";
                if (inputWaterColour) inputWaterColour.value = val;
                const meta = getWaterColourMeta(val);
                if (colourLabel) {
                    colourLabel.textContent = meta ? meta.fullLabel : (val || "— Select Colour —");
                }
                this.container.querySelectorAll(".water-swatch-card").forEach(c => {
                    c.classList.toggle("active", c.getAttribute("data-val") === val);
                    c.classList.toggle("selected", c.getAttribute("data-val") === val);
                });
            });
        });

        // Progressive Disclosure Toggles for Optional Treatments
        const minCard = this.container.querySelector("#section-minerals-card");
        const proCard = this.container.querySelector("#section-probiotics-card");
        const mineralContainer = this.container.querySelector("#mineral-rows-container");
        const probioticContainer = this.container.querySelector("#probiotic-rows-container");

        const btnToggleMin = this.container.querySelector("#btn-toggle-minerals-sec");
        if (btnToggleMin && minCard) {
            btnToggleMin.addEventListener("click", () => {
                const isHidden = minCard.style.display === "none";
                minCard.style.display = isHidden ? "block" : "none";
                if (isHidden && mineralContainer && mineralContainer.children.length === 0) {
                    this.appendMineralRow(mineralContainer, { name: "", amount: "", unit: "KG" });
                }
                this.syncOptionalTogglePills();
            });
        }

        const btnTogglePro = this.container.querySelector("#btn-toggle-probiotics-sec");
        if (btnTogglePro && proCard) {
            btnTogglePro.addEventListener("click", () => {
                const isHidden = proCard.style.display === "none";
                proCard.style.display = isHidden ? "block" : "none";
                if (isHidden && probioticContainer && probioticContainer.children.length === 0) {
                    this.appendProbioticRow(probioticContainer, { name: "", amount: "", unit: "L" });
                }
                this.syncOptionalTogglePills();
            });
        }

        // Date input change -> recalculate DOC
        const inputDate = this.container.querySelector("#input-entry-date");
        const calcDocEl = this.container.querySelector("#modal-calc-doc");
        if (inputDate) {
            inputDate.addEventListener("change", () => {
                const newDate = inputDate.value;
                if (this.currentPond && this.currentPond.stck_date && newDate) {
                    const d = calculateDOC(this.currentPond.stck_date, newDate);
                    calcDocEl.textContent = `DOC ${d}`;
                } else {
                    calcDocEl.textContent = `DOC —`;
                }
            });
        }

        // Add Dynamic Row Buttons
        const btnAddMineral = this.container.querySelector("#btn-add-mineral-row");
        if (btnAddMineral && mineralContainer) {
            btnAddMineral.addEventListener("click", () => {
                this.appendMineralRow(mineralContainer, { name: "", amount: "", unit: "KG" });
            });
        }

        const btnAddProbiotic = this.container.querySelector("#btn-add-probiotic-row");
        if (btnAddProbiotic && probioticContainer) {
            btnAddProbiotic.addEventListener("click", () => {
                this.appendProbioticRow(probioticContainer, { name: "", amount: "", unit: "L" });
            });
        }

        // Form Submit
        const form = this.container.querySelector("#form-daily-record");
        if (form) {
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                await this.handleSaveRecord({ advanceToNextPond: false });
            });
        }

        // Save & Next Pond Button
        const btnSaveNext = this.container.querySelector("#btn-save-and-next");
        if (btnSaveNext) {
            btnSaveNext.addEventListener("click", async () => {
                await this.handleSaveRecord({ advanceToNextPond: true });
            });
        }

        // Delete Button
        const btnDelete = this.container.querySelector("#btn-delete-entry");
        if (btnDelete) {
            btnDelete.addEventListener("click", async () => {
                if (!this.activeModalRecord || !this.activeModalRecord.id) return;
                if (confirm(`Are you sure you want to delete the daily record for ${this.activeModalRecord.log_date}?`)) {
                    try {
                        await DailyRecordsRepository.deleteRecord(this.activeModalRecord.id);
                        Toast.success("Daily record deleted.");
                        if (this.callbacks.onRecordSaved) this.callbacks.onRecordSaved();
                        this.closeModal();
                    } catch (err) {
                        Toast.error("Failed to delete record: " + err.message);
                    }
                }
            });
        }
    }

    /**
     * Appends an interactive Mineral row
     */
    appendMineralRow(container, item = { name: "", amount: "", unit: "KG" }) {
        const row = document.createElement("div");
        row.className = "mineral-item-row";

        row.innerHTML = `
            <input type="text" list="minerals-autocomplete" class="form-control mineral-name" placeholder="Search or type mineral name" value="${item.name || item.item_name || ''}" style="font-size: 0.85rem; font-weight: 600;" />
            <input type="number" step="0.1" min="0" class="form-control mineral-amount" placeholder="Qty" value="${item.amount !== undefined ? item.amount : ''}" style="font-size: 0.85rem; font-weight: 700;" />
            <select class="form-control mineral-unit" style="font-size: 0.82rem; font-weight: 700;">
                <option value="KG" ${(item.unit || '').toUpperCase() === 'KG' ? 'selected' : ''}>KG</option>
                <option value="L" ${(item.unit || '').toUpperCase() === 'L' ? 'selected' : ''}>L</option>
                <option value="bag" ${(item.unit || '').toLowerCase() === 'bag' ? 'selected' : ''}>bag</option>
                <option value="g" ${(item.unit || '').toLowerCase() === 'g' ? 'selected' : ''}>g</option>
            </select>
            <button type="button" class="btn-remove-row" style="background: #fee2e2; border: 1px solid #fecaca; color: #ef4444; border-radius: 6px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                🗑️
            </button>
        `;

        row.querySelector(".btn-remove-row").addEventListener("click", () => row.remove());
        container.appendChild(row);
    }

    /**
     * Appends an interactive Probiotic row
     */
    appendProbioticRow(container, item = { name: "", amount: "", unit: "L" }) {
        const row = document.createElement("div");
        row.className = "probiotic-item-row";

        row.innerHTML = `
            <input type="text" list="probiotics-autocomplete" class="form-control probiotic-name" placeholder="Search or type probiotic name" value="${item.name || item.item_name || ''}" style="font-size: 0.85rem; font-weight: 600;" />
            <input type="number" step="0.1" min="0" class="form-control probiotic-amount" placeholder="Qty" value="${item.amount !== undefined ? item.amount : ''}" style="font-size: 0.85rem; font-weight: 700;" />
            <select class="form-control probiotic-unit" style="font-size: 0.82rem; font-weight: 700;">
                <option value="L" ${(item.unit || '').toUpperCase() === 'L' ? 'selected' : ''}>L</option>
                <option value="KG" ${(item.unit || '').toUpperCase() === 'KG' ? 'selected' : ''}>KG</option>
                <option value="bag" ${(item.unit || '').toLowerCase() === 'bag' ? 'selected' : ''}>bag</option>
                <option value="g" ${(item.unit || '').toLowerCase() === 'g' ? 'selected' : ''}>g</option>
            </select>
            <button type="button" class="btn-remove-row" style="background: #fee2e2; border: 1px solid #fecaca; color: #ef4444; border-radius: 6px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                🗑️
            </button>
        `;

        row.querySelector(".btn-remove-row").addEventListener("click", () => row.remove());
        container.appendChild(row);
    }

    syncPresetHighlights() {
        const inputTray = this.container.querySelector("#input-tray-pct");
        const inputColour = this.container.querySelector("#input-water-colour");
        const selectedLabel = this.container.querySelector("#selected-water-colour-label");

        const trayVal = inputTray ? String(inputTray.value).trim() : "";
        this.container.querySelectorAll(".btn-tray-chip").forEach(chip => {
            chip.classList.toggle("active", chip.getAttribute("data-pct") === trayVal);
        });

        const colVal = inputColour ? inputColour.value : "";
        const meta = getWaterColourMeta(colVal);
        const activeValue = meta ? meta.value : colVal;

        if (selectedLabel) {
            selectedLabel.textContent = meta ? meta.fullLabel : (colVal || "— Select Colour —");
        }

        this.container.querySelectorAll(".water-swatch-card").forEach(card => {
            const isMatch = card.getAttribute("data-val") === activeValue;
            card.classList.toggle("active", isMatch);
            card.classList.toggle("selected", isMatch);
        });
    }

    syncOptionalTogglePills() {
        const minCard = this.container.querySelector("#section-minerals-card");
        const proCard = this.container.querySelector("#section-probiotics-card");
        const btnMin = this.container.querySelector("#btn-toggle-minerals-sec");
        const btnPro = this.container.querySelector("#btn-toggle-probiotics-sec");

        if (btnMin && minCard) {
            const open = minCard.style.display !== "none";
            btnMin.classList.toggle("active", open);
            btnMin.innerHTML = open ? "🧪 Minerals ▲" : "🧪 + Minerals";
        }
        if (btnPro && proCard) {
            const open = proCard.style.display !== "none";
            btnPro.classList.toggle("active", open);
            btnPro.innerHTML = open ? "🦠 Probiotics ▲" : "🦠 + Probiotics";
        }
    }

    /**
     * Sequential pond switching
     */
    async switchPondInModal(direction = 1) {
        if (!this.activePondsList || this.activePondsList.length === 0) return null;
        const currPond = this.currentPond;
        const currIdx = this.activePondsList.findIndex(p =>
            (p.pond_index && p.pond_index === currPond.pond_index) ||
            (p.pond && p.pond === currPond.pond)
        );
        const nextIdx = (currIdx + direction + this.activePondsList.length) % this.activePondsList.length;
        const nextPond = this.activePondsList[nextIdx];

        if (nextPond && this.callbacks.onPondSwitched) {
            await this.callbacks.onPondSwitched(nextPond);
        }
        return nextPond;
    }

    /**
     * Opens modal pre-populated for a given date
     */
    openEntryModal(targetDate, existingRecord = null, options = { autoFocusFeed: true }) {
        this.activeModalRecord = existingRecord;
        const modal = (this.container && this.container.querySelector("#modal-daily-entry")) || document.getElementById("modal-daily-entry");
        const titleEl = this.container.querySelector("#modal-entry-title");
        const subTitleEl = this.container.querySelector("#modal-entry-subtitle");
        const inputDate = this.container.querySelector("#input-entry-date");
        const calcDocEl = this.container.querySelector("#modal-calc-doc");
        const inputFeed = this.container.querySelector("#input-feed-kg");
        const inputTray = this.container.querySelector("#input-tray-pct");
        const inputWaterLevel = this.container.querySelector("#input-water-level");
        const inputColour = this.container.querySelector("#input-water-colour");
        const inputMortality = this.container.querySelector("#input-mortality");
        const inputRemarks = this.container.querySelector("#input-remarks");
        const mineralContainer = this.container.querySelector("#mineral-rows-container");
        const probioticContainer = this.container.querySelector("#probiotic-rows-container");
        const btnDelete = this.container.querySelector("#btn-delete-entry");
        const carryBadge = this.container.querySelector("#carry-forward-badge");
        const carryText = this.container.querySelector("#carry-forward-text");
        const minCard = this.container.querySelector("#section-minerals-card");
        const proCard = this.container.querySelector("#section-probiotics-card");

        // Dynamic Switcher Bar Elements
        const switcherTitleEl = this.container.querySelector("#modal-switcher-pond-title");
        const switcherSubTitleEl = this.container.querySelector("#modal-switcher-pond-subtitle");

        const pondLabel = this.currentPond ? (this.currentPond.pond || this.currentPond.pond_index || "Pond") : "Pond";
        const dateVal = targetDate || getLocalDateStr();
        if (inputDate) inputDate.value = dateVal;

        const doc = (this.currentPond && this.currentPond.stck_date) ? calculateDOC(this.currentPond.stck_date, dateVal) : 0;
        if (calcDocEl) calcDocEl.textContent = `DOC ${doc}`;

        // Update Sequential Pond Switcher Bar Title & Subtitle if present
        if (this.activePondsList && this.activePondsList.length > 0) {
            const currIdx = this.activePondsList.findIndex(p =>
                (p.pond_index && p.pond_index === this.currentPond?.pond_index) ||
                (p.pond && p.pond === this.currentPond?.pond)
            );
            const displayIdx = currIdx >= 0 ? currIdx + 1 : 1;
            const totalActive = this.activePondsList.length;

            if (switcherTitleEl) {
                switcherTitleEl.textContent = `Pond ${pondLabel} · DOC ${doc || '—'}`;
            }
            if (switcherSubTitleEl) {
                const fullBookBtn = this.isModalOnlyMode ? ` · <button type="button" id="btn-modal-open-full-book" style="background: none; border: none; color: #0284c7; font-weight: 800; font-size: 0.7rem; text-decoration: underline; cursor: pointer; padding: 0;">📖 Full Book</button>` : '';
                switcherSubTitleEl.innerHTML = `Active Pond ${displayIdx} of ${totalActive}${fullBookBtn}`;

                // Re-bind Full Book button if rendered
                const btnFull = switcherSubTitleEl.querySelector("#btn-modal-open-full-book");
                if (btnFull) {
                    btnFull.addEventListener("click", () => {
                        this.isModalOnlyMode = false;
                        this.container.classList.remove("daily-mount-modal-only");
                        const mapMount = document.getElementById("field-ops-map-mount");
                        if (mapMount) mapMount.style.display = "none";
                        this.closeModal();
                        if (this.callbacks.onOpenFullBook) this.callbacks.onOpenFullBook();
                    });
                }
            }
        }

        if (mineralContainer) mineralContainer.innerHTML = "";
        if (probioticContainer) probioticContainer.innerHTML = "";

        const dayTreatments = this.treatmentsByDate.get(dateVal) || [];
        const existingMinerals = dayTreatments.filter(t => t.category === 'MINERAL');
        const existingProbiotics = dayTreatments.filter(t => t.category === 'PROBIOTIC');

        if (existingRecord) {
            if (titleEl) titleEl.textContent = `Edit Record — Pond ${pondLabel}`;
            if (subTitleEl) subTitleEl.textContent = `DOC ${doc} · ${formatLocalDateDisplay(dateVal)} (Existing Log)`;
            if (inputFeed) inputFeed.value = existingRecord.feed_kg !== null && existingRecord.feed_kg !== undefined ? existingRecord.feed_kg : "";
            if (inputTray) inputTray.value = existingRecord.feed_tray_remnant_pct !== null && existingRecord.feed_tray_remnant_pct !== undefined ? existingRecord.feed_tray_remnant_pct : "0";
            if (inputWaterLevel) inputWaterLevel.value = existingRecord.water_level_cm !== null && existingRecord.water_level_cm !== undefined ? existingRecord.water_level_cm : "110";
            if (inputColour) inputColour.value = getWaterColourMeta(existingRecord.water_colour)?.value || "Light Green";
            if (inputMortality) {
                inputMortality.value = (existingRecord.mortality_kg !== null && existingRecord.mortality_kg !== undefined)
                    ? existingRecord.mortality_kg
                    : (existingRecord.mortality_count !== null && existingRecord.mortality_count !== undefined ? existingRecord.mortality_count : "0");
            }
            if (inputRemarks) inputRemarks.value = existingRecord.remarks || "";
            if (btnDelete) btnDelete.style.display = "block";
            if (carryBadge) carryBadge.style.display = "none";
        } else {
            if (titleEl) titleEl.textContent = `Quick Log — Pond ${pondLabel}`;
            if (subTitleEl) subTitleEl.textContent = `DOC ${doc} · ${formatLocalDateDisplay(dateVal)}`;

            // Smart Yesterday Carry-Forward
            const sortedPrev = [...this.records]
                .filter(r => r && r.log_date && r.log_date < dateVal)
                .sort((a, b) => b.log_date.localeCompare(a.log_date));
            const prevRecord = sortedPrev.length > 0 ? sortedPrev[0] : (this.records.length > 0 ? this.records[0] : null);

            if (prevRecord) {
                if (inputFeed) inputFeed.value = (prevRecord.feed_kg && parseFloat(prevRecord.feed_kg) > 0) ? prevRecord.feed_kg : "";
                if (inputTray) inputTray.value = "0";
                if (inputWaterLevel) inputWaterLevel.value = prevRecord.water_level_cm || "110";
                if (inputColour) inputColour.value = getWaterColourMeta(prevRecord.water_colour)?.value || "Light Green";
                if (carryBadge && carryText) {
                    const prevFeedStr = prevRecord.feed_kg ? `${parseFloat(prevRecord.feed_kg).toFixed(1)} kg` : "—";
                    carryText.textContent = `↺ Pre-filled from ${formatLocalDateDisplay(prevRecord.log_date)} (${prevFeedStr}, ${prevRecord.water_level_cm || 110} cm)`;
                    carryBadge.style.display = "flex";
                }
            } else {
                if (inputFeed) inputFeed.value = "";
                if (inputTray) inputTray.value = "0";
                if (inputWaterLevel) inputWaterLevel.value = "110";
                if (inputColour) inputColour.value = "Light Green";
                if (carryBadge) carryBadge.style.display = "none";
            }

            if (inputMortality) inputMortality.value = "0";
            if (inputRemarks) inputRemarks.value = "";
            if (btnDelete) btnDelete.style.display = "none";
        }

        if (mineralContainer) existingMinerals.forEach(m => this.appendMineralRow(mineralContainer, m));
        if (probioticContainer) existingProbiotics.forEach(p => this.appendProbioticRow(probioticContainer, p));

        if (minCard) minCard.style.display = existingMinerals.length > 0 ? "block" : "none";
        if (proCard) proCard.style.display = existingProbiotics.length > 0 ? "block" : "none";

        this.syncPresetHighlights();
        this.syncOptionalTogglePills();

        if (modal) {
            const sheetBody = modal.querySelector(".modal-sheet-body") || modal.querySelector(".modal-dialog");
            if (sheetBody) sheetBody.scrollTop = 0;
            modal.classList.remove("hidden");
            modal.style.setProperty("display", "flex", "important");
        }
        document.getElementById("view-field-ops")?.classList.add("has-modal-open");

        const isMobileViewport = typeof window !== "undefined" && window.innerWidth <= 768;
        if (options.autoFocusFeed && !isMobileViewport && inputFeed && !inputFeed.value) {
            setTimeout(() => inputFeed.focus(), 50);
        }
    }

    closeModal() {
        const modal = (this.container && this.container.querySelector("#modal-daily-entry")) || document.getElementById("modal-daily-entry");
        if (modal) {
            modal.style.setProperty("display", "none", "important");
            modal.classList.add("hidden");
        }
        document.getElementById("view-field-ops")?.classList.remove("has-modal-open");
        if (this.callbacks.onClose) this.callbacks.onClose();
    }

    /**
     * Handles saving daily log and treatments
     */
    async handleSaveRecord({ advanceToNextPond = false } = {}) {
        const inputDate = this.container.querySelector("#input-entry-date");
        const inputFeed = this.container.querySelector("#input-feed-kg");
        const inputTray = this.container.querySelector("#input-tray-pct");
        const inputWaterLevel = this.container.querySelector("#input-water-level");
        const inputColour = this.container.querySelector("#input-water-colour");
        const inputMortality = this.container.querySelector("#input-mortality");
        const inputRemarks = this.container.querySelector("#input-remarks");
        const btnSave = this.container.querySelector("#btn-save-record");
        const btnSaveNext = this.container.querySelector("#btn-save-and-next");

        const logDate = inputDate ? inputDate.value : "";
        if (!logDate) {
            Toast.error("Please select a record date.");
            return;
        }

        const treatmentsPayload = [];
        this.container.querySelectorAll(".mineral-item-row").forEach(row => {
            const name = (row.querySelector(".mineral-name")?.value || "").trim().toUpperCase();
            const amount = parseFloat(row.querySelector(".mineral-amount")?.value || 0);
            const unit = row.querySelector(".mineral-unit")?.value || "KG";
            if (name && amount > 0) treatmentsPayload.push({ category: "MINERAL", name, amount, unit });
        });

        this.container.querySelectorAll(".probiotic-item-row").forEach(row => {
            const name = (row.querySelector(".probiotic-name")?.value || "").trim().toUpperCase();
            const amount = parseFloat(row.querySelector(".probiotic-amount")?.value || 0);
            const unit = row.querySelector(".probiotic-unit")?.value || "L";
            if (name && amount > 0) treatmentsPayload.push({ category: "PROBIOTIC", name, amount, unit });
        });

        const pondIndex = this.currentPond.pond_index;
        const pondName = this.currentPond.pond || pondIndex;
        const mortVal = (inputMortality && inputMortality.value !== "") ? parseFloat(inputMortality.value) : 0;

        const dailyPayload = {
            pond_index: pondIndex,
            pond: pondName,
            log_date: logDate,
            feed_kg: (inputFeed && inputFeed.value !== "") ? parseFloat(inputFeed.value) : 0,
            feed_tray_remnant_pct: (inputTray && inputTray.value !== "") ? parseInt(inputTray.value, 10) : 0,
            water_level_cm: (inputWaterLevel && inputWaterLevel.value !== "") ? parseFloat(inputWaterLevel.value) : null,
            water_colour: inputColour ? (inputColour.value ? inputColour.value.trim() : null) : null,
            mortality_kg: isNaN(mortVal) ? 0.0 : mortVal,
            mortality_count: isNaN(mortVal) ? 0 : Math.round(mortVal),
            remarks: (inputRemarks && inputRemarks.value) ? inputRemarks.value.trim() || null : null
        };

        if (this.activeModalRecord && this.activeModalRecord.id) {
            dailyPayload.id = this.activeModalRecord.id;
        }

        if (btnSave) {
            btnSave.disabled = true;
            btnSave.textContent = "Saving...";
        }
        if (btnSaveNext) {
            btnSaveNext.disabled = true;
            btnSaveNext.textContent = "Saving...";
        }

        try {
            const savedRecord = await DailyRecordsRepository.upsertRecord(dailyPayload);
            const recordId = (savedRecord && savedRecord.id) || (this.activeModalRecord && this.activeModalRecord.id) || null;

            await MineralProbioticRepository.syncDailyTreatments(
                recordId,
                pondIndex,
                pondName,
                logDate,
                treatmentsPayload
            );

            if (this.callbacks.onRecordSaved) this.callbacks.onRecordSaved();

            if (advanceToNextPond && this.activePondsList && this.activePondsList.length > 1) {
                const nextPond = await this.switchPondInModal(1);
                const nextName = nextPond ? (nextPond.pond || nextPond.pond_index) : "Next Pond";
                Toast.success(`✅ Saved Pond ${pondName} — Ready for Pond ${nextName}!`);
            } else if (this.isModalOnlyMode) {
                Toast.success(`✅ Saved Pond ${pondName} (${dailyPayload.feed_kg} kg)!`);
                this.closeModal();
            } else {
                Toast.success(`Daily record & treatments for ${logDate} saved!`);
                this.closeModal();
                if (this.callbacks.onReloadView) await this.callbacks.onReloadView();
            }
        } catch (err) {
            console.error("Save error:", err);
            const isNetworkErr = !OfflineSync.isOnline() || err.name === "AbortError" || /failed to fetch|network|timeout|connection/i.test(err.message || "");
            if (isNetworkErr) {
                OfflineSync.queueRequest("daily_pond_records?on_conflict=pond_index,log_date", {
                    method: "POST",
                    headers: { "Prefer": "resolution=merge-duplicates" },
                    body: dailyPayload
                }, { type: "daily_record", pondIndex, logDate });

                const validTreatments = treatmentsPayload.filter(it => it.name && parseFloat(it.amount) > 0);
                if (validTreatments.length > 0) {
                    const treatmentRows = validTreatments.map(it => ({
                        pond_index: pondIndex,
                        pond: pondName,
                        log_date: logDate,
                        category: it.category === 'PROBIOTIC' ? 'PROBIOTIC' : 'MINERAL',
                        item_name: String(it.name).trim().toUpperCase(),
                        amount: parseFloat(it.amount),
                        unit: it.unit || (it.category === 'PROBIOTIC' ? 'L' : 'KG'),
                        remarks: it.remarks || null,
                        updated_at: new Date().toISOString()
                    }));
                    OfflineSync.queueRequest("mineral_probiotic_used", {
                        method: "POST",
                        body: treatmentRows
                    }, { type: "treatments", pondIndex, logDate });
                }

                Toast.info(`📡 Saved locally (Offline). Will sync when connection is restored!`);
                if (this.callbacks.onRecordSaved) this.callbacks.onRecordSaved();
                this.closeModal();
            } else {
                Toast.error("Failed to save daily record: " + err.message);
            }
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.textContent = "💾 Save";
            }
            if (btnSaveNext) {
                btnSaveNext.disabled = false;
                btnSaveNext.textContent = "⚡ Save & Next ➔";
            }
        }
    }
}
