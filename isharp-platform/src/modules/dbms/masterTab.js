/**
 * iSHARP DBMS 2.0 — Master Tab Module (Tab 1)
 * Cycle management, operational milestones, aerator configuration, and snapshot KPIs.
 */

import { appState } from "../../state/appState.js";
import { calculateTotalActiveHP, calculateAerationDensity } from "../../domain/aeration.js";
import { calculateDOC, getEffectiveBiomassGain, getLatestSurvivalRate } from "../../domain/biometrics.js";
import { calculateFCR } from "../../domain/feeding.js";
import { isCycleClosed, formatFinalStatus, evaluateBiosecurityStatus } from "../../domain/rollover.js";
import { InventoryRepository } from "../../infrastructure/repositories/inventoryRepository.js";
import { PondRepository } from "../../infrastructure/repositories/pondRepository.js";
import { SamplingRepository } from "../../infrastructure/repositories/samplingRepository.js";
import { HarvestRepository } from "../../infrastructure/repositories/harvestRepository.js";
import { LabRepository } from "../../infrastructure/repositories/labRepository.js";
import { hasPermission, PERMISSIONS } from "../../config/permissions.js";
import { Toast } from "../../components/Toast.js";
import { DOM_IDS } from "../../config/domContracts.js";

export class MasterTab {
    constructor() {
        this.dom = {
            // Milestone Inputs
            inputDateCycle: document.getElementById(DOM_IDS.MASTER.INPUT_DATE_CYCLE),
            inputDateCleaning: document.getElementById(DOM_IDS.MASTER.INPUT_DATE_CLEANING),
            inputDateRepair: document.getElementById(DOM_IDS.MASTER.INPUT_DATE_REPAIR),
            inputDateFilling: document.getElementById(DOM_IDS.MASTER.INPUT_DATE_FILLING),
            inputDateCulture: document.getElementById(DOM_IDS.MASTER.INPUT_DATE_CULTURE),
            inputDateBabyBox: document.getElementById(DOM_IDS.MASTER.INPUT_DATE_BABYBOX),
            inputDateQaqc: document.getElementById(DOM_IDS.MASTER.INPUT_DATE_QAQC),
            inputDateReady: document.getElementById(DOM_IDS.MASTER.INPUT_DATE_READY),
            inputDatePlanStock: document.getElementById(DOM_IDS.MASTER.INPUT_DATE_PLAN_STOCK),
            inputIdleDays: document.getElementById(DOM_IDS.MASTER.INPUT_IDLE_DAYS),
            inputIdleStatus: document.getElementById(DOM_IDS.MASTER.INPUT_IDLE_STATUS),
            inputWaterType: document.getElementById(DOM_IDS.MASTER.INPUT_WATER_TYPE),

            // Aerator Steppers
            aerator1hp: document.getElementById(DOM_IDS.MASTER.AERATOR_1HP),
            aerator2hp: document.getElementById(DOM_IDS.MASTER.AERATOR_2HP),
            aerator4hp: document.getElementById(DOM_IDS.MASTER.AERATOR_4HP),
            summaryTotalActiveHp: document.getElementById(DOM_IDS.MASTER.SUMMARY_ACTIVE_HP),
            badgeTotalHp: document.getElementById(DOM_IDS.BANNER.BADGE_TOTAL_HP),

            // Hero Snapshot Cards (Row 1 & Row 2)
            snapSpecies: document.getElementById(DOM_IDS.MASTER.SNAP_SPECIES) || document.getElementById(DOM_IDS.BANNER.BADGE_SPECIES) || document.getElementById("snap-species"),
            snapGenetic: document.getElementById(DOM_IDS.MASTER.SNAP_SPECIES_FOOT) || document.getElementById(DOM_IDS.BANNER.BADGE_GENETIC) || document.getElementById("snap-genetic"),
            snapHatcherySource: document.getElementById(DOM_IDS.MASTER.SNAP_HATCHERY_SOURCE),
            snapHatcheryFoot: document.getElementById(DOM_IDS.MASTER.SNAP_HATCHERY_FOOT),
            snapDocVal: document.getElementById(DOM_IDS.MASTER.SNAP_DOC),
            snapDocFoot: document.getElementById(DOM_IDS.MASTER.SNAP_DOC_FOOT),
            snapLatestAbw: document.getElementById(DOM_IDS.MASTER.SNAP_LATEST_ABW),
            snapAbwFoot: document.getElementById(DOM_IDS.MASTER.SNAP_ABW_FOOT),
            snapFcrVal: document.getElementById(DOM_IDS.MASTER.SNAP_FCR),
            snapFcrFoot: document.getElementById(DOM_IDS.MASTER.SNAP_FCR_FOOT),
            snapBiomassHarvestVal: document.getElementById(DOM_IDS.MASTER.SNAP_BIOMASS_HARVEST),
            snapBiomassHarvestTitle: document.getElementById(DOM_IDS.MASTER.SNAP_BIOMASS_HARVEST_TITLE),
            snapBiomassHarvestFoot: document.getElementById(DOM_IDS.MASTER.SNAP_BIOMASS_HARVEST_FOOT),
            snapFinalStatusBadge: document.getElementById(DOM_IDS.MASTER.SNAP_FINAL_STATUS_BADGE),
            snapDiseaseStatusVal: document.getElementById(DOM_IDS.MASTER.SNAP_DISEASE_STATUS),
            snapDiseaseStatusFoot: document.getElementById(DOM_IDS.MASTER.SNAP_DISEASE_STATUS_FOOT),
            snapInitiativeVal: document.getElementById(DOM_IDS.MASTER.SNAP_INITIATIVE),
            snapInitiativeFoot: document.getElementById(DOM_IDS.MASTER.SNAP_INITIATIVE_FOOT),

            // Legacy hidden trackers
            snapStockedPcs: document.getElementById(DOM_IDS.MASTER.SNAP_STOCKED_PCS),
            snapStockedFoot: document.getElementById(DOM_IDS.MASTER.SNAP_STOCKED_FOOT),
            snapTotalFeed: document.getElementById(DOM_IDS.MASTER.SNAP_TOTAL_FEED),
            snapFeedFoot: document.getElementById(DOM_IDS.MASTER.SNAP_FEED_FOOT),
            snapTotalHarvest: document.getElementById(DOM_IDS.MASTER.SNAP_TOTAL_HARVEST),
            snapHarvestFoot: document.getElementById(DOM_IDS.MASTER.SNAP_HARVEST_FOOT),
            snapCycleStatus: document.getElementById(DOM_IDS.MASTER.SNAP_CYCLE_STATUS)
        };

        this.btnSave = document.getElementById(DOM_IDS.MASTER.BTN_SAVE_MASTER);
        this.btnSaveAerators = document.getElementById(DOM_IDS.MASTER.BTN_SAVE_AERATORS);

        this.bindEvents();
        appState.subscribe("pondChanged", (pond) => this.render(pond));
        appState.subscribe("roleChanged", () => this.applyRolePermissions());
    }

