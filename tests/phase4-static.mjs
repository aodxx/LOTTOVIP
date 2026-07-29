import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const dashboard = read("auth-page.js");
const builder = read("entry-builder.js");
const migration = read("supabase/migrations/20260729150000_phase_4_simulator_experience.sql");

for (const id of [
  "category-tabs", "recent-entries", "entry-form", "submit-entry",
  "submit-total", "entry-round-code", "entry-close-time"
]) {
  assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
}

for (const category of ["thai", "yeekee", "lao", "hanoi", "quick"]) {
  assert.match(dashboard, new RegExp(`${category}:`), `missing category ${category}`);
}

assert.match(builder, /\.rpc\("submit_simulation_entry"/);
assert.match(migration, /for update;/i, "wallet and entry rows must be locked");
assert.match(migration, /INSUFFICIENT_SIMULATION_CREDITS/);
assert.match(migration, /revoke all on public\.rounds, public\.wallets, public\.wallet_ledger/);
assert.match(migration, /revoke all on function public\.submit_simulation_entry\(uuid\) from public, anon/);
assert.doesNotMatch(migration, /service_role/i);

console.log("Phase 4 static checks passed");
