/**
 * iSHARP DBMS 2.0 — Executive Minimalist Harvest Canvas Chart
 * High-performance 2D canvas renderer displaying:
 * - 12-Month Rolling Biomass (Pastel Sky Blue Bars)
 * - Gross Revenue Yield (Emerald Trend Line & Nodes)
 * 
 * Clean Coding Standard: Zero direct application state coupling; pure canvas painter.
 */

/**
 * Draws the 12-month rolling biomass and revenue chart on the provided canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<object>} monthlyBuckets Array of month aggregated data
 */
export function drawMinimalistHarvestChart(canvas, monthlyBuckets = []) {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI displays (retina screens)
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.parentElement?.clientWidth || 600;
    const h = 240;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const displayBuckets = monthlyBuckets.slice(-12);
    if (displayBuckets.length === 0) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No harvest data available for selected period", w / 2, h / 2);
        return;
    }

    const tonsArr = displayBuckets.map(b => b.tonnage || 0);
    const revArr = displayBuckets.map(b => (b.grossRevenue || 0) / 1000000); // In Millions RM

    const maxTons = Math.max(10, Math.ceil(Math.max(...tonsArr) / 50) * 50);
    const maxRev = Math.max(1, Math.ceil(Math.max(...revArr)));

    const padding = { left: 45, right: 35, top: 25, bottom: 30 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // Subtle Hairline Gridlines
    ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
        const y = padding.top + (plotH / 3) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        const val = Math.round(maxTons - (maxTons / 3) * i);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px ui-monospace, monospace";
        ctx.textAlign = "right";
        ctx.fillText(val + " T", padding.left - 8, y + 3);
    }

    const barW = Math.max(8, (plotW / displayBuckets.length) * 0.44);
    const stepX = plotW / displayBuckets.length;

    // Draw Soft Sky Pastel Bars (Biomass)
    displayBuckets.forEach((b, idx) => {
        const x = padding.left + stepX * idx + (stepX - barW) / 2;
        const barH = maxTons > 0 ? (b.tonnage / maxTons) * plotH : 0;
        const y = padding.top + (plotH - barH);

        if (b.tonnage > 0) {
            ctx.fillStyle = "#bae6fd"; // Soft pastel sky
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
                ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
            } else {
                ctx.rect(x, y, barW, barH);
            }
            ctx.fill();
        }

        // Month Label (e.g. 11/25, 12/25, 01/26 ... 10/26)
        ctx.fillStyle = "#64748b";
        ctx.font = "500 10px ui-monospace, monospace";
        ctx.textAlign = "center";
        const parts = (b.month || "").split("-");
        const monthLabel = parts.length === 2 ? `${parts[1]}/${parts[0].slice(2)}` : b.month;
        ctx.fillText(monthLabel, x + barW / 2, h - 10);
    });

    // Draw Smooth Emerald Revenue Line
    ctx.beginPath();
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = 2.2;
    let lineStarted = false;
    displayBuckets.forEach((b, idx) => {
        const x = padding.left + stepX * idx + stepX / 2;
        const normRev = maxRev > 0 ? revArr[idx] / maxRev : 0;
        const y = padding.top + (plotH - (normRev * plotH));
        if (!lineStarted) {
            ctx.moveTo(x, y);
            lineStarted = true;
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Draw Revenue Points
    displayBuckets.forEach((b, idx) => {
        const x = padding.left + stepX * idx + stepX / 2;
        const normRev = maxRev > 0 ? revArr[idx] / maxRev : 0;
        const y = padding.top + (plotH - (normRev * plotH));

        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#059669";
        ctx.stroke();
    });
}