    bindEvents() {
        // Real-time aerator HP recalculation
        [this.dom.aerator1hp, this.dom.aerator2hp, this.dom.aerator4hp].forEach(input => {
            if (input) {
                input.addEventListener("input", () => this.recalculateAeratorHP());
            }
        });

        // Inline Save buttons
        if (this.btnSave) {
            this.btnSave.addEventListener("click", () => this.savePreparationDates());
        }
        if (this.btnSaveAerators) {
            this.btnSaveAerators.addEventListener("click", () => this.saveAeratorInventory());
        }
    }

    async render(pond) {
        if (!pond) return;

        // Populate Milestone Dates
        if (this.dom.inputDateCycle) this.dom.inputDateCycle.value = pond.date_cycle || "";
        if (this.dom.inputDateCleaning) this.dom.inputDateCleaning.value = pond.date_cleaning || "";
        if (this.dom.inputDateRepair) this.dom.inputDateRepair.value = pond.date_repair || "";
        if (this.dom.inputDateFilling) this.dom.inputDateFilling.value = pond.date_filling || "";
        if (this.dom.inputDateCulture) this.dom.inputDateCulture.value = pond.date_culture || "";
        if (this.dom.inputDateBabyBox) this.dom.inputDateBabyBox.value = pond.date_baby_box || pond.date_babybox || "";
        if (this.dom.inputDateQaqc) this.dom.inputDateQaqc.value = pond.date_qaqc || "";
        if (this.dom.inputDateReady) this.dom.inputDateReady.value = pond.date_ready || "";
        if (this.dom.inputDatePlanStock) this.dom.inputDatePlanStock.value = pond.date_plan_stock || "";
        if (this.dom.inputIdleDays) this.dom.inputIdleDays.value = pond.idle_days || "0";
        if (this.dom.inputIdleStatus) this.dom.inputIdleStatus.value = pond.idle_status || "";
        if (this.dom.inputWaterType) this.dom.inputWaterType.value = pond.water_type || "Marine (Saltwater)";

        // Populate Real-Time Snapshots from Database
        await this.loadSnapshots(pond);

        // Fetch Aerator Inventory from DB
        await this.loadAerators(pond.pond_index, pond.area);

        // Apply RBAC
        this.applyRolePermissions();
    }

