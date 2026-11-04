/**
 * iSHARP DBMS 2.0 — Pond State Machine, Hybrid Excel/DBMS Reconciliation & Turnaround Timeline
 * Pure Domain Functions: getOperationalPondState, POND_PROGRESS_STATES,
 * normalizePondProgressState, calculateProgressDays, resolveHybridPondState,
 * and buildPondProgressTimeline.
 */

import { isCycleClosed } from "../rollover.js";
import { calculateDOC, getCultureStage } from "./coreMetrics.js";

export function getOperationalPondState(cycle, referenceDate = new Date()) {
    if (!cycle) {
        return {
            isStocked: false,
            isProduction: false,
            isIdle: true,
            isClosed: false,
            isPrep: false,
            statusLabel: "IDLE",
            doc: 0,
            docDisplay: "—",
            speciesLabel: "IDLE",
            speciesCode: "IDLE",
            speciesBadgeClass: "sp-idle",
            idleDays: 0
        };
    }

    const rawStatus = String(cycle.pond_status || cycle.status || "").trim().toUpperCase();
    const isClosed = isCycleClosed(cycle);
    const hasStock = Boolean(cycle.stck_date && String(cycle.stck_date).trim() !== "");

    if (isClosed) {
        const doc = hasStock ? calculateDOC(cycle.stck_date, cycle.date_close) : 0;
        const rawSp = String(cycle.species || cycle.stck_species || "").toUpperCase();
        const speciesLabel = rawSp.includes("MON") ? "MON" : (hasStock ? "VAN" : "—");
        return {
            isStocked: hasStock,
            isProduction: false,
            isIdle: false,
            isClosed: true,
            isPrep: false,
            statusLabel: "CLOSE",
            doc,
            docDisplay: hasStock ? `${doc}` : "—",
            speciesLabel,
            speciesCode: speciesLabel,
            speciesBadgeClass: "sp-idle",
            idleDays: 0
        };
    }

    let idleDays = 0;
    if (cycle.date_cycle) {
        const start = new Date(cycle.date_cycle);
        if (!isNaN(start.getTime())) {
            idleDays = Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
        }
    } else if (cycle.idle_days) {
        idleDays = parseInt(cycle.idle_days, 10) || 0;
    }

    if (!hasStock) {
        const isPrep = rawStatus === "PREPARATION" || rawStatus === "PRODUCTION";
        return {
            isStocked: false,
            isProduction: false,
            isIdle: !isPrep,
            isClosed: false,
            isPrep: isPrep,
            statusLabel: isPrep ? "PREPARATION" : (rawStatus || "IDLE"),
            doc: 0,
            docDisplay: isPrep ? "PREP" : `${idleDays}d`,
            speciesLabel: isPrep ? "PREP" : "IDLE",
            speciesCode: isPrep ? "PREP" : "IDLE",
            speciesBadgeClass: isPrep ? "sp-prep" : "sp-idle",
            idleDays
        };
    }

    const doc = calculateDOC(cycle.stck_date, cycle.date_close || referenceDate);
    const rawSp = String(cycle.species || cycle.stck_species || "VAN").toUpperCase();
    const speciesLabel = (rawSp.includes("MON") || rawSp.includes("BLACK") || rawSp.includes("TIGER")) ? "MON" : "VAN";

    return {
        isStocked: true,
        isProduction: true,
        isIdle: false,
        isClosed: false,
        isPrep: false,
        statusLabel: "PRODUCTION",
        doc,
        docDisplay: `${doc}`,
        speciesLabel,
        speciesCode: speciesLabel,
        speciesBadgeClass: speciesLabel === "MON" ? "sp-mon" : "sp-van",
        idleDays: 0
    };
}

