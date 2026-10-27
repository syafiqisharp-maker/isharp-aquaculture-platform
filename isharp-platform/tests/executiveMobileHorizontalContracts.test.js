import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getExecutiveBiomassHtml } from "../src/modules/executive/templates/executiveBiomassTemplate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Executive Mobile Horizontal: Stylesheet exists and contains 12-across grid rule", () => {
    const cssPath = path.resolve(__dirname, "../src/styles/components/executive-mobile-landscape.css");
    assert.ok(fs.existsSync(cssPath), "executive-mobile-landscape.css should exist");

    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // 1. Verify 12-column repeat rule for farm grid
    assert.ok(
        cssContent.includes("grid-template-columns: repeat(12, minmax(0, 1fr))"),
        "Should define repeat(12, minmax(0, 1fr)) for fitting all 12 ponds across without horizontal scrolling"
    );

    // 2. Verify 270deg rotation transform for mobile portrait virtual landscape
    assert.ok(
        cssContent.includes("transform: rotate(270deg) translateX(-100%)"),
        "Should define 270deg counter-clockwise rotation transform for virtual landscape"
    );

    // 3. Verify right slide-over sheet for drawer
    assert.ok(
        cssContent.includes(".pond-detail-drawer"),
        "Should define mobile drawer styles"
    );
    assert.ok(
        cssContent.includes("max-width: 50%"),
        "Mobile horizontal drawer should occupy right half-screen so map remains visible"
    );

    // 4. Verify non-sticky header so it scrolls away naturally
    assert.ok(
        cssContent.includes("position: static !important"),
        "Header should be position: static so it scrolls away completely on mobile"
    );

    // 5. Verify flip button is cleanly removed
    assert.ok(
        !cssContent.includes(".btn-exec-flip"),
        "Should not include obsolete .btn-exec-flip styles"
    );
});

test("Executive Mobile Horizontal: Components index imports executive-mobile-landscape.css", () => {
    const componentsCssPath = path.resolve(__dirname, "../src/styles/components.css");
    const componentsCss = fs.readFileSync(componentsCssPath, "utf-8");

    assert.ok(
        componentsCss.includes('@import "./components/executive-mobile-landscape.css";'),
        "components.css must import executive-mobile-landscape.css"
    );
});

test("Executive Mobile Horizontal: Executive Biomass view markup includes exec-biomass-analytics-grid", () => {
    const html = getExecutiveBiomassHtml({
        cohortFilter: "ALL",
        pipelineFilter: "ALL",
        evaluatedPonds: [],
        forecast14d: { candidatePonds: [], totalProjectedBiomassTons: 0 },
        aggregated12m: null
    });

    assert.ok(
        html.includes('class="exec-biomass-analytics-grid"'),
        "Biomass template must include exec-biomass-analytics-grid class for mobile 2-column layout"
    );
});

test("Executive Mobile Horizontal: executiveTab.js touch scrolling", () => {
    const tabPath = path.resolve(__dirname, "../src/modules/executive/executiveTab.js");
    const content = fs.readFileSync(tabPath, "utf-8");

    assert.ok(
        !content.includes('btn-exec-flip-orientation'),
        "executiveTab.js must not contain obsolete flip button element"
    );
    assert.ok(
        !content.includes("exec-flipped"),
        "executiveTab.js must not reference exec-flipped"
    );
    assert.ok(
        content.includes("initMobileTouchScroll"),
        "executiveTab.js must initialize mobile touch scroll handler"
    );
});

test("Executive Mobile Horizontal: Pond drawer viewport and containment contracts", () => {
    const cssPath = path.resolve(__dirname, "../src/styles/components/executive-mobile-landscape.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // 1. exec-drawer-viewport is configured for portrait virtual landscape
    assert.ok(
        cssContent.includes(".exec-drawer-viewport"),
        "executive-mobile-landscape.css must define .exec-drawer-viewport"
    );
    assert.ok(
        cssContent.includes("transform: rotate(270deg) translateX(-100%)"),
        "exec-drawer-viewport must have rotation transform matching virtual landscape"
    );

    // 2. farm-map.css defines exec-drawer-viewport baseline
    const farmMapCssPath = path.resolve(__dirname, "../src/styles/components/farm-map.css");
    const farmMapCss = fs.readFileSync(farmMapCssPath, "utf-8");
    assert.ok(
        farmMapCss.includes(".exec-drawer-viewport"),
        "farm-map.css must define .exec-drawer-viewport baseline styles"
    );

    // 3. PondGridMap.js mounts drawer into exec-drawer-viewport on view-executive
    const gridMapPath = path.resolve(__dirname, "../src/modules/executive/PondGridMap.js");
    const gridMapContent = fs.readFileSync(gridMapPath, "utf-8");
    assert.ok(
        gridMapContent.includes("exec-drawer-viewport"),
        "PondGridMap.js must initialize exec-drawer-viewport container"
    );
    assert.ok(
        gridMapContent.includes("view-executive"),
        "PondGridMap.js must mount to #view-executive"
    );
    assert.ok(
        gridMapContent.includes("bindDrawerTouchScroll"),
        "PondGridMap.js must include bindDrawerTouchScroll method"
    );
    assert.ok(
        !gridMapContent.includes("exec-flipped"),
        "PondGridMap.js must not reference obsolete exec-flipped"
    );
});
