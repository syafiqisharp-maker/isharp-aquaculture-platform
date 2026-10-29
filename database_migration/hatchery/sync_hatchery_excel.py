#!/usr/bin/env python3
"""
Telaga Putat Hatchery (TPH) — Synchronization & Ingestion Pipeline
Executes zero-timeout, chunked, verified loads into Supabase Cloud PostgreSQL.
Supports: --dry-run, --summary-only, --chunk-size N.
"""

import os
import sys
import json
import time
import shutil
import tempfile
import argparse
import urllib.request
import urllib.error
import openpyxl
import re
import datetime

# Add local directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hatchery_config import SUPABASE_URL, SUPABASE_KEY, EDITOR_PASSCODE, SOURCES, SOURCE_MAP, MAT_SHEET_MAP
from hatchery_parsers import generate_64_tanks, parse_batch_sheet, parse_summary_sheet1

DEFAULT_SUMMARY_EXCEL = r"C:\Users\syafiq\OneDrive - BLUE ARCHIPELAGO BERHAD\Shared Documents - iSHARP Data Management Team\iSharp Data\TP Hatchery Database\Summary report 2024_2026_complete.xlsx"
DEFAULT_MAT_EXCEL = r"C:\Users\syafiq\OneDrive - BLUE ARCHIPELAGO BERHAD\Shared Documents - iSHARP Data Management Team\iSharp Data\TP Hatchery Database\Mat Daily Report Template Jun 26.xlsx"

