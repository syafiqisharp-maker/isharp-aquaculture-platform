/**
 * iSHARP DBMS 2.0 — Daily Report Laboratory & Weather Service
 * Encapsulates lab email table clipboard parsing, 5-day rainfall date shifting,
 * and live weather fetching without DOM coupling.
 */

import { parseLabEmailTable, getNextDayLabel } from "../utils/labTableParser.js";

export class DailyReportLabService {
    /**
     * Parses raw pasted clipboard text/HTML from laboratory email.
     * @param {string} rawText 
     * @returns {Object|null}
     */
    static parseLabTableText(rawText) {
        return parseLabEmailTable(rawText);
    }

    /**
     * Calculates the subsequent day's DD-MMM label from a reference date string.
     * @param {string} dateStr 
     * @returns {string}
     */
    static getNextDay(dateStr) {
        return getNextDayLabel(dateStr);
    }

    /**
     * Shifts 5-day rainfall readings rightward (Days 0-3 become Days 1-4)
     * and sets today's date in Day 0 (leftmost column).
     * @param {Array<Object>} rainfallHistory 
     * @returns {{ nextDate: string, rainfallHistory: Array<Object> }}
     */
    static shiftRainfallDays(rainfallHistory = []) {
        if (!rainfallHistory || rainfallHistory.length < 5) {
            return { nextDate: "", rainfallHistory: rainfallHistory || [] };
        }

        const nextDate = getNextDayLabel(rainfallHistory[0]?.date);
        const updated = [
            { date: nextDate, mm: "0.00" },               // Newest (Today) on leftmost column
            { date: rainfallHistory[0].date, mm: rainfallHistory[0].mm }, // Yesterday
            { date: rainfallHistory[1].date, mm: rainfallHistory[1].mm }, // 2 days ago
            { date: rainfallHistory[2].date, mm: rainfallHistory[2].mm }, // 3 days ago
            { date: rainfallHistory[3].date, mm: rainfallHistory[3].mm }  // 4 days ago
        ];

        return { nextDate, rainfallHistory: updated };
    }

    /**
     * Applies extracted lab metrics directly to a report state object.
     * @param {Object} parsed 
     * @param {Object} reportState 
     * @returns {{ updatedFields: string[], state: Object }}
     */
    static applyParsedLabData(parsed, reportState) {
        if (!parsed || !reportState) return { updatedFields: [], state: reportState };
        const updatedFields = [];

        // 1. Update 5-day Dates & Rainfall
        if (parsed.dates && parsed.dates.length > 0) {
            if (!reportState.rainfallHistory) reportState.rainfallHistory = [];
            parsed.dates.forEach((d, i) => {
                if (reportState.rainfallHistory[i]) {
                    reportState.rainfallHistory[i].date = d;
                }
            });
            updatedFields.push(`${parsed.dates.length} dates`);
        }

        if (parsed.rainfall && parsed.rainfall.length > 0) {
            if (!reportState.rainfallHistory) reportState.rainfallHistory = [];
            parsed.rainfall.forEach((rf, i) => {
                if (reportState.rainfallHistory[i]) {
                    reportState.rainfallHistory[i].mm = rf;
                }
            });
            updatedFields.push(`${parsed.rainfall.length} rainfall readings`);
        }

        // 2. Update MDC Level
        if (parsed.mdc) {
            reportState.mdcStatus = parsed.mdc;
            updatedFields.push(`MDC: ${parsed.mdc}`);
        }

        // 3. Update AM Temp
        if (parsed.amTemp) {
            reportState.pondAmTemp = parsed.amTemp;
            updatedFields.push(`Temp: ${parsed.amTemp}`);
        }

        // 4. Update Salinity
        if (parsed.salinity) {
            reportState.pondSalinity = parsed.salinity;
            updatedFields.push(`Salinity: ${parsed.salinity}`);
        }

        return { updatedFields, state: reportState };
    }

    /**
     * Fetches live 5-day weather & rainfall forecast for Setiu Farm coordinates.
     * @returns {Promise<Array<Object>|null>} Array of 5 weather forecast day items
     */
    static async fetchSetiuWeather() {
        try {
            const url = "https://api.open-meteo.com/v1/forecast?latitude=5.6667&longitude=102.7500&daily=weathercode,temperature_2m_max,precipitation_sum&timezone=Asia%2FKuala_Lumpur";
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data?.daily?.time && data.daily.time.length >= 5) {
                const days = [];
                for (let i = 0; i < 5; i++) {
                    const dStr = new Date(data.daily.time[i]).toLocaleDateString("en-US", { day: "2-digit", month: "short" });
                    const code = data.daily.weathercode[i];
                    let icon = "☀️";
                    let desc = "Clear";
                    if (code >= 1 && code <= 3) { icon = "⛅"; desc = "Few Clouds"; }
                    else if (code >= 45 && code <= 48) { icon = "☁️"; desc = "Overcast"; }
                    else if (code >= 51 && code <= 67) { icon = "🌧️"; desc = "Light Rain"; }
                    else if (code >= 80 && code <= 99) { icon = "⛈️"; desc = "Rain / Thunder"; }
                    const rain = data.daily.precipitation_sum?.[i] || 0;
                    days.push({ date: dStr, desc, icon, rain: `${rain.toFixed(1)}mm` });
                }
                return days;
            }
            return null;
        } catch (err) {
            console.warn("Could not auto-fetch weather forecast:", err);
            return null;
        }
    }
}
