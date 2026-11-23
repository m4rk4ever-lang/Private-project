#!/usr/bin/env python3
"""Key figures per period, per bot-hour, with XP turned into OSRS-XP (divided by the TieredExperience
factor at the bot's level then): docs/analysis/2026-11-23-voortgang-en-aandachtspunten.md.

    python3 -I docs/analysis/scripts/period_compare.py /path/to/adventurers-metrics.jsonl

Edit G below for the periods (name, set of versions).
"""
import json,collections as C,bisect,sys
rows=[r for r in (json.loads(l) for l in open(sys.argv[1])) if isinstance(r.get('at'), str)]
G=[('21-11 nulmeting',{'2f294017e','2cf602e1b','ec676fad1','da3294718','da94bfc0f'}),
   ('22-11 #57',{'b943103e0','3f8a80352'}),
   ('23-11 #61',{'aa5373793'}),('23-11 #64',{'4baf1a2cc'}),('23-11 #66',{'5eb6f500f','f0c01e14f'}),('23-11 #68+70',{'441b07283'})]
def tier(l): return 25 if l<50 else 15 if l<80 else 10 if l<90 else 5
lv=C.defaultdict(list)
for r in rows:
  if r['kind']=='levels': lv[r['bot']].append((r['at'],r['levels']))
def levels(b,at):
  s=lv.get(b) or []
  if not s: return None
  i=bisect.bisect_right([x[0] for x in s],at)-1; return s[max(i,0)][1]
out={}
for name,vs in G:
  R=[r for r in rows if r.get('v') in vs]; B=[r for r in R if r['kind']=='bot']
  t=C.Counter()
  for r in B:
    for k,m in (r.get('time') or {}).items(): t[k]+=m
  mins=sum(t.values()); h=mins/60
  osrs=0; raw=0; coins=0
  for r in B:
    L=levels(r['bot'],r['at']) or {}
    for s,v in (r.get('xpGained') or {}).items():
      raw+=v; osrs+=v/tier(L.get(s,1))
    cg=r.get('coinsGained'); coins+= cg if isinstance(cg,(int,float)) else 0
  K=C.Counter(r['kind'] for r in R)
  jobs=[r for r in R if r['kind']=='job']; cj=[r for r in jobs if r.get('mode')=='combat_training']
  qe=[r for r in R if r['kind']=='quest_end']
  out[name]=dict(bothours=round(h),werken=round(t['working']/mins*100,1),lopen=round(t['walking']/mins*100,1),errand=round(t['errand']/mins*100,1),idle=round(t['idle']/mins*100,1),
    osrs_xp_per_bot_uur=round(osrs/h),coins_per_bot_uur=round(coins/h) if coins else None,
    stuck_per_bot_uur=round(K['stuck']/h,2),walk_blocked_per_bot_uur=round(K['walk_blocked']/h,2),loop_per_bot_uur=round(K['loop']/h,2),stranded_per_bot_uur=round(K['stranded']/h,2),
    slow_bot_per_uur=round(K['slow_bot']/(h/60),2),deaths=K['death'],combat_stuck=f"{sum(1 for r in cj if r.get('ended')=='stuck')}/{len(cj)}",
    quests_done=f"{sum(1 for r in qe if r['outcome']=='done')}/{len(qe)}")
keys=list(next(iter(out.values())).keys())
print('meting'.ljust(26)+''.join(n[:14].rjust(16) for n in out))
for k in keys: print(k.ljust(26)+''.join(str(out[n][k]).rjust(16) for n in out))
