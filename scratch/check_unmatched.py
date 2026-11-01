import urllib.request, json

ponds = ['04.07.09', '03.05.07', '04.07.01', '07.14.05', '07.14.06', '09.18.04', '09.18.08', '09.17.07', '05.10.01', '04.07.02']
pond_in = ','.join(ponds)

url = f'https://keappoukeagyzpoxkrru.supabase.co/rest/v1/growout_pond_master?pond=in.({pond_in})&select=pond_index,pond,cycle_no,crop_no,pond_status,pond_active&order=pond_index.desc'
req = urllib.request.Request(url, headers={
    'apikey': 'sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s',
    'Authorization': 'Bearer sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s',
    'Range': '0-999'
})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    for p in ponds:
        cycles = [d for d in data if d['pond'] == p]
        res = [f"{c['pond_index']} ({c['pond_status']})" for c in cycles[:4]]
        print(f"{p}: {res}")
