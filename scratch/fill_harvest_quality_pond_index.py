import urllib.request, json, openpyxl, sys
from datetime import datetime, timedelta

excel_path = r"C:\Users\syafiq\Documents\1 A assortment\20261101 Result harvest quality.xlsx"

print(f"Loading Excel workbook: {excel_path}")
wb = openpyxl.load_workbook(excel_path)
ws = wb.active

# 1. Fetch Supabase harvest records
print("Fetching Supabase harvest records...")
all_harv = []
offset = 0
while True:
    url = f"https://keappoukeagyzpoxkrru.supabase.co/rest/v1/pond_harvest_daily?select=pond_index,harv_date,harv_status&harv_date=gte.2025-10-01&order=harv_date.asc&offset={offset}&limit=1000"
    req = urllib.request.Request(url, headers={
        'apikey': 'sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s',
        'Authorization': 'Bearer sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s',
    })
    with urllib.request.urlopen(req) as resp:
        chunk = json.loads(resp.read().decode())
        all_harv.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
print(f"Fetched {len(all_harv)} harvest records from Supabase.")

# Build lookup by (pond, harv_date) -> list of pond_indices
harv_map = {}
for h in all_harv:
    pi = h['pond_index']
    p_code = f"{pi[1:3]}.{pi[3:5]}.{pi[5:7]}"
    hd = datetime.strptime(h['harv_date'], '%Y-%m-%d').date()
    harv_map.setdefault((p_code, hd), []).append(pi)

# Helper date parser
def parse_date(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        v = v.strip()
        for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%Y/%m/%d'):
            try:
                return datetime.strptime(v, fmt).date()
            except ValueError:
                pass
    return None

# Known / verified manual resolutions
# Row 63: Pond 04.07.09 in Excel was confirmed by user as Pond 04.07.08 (2040708.39)
# Rows 291, 385-393: Late Oct 2026 harvests verified via growout_pond_master and DOC
manual_resolutions = {
    63: "2040708.39",    # User confirmed 04.07.08 on 2026-04-15
    291: "2030507.41",   # Partial on 2026-09-02 (DOC 148)
    385: "2040701.40",   # 2026-10-23 (DOC 124)
    386: "2071405.38",   # 2026-10-25 (DOC 129)
    387: "2071406.38",   # 2026-10-25 (DOC 129)
    388: "2091804.40",   # 2026-10-25 (DOC 66)
    389: "2091808.41",   # 2026-10-26 (DOC 66)
    390: "2040701.40",   # 2026-10-26 (DOC 127)
    391: "2091707.41",   # 2026-10-27 (DOC 68)
    392: "2051001.40",   # 2026-10-27 (DOC 123)
    393: "2040702.40",   # 2026-10-27 (DOC 123)
}

exact_count = 0
manual_count = 0
unresolved = []

for r in range(2, ws.max_row + 1):
    val_date = parse_date(ws.cell(r, 9).value)
    addr = str(ws.cell(r, 10).value or '').strip()
    dotted = f"{addr[0:2]}.{addr[2:4]}.{addr[4:6]}"
    
    if r in manual_resolutions:
        resolved_pi = manual_resolutions[r]
        ws.cell(row=r, column=11).value = resolved_pi
        manual_count += 1
        continue
    
    # Check exact match
    if (dotted, val_date) in harv_map:
        candidates = harv_map[(dotted, val_date)]
        resolved_pi = candidates[0]
        ws.cell(row=r, column=11).value = resolved_pi
        exact_count += 1
        continue
    
    # Check +/- 1 day
    p1 = harv_map.get((dotted, val_date + timedelta(days=1)))
    m1 = harv_map.get((dotted, val_date - timedelta(days=1)))
    if p1:
        resolved_pi = p1[0]
        ws.cell(row=r, column=11).value = resolved_pi
        exact_count += 1
        continue
    elif m1:
        resolved_pi = m1[0]
        ws.cell(row=r, column=11).value = resolved_pi
        exact_count += 1
        continue
    
    unresolved.append((r, dotted, val_date))

print(f"Exact harvest matches: {exact_count}")
print(f"Manual / verified fallback matches: {manual_count}")
print(f"Total resolved: {exact_count + manual_count} / {ws.max_row - 1}")
print(f"Unresolved count: {len(unresolved)}")

if unresolved:
    print("ERROR: Some rows could not be resolved:", unresolved)
    sys.exit(1)

print("Saving modified workbook...")
wb.save(excel_path)
print("SUCCESS: Workbook saved successfully!")
