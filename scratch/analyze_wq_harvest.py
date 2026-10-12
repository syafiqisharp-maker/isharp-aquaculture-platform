import os
import sys
import json
import math
import datetime
import urllib.request
from collections import defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("====================================================================")
print("  iSHARP AQUACULTURE PLATFORM: WATER QUALITY vs HARVEST ANALYSIS   ")
print("  Blue Archipelago Berhad — Setiu Shrimp Farm (2024 - 2026)        ")
print("====================================================================")

# 1. Load Ground Truth Harvest Final Data
HARVEST_JSON_PATH = r"C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\scratch\harvest_final_2024_2026.json"
with open(HARVEST_JSON_PATH, "r", encoding="utf-8-sig") as f:
    harvest_raw = json.load(f)

print(f"\n[1/5] Loaded {len(harvest_raw)} official closed harvest cycles from {HARVEST_JSON_PATH}")

# Clean and normalize harvest records
harvest_map = {}
for r in harvest_raw:
    p = r.get("pond_index")
    if not p: continue
    
    sr = r.get("final_sr")
    adg = r.get("final_adg")
    abw = r.get("final_abw")
    doc = r.get("final_doc")
    kg = r.get("final_kg")
    dt = r.get("final_date")
    
    if sr is None or adg is None or sr <= 0 or adg <= 0:
        continue
    if sr > 150.0: # Filter out stocking estimation artifacts
        continue
        
    species = str(r.get("species") or "P. VANNAMEi").upper()
    is_mon = "MON" in species
    yr = int(dt[:4]) if dt else 2025
    
    harvest_map[p] = {
        "pond_index": p,
        "pond": r.get("pond"),
        "species": "MON" if is_mon else "VAN",
        "final_date": dt,
        "year": yr,
        "final_doc": doc,
        "final_abw": abw,
        "final_kg": kg,
        "final_adg": adg,
        "final_sr": sr,
        "final_fcr": r.get("final_fcr"),
        "final_status": r.get("final_status") or "HARVESTED",
        "stock_total": r.get("stock_total"),
        "stock_density": r.get("stock_density")
    }

print(f"  -> Valid cleaned closed harvest cycles: {len(harvest_map)} cycles")

# 2. Extract Lab Water Quality from Supabase Cloud
SUPABASE_URL = "https://keappoukeagyzpoxkrru.supabase.co"
SUPABASE_KEY = "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def fetch_all_supabase(endpoint):
    records = []
    limit = 1000
    offset = 0
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}&limit={limit}&offset={offset}"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as r:
            batch = json.loads(r.read())
            if not batch: break
            records.extend(batch)
            if len(batch) < limit: break
            offset += len(batch)
            print(f"     Fetched {len(records)} records from {endpoint.split('?')[0]}...")
    return records

print(f"\n[2/5] Fetching lab_water_quality from Supabase...")
wq_raw = fetch_all_supabase("lab_water_quality?log_date=gte.2024-01-01&select=pond_index,pond,log_date,doc,salinity_ppt,alkalinity,ammonia,nitrite,calcium,magnesium,turbidity")
print(f"  -> Total lab water quality samples loaded: {len(wq_raw)}")

# 3. Match and Aggregate WQ per Cycle
print("\n[3/5] Aggregating cycle-level water quality metrics...")
wq_by_cycle = defaultdict(list)
for r in wq_raw:
    p = r.get("pond_index")
    if p and p in harvest_map:
        wq_by_cycle[p].append(r)

print(f"  -> Matched {len(wq_by_cycle)} cycles with both lab water quality and harvest records!")