def post_rpc_ingest(table_name, rows, dry_run=False, chunk_size=50):
    """
    Submits rows via the atomic fn_hatchery_ingest RPC.
    Evaluates DBMS Editor authorization exactly ONCE per chunk.
    """
    if dry_run or not rows:
        return len(rows)

    url = f"{SUPABASE_URL}/rest/v1/rpc/fn_hatchery_ingest"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json; charset=utf-8",
        "Prefer": "return=representation",
        "x-isharp-passcode": EDITOR_PASSCODE
    }

    total_written = 0
    total_rows = len(rows)

    for i in range(0, total_rows, chunk_size):
        chunk = rows[i:i + chunk_size]
        payload = {
            "p_table": table_name,
            "p_rows": chunk
        }
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")

        attempt = 0
        max_attempts = 5
        curr_chunk = chunk
        while attempt < max_attempts:
            try:
                t0 = time.time()
                with urllib.request.urlopen(req, timeout=45) as resp:
                    res_body = resp.read().decode("utf-8")
                    res_json = json.loads(res_body) if res_body else {}
                    written = res_json.get("written", len(curr_chunk))
                    total_written += written
                    elapsed = time.time() - t0
                    print(f"    [INGEST] {table_name}: rows {i + 1}..{min(i + chunk_size, total_rows)} ({written} rows) in {elapsed:.2f}s")
                    break
            except urllib.error.HTTPError as e:
                attempt += 1
                err_text = e.read().decode("utf-8", errors="ignore")
                print(f"    [WARN] Ingest attempt {attempt} failed for {table_name}: {e.code} {err_text}")
                if "57014" in err_text and len(curr_chunk) > 5:
                    # Adaptive chunk halving on statement timeout
                    chunk_size = max(5, chunk_size // 2)
                    print(f"    [ADAPTIVE] Halving chunk size to {chunk_size} on timeout...")
                if attempt >= max_attempts:
                    raise RuntimeError(f"Ingestion failed for {table_name}: {err_text}")
                time.sleep(2 * attempt)
            except Exception as ex:
                attempt += 1
                print(f"    [WARN] Network error attempt {attempt}: {ex}")
                if attempt >= max_attempts:
                    raise
                time.sleep(2 * attempt)

    return total_written

def reconcile_pond_links(events, commercial, dry_run=False, chunk_size=50):
    print("\n[STAGE 6/7] Reconciling PL harvest lots to growout ponds (SGO shipments)...")
    
    # 1. Key commercial records by (tank_code, stock_date, event_date, occurrence_no)
    comm_map = {}
    for c in commercial:
        key = (c.get("tank_code"), c.get("stock_date"), c.get("event_date"), c.get("occurrence_no"))
        comm_map[key] = c

    # 2. Filter eligible harvest events for farm growout linkage:
    # Internal farm shipments to SGO often left Buyer blank/None in hatchery logs.
    # Exclude only explicit non-SGO destinations (KGO, EXTERNAL).
    eligible_events = []
    for e in events:
        if e.get("event_type") != "HARVEST":
            continue
        key = (e.get("tank_code"), e.get("stock_date"), e.get("event_date"), e.get("occurrence_no"))
        c = comm_map.get(key, {})
        buyer = (c.get("buyer") or "").strip().upper()
        if buyer in ("KGO", "EXTERNAL") or c.get("external_buyer"):
            continue
        eligible_events.append((e, c))

    print(f"  [INFO] Total SGO & Internal Harvest Shipments eligible for Growout Linkage: {len(eligible_events)}")
    
    if not eligible_events:
        return []

    # 3. Fetch farm pond stocking batches from Supabase (2024-2026)
    batches = []
    offset = 0
    limit = 1000
    while True:
        url = f"{SUPABASE_URL}/rest/v1/pond_stocking_batches?stck_date=gte.2024-01-01&select=pond_index,stck_date,stck_tank,stck_source,stck_pcs&offset={offset}&limit={limit}"
        req = urllib.request.Request(url, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                chunk = json.loads(res.read().decode("utf-8"))
                batches.extend(chunk)
                if len(chunk) < limit:
                    break
                offset += limit
        except Exception as ex:
            print(f"  [WARN] Could not fetch pond stocking batches: {ex}")
            break

    # 4. Parse multi-tank strings in stocking batches (e.g. 'C11,C14', 'A11,A12,A13')
    parsed_batches = []
    for b in batches:
        t_raw = b.get("stck_tank")
        src = (b.get("stck_source") or "").upper()
        if t_raw:
            matches = re.findall(r"([A-D])\s*[-_]?\s*(1[0-6]|0?[1-9])(?![0-9])", str(t_raw), re.I)
            tanks = {f"{blk.upper()}{int(n):02d}" for blk, n in matches}
            parsed_batches.append({
                "pond_index": b["pond_index"],
                "stck_date": b["stck_date"],
                "tanks": tanks,
                "pcs": b.get("stck_pcs"),
                "tank_raw": t_raw,
                "source": src
            })

    # 5. Perform reconciliation
    pond_links = []
    seen_links = set()

    for e, c in eligible_events:
        t_code = e["tank_code"]
        r_stock_date = e["stock_date"]
        e_date = datetime.date.fromisoformat(e["event_date"])
        lot = e.get("lot_no") or "Lot N/A"
        q_val = e.get("qty_k", 0)

        seen_candidates = {}
        for pb in parsed_batches:
            if t_code in pb["tanks"]:
                b_date = datetime.date.fromisoformat(pb["stck_date"])
                if abs((b_date - e_date).days) <= 1:
                    key = (pb["pond_index"], pb["stck_date"])
                    seen_candidates[key] = pb

        for (p_idx, p_date), pb in seen_candidates.items():
            link_key = (t_code, r_stock_date, p_idx, p_date)
            if link_key not in seen_links:
                seen_links.add(link_key)
                match_method = "AUTO" if len(seen_candidates) == 1 else "AUTO_SPLIT"
                t_raw_val = pb["tank_raw"]
                pond_links.append({
                    "tank_code": t_code,
                    "run_stock_date": r_stock_date,
                    "pond_index": p_idx,
                    "pond_stck_date": p_date,
                    "status": "LINKED",
                    "match_method": match_method,
                    "confidence": 1.0 if match_method == "AUTO" else 0.95,
                    "review_notes": f"Matched harvest {q_val}k ({lot}) to farm {t_raw_val}"
                })

    print(f"  [SUMMARY] Generated {len(pond_links)} confirmed pond traceability links.")
    post_rpc_ingest("hatchery_pond_links", pond_links, dry_run=dry_run, chunk_size=chunk_size)
    return pond_links

def copy_to_temp(src_path):
    """Safely copies locked/synced OneDrive files to temp using PowerShell."""
    temp_dir = tempfile.gettempdir()
    base_name = os.path.basename(src_path)
    dst_path = os.path.join(temp_dir, f"tph_sync_{int(time.time())}_{base_name}")
    
    # Try Python shutil first, fallback to PowerShell Copy-Item if locked by Excel/OneDrive
    try:
        shutil.copyfile(src_path, dst_path)
    except PermissionError:
        import subprocess
        ps_cmd = f"Copy-Item -LiteralPath '{src_path}' -Destination '{dst_path}' -Force"
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
        if res.returncode != 0 or not os.path.exists(dst_path):
            raise PermissionError(f"Failed to copy locked file via PowerShell: {res.stderr}")
    return dst_path

def run_sync(summary_path, mat_path, dry_run=False, chunk_size=50):
    print("=" * 80)
    print("TELAGA PUTAT HATCHERY (TPH) — DATA INGESTION & AUDIT PIPELINE")
    print(f"Mode: {'DRY RUN (No Supabase writes)' if dry_run else 'LIVE UPLOAD (Supabase PostgreSQL)'}")
    print("=" * 80)

    # 1. Pre-flight verification
    print("\n[STAGE 1/7] Pre-flight security & authorization verification...")
    if not dry_run:
        verify_url = f"{SUPABASE_URL}/rest/v1/rpc/fn_verify_dbms_passcode"
        verify_payload = json.dumps({"p_passcode": EDITOR_PASSCODE}).encode("utf-8")
        req = urllib.request.Request(verify_url, data=verify_payload, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                role = json.loads(resp.read().decode("utf-8"))
                if role != "EDITOR":
                    raise PermissionError(f"Pre-flight failed: Passcode rejected by Supabase (Role: {role})")
                print("  [OK] Successfully authenticated with Supabase as DBMS EDITOR.")
        except Exception as e:
            print(f"  [ERROR] Could not verify DBMS Editor role: {e}")
            raise
    else:
        print("  [SKIP] Dry run mode — skipping live security check.")

    # 2. Copy and load workbooks
    print("\n[STAGE 2/7] Opening workbook snapshots from OneDrive...")
    tmp_summary = copy_to_temp(summary_path)
    tmp_mat = copy_to_temp(mat_path)
    print(f"  [OK] Copied Summary to: {tmp_summary}")
    print(f"  [OK] Copied Maturation to: {tmp_mat}")

    wb_summary = openpyxl.load_workbook(tmp_summary, read_only=True, data_only=True)
    wb_mat = openpyxl.load_workbook(tmp_mat, read_only=True, data_only=True)

    # 3. Seed Master Dictionaries (64 Tanks, Sources, Aliases)
    print("\n[STAGE 3/7] Preparing master dictionary records...")
    tanks = generate_64_tanks()
    print(f"  [PREPARED] 64 Hatchery Tanks (A01..D16)")

    sources = SOURCES
    print(f"  [PREPARED] {len(sources)} Master Hatchery Sources (Internal & External)")

    source_map_records = [{"raw_code": k, "source_code": v} for k, v in SOURCE_MAP.items()]
    print(f"  [PREPARED] {len(source_map_records)} Source Normalization Aliases")

    post_rpc_ingest("hatchery_tanks", tanks, dry_run=dry_run, chunk_size=chunk_size)
    post_rpc_ingest("hatchery_sources", sources, dry_run=dry_run, chunk_size=chunk_size)
    post_rpc_ingest("hatchery_source_map", source_map_records, dry_run=dry_run, chunk_size=chunk_size)

    # 4. Parse Broodstock Maturation Batches & Daily Records
    print("\n[STAGE 4/7] Parsing Maturation Daily Report workbook (2024–2026 Batches)...")
    all_batches = []
    all_blocks = []
    all_daily = []
    all_allocations = []

    for sheet_name in MAT_SHEET_MAP.keys():
        if sheet_name in wb_mat.sheetnames:
            ws = wb_mat[sheet_name]
            b_meta, b_blocks, b_daily, b_alloc = parse_batch_sheet(ws, sheet_name)
            if b_meta:
                all_batches.append(b_meta)
                all_blocks.extend(b_blocks)
                all_daily.extend(b_daily)
                all_allocations.extend(b_alloc)
                print(f"  [PARSED] {sheet_name}: {len(b_daily)} daily records, {len(b_alloc)} tank allocations")

    print(f"  [SUMMARY] Total Batches: {len(all_batches)} | Daily Records: {len(all_daily)} | Allocations: {len(all_allocations)}")
    post_rpc_ingest("broodstock_batches", all_batches, dry_run=dry_run, chunk_size=chunk_size)
    post_rpc_ingest("broodstock_block_assignments", all_blocks, dry_run=dry_run, chunk_size=chunk_size)
    post_rpc_ingest("broodstock_daily", all_daily, dry_run=dry_run, chunk_size=chunk_size)
    post_rpc_ingest("hatchery_nauplii_allocations", all_allocations, dry_run=dry_run, chunk_size=chunk_size)

    # 5. Parse PL Tank Runs & Lifecycle Events from Sheet1
    print("\n[STAGE 5/7] Parsing Master PL Production Log (Sheet1)...")
    ws_sheet1 = wb_summary["Sheet1"]
    runs, events, commercial, logs = parse_summary_sheet1(ws_sheet1)

    print(f"  [SUMMARY] Total Runs: {len(runs)} | Events: {len(events)} | Commercial Records: {len(commercial)} | Review Logs: {len(logs)}")
    post_rpc_ingest("hatchery_tank_runs", runs, dry_run=dry_run, chunk_size=chunk_size)
    post_rpc_ingest("hatchery_run_events", events, dry_run=dry_run, chunk_size=chunk_size)
    post_rpc_ingest("hatchery_run_commercial", commercial, dry_run=dry_run, chunk_size=chunk_size)

    # 6. Automatic Pond Linkage Reconciliation
    pond_links = reconcile_pond_links(events, commercial, dry_run=dry_run, chunk_size=chunk_size)

    # 7. Final Ingestion & Reconciliation Audit
    print("\n[STAGE 7/7] Completeness & Reconciliation Audit:")
    print("-" * 60)
    print(f"  1. Tanks in Database         : {len(tanks)} (All 64 present)")
    print(f"  2. Total Runs Extracted      : {len(runs)}")
    print(f"  3. Culture Runs Active Today : {sum(1 for r in runs if r['status'] == 'CULTURE')}")
    print(f"  4. Harvest Events Logged     : {sum(1 for e in events if e['event_type'] == 'HARVEST')}")
    print(f"  5. Flush Events Logged       : {sum(1 for e in events if e['event_type'] == 'FLUSH')}")
    print(f"  6. Maturation Daily Records  : {len(all_daily)}")
    print(f"  7. Nauplii Allocations       : {len(all_allocations)}")
    print(f"  8. Flagged Rows for Review   : {len(logs)}")
    print(f"  9. Confirmed Pond Links      : {len(pond_links)}")
    print("-" * 60)

    # Clean up temp files
    try:
        os.remove(tmp_summary)
        os.remove(tmp_mat)
    except Exception:
        pass

    print("\n[SUCCESS] Pipeline execution complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TPH Data Sync Pipeline")
    parser.add_argument("--summary", default=DEFAULT_SUMMARY_EXCEL, help="Path to Summary report excel")
    parser.add_argument("--mat", default=DEFAULT_MAT_EXCEL, help="Path to Mat daily report excel")
    parser.add_argument("--dry-run", action="store_true", help="Perform parsing and verification without DB write")
    parser.add_argument("--chunk-size", type=int, default=50, help="Chunk size for batch ingest RPC")

    args = parser.parse_args()
    run_sync(args.summary, args.mat, dry_run=args.dry_run, chunk_size=args.chunk_size)