    /**
     * Loads live cycle metrics (Stocking, Biometrics Sampling, and Harvest) from Supabase.
     * @param {object} pond 
     */
    /**
     * Loads live cycle metrics for the 8 Hero Snapshot Cards:
     * Row 1: 1. Species/Line, 2. Hatchery/Source, 3. DOC, 4. ABW, 5. FCR
     * Row 2: 6. Current Biomass or Harvest Biomass, 7. Disease Status, 8. Initiative / Special Trial
     * @param {object} pond 
     */
    async loadSnapshots(pond) {
        if (!pond) return;

        const isProd = (pond.pond_status || pond.status || "").toUpperCase() === "PRODUCTION";
        const isClosed = (pond.pond_status || pond.status || "").toUpperCase() === "CLOSE";

        // ==========================================
        // ROW 1: CARD 1 — Species / Line
        // ==========================================
        const species = pond.species || pond.stck_species;
        if (this.dom.snapSpecies) {
            this.dom.snapSpecies.textContent = (species && species !== "—") ? species : (isProd ? "P. VANNAMEi" : "—");
        }
        const genetic = pond.genetic_line || pond.bs_line;
        if (this.dom.snapGenetic) {
            this.dom.snapGenetic.textContent = (genetic && genetic !== "—") ? genetic : (isProd ? "Standard Line" : "—");
        }

        // ==========================================
        // ROW 1: CARD 2 — Hatchery / Source
        // ==========================================
        const hatchery = pond.pl_origin || pond.stck_source;
        if (this.dom.snapHatcherySource) {
            this.dom.snapHatcherySource.textContent = (hatchery && hatchery !== "—") ? hatchery : (isProd ? "Hatchery" : "—");
        }
        if (this.dom.snapHatcheryFoot) {
            const tank = pond.stck_tank ? `Tank: ${pond.stck_tank}` : "";
            const size = pond.stck_size ? `Size: ${pond.stck_size}` : "";
            const details = [tank, size].filter(Boolean).join(" · ");
            this.dom.snapHatcheryFoot.textContent = details || "PL Delivery Manifest";
        }

        // ==========================================
        // ROW 1: CARD 3 — DOC (Days of Culture)
        // ==========================================
        let calculatedDoc = 0;
        if (pond.stck_date && String(pond.stck_date).trim() !== "") {
            calculatedDoc = calculateDOC(pond.stck_date, pond.date_close || null);
            if (this.dom.snapDocVal) this.dom.snapDocVal.textContent = `${calculatedDoc}`;
            if (this.dom.snapDocFoot) this.dom.snapDocFoot.textContent = `Stocked: ${pond.stck_date}`;
        } else {
            if (this.dom.snapDocVal) this.dom.snapDocVal.textContent = isProd ? "0" : "—";
            if (this.dom.snapDocFoot) this.dom.snapDocFoot.textContent = isProd ? "Awaiting Stocking" : "Pond Not Stocked";
        }

        // Status badge tracking
        if (this.dom.snapCycleStatus) {
            const status = (pond.pond_status || "PRODUCTION").toUpperCase();
            this.dom.snapCycleStatus.textContent = status;
            this.dom.snapCycleStatus.className = `status-badge ${status === 'PRODUCTION' ? 'status-production' : status === 'CLOSE' ? 'status-close' : 'status-idle'}`;
        }

        // Stocked Pieces fallback
        const pcs = parseInt(pond.stck_netto || pond.stck_pcs || 0, 10);
        if (this.dom.snapStockedPcs) {
            this.dom.snapStockedPcs.textContent = !isNaN(pcs) && pcs > 0 ? `${pcs.toLocaleString()} pcs` : "—";
        }

        // ==========================================
        // FETCH SAMPLING & HARVEST DATA
        // ==========================================
        let latestSampling = null;
        let harvestSummary = { hasHarvest: false, totalWeightKg: 0, totalRevenue: 0 };

        try {
            latestSampling = await SamplingRepository.getLatestSampling(pond.pond_index);
        } catch (err) {
            console.warn("Could not load biometrics sampling for snapshot:", err);
        }

        try {
            harvestSummary = await HarvestRepository.getHarvestSummary(pond.pond_index);
        } catch (err) {
            console.warn("Could not load harvest summary for snapshot:", err);
        }

        const abw = latestSampling ? parseFloat(latestSampling.smpl_abw || 0) : 0;
        const totalFeedKg = latestSampling ? parseFloat(latestSampling.smpl_tfed || 0) : 0;
        const currentBiomassKg = latestSampling ? parseFloat(latestSampling.smpl_bms || 0) : 0;
        const samplingDoc = latestSampling ? latestSampling.smpl_doc : null;

        // Legacy total feed element tracker
        if (this.dom.snapTotalFeed) {
            this.dom.snapTotalFeed.textContent = totalFeedKg > 0 ? `${Math.round(totalFeedKg).toLocaleString()} kg` : "0 kg";
        }

        // ==========================================
        // ROW 1: CARD 4 — ABW (Average Body Weight)
        // ==========================================
        if (this.dom.snapLatestAbw) {
            this.dom.snapLatestAbw.textContent = abw > 0 ? `${abw.toFixed(2)} g` : "—";
        }
        if (this.dom.snapAbwFoot) {
            this.dom.snapAbwFoot.textContent = samplingDoc ? `DOC ${samplingDoc} sampling` : (isProd ? "Awaiting sampling" : "No sampling data");
        }

        // ==========================================
        // ROW 1: CARD 5 — FCR (Feed Conversion Ratio)
        // ==========================================
        // Effective Gain:
        // - If closed or final termination harvest logged: total harvested kg
        // - If active with partial harvest: current biomass + partial harvest kg
        // - Else: current biomass
        const effectiveBiomass = getEffectiveBiomassGain(pond, latestSampling, harvestSummary);
        const fcr = calculateFCR(totalFeedKg, effectiveBiomass.effectiveGainKg);

        if (this.dom.snapFcrVal) {
            if (fcr > 0) {
                this.dom.snapFcrVal.textContent = fcr.toFixed(2);
                this.dom.snapFcrVal.style.color = fcr <= 1.5 ? "#059669" : fcr <= 1.8 ? "#d97706" : "#dc2626";
            } else {
                this.dom.snapFcrVal.textContent = "—";
                this.dom.snapFcrVal.style.color = "#64748b";
            }
        }
        if (this.dom.snapFcrFoot) {
            if (effectiveBiomass.hasPartial) {
                this.dom.snapFcrFoot.textContent = `Current: ${Math.round(effectiveBiomass.currentBiomassKg).toLocaleString()} kg + Partial: ${Math.round(effectiveBiomass.partialWeightKg).toLocaleString()} kg`;
            } else if (effectiveBiomass.isFinal) {
                this.dom.snapFcrFoot.textContent = `Total Harvest: ${Math.round(effectiveBiomass.totalHarvestKg).toLocaleString()} kg`;
            } else {
                this.dom.snapFcrFoot.textContent = totalFeedKg > 0 ? `Total Feed: ${Math.round(totalFeedKg).toLocaleString()} kg` : "Feed: 0 kg";
            }
        }

        // ==========================================
        // ROW 2: CARD 6 — Current Biomass or Harvest Biomass
        // ==========================================
        if (effectiveBiomass.isFinal || isClosed) {
            if (this.dom.snapBiomassHarvestTitle) {
                this.dom.snapBiomassHarvestTitle.textContent = isClosed ? "Final Harvest Biomass" : "Harvested Biomass";
            }
            if (this.dom.snapBiomassHarvestVal) {
                this.dom.snapBiomassHarvestVal.textContent = `${Math.round(effectiveBiomass.totalHarvestKg).toLocaleString()} kg`;
            }
            if (this.dom.snapBiomassHarvestFoot) {
                this.dom.snapBiomassHarvestFoot.textContent = harvestSummary.totalRevenue > 0
                    ? `Gross Revenue: RM ${harvestSummary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : (isClosed ? "Status: CYCLE CLOSED" : "Termination Harvest logged");
            }
            if (this.dom.snapFinalStatusBadge) {
                const finalStatusInfo = formatFinalStatus(pond.final_status);
                this.dom.snapFinalStatusBadge.textContent = finalStatusInfo.label;
                this.dom.snapFinalStatusBadge.className = finalStatusInfo.className;
                this.dom.snapFinalStatusBadge.style.display = "inline-flex";
            }
        } else {
            if (this.dom.snapBiomassHarvestTitle) {
                this.dom.snapBiomassHarvestTitle.textContent = "Current Biomass";
            }
            if (this.dom.snapBiomassHarvestVal) {
                this.dom.snapBiomassHarvestVal.textContent = effectiveBiomass.currentBiomassKg > 0
                    ? `${Math.round(effectiveBiomass.currentBiomassKg).toLocaleString()} kg`
                    : (isProd ? "—" : "0.0 kg");
            }
            if (this.dom.snapBiomassHarvestFoot) {
                const latestSr = getLatestSurvivalRate(latestSampling);
                if (effectiveBiomass.hasPartial) {
                    const survStr = latestSr !== null ? ` | Est. Surv: ${latestSr.toFixed(1)}%` : "";
                    this.dom.snapBiomassHarvestFoot.textContent = `Partial Harvest: ${Math.round(effectiveBiomass.partialWeightKg).toLocaleString()} kg${survStr}`;
                } else if (effectiveBiomass.currentBiomassKg > 0 && latestSr !== null) {
                    this.dom.snapBiomassHarvestFoot.textContent = `Est. Survival: ${latestSr.toFixed(1)}% (DOC ${samplingDoc})`;
                } else {
                    this.dom.snapBiomassHarvestFoot.textContent = isClosed ? "Status: CYCLE CLOSED" : (isProd ? "Status: IN CULTURE" : "Status: IDLE / PREPARATION");
                }
            }
            if (this.dom.snapFinalStatusBadge) {
                this.dom.snapFinalStatusBadge.style.display = "none";
            }
        }

        // ==========================================
        // ROW 2: CARD 7 — Disease Status
        // ==========================================
        await this.loadDiseaseCard(pond);

        // ==========================================
        // ROW 2: CARD 8 — Initiative / Special Trial
        // ==========================================
        const initList = [pond.initiative, pond.initiative1, pond.initiative2]
            .map(s => (s || "").trim())
            .filter(Boolean);

        if (this.dom.snapInitiativeVal) {
            if (initList.length > 0) {
                this.dom.snapInitiativeVal.textContent = initList[0];
                this.dom.snapInitiativeVal.style.color = "#0369a1";
                this.dom.snapInitiativeVal.title = initList.join(" | ");
            } else {
                this.dom.snapInitiativeVal.textContent = "Standard SOP";
                this.dom.snapInitiativeVal.style.color = "#64748b";
                this.dom.snapInitiativeVal.title = "No special trials assigned to this cycle";
            }
        }
        if (this.dom.snapInitiativeFoot) {
            if (initList.length > 1) {
                this.dom.snapInitiativeFoot.textContent = `+ ${initList.slice(1).join(" · ")}`;
            } else if (initList.length === 1) {
                this.dom.snapInitiativeFoot.textContent = "1 Active Farm Trial logged";
            } else {
                this.dom.snapInitiativeFoot.textContent = "No active experimental trials";
            }
        }
    }

    /**
     * Loads Biosecurity Pathology records from LabRepository for Hero Card 7
     * Synchronizes growout_pond_master.disease_status with laboratory records
     * @param {object|string} pondOrIndex 
     */
    async loadDiseaseCard(pondOrIndex) {
        if (!this.dom.snapDiseaseStatusVal) return;

        const pond = typeof pondOrIndex === "object" ? pondOrIndex : null;
        const pondIndex = pond ? pond.pond_index : pondOrIndex;

        if (!pondIndex) {
            this.dom.snapDiseaseStatusVal.innerHTML = `<span class="disease-pill disease-ok" style="font-size:0.85rem; padding: 2px 10px;">Pathogen Negative</span>`;
            if (this.dom.snapDiseaseStatusFoot) this.dom.snapDiseaseStatusFoot.textContent = "No pond selected";
            return;
        }

        try {
            const issues = await LabRepository.getIssuesByPond(pondIndex);
            const status = evaluateBiosecurityStatus(pond, issues);

            this.dom.snapDiseaseStatusVal.innerHTML = `<span class="${status.className}" style="font-size:0.85rem; padding: 2px 10px;">${status.label}</span>`;
            if (this.dom.snapDiseaseStatusFoot) {
                this.dom.snapDiseaseStatusFoot.textContent = status.footText;
            }
        } catch (err) {
            console.warn("Could not load disease card status:", err);
            const fallback = evaluateBiosecurityStatus(pond, []);
            this.dom.snapDiseaseStatusVal.innerHTML = `<span class="${fallback.className}" style="font-size:0.85rem; padding: 2px 10px;">${fallback.label}</span>`;
            if (this.dom.snapDiseaseStatusFoot) this.dom.snapDiseaseStatusFoot.textContent = fallback.footText;
        }
    }

    async loadAerators(pondIndex, pondArea) {
        let u1 = 0, u2 = 0, u4 = 0;
        try {
            const items = await InventoryRepository.getAerators(pondIndex);
            if (items && items.length > 0) {
                items.forEach(item => {
                    const hp = parseFloat(item.hp !== undefined && item.hp !== null ? item.hp : item.hp_rating);
                    if (hp === 1.0) u1 = item.total_units || 0;
                    if (hp === 2.0) u2 = item.total_units || 0;
                    if (hp === 4.0) u4 = item.total_units || 0;
                });
            } else if (appState.currentPond) {
                // Fallback to legacy fields if present
                u1 = parseInt(appState.currentPond.aerator_1hp || 0, 10);
                u2 = parseInt(appState.currentPond.aerator_2hp || 0, 10);
            }
        } catch (err) {
            console.warn("Could not load aerator inventory:", err);
        }

        if (this.dom.aerator1hp) this.dom.aerator1hp.value = u1;
        if (this.dom.aerator2hp) this.dom.aerator2hp.value = u2;
        if (this.dom.aerator4hp) this.dom.aerator4hp.value = u4;

        this.recalculateAeratorHP(pondArea);
    }

    recalculateAeratorHP(pondArea) {
        const u1 = parseInt(this.dom.aerator1hp?.value || 0, 10);
        const u2 = parseInt(this.dom.aerator2hp?.value || 0, 10);
        const u4 = parseInt(this.dom.aerator4hp?.value || 0, 10);

        const totalHP = calculateTotalActiveHP(u1, u2, u4);
        const area = pondArea || (appState.currentPond ? appState.currentPond.area : 0);
        const density = calculateAerationDensity(totalHP, area);

        if (this.dom.summaryTotalActiveHp) {
            this.dom.summaryTotalActiveHp.textContent = `${totalHP.toFixed(1)} HP (${density} HP/Ha)`;
        }
        if (this.dom.badgeTotalHp) {
            this.dom.badgeTotalHp.textContent = `${totalHP.toFixed(1)} HP`;
        }
    }

    async savePreparationDates() {
        const pondIndex = appState.currentPondIndex;
        if (!pondIndex) return;

        const role = appState.userRole;
        if (!hasPermission(role, PERMISSIONS.EDIT_MASTER_CYCLE)) {
            Toast.error("Your current role does not have permission to modify Master cycle dates.");
            return;
        }

        try {
            appState.setLoading(true);
            Toast.info("Saving preparation dates...");

            const updates = {
                date_cycle: this.dom.inputDateCycle?.value || null,
                date_cleaning: this.dom.inputDateCleaning?.value || null,
                date_repair: this.dom.inputDateRepair?.value || null,
                date_filling: this.dom.inputDateFilling?.value || null,
                date_culture: this.dom.inputDateCulture?.value || null,
                date_baby_box: this.dom.inputDateBabyBox?.value || null,
                date_qaqc: this.dom.inputDateQaqc?.value || null,
                date_ready: this.dom.inputDateReady?.value || null,
                date_plan_stock: this.dom.inputDatePlanStock?.value || null,
                idle_days: parseInt(this.dom.inputIdleDays?.value || 0, 10),
                idle_status: this.dom.inputIdleStatus?.value || null,
                water_type: this.dom.inputWaterType?.value || null
            };
            await PondRepository.updateCycle(pondIndex, updates);
            Toast.success("Pond preparation dates saved successfully!");
        } catch (err) {
            console.error("Save preparation dates error:", err);
            Toast.error(`Save failed: ${err.message}`);
        } finally {
            appState.setLoading(false);
        }
    }

    async saveAeratorInventory() {
        const pondIndex = appState.currentPondIndex;
        if (!pondIndex) return;

        const role = appState.userRole;
        if (!hasPermission(role, PERMISSIONS.EDIT_AERATORS)) {
            Toast.error("Your current role does not have permission to modify Aerator inventory.");
            return;
        }

        try {
            appState.setLoading(true);
            Toast.info("Saving paddlewheel inventory...");

            const aeratorPayload = [
                { hp_rating: 1.0, total_units: parseInt(this.dom.aerator1hp?.value || 0, 10) },
                { hp_rating: 2.0, total_units: parseInt(this.dom.aerator2hp?.value || 0, 10) },
                { hp_rating: 4.0, total_units: parseInt(this.dom.aerator4hp?.value || 0, 10) }
            ];
            await InventoryRepository.syncAeratorInventory(pondIndex, aeratorPayload);
            Toast.success("Paddlewheel inventory saved successfully!");
        } catch (err) {
            console.error("Save aerator inventory error:", err);
            Toast.error(`Save failed: ${err.message}`);
        } finally {
            appState.setLoading(false);
        }
    }

    async saveData() {
        await Promise.all([
            this.savePreparationDates(),
            this.saveAeratorInventory()
        ]);
    }

    applyRolePermissions() {
        const canEditMaster = hasPermission(appState.userRole, PERMISSIONS.EDIT_MASTER_CYCLE);
        const canEditAerators = hasPermission(appState.userRole, PERMISSIONS.EDIT_AERATORS);

        const inputs = [
            this.dom.inputDateCycle, this.dom.inputDateCleaning, this.dom.inputDateRepair,
            this.dom.inputDateFilling, this.dom.inputDateCulture, this.dom.inputDateBabyBox,
            this.dom.inputDateQaqc, this.dom.inputDateReady, this.dom.inputDatePlanStock,
            this.dom.inputIdleDays, this.dom.inputIdleStatus, this.dom.inputWaterType
        ];

        inputs.forEach(inp => {
            if (inp) {
                inp.disabled = !canEditMaster;
                inp.style.opacity = canEditMaster ? "1" : "0.7";
            }
        });

        // Aerator inputs & steppers
        [this.dom.aerator1hp, this.dom.aerator2hp, this.dom.aerator4hp].forEach(inp => {
            if (inp) {
                inp.disabled = !canEditAerators;
                inp.style.opacity = canEditAerators ? "1" : "0.7";
            }
        });

        const stepperButtons = document.querySelectorAll(".paddlewheel-card .btn-stepper");
        stepperButtons.forEach(btn => {
            btn.disabled = !canEditAerators;
            btn.style.opacity = canEditAerators ? "1" : "0.5";
            btn.style.pointerEvents = canEditAerators ? "auto" : "none";
        });

        // Save buttons
        if (this.btnSave) {
            this.btnSave.disabled = !canEditMaster;
            this.btnSave.style.opacity = canEditMaster ? "1" : "0.5";
            this.btnSave.style.pointerEvents = canEditMaster ? "auto" : "none";
        }

        if (this.btnSaveAerators) {
            this.btnSaveAerators.disabled = !canEditAerators;
            this.btnSaveAerators.style.opacity = canEditAerators ? "1" : "0.5";
            this.btnSaveAerators.style.pointerEvents = canEditAerators ? "auto" : "none";
        }
    }
}