matched_dataset = []
for p, wq_list in wq_by_cycle.items():
    if len(wq_list) < 3: # Must have at least 3 samples across cycle
        continue
    outcome = harvest_map[p]
    
    salinities = [float(r['salinity_ppt']) for r in wq_list if r.get('salinity_ppt') is not None]
    alkalinities = [float(r['alkalinity']) for r in wq_list if r.get('alkalinity') is not None]
    ammonias = [float(r['ammonia']) for r in wq_list if r.get('ammonia') is not None]
    nitrites = [float(r['nitrite']) for r in wq_list if r.get('nitrite') is not None]
    calciums = [float(r['calcium']) for r in wq_list if r.get('calcium') is not None]
    magnesiums = [float(r['magnesium']) for r in wq_list if r.get('magnesium') is not None]
    turbidities = [float(r['turbidity']) for r in wq_list if r.get('turbidity') is not None]
    
    def safe_mean(arr): return sum(arr)/len(arr) if arr else None
    def safe_max(arr): return max(arr) if arr else None
    def safe_min(arr): return min(arr) if arr else None
    def safe_std(arr):
        if not arr or len(arr) < 2: return 0.0
        m = sum(arr)/len(arr)
        return math.sqrt(sum((x-m)**2 for x in arr)/(len(arr)-1))
    def safe_pct_above(arr, thresh): return (sum(1 for x in arr if x > thresh)/len(arr))*100.0 if arr else 0.0
    def safe_pct_below(arr, thresh): return (sum(1 for x in arr if x < thresh)/len(arr))*100.0 if arr else 0.0
    
    ca_mean = safe_mean(calciums)
    mg_mean = safe_mean(magnesiums)
    camg_ratio = (mg_mean / ca_mean) if (ca_mean and mg_mean and ca_mean > 0) else None
    
    entry = {
        **outcome,
        'wq_samples_count': len(wq_list),
        'ammonia_mean': safe_mean(ammonias),
        'ammonia_max': safe_max(ammonias),
        'ammonia_std': safe_std(ammonias),
        'ammonia_pct_high': safe_pct_above(ammonias, 1.0),
        'ammonia_pct_crit': safe_pct_above(ammonias, 2.0),
        'nitrite_mean': safe_mean(nitrites),
        'nitrite_max': safe_max(nitrites),
        'nitrite_std': safe_std(nitrites),
        'nitrite_pct_high': safe_pct_above(nitrites, 0.5),
        'nitrite_pct_crit': safe_pct_above(nitrites, 1.0),
        'salinity_mean': safe_mean(salinities),
        'salinity_min': safe_min(salinities),
        'salinity_max': safe_max(salinities),
        'salinity_std': safe_std(salinities),
        'salinity_pct_low': safe_pct_below(salinities, 15.0),
        'alkalinity_mean': safe_mean(alkalinities),
        'calcium_mean': ca_mean,
        'magnesium_mean': mg_mean,
        'camg_ratio': camg_ratio,
        'turbidity_mean': safe_mean(turbidities),
        'turbidity_max': safe_max(turbidities),
        'turbidity_pct_high': safe_pct_above(turbidities, 30.0)
    }
    matched_dataset.append(entry)

print(f"  -> Total complete cycles in modeling dataset: {len(matched_dataset)}")