export const POND_PROGRESS_STATES = {
    CULTURE: {
        code: "CULTURE",
        label: "Culture",
        badgeText: "CULTURE",
        badgeClass: "sp-culture",
        tileClass: "progress-culture",
        order: 1
    },
    READY: {
        code: "READY",
        label: "Ready for Stocking",
        badgeText: "READY",
        badgeClass: "sp-ready",
        tileClass: "progress-ready",
        order: 2
    },
    WATER_CULTURE: {
        code: "WATER_CULTURE",
        label: "Water Culture",
        badgeText: "WATER CULT",
        badgeClass: "sp-water-cult",
        tileClass: "progress-water-culture",
        order: 3
    },
    REPAIRED: {
        code: "REPAIRED",
        label: "Repaired",
        badgeText: "REPAIRED",
        badgeClass: "sp-repaired",
        tileClass: "progress-repaired",
        order: 4
    },
    CLEANED: {
        code: "CLEANED",
        label: "Cleaned",
        badgeText: "CLEANED",
        badgeClass: "sp-cleaned",
        tileClass: "progress-cleaned",
        order: 5
    },
    CLEANING: {
        code: "CLEANING",
        label: "Cleaning",
        badgeText: "CLEANING",
        badgeClass: "sp-cleaning",
        tileClass: "progress-cleaning",
        order: 6
    },
    IDLE: {
        code: "IDLE",
        label: "Idle",
        badgeText: "IDLE",
        badgeClass: "sp-idle",
        tileClass: "risk-idle",
        order: 7
    }
};

export function normalizePondProgressState(rawStatus, statusCode = "", mapCode = "") {
    const raw = String(rawStatus || "").trim().toUpperCase();
    const sc = String(statusCode || "").trim();
    const mc = String(mapCode || "").trim().toUpperCase();

    if (raw.includes("READY") || mc.includes("BIOA")) {
        return "READY";
    }
    if (raw.includes("WATER CULTURE") || raw.includes("WATER FILLING") || sc === "Wc" || sc === "Fw") {
        return "WATER_CULTURE";
    }
    if (raw.includes("REPAIRED") || raw.includes("REPAIR") || sc === "Rw" || sc === "RW" || sc === "Rp") {
        return "REPAIRED";
    }
    if (raw.includes("CLEANED") || sc === "Cr") {
        return "CLEANED";
    }
    if (raw.includes("CLEANING") || sc === "Cp") {
        return "CLEANING";
    }
    if (raw.includes("CULTURE") || sc === "Opr") {
        return "CULTURE";
    }
    return "IDLE";
}

export function calculateProgressDays(dailyRecord, referenceDate = new Date()) {
    if (!dailyRecord) return 0;
    if (dailyRecord.status_start_date) {
        const start = new Date(dailyRecord.status_start_date);
        const ref = new Date(referenceDate);
        if (!isNaN(start.getTime()) && !isNaN(ref.getTime())) {
            const diffMs = ref.getTime() - start.getTime();
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            return Math.max(0, days);
        }
    }
    const raw = parseInt(dailyRecord.days_in_status, 10);
    return isNaN(raw) ? 0 : Math.max(0, raw);
}

