#!/usr/bin/env python3
"""
iSHARP Aquaculture Platform — Laboratory Water Quality Data Importer
Imports water quality laboratory monitoring records (Salinity, Alkalinity,
Ammonia, Nitrite, Calcium, Magnesium, Turbidity, DOC) from the master lab Excel
into the Supabase 'lab_water_quality' table, accurately resolving the pond_index
based on cycle start and close dates in 'growout_pond_master'.
"""

import os
import sys

# Ensure immediate unbuffered console output
sys.stdout.reconfigure(line_buffering=True)

import json
import time
import shutil
import tempfile
import datetime
import urllib.request
import urllib.error
import openpyxl

EXCEL_PATH = r"C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Water Quality DB\DATABASE COMBINE MONITORING 2024 - 2026 new.xlsx"
SUPABASE_URL = "https://keappoukeagyzpoxkrru.supabase.co"
SUPABASE_KEY = "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s"
BATCH_SIZE = 500

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def safe_float(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace(",", "")
    if not val_str or val_str in ("-", "ND", "N/A", "nil", "NA", "None"):
        return None
    try:
        return float(val_str)
    except ValueError:
        clean = "".join(c for c in val_str if c.isdigit() or c == ".")
        try:
            return float(clean) if clean else None
        except ValueError:
            return None

def safe_int(val):
    flt = safe_float(val)
    return int(round(flt)) if flt is not None else None

def safe_date_str(val):
    if val is None:
        return None
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.strftime("%Y-%m-%d")
    val_str = str(val).strip()[:10]
    try:
        dt = datetime.datetime.strptime(val_str, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None

def fetch_master_cycles():
    print(f"[*] Fetching master cycles from {SUPABASE_URL}/rest/v1/growout_pond_master ...")
    url_base = f"{SUPABASE_URL}/rest/v1/growout_pond_master?select=pond_index,pond,date_cycle,date_close,pond_status&order=pond,date_cycle.asc"
    all_cycles = []
    offset = 0
    limit = 1000

    while True:
        req = urllib.request.Request(f"{url_base}&limit={limit}&offset={offset}", headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            batch = json.loads(resp.read().decode())
        if not batch:
            break
        all_cycles.extend(batch)
        offset += len(batch)
        if len(batch) < limit:
            break

    print(f"[OK] Fetched {len(all_cycles)} master cycle records.")

    # Group cycles by pond
    pond_cycles = {}
    for c in all_cycles:
        p = c["pond"]
        if p not in pond_cycles:
            pond_cycles[p] = []
        pond_cycles[p].append(c)

    return pond_cycles

def resolve_pond_index(pond, log_date, pond_cycles):
    if pond not in pond_cycles:
        return None, "UNKNOWN_POND"

    cycles = pond_cycles[pond]

    # 1. Exact match within cycle bounds
    for i, c in enumerate(cycles):
        dc = c["date_cycle"]
        dclose = c["date_close"]
        if dc and dc <= log_date:
            if dclose and log_date <= dclose:
                return c["pond_index"], "EXACT"
            elif not dclose:
                next_dc = cycles[i + 1]["date_cycle"] if i + 1 < len(cycles) else None
                if not next_dc or log_date < next_dc:
                    return c["pond_index"], "OPEN_CYCLE"

    # 2. Inter-cycle preparation check (between previous close and upcoming cycle start)
    for i in range(len(cycles) - 1):
        c1 = cycles[i]
        c2 = cycles[i + 1]
        if c1["date_close"] and c2["date_cycle"]:
            if c1["date_close"] < log_date < c2["date_cycle"]:
                return c2["pond_index"], "PRE_CYCLE_PREP"

    # 3. Fallbacks for boundary dates
    if cycles and cycles[-1]["date_cycle"] and log_date >= cycles[-1]["date_cycle"]:
        return cycles[-1]["pond_index"], "LATEST_CYCLE"
    if cycles and cycles[0]["date_cycle"] and log_date < cycles[0]["date_cycle"]:
        return cycles[0]["pond_index"], "EARLIEST_CYCLE"

    return None, "NO_CYCLE_MATCH"

def post_batch(batch, max_retries=3):
    url = f"{SUPABASE_URL}/rest/v1/lab_water_quality?on_conflict=pond_index,log_date"
    body = json.dumps(batch).encode("utf-8")
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201, 204):
                    return True
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            print(f" [!] HTTP {e.code} on attempt {attempt}: {err_msg[:200]}")
            if attempt == max_retries:
                raise
        except Exception as e:
            print(f" [!] Error on attempt {attempt}: {e}")
            if attempt == max_retries:
                raise
        time.sleep(2 * attempt)
    return False

def run_import():
    start_time = time.time()
    print("==================================================================")
    print("  iSHARP LABORATORY WATER QUALITY DATABASE IMPORTER (2024 - 2026) ")
    print(f"  Timestamp: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("==================================================================")

    if not os.path.exists(EXCEL_PATH):
        print(f"[ERROR] Excel file not found: {EXCEL_PATH}")
        sys.exit(1)

    # 1. Fetch cycles map
    pond_cycles = fetch_master_cycles()

    # 2. Copy excel to temp to bypass open locks
    temp_dir = tempfile.gettempdir()
    temp_excel = os.path.join(temp_dir, f"temp_wq_import_{int(time.time())}.xlsx")
    print(f"[*] Copying Excel file to temp to prevent file locking: {temp_excel} ...")
    shutil.copy2(EXCEL_PATH, temp_excel)

    try:
        print("[*] Opening Excel workbook with openpyxl (read_only=True) ...")
        wb = openpyxl.load_workbook(temp_excel, read_only=True, data_only=True)
        if "DB COMBINE" not in wb.sheetnames:
            raise ValueError(f"Sheet 'DB COMBINE' not found. Available sheets: {wb.sheetnames}")
        sheet = wb["DB COMBINE"]

        records_map = {}
        row_count = 0
        skipped_count = 0

        print("[*] Reading rows from sheet 'DB COMBINE' ...")
        for i, row in enumerate(sheet.iter_rows(values_only=True)):
            if i == 0:
                continue  # Header
            row_count += 1

            raw_date = row[4]    # Col 4: Date
            raw_pond = row[12]   # Col 12: Pond
            if not raw_date or not raw_pond:
                skipped_count += 1
                continue

            log_date = safe_date_str(raw_date)
            pond = str(raw_pond).strip()
            if not log_date or not pond:
                skipped_count += 1
                continue

            pond_index, status = resolve_pond_index(pond, log_date, pond_cycles)
            if not pond_index:
                skipped_count += 1
                continue

            record = {
                "pond_index": pond_index,
                "pond": pond,
                "log_date": log_date,
                "doc": safe_int(row[13]),             # Col 13: DOC
                "salinity_ppt": safe_float(row[14]),  # Col 14: Salinity (ppt)
                "alkalinity": safe_float(row[18]),    # Col 18: Alkalinity
                "ammonia": safe_float(row[19]),       # Col 19: Ammonia
                "nitrite": safe_float(row[20]),       # Col 20: Nitrite
                "calcium": safe_float(row[31]),       # Col 31: Calcium
                "magnesium": safe_float(row[32]),     # Col 32: Magnesium
                "turbidity": safe_float(row[34])      # Col 34: Turbidity
            }

            # Deduplicate: later row overwrites earlier row
            dedup_key = (pond_index, log_date)
            records_map[dedup_key] = record

            if row_count % 3000 == 0:
                print(f"    Processed {row_count} rows ({len(records_map)} distinct records so far)...")

        wb.close()
    finally:
        if os.path.exists(temp_excel):
            try:
                os.remove(temp_excel)
            except Exception:
                pass

    total_records = list(records_map.values())
    print(f"\n[OK] Excel parsing complete:")
    print(f"     Total Excel data rows: {row_count}")
    print(f"     Skipped rows (missing pond/date): {skipped_count}")
    print(f"     Distinct valid records to upsert: {len(total_records)}")

    # 3. Upload to Supabase in batches
    print(f"\n[*] Starting batch upload to Supabase ({BATCH_SIZE} records per batch) ...")
    total_batches = (len(total_records) + BATCH_SIZE - 1) // BATCH_SIZE
    uploaded = 0

    for b_idx in range(total_batches):
        batch = total_records[b_idx * BATCH_SIZE : (b_idx + 1) * BATCH_SIZE]
        post_batch(batch)
        uploaded += len(batch)
        pct = (uploaded / len(total_records)) * 100
        print(f"    Batch {b_idx + 1}/{total_batches} ({len(batch)} records) synced. Total: {uploaded}/{len(total_records)} ({pct:.1f}%)")

    elapsed = time.time() - start_time
    print(f"\n[SUCCESS] Successfully imported {uploaded} records into 'lab_water_quality' in {elapsed:.1f}s.")

if __name__ == "__main__":
    run_import()
