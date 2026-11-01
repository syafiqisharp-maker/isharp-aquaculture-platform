import urllib.request, json
from datetime import datetime

unmatched_data = [
    (63, '04.07.09', '2026-04-15', 66, 'L. vannamei', 'Normal'),
    (291, '03.05.07', '2026-09-02', 148, 'P. monodon', 'Normal'),
    (385, '04.07.01', '2026-10-23', 124, 'P. monodon', 'Normal'),
    (386, '07.14.05', '2026-10-25', 129, 'P. monodon', 'Normal'),
    (387, '07.14.06', '2026-10-25', 129, 'P. monodon', 'Normal'),
    (388, '09.18.04', '2026-10-25', 66, 'L. vannamei', 'Emergency'),
    (389, '09.18.08', '2026-10-26', 66, 'L. vannamei', 'Emergency'),
    (390, '04.07.01', '2026-10-26', 127, 'P. monodon', 'Normal'),
    (391, '09.17.07', '2026-10-27', 68, 'L. vannamei', 'Emergency'),
    (392, '05.10.01', '2026-10-27', 123, 'P. monodon', 'Normal'),
    (393, '04.07.02', '2026-10-27', 123, 'P. monodon', 'Normal'),
]

# Check stocking batches for these ponds
for row_idx, pond, harv_date, doc, species, htype in unmatched_data:
    p_code = f"2{pond.replace('.', '')}"
    url = f"https://keappoukeagyzpoxkrru.supabase.co/rest/v1/pond_stocking_batches?pond_index=like.{p_code}.*&select=pond_index,stck_date,stck_species,stck_pcs&order=stck_date.desc"
    req = urllib.request.Request(url, headers={
        'apikey': 'sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s',
        'Authorization': 'Bearer sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s',
    })
    with urllib.request.urlopen(req) as resp:
        batches = json.loads(resp.read().decode())
    
    h_dt = datetime.strptime(harv_date, '%Y-%m-%d').date()
    print(f"Row {row_idx}: Pond {pond}, HarvDate {harv_date}, DOC {doc}, Species {species}")
    for b in batches[:3]:
        s_dt = datetime.strptime(b['stck_date'], '%Y-%m-%d').date()
        calc_doc = (h_dt - s_dt).days
        print(f"   Cycle: {b['pond_index']}, StockDate: {b['stck_date']}, StockSpecies: {b['stck_species']}, CalcDOC: {calc_doc}")
