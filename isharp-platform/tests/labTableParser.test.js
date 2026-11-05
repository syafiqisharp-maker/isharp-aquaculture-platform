import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseLabEmailTable, getNextDayLabel } from "../src/modules/dbms/utils/labTableParser.js";

describe("Laboratory Email Table Parser", () => {
    const sampleLabText = `
Nov-26
31/10/2026\t1/11/2026\t2/11/2026\t3/11/2026\t4/11/2026
Rainfall (8.30 am)\t0.00\t0.00\t8.60\t4.20\t1.00
Rainfall (4.00 pm)\t0.00\t0.00\t0.00\t0.00\t0.00
Total Rainfall\t0.00\t0.00\t8.60\t4.20\t1.00
PH\t\t\t5.60\t5.75\t
Total Pond Harvested\t0\t2\t1\t2\t1
MDC (cm) (standard <80cm)\t104\t100\t98\t90\t84
IETS-EQ (cm)\t140\t142\t146\t146\t150
Final Discharge-MO (cm)\t86\t88\t90\t90\t80
Laboratory\t29.20\t29.70\t29.90\t29.70\t30.10
Tank (in front of Lab)\t32.10\t30.10\t30.00\t30.80\t31.00
Pond (pm)\t32.50\t32.30\t32.90\t33.00\t33.70
Daily Ponds (surface)\t32.50\t32.30\t32.90\t33.00\t33.70
Daily Ponds (middle )\t32.50\t32.30\t32.90\t33.00\t33.70
Daily Ponds (am)\t30.66\t30.45\t30.78\t31.32\t31.63
Pond 01.01.11 (pm)\t29.00\t29.00\t29.00\t29.00\t29.00
Daily Ponds Salinity (am)\t\t29.96\t30.71\t30.22\t29.20
MIN(°C)\t26.00\t27.00\t26.00\t26.00\t27.00
CURRENT (°C)\t32.00\t33.00\t33.50\t33.00\t33.00
MAX(°C)\t35.00\t34.00\t35.00\t36.00\t35.00
    `;

    test("extracts 5 formatted dates from header row with newest date on the left", () => {
        const res = parseLabEmailTable(sampleLabText);
        assert.ok(res);
        assert.deepEqual(res.dates, ["04-Nov", "03-Nov", "02-Nov", "01-Nov", "31-Oct"]);
    });

    test("extracts 5-day total rainfall readings aligned with newest date first", () => {
        const res = parseLabEmailTable(sampleLabText);
        assert.ok(res);
        assert.deepEqual(res.rainfall, ["1.00mm", "4.20mm", "8.60mm", "0.00mm", "0.00mm"]);
    });

    test("extracts latest MDC canal level", () => {
        const res = parseLabEmailTable(sampleLabText);
        assert.ok(res);
        assert.equal(res.mdc, "84 cm (standard <80cm)");
    });

    test("extracts latest Daily Ponds AM water temperature", () => {
        const res = parseLabEmailTable(sampleLabText);
        assert.ok(res);
        assert.equal(res.amTemp, "31.63°C");
    });

    test("extracts latest Salinity reading", () => {
        const res = parseLabEmailTable(sampleLabText);
        assert.ok(res);
        assert.equal(res.salinity, "29 ppt");
    });

    test("handles empty or invalid inputs gracefully", () => {
        assert.equal(parseLabEmailTable(null), null);
        assert.equal(parseLabEmailTable(""), null);
        assert.equal(parseLabEmailTable("random text without table data"), null);
    });

    describe("getNextDayLabel helper", () => {
        test("advances DD-MMM dates across days and month boundaries", () => {
            assert.equal(getNextDayLabel("04-Nov"), "05-Nov");
            assert.equal(getNextDayLabel("31-Oct"), "01-Nov");
            assert.equal(getNextDayLabel("30-Nov"), "01-Dec");
            assert.equal(getNextDayLabel("31-Dec"), "01-Jan");
        });

        test("advances slash-formatted DD/MM/YYYY dates to DD-MMM", () => {
            assert.equal(getNextDayLabel("31/10/2026"), "01-Nov");
            assert.equal(getNextDayLabel("4/11/2026"), "05-Nov");
        });
    });
});