export function resolveHybridPondState(pondCode, cycle, dailyRecord, pondIssues = [], referenceDate = new Date()) {
    const opState = getOperationalPondState(cycle, referenceDate);

    const hasMidWeekStocking = !opState.isStocked &&
        Boolean(dailyRecord && (dailyRecord.progress_state === "CULTURE" || String(dailyRecord.raw_template_status || "").toUpperCase().includes("CULTURE")) && dailyRecord.stocking_date);

    const hasMidWeekHarvest = opState.isStocked &&
        Boolean(dailyRecord && dailyRecord.progress_state !== "CULTURE" && dailyRecord.last_harvest_date && cycle && cycle.stck_date && dailyRecord.last_harvest_date > cycle.stck_date);

    if (hasMidWeekStocking) {
        const doc = calculateDOC(dailyRecord.stocking_date, referenceDate);
        return {
            pondCode,
            pondIndex: cycle ? cycle.pond_index : "",
            isActive: true,
            doc,
            docDisplay: String(doc),
            speciesCode: "NEW",
            speciesLabel: "NEW",
            speciesBadgeClass: "sp-new",
            health: "GREEN",
            healthDescription: "Newly Stocked (Daily Tracker) — Pending Friday DBMS Sync",
            stageCode: getCultureStage(doc, dailyRecord.species || "VAN").stageCode,
            cssClass: "risk-green",
            progressState: "CULTURE",
            progressLabel: "Culture",
            progressBadgeText: "NEW",
            progressBadgeClass: "sp-new",
            progressDays: doc,
            idleDays: 0,
            syncState: "NEWLY_STOCKED_EXCEL",
            dailyRecord
        };
    }

    if (hasMidWeekHarvest) {
        const progressState = dailyRecord.progress_state || normalizePondProgressState(dailyRecord.raw_template_status, dailyRecord.status_code, dailyRecord.map_code);
        const meta = POND_PROGRESS_STATES[progressState] || POND_PROGRESS_STATES.IDLE;
        const progressDays = calculateProgressDays(dailyRecord, referenceDate);

        return {
            pondCode,
            pondIndex: cycle ? cycle.pond_index : "",
            isActive: false,
            doc: 0,
            docDisplay: `${progressDays}d`,
            speciesCode: progressState,
            speciesLabel: meta.badgeText,
            speciesBadgeClass: meta.badgeClass,
            health: "IDLE",
            healthDescription: `Harvested Mid-Week: ${meta.label} (${progressDays} days)`,
            stageCode: "IDLE",
            cssClass: (progressDays > 30 && progressState === "IDLE") ? "risk-idle idle-overdue" : meta.tileClass,
            progressState,
            progressLabel: meta.label,
            progressBadgeText: meta.badgeText,
            progressBadgeClass: meta.badgeClass,
            progressDays,
            idleDays: progressDays,
            syncState: "HARVESTED_MIDWEEK_EXCEL",
            dailyRecord
        };
    }

    if (opState.isStocked) {
        const { stageCode } = getCultureStage(opState.doc, opState.speciesLabel);

        let health = "GREEN";
        let healthDesc = "Clean Biosecurity";
        let cssClass = "risk-green";

        const hasRed = (pondIssues || []).some(i => (i.issue_flag || "").toUpperCase() === "RED" || (i.pcr_result || "").toUpperCase() === "POSITIVE");
        const hasYellow = (pondIssues || []).some(i => (i.issue_flag || "").toUpperCase() === "YELLOW");

        if (hasRed) {
            health = "RED";
            healthDesc = "Red Alert: Active Pathogen Detected";
            cssClass = "risk-red";
        } else if (hasYellow) {
            health = "YELLOW";
            healthDesc = "Warning: Monitored Symptoms";
            cssClass = "risk-yellow";
        }

        return {
            pondCode,
            pondIndex: cycle ? cycle.pond_index : "",
            isActive: true,
            doc: opState.doc,
            docDisplay: opState.docDisplay,
            speciesCode: opState.speciesCode,
            speciesLabel: opState.speciesLabel,
            speciesBadgeClass: opState.speciesBadgeClass,
            health,
            healthDescription: healthDesc,
            stageCode,
            cssClass,
            progressState: "CULTURE",
            progressLabel: "Culture",
            progressBadgeText: opState.speciesLabel,
            progressBadgeClass: opState.speciesBadgeClass,
            progressDays: opState.doc,
            idleDays: 0,
            syncState: "SYNCED",
            dailyRecord
        };
    }

    let progressState = "IDLE";
    if (dailyRecord) {
        const rawState = dailyRecord.progress_state || normalizePondProgressState(dailyRecord.raw_template_status, dailyRecord.status_code, dailyRecord.map_code);
        progressState = (rawState === "CULTURE") ? (opState.isPrep ? "CLEANING" : "IDLE") : rawState;
    } else {
        progressState = opState.isPrep ? "CLEANING" : "IDLE";
    }

    const meta = POND_PROGRESS_STATES[progressState] || POND_PROGRESS_STATES.IDLE;
    const progressDays = dailyRecord ? calculateProgressDays(dailyRecord, referenceDate) : (opState.idleDays || 0);

    return {
        pondCode,
        pondIndex: cycle ? cycle.pond_index : "",
        isActive: false,
        doc: 0,
        docDisplay: `${progressDays}d`,
        speciesCode: progressState,
        speciesLabel: meta.badgeText,
        speciesBadgeClass: meta.badgeClass,
        health: "IDLE",
        healthDescription: `${meta.label} (${progressDays} days)`,
        stageCode: "IDLE",
        cssClass: (progressDays > 30 && progressState === "IDLE") ? "risk-idle idle-overdue" : meta.tileClass,
        progressState,
        progressLabel: meta.label,
        progressBadgeText: meta.badgeText,
        progressBadgeClass: meta.badgeClass,
        progressDays,
        idleDays: progressDays,
        syncState: "SYNCED",
        dailyRecord
    };
}

