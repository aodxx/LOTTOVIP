import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const html=read("index.html"),ui=read("phase5.js"),sql=read("supabase/migrations/20260729180000_phase_5_results_and_settlement.sql");
for(const id of ["recent-results","results-status"])assert.match(html,new RegExp(`id="${id}"`));
assert.match(ui,/round_results/);assert.match(sql,/ADMIN_REQUIRED/);assert.match(sql,/wallet_ledger_settlement_key_unique/);
assert.match(sql,/on conflict\(settlement_key\)/);assert.match(sql,/for update/);assert.match(sql,/three_permutation/);
assert.match(sql,/revoke all on function public\.publish_simulation_result/);assert.match(sql,/status='settled'/);
console.log("Phase 5 static checks passed");