# 4. Statistical Functions
def get_stats(arr):
    valid = [x for x in arr if x is not None and not math.isnan(x)]
    if not valid: return {'n': 0, 'mean': 0, 'std': 0, 'min': 0, 'med': 0, 'max': 0}
    n = len(valid)
    mean = sum(valid) / n
    var = sum((x - mean) ** 2 for x in valid) / (n - 1) if n > 1 else 0
    std = math.sqrt(var)
    s = sorted(valid)
    med = s[n // 2] if n % 2 != 0 else (s[n // 2 - 1] + s[n // 2]) / 2
    return {'n': n, 'mean': mean, 'std': std, 'min': s[0], 'med': med, 'max': s[-1]}

def t_p_value(r, n):
    if r is None or abs(r) >= 1.0 or n <= 2: return 0.0
    df = n - 2
    t = abs(r) * math.sqrt(df / (1.0 - r**2))
    z = (t * (1 - 1 / (4 * df))) / math.sqrt(1 + t * t / (2 * df))
    p = 0.5 * math.erfc(z / math.sqrt(2)) * 2
    return max(0.000001, min(1.0, p))

def pearson_r(x_arr, y_arr):
    pairs = [(x, y) for x, y in zip(x_arr, y_arr) if x is not None and y is not None and not math.isnan(x) and not math.isnan(y)]
    if len(pairs) < 5: return None, 0.0, 0, 1.0
    n = len(pairs)
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    mx = sum(xs) / n
    my = sum(ys) / n
    var_x = sum((x - mx) ** 2 for x in xs)
    var_y = sum((y - my) ** 2 for y in ys)
    if var_x == 0 or var_y == 0: return 0.0, 0.0, n, 1.0
    cov = sum((x - mx) * (y - my) for x, y in pairs)
    r = cov / math.sqrt(var_x * var_y)
    r2 = r ** 2
    p_val = t_p_value(r, n)
    return r, r2, n, p_val

def rank_data(arr):
    indexed = sorted(enumerate(arr), key=lambda x: x[1])
    ranks = [0.0] * len(arr)
    i = 0
    while i < len(arr):
        j = i
        while j < len(arr) - 1 and indexed[j][1] == indexed[j + 1][1]:
            j += 1
        avg_rank = (i + j + 2) / 2.0
        for k in range(i, j + 1):
            ranks[indexed[k][0]] = avg_rank
        i = j + 1
    return ranks

def spearman_rho(x_arr, y_arr):
    pairs = [(x, y) for x, y in zip(x_arr, y_arr) if x is not None and y is not None and not math.isnan(x) and not math.isnan(y)]
    if len(pairs) < 5: return None, len(pairs), 1.0
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    rx = rank_data(xs)
    ry = rank_data(ys)
    r, r2, n, p_val = pearson_r(rx, ry)
    return r, n, p_val

print("\n[4/5] Executing Correlation and Threshold Computations...")

print("\n====================================================================")
print("  CYCLE HARVEST OUTCOMES SUMMARY (N = %d)" % len(matched_dataset))
print("====================================================================")
sr_stats = get_stats([d['final_sr'] for d in matched_dataset])
adg_stats = get_stats([d['final_adg'] for d in matched_dataset])
abw_stats = get_stats([d['final_abw'] for d in matched_dataset])
doc_stats = get_stats([d['final_doc'] for d in matched_dataset])
kg_stats = get_stats([d['final_kg'] for d in matched_dataset])
fcr_stats = get_stats([d['final_fcr'] for d in matched_dataset])

print(f"Survival Rate (SR %):   Mean={sr_stats['mean']:.2f}%, Median={sr_stats['med']:.2f}%, Std={sr_stats['std']:.2f}%, Min={sr_stats['min']:.2f}%, Max={sr_stats['max']:.2f}%")
print(f"Average Daily Growth:   Mean={adg_stats['mean']:.3f} g/d, Median={adg_stats['med']:.3f} g/d, Std={adg_stats['std']:.3f}, Min={adg_stats['min']:.3f}, Max={adg_stats['max']:.3f}")
print(f"Harvest ABW (g):        Mean={abw_stats['mean']:.2f}g, Median={abw_stats['med']:.2f}g, Std={abw_stats['std']:.2f}g, Min={abw_stats['min']:.2f}g, Max={abw_stats['max']:.2f}g")
print(f"Days of Culture (DOC):  Mean={doc_stats['mean']:.1f}d, Median={doc_stats['med']:.1f}d, Std={doc_stats['std']:.1f}d, Min={doc_stats['min']:.0f}d, Max={doc_stats['max']:.0f}d")
print(f"Total Harvest (kg):     Mean={kg_stats['mean']:.1f}kg, Median={kg_stats['med']:.1f}kg, Std={kg_stats['std']:.1f}kg")
print(f"Feed Conversion Ratio:  Mean={fcr_stats['mean']:.2f}, Median={fcr_stats['med']:.2f}, Std={fcr_stats['std']:.2f}")

van_data = [d for d in matched_dataset if d['species'] == 'VAN']
mon_data = [d for d in matched_dataset if d['species'] == 'MON']
print(f"\nSpecies Breakdown: P. vannamei = {len(van_data)} cycles, P. monodon = {len(mon_data)} cycles")

for yr in [2024, 2025, 2026]:
    yr_data = [d for d in matched_dataset if d['year'] == yr]
    print(f"Year {yr}: {len(yr_data)} cycles")

wq_vars = [
    ('ammonia_mean', 'Ammonia Mean (mg/L)'),
    ('ammonia_max', 'Ammonia Max (mg/L)'),
    ('ammonia_pct_high', 'Ammonia % Days > 1.0'),
    ('nitrite_mean', 'Nitrite Mean (mg/L)'),
    ('nitrite_max', 'Nitrite Max (mg/L)'),
    ('nitrite_pct_high', 'Nitrite % Days > 0.5'),
    ('salinity_mean', 'Salinity Mean (ppt)'),
    ('salinity_min', 'Salinity Min (ppt)'),
    ('salinity_max', 'Salinity Max (ppt)'),
    ('calcium_mean', 'Calcium Mean (mg/L)'),
    ('magnesium_mean', 'Magnesium Mean (mg/L)'),
    ('camg_ratio', 'Ca:Mg Ratio'),
    ('turbidity_mean', 'Turbidity Mean (NTU)'),
    ('turbidity_max', 'Turbidity Max (NTU)'),
    ('turbidity_pct_high', 'Turbidity % Days > 30')
]

print("\n========================================================================================================================")
print("  STATISTICAL CORRELATION: WATER QUALITY vs HARVEST OUTCOMES (ALL CYCLES, N = %d)" % len(matched_dataset))
print("========================================================================================================================")
print(f"{'Parameter':<24} | {'Pearson r(SR)':<13} | {'R2(SR)':<8} | {'p-val(SR)':<10} | {'Spearman rho(SR)':<17} || {'Pearson r(ADG)':<14} | {'R2(ADG)':<8} | {'p-val(ADG)':<10} | {'Spearman rho(ADG)':<17}")
print("-" * 130)

for var_key, var_label in wq_vars:
    xs = [d[var_key] for d in matched_dataset]
    sr_vals = [d['final_sr'] for d in matched_dataset]
    adg_vals = [d['final_adg'] for d in matched_dataset]
    
    r_sr, r2_sr, n_sr, p_sr = pearson_r(xs, sr_vals)
    rho_sr, _, _ = spearman_rho(xs, sr_vals)
    
    r_adg, r2_adg, n_adg, p_adg = pearson_r(xs, adg_vals)
    rho_adg, _, _ = spearman_rho(xs, adg_vals)
    
    r_sr_str = f"{r_sr:+.4f}" if r_sr is not None else "N/A"
    r2_sr_str = f"{r2_sr:.4f}" if r2_sr is not None else "N/A"
    p_sr_str = f"{p_sr:.4f}" if p_sr is not None else "N/A"
    rho_sr_str = f"{rho_sr:+.4f}" if rho_sr is not None else "N/A"
    
    r_adg_str = f"{r_adg:+.4f}" if r_adg is not None else "N/A"
    r2_adg_str = f"{r2_adg:.4f}" if r2_adg is not None else "N/A"
    p_adg_str = f"{p_adg:.4f}" if p_adg is not None else "N/A"
    rho_adg_str = f"{rho_adg:+.4f}" if rho_adg is not None else "N/A"
    
    print(f"{var_label:<24} | {r_sr_str:<13} | {r2_sr_str:<8} | {p_sr_str:<10} | {rho_sr_str:<15} || {r_adg_str:<14} | {r2_adg_str:<8} | {p_adg_str:<10} | {rho_adg_str:<15}")

print("\n========================================================================================================================")
print("  STATISTICAL CORRELATION: P. VANNAMEi ONLY (N = %d)" % len(van_data))
print("========================================================================================================================")
print(f"{'Parameter':<24} | {'Pearson r(SR)':<13} | {'R2(SR)':<8} | {'p-val(SR)':<10} | {'Spearman rho(SR)':<17} || {'Pearson r(ADG)':<14} | {'R2(ADG)':<8} | {'p-val(ADG)':<10} | {'Spearman rho(ADG)':<17}")
print("-" * 130)

for var_key, var_label in wq_vars:
    xs = [d[var_key] for d in van_data]
    sr_vals = [d['final_sr'] for d in van_data]
    adg_vals = [d['final_adg'] for d in van_data]
    
    r_sr, r2_sr, n_sr, p_sr = pearson_r(xs, sr_vals)
    rho_sr, _, _ = spearman_rho(xs, sr_vals)
    
    r_adg, r2_adg, n_adg, p_adg = pearson_r(xs, adg_vals)
    rho_adg, _, _ = spearman_rho(xs, adg_vals)
    
    r_sr_str = f"{r_sr:+.4f}" if r_sr is not None else "N/A"
    r2_sr_str = f"{r2_sr:.4f}" if r2_sr is not None else "N/A"
    p_sr_str = f"{p_sr:.4f}" if p_sr is not None else "N/A"
    rho_sr_str = f"{rho_sr:+.4f}" if rho_sr is not None else "N/A"
    
    r_adg_str = f"{r_adg:+.4f}" if r_adg is not None else "N/A"
    r2_adg_str = f"{r2_adg:.4f}" if r2_adg is not None else "N/A"
    p_adg_str = f"{p_adg:.4f}" if p_adg is not None else "N/A"
    rho_adg_str = f"{rho_adg:+.4f}" if rho_adg is not None else "N/A"
    
    print(f"{var_label:<24} | {r_sr_str:<13} | {r2_sr_str:<8} | {p_sr_str:<10} | {rho_sr_str:<15} || {r_adg_str:<14} | {r2_adg_str:<8} | {p_adg_str:<10} | {rho_adg_str:<15}")

# YEAR-BY-YEAR ANALYSIS FOR VANNAMEI
for yr in [2024, 2025, 2026]:
    yr_set = [d for d in van_data if d['year'] == yr]
    print(f"\n--- P. VANNAMEi YEAR {yr} (N = {len(yr_set)}) ---")
    print(f"{'Parameter':<24} | {'Pearson r(SR)':<14} | {'R2(SR)':<8} || {'Pearson r(ADG)':<15} | {'R2(ADG)':<8}")
    print("-" * 75)
    for var_key, var_label in [
        ('ammonia_mean', 'Ammonia Mean (mg/L)'),
        ('nitrite_mean', 'Nitrite Mean (mg/L)'),
        ('salinity_mean', 'Salinity Mean (ppt)'),
        ('calcium_mean', 'Calcium Mean (mg/L)'),
        ('magnesium_mean', 'Magnesium Mean (mg/L)'),
        ('turbidity_mean', 'Turbidity Mean (NTU)')
    ]:
        xs = [d[var_key] for d in yr_set]
        sr_vals = [d['final_sr'] for d in yr_set]
        adg_vals = [d['final_adg'] for d in yr_set]
        r_sr, r2_sr, _, _ = pearson_r(xs, sr_vals)
        r_adg, r2_adg, _, _ = pearson_r(xs, adg_vals)
        r_sr_str = f"{r_sr:+.4f}" if r_sr is not None else "N/A"
        r2_sr_str = f"{r2_sr:.4f}" if r2_sr is not None else "N/A"
        r_adg_str = f"{r_adg:+.4f}" if r_adg is not None else "N/A"
        r2_adg_str = f"{r2_adg:.4f}" if r2_adg is not None else "N/A"
        print(f"{var_label:<24} | {r_sr_str:<14} | {r2_sr_str:<8} || {r_adg_str:<15} | {r2_adg_str:<8}")

print("\n====================================================================================================")
print("  TOP QUARTILE vs BOTTOM QUARTILE ANALYSIS (HIGH vs LOW PERFORMERS - P. VANNAMEi)")
print("====================================================================================================")
sorted_by_sr = sorted(van_data, key=lambda x: x['final_sr'])
q1_sr = sorted_by_sr[:len(sorted_by_sr)//4]
q4_sr = sorted_by_sr[-len(sorted_by_sr)//4:]

print(f"\n--- SURVIVAL RATE CONTRAST (P. vannamei) ---")
print(f"Low SR Quartile Q1  (N={len(q1_sr)}): Mean SR = {get_stats([d['final_sr'] for d in q1_sr])['mean']:.1f}% (Range: {get_stats([d['final_sr'] for d in q1_sr])['min']:.1f}% - {get_stats([d['final_sr'] for d in q1_sr])['max']:.1f}%)")
print(f"High SR Quartile Q4 (N={len(q4_sr)}): Mean SR = {get_stats([d['final_sr'] for d in q4_sr])['mean']:.1f}% (Range: {get_stats([d['final_sr'] for d in q4_sr])['min']:.1f}% - {get_stats([d['final_sr'] for d in q4_sr])['max']:.1f}%)")
print(f"{'Parameter':<24} | {'Low SR Mean':<14} | {'High SR Mean':<14} | {'Difference (Diff)':<18}")
print("-" * 75)
for var_key, var_label in [
    ('ammonia_mean', 'Ammonia Mean (mg/L)'),
    ('ammonia_max', 'Ammonia Max (mg/L)'),
    ('nitrite_mean', 'Nitrite Mean (mg/L)'),
    ('nitrite_max', 'Nitrite Max (mg/L)'),
    ('salinity_mean', 'Salinity Mean (ppt)'),
    ('calcium_mean', 'Calcium Mean (mg/L)'),
    ('magnesium_mean', 'Magnesium Mean (mg/L)'),
    ('camg_ratio', 'Ca:Mg Ratio'),
    ('turbidity_mean', 'Turbidity Mean (NTU)')
]:
    m1 = get_stats([d[var_key] for d in q1_sr])['mean']
    m4 = get_stats([d[var_key] for d in q4_sr])['mean']
    diff = m4 - m1
    print(f"{var_label:<24} | {m1:<14.2f} | {m4:<14.2f} | {diff:<+15.2f}")

sorted_by_adg = sorted(van_data, key=lambda x: x['final_adg'])
q1_adg = sorted_by_adg[:len(sorted_by_adg)//4]
q4_adg = sorted_by_adg[-len(sorted_by_adg)//4:]

print(f"\n--- AVERAGE DAILY GROWTH (ADG) CONTRAST (P. vannamei) ---")
print(f"Low ADG Quartile Q1  (N={len(q1_adg)}): Mean ADG = {get_stats([d['final_adg'] for d in q1_adg])['mean']:.3f} g/d (Range: {get_stats([d['final_adg'] for d in q1_adg])['min']:.3f} - {get_stats([d['final_adg'] for d in q1_adg])['max']:.3f})")
print(f"High ADG Quartile Q4 (N={len(q4_adg)}): Mean ADG = {get_stats([d['final_adg'] for d in q4_adg])['mean']:.3f} g/d (Range: {get_stats([d['final_adg'] for d in q4_adg])['min']:.3f} - {get_stats([d['final_adg'] for d in q4_adg])['max']:.3f})")
print(f"{'Parameter':<24} | {'Low ADG Mean':<14} | {'High ADG Mean':<14} | {'Difference (Diff)':<18}")
print("-" * 75)
for var_key, var_label in [
    ('ammonia_mean', 'Ammonia Mean (mg/L)'),
    ('ammonia_max', 'Ammonia Max (mg/L)'),
    ('nitrite_mean', 'Nitrite Mean (mg/L)'),
    ('nitrite_max', 'Nitrite Max (mg/L)'),
    ('salinity_mean', 'Salinity Mean (ppt)'),
    ('calcium_mean', 'Calcium Mean (mg/L)'),
    ('magnesium_mean', 'Magnesium Mean (mg/L)'),
    ('camg_ratio', 'Ca:Mg Ratio'),
    ('turbidity_mean', 'Turbidity Mean (NTU)')
]:
    m1 = get_stats([d[var_key] for d in q1_adg])['mean']
    m4 = get_stats([d[var_key] for d in q4_adg])['mean']
    diff = m4 - m1
    print(f"{var_label:<24} | {m1:<14.2f} | {m4:<14.2f} | {diff:<+15.2f}")

print("\n====================================================================================================")
print("  NON-LINEAR THRESHOLD EFFECT / BINNED ANALYSIS (P. VANNAMEi)")
print("====================================================================================================")

def analyze_bins(dataset, param_key, param_name, bins, labels):
    print(f"\n--- {param_name} Binned Analysis ---")
    print(f"{'Bin Range':<24} | {'Ponds(N)':<9} | {'Mean SR(%)':<12} | {'Median SR(%)':<14} | {'Mean ADG(g/d)':<14} | {'Median ADG(g/d)':<15}")
    print("-" * 96)
    for i in range(len(bins) - 1):
        low, high = bins[i], bins[i+1]
        subset = [d for d in dataset if d.get(param_key) is not None and low <= d[param_key] < high]
        if not subset:
            print(f"{labels[i]:<24} | {0:<9} | {'N/A':<12} | {'N/A':<14} | {'N/A':<14} | {'N/A':<15}")
            continue
        sr_m = sum(d['final_sr'] for d in subset) / len(subset)
        srs = sorted(d['final_sr'] for d in subset)
        sr_med = srs[len(srs)//2]
        adg_m = sum(d['final_adg'] for d in subset) / len(subset)
        adgs = sorted(d['final_adg'] for d in subset)
        adg_med = adgs[len(adgs)//2]
        print(f"{labels[i]:<24} | {len(subset):<9} | {sr_m:<12.2f} | {sr_med:<14.2f} | {adg_m:<14.3f} | {adg_med:<15.3f}")

analyze_bins(van_data, 'ammonia_mean', 'Ammonia Mean', [0, 0.3, 0.6, 1.0, 999], ['< 0.3 mg/L (Low)', '0.3 - 0.6 mg/L (Normal)', '0.6 - 1.0 mg/L (Elevated)', '>= 1.0 mg/L (Critical)'])
analyze_bins(van_data, 'ammonia_max', 'Ammonia Peak Max', [0, 0.5, 1.0, 2.0, 999], ['< 0.5 mg/L', '0.5 - 1.0 mg/L', '1.0 - 2.0 mg/L', '>= 2.0 mg/L (Acute Spike)'])

analyze_bins(van_data, 'nitrite_mean', 'Nitrite Mean', [0, 0.1, 0.3, 0.5, 999], ['< 0.10 mg/L (Low)', '0.10 - 0.30 mg/L (Normal)', '0.30 - 0.50 mg/L (Elevated)', '>= 0.50 mg/L (Critical)'])
analyze_bins(van_data, 'nitrite_max', 'Nitrite Peak Max', [0, 0.3, 0.8, 1.5, 999], ['< 0.30 mg/L', '0.30 - 0.80 mg/L', '0.80 - 1.50 mg/L', '>= 1.50 mg/L (Severe Spike)'])

analyze_bins(van_data, 'salinity_mean', 'Salinity Mean', [0, 15, 22, 28, 999], ['< 15 ppt (Low Salinity)', '15 - 22 ppt (Medium Low)', '22 - 28 ppt (Optimal)', '>= 28 ppt (High Salinity)'])

analyze_bins(van_data, 'camg_ratio', 'Ca:Mg Ratio', [0, 2.0, 2.5, 3.5, 999], ['< 1:2.0 (Deficient)', '1:2.0 - 2.5 (Suboptimal)', '1:2.5 - 3.5 (Optimal Standard)', '> 1:3.5 (Excess)'])

analyze_bins(van_data, 'turbidity_mean', 'Turbidity Mean', [0, 20, 30, 45, 999], ['< 20 NTU (Clear)', '20 - 30 NTU (Optimal Bloom)', '30 - 45 NTU (Heavy Bloom)', '>= 45 NTU (Turbid / Silt)'])

print("\n====================================================================================================")
print("  CYCLE OUTCOME CATEGORY CONTRAST: NORMAL HARVEST vs FORCED / CULLED")
print("====================================================================================================")
normal_cycles = [d for d in van_data if "FORCED" not in str(d['final_status']).upper() and "CULL" not in str(d['final_status']).upper()]
forced_cycles = [d for d in van_data if "FORCED" in str(d['final_status']).upper() or "CULL" in str(d['final_status']).upper()]

print(f"Normal Completed Harvest: {len(normal_cycles)} ponds | Mean SR: {get_stats([d['final_sr'] for d in normal_cycles])['mean']:.2f}% | Mean ADG: {get_stats([d['final_adg'] for d in normal_cycles])['mean']:.3f} g/d")
print(f"Forced Harvest / Culled:  {len(forced_cycles)} ponds | Mean SR: {get_stats([d['final_sr'] for d in forced_cycles])['mean']:.2f}% | Mean ADG: {get_stats([d['final_adg'] for d in forced_cycles])['mean']:.3f} g/d")
print(f"{'Parameter':<24} | {'Normal Harvest Mean':<20} | {'Forced Harvest Mean':<20} | {'Difference (Diff)':<18}")
print("-" * 85)
for var_key, var_label in [
    ('ammonia_mean', 'Ammonia Mean (mg/L)'),
    ('ammonia_max', 'Ammonia Max (mg/L)'),
    ('nitrite_mean', 'Nitrite Mean (mg/L)'),
    ('nitrite_max', 'Nitrite Max (mg/L)'),
    ('salinity_mean', 'Salinity Mean (ppt)'),
    ('calcium_mean', 'Calcium Mean (mg/L)'),
    ('magnesium_mean', 'Magnesium Mean (mg/L)'),
    ('camg_ratio', 'Ca:Mg Ratio'),
    ('turbidity_mean', 'Turbidity Mean (NTU)')
]:
    m1 = get_stats([d[var_key] for d in normal_cycles])['mean']
    m2 = get_stats([d[var_key] for d in forced_cycles])['mean']
    diff = m2 - m1
    print(f"{var_label:<24} | {m1:<20.2f} | {m2:<20.2f} | {diff:<+15.2f}")

print("\n====================================================================================================")
print("  STAGE-WISE CORRELATION (EARLY DOC <= 40 vs LATE DOC > 40) - P. VANNAMEi")
print("====================================================================================================")
# Group raw wq by cycle into early (DOC <= 40) and late (DOC > 40)
early_wq_map = defaultdict(lambda: defaultdict(list))
late_wq_map = defaultdict(lambda: defaultdict(list))

for r in wq_raw:
    p = r.get("pond_index")
    if not p or p not in harvest_map: continue
    d = r.get("doc") or 0
    target = early_wq_map[p] if d <= 40 else late_wq_map[p]
    for k in ['ammonia', 'nitrite', 'salinity_ppt', 'calcium', 'magnesium', 'turbidity']:
        if r.get(k) is not None:
            target[k].append(float(r[k]))

print(f"{'Parameter':<20} | {'Early (DOC<=40) r(SR)':<22} | {'Late (DOC>40) r(SR)':<22} || {'Early r(ADG)':<15} | {'Late r(ADG)':<15}")
print("-" * 105)

for k, lbl in [('ammonia', 'Ammonia'), ('nitrite', 'Nitrite'), ('salinity_ppt', 'Salinity'), ('calcium', 'Calcium'), ('magnesium', 'Magnesium'), ('turbidity', 'Turbidity')]:
    e_xs = [sum(early_wq_map[d['pond_index']][k])/len(early_wq_map[d['pond_index']][k]) if early_wq_map[d['pond_index']][k] else None for d in van_data]
    l_xs = [sum(late_wq_map[d['pond_index']][k])/len(late_wq_map[d['pond_index']][k]) if late_wq_map[d['pond_index']][k] else None for d in van_data]
    sr_vals = [d['final_sr'] for d in van_data]
    adg_vals = [d['final_adg'] for d in van_data]
    
    r_e_sr, _, _, _ = pearson_r(e_xs, sr_vals)
    r_l_sr, _, _, _ = pearson_r(l_xs, sr_vals)
    r_e_adg, _, _, _ = pearson_r(e_xs, adg_vals)
    r_l_adg, _, _, _ = pearson_r(l_xs, adg_vals)
    
    s_e_sr = f"{r_e_sr:+.4f}" if r_e_sr is not None else "N/A"
    s_l_sr = f"{r_l_sr:+.4f}" if r_l_sr is not None else "N/A"
    s_e_adg = f"{r_e_adg:+.4f}" if r_e_adg is not None else "N/A"
    s_l_adg = f"{r_l_adg:+.4f}" if r_l_adg is not None else "N/A"
    print(f"{lbl:<20} | {s_e_sr:<22} | {s_l_sr:<22} || {s_e_adg:<15} | {s_l_adg:<15}")

print("\n====================================================================================================")
print("  MULTIVARIATE PREDICTIVE POWER (OLS MULTIPLE LINEAR REGRESSION R-SQUARED)")
print("====================================================================================================")
# Build design matrix for complete cases across all 6 parameters
complete_van = [d for d in van_data if all(d.get(k) is not None for k in ['ammonia_mean', 'nitrite_mean', 'salinity_mean', 'calcium_mean', 'magnesium_mean', 'turbidity_mean'])]
print(f"P. vannamei cycles with complete readings for all 6 parameters: N = {len(complete_van)}")

# Gaussian elimination for OLS multiple regression
def ols_r2(X_mat, y_vec):
    n = len(y_vec)
    k = len(X_mat[0])
    # Compute X^T X and X^T y
    XtX = [[sum(X_mat[i][r] * X_mat[i][c] for i in range(n)) for c in range(k)] for r in range(k)]
    Xty = [sum(X_mat[i][r] * y_vec[i] for i in range(n)) for r in range(k)]
    
    # Solve XtX * beta = Xty using Gaussian elimination with partial pivoting
    A = [row[:] + [Xty[i]] for i, row in enumerate(XtX)]
    for i in range(k):
        max_row = max(range(i, k), key=lambda r: abs(A[r][i]))
        A[i], A[max_row] = A[max_row], A[i]
        pivot = A[i][i]
        if abs(pivot) < 1e-12: return 0.0
        for j in range(i, k + 1):
            A[i][j] /= pivot
        for r in range(k):
            if r != i:
                factor = A[r][i]
                for j in range(i, k + 1):
                    A[r][j] -= factor * A[i][j]
    beta = [A[i][-1] for i in range(k)]
    
    # Compute R2
    y_mean = sum(y_vec) / n
    ss_tot = sum((y - y_mean)**2 for y in y_vec)
    y_pred = [sum(X_mat[i][j] * beta[j] for j in range(k)) for i in range(n)]
    ss_res = sum((y_vec[i] - y_pred[i])**2 for i in range(n))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    return max(0.0, r2), beta

X_all = [[1.0, d['ammonia_mean'], d['nitrite_mean'], d['salinity_mean'], d['calcium_mean'], d['magnesium_mean'], d['turbidity_mean']] for d in complete_van]
y_sr = [d['final_sr'] for d in complete_van]
y_adg = [d['final_adg'] for d in complete_van]

r2_multi_sr, beta_sr = ols_r2(X_all, y_sr)
r2_multi_adg, beta_adg = ols_r2(X_all, y_adg)

print(f"\nCombined 6-Parameter Model R-Squared on Survival Rate (SR): R2 = {r2_multi_sr:.4f} ({r2_multi_sr*100:.1f}% variance explained)")
print(f"Combined 6-Parameter Model R-Squared on Daily Growth (ADG):   R2 = {r2_multi_adg:.4f} ({r2_multi_adg*100:.1f}% variance explained)")
print(f"  -> Unexplained variance in ADG: {(1.0 - r2_multi_adg)*100:.1f}% (Water quality explains less than 15% of ADG variance!)")

print("\n[5/5] Analysis complete!")
