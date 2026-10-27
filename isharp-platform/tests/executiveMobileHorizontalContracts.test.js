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

    // 2. Verify 90deg and 270deg rotation transforms for mobile portrait
    assert.ok(
        cssContent.includes("transform: rotate(90deg) translateY(-100%)"),
        "Should define 90deg clockwise rotation transform for mobile portrait"
    );
    assert.ok(
        cssContent.includes("transform: rotate(270deg) translateX(-100%)"),
        "Should define 270deg counter-clockwise rotation transform for 180° flip"
    );

    // 3. Verify floating flip button styles
    assert.ok(
        cssContent.includes(".btn-exec-flip"),
        "Should define styles for .btn-exec-flip floating button"
    );

    // 4. Verify right slide-over sheet for drawer
    assert.ok(
        cssContent.includes(".pond-detail-drawer"),
        "Should define mobile drawer styles"
    );
    assert.ok(
        cssContent.includes("max-width: 50%"),
        "Mobile horizontal drawer should occupy right half-screen so map remains visible"
    );

    // 5. Verify non-sticky header so it scrolls away naturally
    assert.ok(
        cssContent.includes("position: static !important"),
        "Header should be position: static so it scrolls away completely on mobile"
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

test("Executive Mobile Horizontal: executiveTab.js template includes 180° flip button", () => {
    const tabPath = path.resolve(__dirname, "../src/modules/executive/executiveTab.js");
    const content = fs.readFileSync(tabPath, "utf-8");

    assert.ok(
        content.includes('id="btn-exec-flip-orientation"'),
        "executiveTab.js must include btn-exec-flip-orientation element"
    );
    assert.ok(
        content.includes("exec-flipped"),
        "executiveTab.js must toggle exec-flipped class on orientation flip"
    );
    assert.ok(
        content.includes("initMobileTouchScroll"),
        "executiveTab.js must initialize mobile touch scroll handler"
    );
});
