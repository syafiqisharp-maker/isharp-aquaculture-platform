import os
import sys
import shutil
import tempfile
import json
from datetime import datetime, date, timedelta

DEFAULT_EXCEL_PATH = r"C:\Users\syafiq\OneDrive - BLUE ARCHIPELAGO BERHAD\Shared Documents - iSHARP Data Management Team\iSharp Data\Daily_Harvest_Log.xlsx"
OUTPUT_JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "isharp-platform", "public", "data", "daily_harvest_log.json")

def get_week_range(ref_date=None):
    """
    Returns (start_of_week, end_of_week) as dates.
    Farm week starts on Sunday and ends on Saturday (matching farm whiteboard schedule).
    """
    if ref_date is None:
        ref_date = date.today()
    elif isinstance(ref_date, str):
        ref_date = datetime.strptime(ref_date.split("T")[0], "%Y-%m-%d").date()
    elif isinstance(ref_date, datetime):
        ref_date = ref_date.date()

    # In Python: Monday is 0, Sunday is 6.
    # If ref_date is Sunday (weekday == 6), days_from_sunday = 0.
    # Otherwise, days_from_sunday = (weekday + 1) % 7.
    days_from_sunday = (ref_date.weekday() + 1) % 7
    start_of_week = ref_date - timedelta(days=days_from_sunday)
    end_of_week = start_of_week + timedelta(days=6)
    return start_of_week, end_of_week

def parse_daily_harvest_log(excel_path=DEFAULT_EXCEL_PATH, ref_date=None):
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel file not found at: {excel_path}")

    # Copy to temporary file to bypass Excel / OneDrive locks
    temp_dir = tempfile.gettempdir()
    temp_file = os.path.join(temp_dir, f"temp_harvest_log_{os.getpid()}.xlsx")
    try:
        shutil.copy2(excel_path, temp_file)
    except Exception as e:
        # Fallback copy if standard copy fails
        with open(excel_path, "rb") as src_f, open(temp_file, "wb") as dst_f:
            dst_f.write(src_f.read())

    try:
        import openpyxl
        wb = openpyxl.load_workbook(temp_file, data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass

    if not rows or len(rows) < 2:
        return {"this_week": [], "all_records": []}

    # Header: Date, Pond, Type of Harvest, ABW, Weight, DOC, Species, Remarks...
    # Exclude Remarks column as explicitly instructed by user.
    raw_records = []
    for row_idx, r in enumerate(rows[1:], start=1):
        if not r or r[0] is None or r[1] is None:
            continue

        raw_d = r[0]
        pond_str = str(r[1]).strip()
        type_str = str(r[2]).strip() if r[2] is not None else "Partial"
        raw_abw = r[3]
        raw_weight = r[4]
        raw_doc = r[5]
        species_str = str(r[6]).strip() if len(r) > 6 and r[6] is not None else ""

        # Normalize Date
        parsed_date = None
        if isinstance(raw_d, (datetime, date)):
            parsed_date = raw_d.date() if isinstance(raw_d, datetime) else raw_d
        elif isinstance(raw_d, str):
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
                try:
                    parsed_date = datetime.strptime(raw_d.strip().split("T")[0], fmt).date()
                    break
                except:
                    continue

        if not parsed_date:
            continue

        # Clean ABW
        abw_val = None
        if raw_abw is not None:
            clean_abw = str(raw_abw).replace("&nbsp;", "").strip()
            try:
                abw_val = round(float(clean_abw), 2)
            except:
                abw_val = None

        # Clean Weight (Tonnage in kg)
        weight_val = None
        if raw_weight is not None:
            clean_w = str(raw_weight).replace("&nbsp;", "").replace(",", "").strip()
            try:
                weight_val = round(float(clean_w), 2)
            except:
                weight_val = None

        # Clean DOC
        doc_val = None
        if raw_doc is not None:
            try:
                doc_val = int(float(str(raw_doc).strip()))
            except:
                doc_val = None

        raw_records.append({
            "file_row": row_idx,
            "iso_date": parsed_date.strftime("%Y-%m-%d"),
            "display_date": parsed_date.strftime("%d/%m"),
            "pond": pond_str,
            "type": type_str,
            "plan_abw": abw_val,
            "plan_tonnage": weight_val,
            "doc": doc_val,
            "species": species_str
        })

    # Determine current week range
    start_week, end_week = get_week_range(ref_date)
    start_str = start_week.strftime("%Y-%m-%d")
    end_str = end_week.strftime("%Y-%m-%d")

    # Filter to this week only
    week_raw = [r for r in raw_records if start_str <= r["iso_date"] <= end_str]

    # Deduplicate choosing the recent log one (last occurrence in the file takes precedence)
    deduped_week_map = {}
    for r in week_raw:
        # Overwrites previous entry for the same pond, keeping the latest log
        deduped_week_map[r["pond"]] = r

    # Sort this week's records by date ascending, then pond ascending
    this_week_records = list(deduped_week_map.values())
    this_week_records.sort(key=lambda x: (x["iso_date"], x["pond"]))

    # Map to Harvest Report Table format:
    # "The weight and abw data is the harvest plan. Leave actual harvest data empty. Later i will think on how to populate the actual harvest data."
    formatted_harvest_reports = []
    for r in this_week_records:
        formatted_harvest_reports.append({
            "pond": r["pond"],
            "date": r["display_date"],
            "raw_date": r["iso_date"],
            "type": r["type"],
            "actTonnage": "",      # Left empty as requested
            "actAbw": "",          # Left empty as requested
            "planTonnage": r["plan_tonnage"] if r["plan_tonnage"] is not None else 0,
            "planAbw": r["plan_abw"] if r["plan_abw"] is not None else 0,
            "planAbw2": "",
            "doc": r["doc"],
            "species": r["species"]
        })

    result = {
        "source_file": excel_path,
        "week_label": f"{start_week.strftime('%d %b')} – {end_week.strftime('%d %b %Y')}",
        "week_start": start_str,
        "week_end": end_str,
        "count": len(formatted_harvest_reports),
        "harvestReports": formatted_harvest_reports
    }
    return result

def main():
    excel_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EXCEL_PATH
    ref_date_str = sys.argv[2] if len(sys.argv) > 2 else "2026-11-05" # Default to Nov 5, 2026 context
    data = parse_daily_harvest_log(excel_path, ref_date_str)

    os.makedirs(os.path.dirname(OUTPUT_JSON_PATH), exist_ok=True)
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Successfully processed {data['count']} ponds for week {data['week_label']}.")
    print(f"Exported to {OUTPUT_JSON_PATH}")
    for item in data["harvestReports"]:
        print(f"  {item['date']} | {item['pond']} | {item['type']} | Plan: {item['planTonnage']} kg @ {item['planAbw']}g | Act: Empty")

if __name__ == "__main__":
    main()
