/**
 * iSHARP DBMS 2.0 — Aquaculture Biometrics Calculations (Barrel Facade)
 * Re-exports 100% of pure domain functions and constants from modular sub-packages
 * under src/domain/biometrics/ so all existing callers and unit tests work with
 * zero breaking changes.
 */

export {
    calculateDOC,
    calculateBroodstockDOC,
    calculateBiomass,
    getLatestSurvivalRate,
    calculateADG,
    getStandardABW,
    getEffectiveBiomassGain,
    CULTURE_STAGE_DEFINITIONS,
    getCultureStage
} from "./biometrics/coreMetrics.js";

export {
    COO_HARVEST_READINESS_THRESHOLDS,
    classifyHarvestReadiness,
    evaluateBiosecurityAndEhpStatus,
    projectHarvestForecast,
    aggregate12MonthMovingHarvest
} from "./biometrics/harvestForecast.js";

export {
    getOperationalPondState,
    POND_PROGRESS_STATES,
    normalizePondProgressState,
    calculateProgressDays,
    resolveHybridPondState,
    buildPondProgressTimeline
} from "./biometrics/pondStateEngine.js";