export function buildPondProgressTimeline(dailyProgress, cycle = null, pondData = null, referenceDate = new Date()) {
    const isProd = Boolean(pondData?.isActive || (cycle && cycle.stck_date && (cycle.pond_status || "").toUpperCase() === "PRODUCTION"));
    const isNewlyStocked = pondData?.syncState === "NEWLY_STOCKED_EXCEL";

    const stockDate = (dailyProgress && dailyProgress.stocking_date) || (isProd && cycle ? cycle.stck_date : null);

    const definitions = [
        { key: "harvest", label: "Last Harvest", code: "Hv", date: dailyProgress?.last_harvest_date || null },
        { key: "cleaning_start", label: "Cleaning Start", code: "Cp", date: dailyProgress?.clean_progress_date || null },
        { key: "cleaned", label: "Cleaned", code: "Cr", date: dailyProgress?.cleaning_done_date || null },
        { key: "repaired", label: "Repaired", code: "Rw", date: dailyProgress?.repair_done_date || dailyProgress?.repair_progress_date || null },
        { key: "water_filled", label: "Water Filled", code: "Fw", date: dailyProgress?.filled_water_date || null },
        { key: "water_treated", label: "W. Culture Start", code: "Wc", date: dailyProgress?.water_treat_date || null },
        { key: "bioassay", label: "Bioassay & QAQC", code: "BioA", date: dailyProgress?.bioassay_date || dailyProgress?.qaqc_date || null, isBioassay: true },
        { key: "stocked", label: "Stocked", code: "Opr", date: stockDate }
    ];

    let lastCompletedIdx = -1;
    for (let i = 0; i < definitions.length; i++) {
        if (definitions[i].date) {
            lastCompletedIdx = i;
        }
    }
    if (lastCompletedIdx < 6 && (dailyProgress?.pass_bioassay || pondData?.progressState === "READY")) {
        lastCompletedIdx = 6;
    }
    if (isProd || isNewlyStocked || pondData?.progressState === "CULTURE") {
        lastCompletedIdx = 7;
    }

    const steps = definitions.map((def, idx) => {
        const isDone = idx <= lastCompletedIdx && Boolean(def.date || (def.key === "bioassay" && dailyProgress?.pass_bioassay));
        const isCurrent = idx === lastCompletedIdx;
        let status = isCurrent ? "current" : (isDone ? "done" : "pending");
        if (!isCurrent && !isDone && idx < lastCompletedIdx && !def.date) {
            status = "skipped";
        }

        let nodeBadge = null;
        let nodeBadgeClass = null;

        if (def.key === "bioassay" && dailyProgress?.pass_bioassay) {
            nodeBadge = "PASS";
            nodeBadgeClass = "badge-pass";
        } else if (isCurrent && !isProd && pondData?.progressDays !== undefined) {
            nodeBadge = `Active • ${pondData.progressDays}d`;
            nodeBadgeClass = "badge-active-stage";
        } else if (isCurrent && isProd && pondData?.docDisplay) {
            nodeBadge = `Current • ${pondData.docDisplay} DOC`;
            nodeBadgeClass = "badge-current-doc";
        }

        return {
            ...def,
            status,
            isCurrent,
            isDone,
            nodeBadge,
            nodeBadgeClass,
            segmentDays: null,
            segmentLabel: null,
            segmentDone: false
        };
    });

    for (let i = 0; i < steps.length - 1; i++) {
        if (i < lastCompletedIdx) {
            steps[i].segmentDone = true;
        }
    }

    const datedMilestones = [];
    for (let i = 0; i < steps.length; i++) {
        if (steps[i].date) {
            const d = new Date(steps[i].date);
            if (!isNaN(d.getTime())) {
                datedMilestones.push({ index: i, time: d.getTime() });
            }
        }
    }

    for (let k = 0; k < datedMilestones.length - 1; k++) {
        const start = datedMilestones[k];
        const end = datedMilestones[k + 1];

        const diffMs = end.time - start.time;
        const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        const curStep = steps[start.index];
        curStep.segmentDays = days;
        curStep.segmentLabel = days === 1 ? "1 day" : `${days} days`;

        for (let j = start.index; j < end.index; j++) {
            steps[j].segmentDone = true;
        }
    }

    let totalTurnaroundDays = null;
    const harvestDate = steps[0].date ? new Date(steps[0].date) : null;
    const finalDate = (isProd && steps[7].date) ? new Date(steps[7].date) : (lastCompletedIdx > 0 && steps[lastCompletedIdx].date ? new Date(steps[lastCompletedIdx].date) : null);

    if (harvestDate && finalDate && !isNaN(harvestDate.getTime()) && !isNaN(finalDate.getTime())) {
        const diffMs = finalDate.getTime() - harvestDate.getTime();
        totalTurnaroundDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
        steps,
        totalTurnaroundDays,
        isStocked: isProd || isNewlyStocked,
        hasAnyDate: steps.some(s => Boolean(s.date))
    };
}
