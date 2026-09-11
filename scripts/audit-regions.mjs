/**
 * READ-ONLY audit of region isolation against the live database.
 *
 *   node scripts/audit-regions.mjs
 *
 * Mirrors the resolution rules in lib/regions.ts and lib/settings.ts, and
 * asserts the invariants that keep editions independent:
 *   - the four editions partition each collection exactly (no doc in two, none lost)
 *   - no document carries an unrecognised region
 *   - an edition that hasn't started inherits no round, deadline or teams
 *   - Bauchi still resolves its pre-region settings through the legacy fallback
 *   - a past finalization is still recognised, so auto-finalize cannot re-run
 *     and reshuffle a concluded competition
 *
 * Exits non-zero if any check fails. Safe to run any time — writes nothing.
 */
import { readFileSync } from "node:fs"
import mongoose from "mongoose"

for (const line of readFileSync(new URL("../.env.import", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const DEFAULT_REGION = "bauchi"
const REGIONS = ["bauchi", "kaduna", "nasarawa", "abuja"]
const regionFilter = (r) =>
  r === "all"
    ? {}
    : r === DEFAULT_REGION
      ? { $or: [{ region: DEFAULT_REGION }, { region: { $exists: false } }, { region: null }] }
      : { region: r }

await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "mps" })
const db = mongoose.connection.db
const S = db.collection("settings")
const readRegionSetting = async (region, key) => {
  const scoped = await S.findOne({ key: `${region}:${key}` })
  if (scoped?.value != null) return scoped.value
  if (region === DEFAULT_REGION) {
    const legacy = await S.findOne({ key })
    if (legacy?.value != null) return legacy.value
  }
  return null
}

let failures = 0
const check = (label, pass, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`)
  if (!pass) failures++
}

console.log("=== counts per edition ===")
for (const r of REGIONS) {
  const [teams, tickets, votes] = await Promise.all([
    db.collection("teams").countDocuments(regionFilter(r)),
    db.collection("tickets").countDocuments(regionFilter(r)),
    db.collection("votes").countDocuments(regionFilter(r)),
  ])
  console.log(`  ${r.padEnd(9)} teams=${String(teams).padStart(4)} tickets=${String(tickets).padStart(5)} votes=${String(votes).padStart(5)}`)
}

const totals = {
  teams: await db.collection("teams").countDocuments({}),
  tickets: await db.collection("tickets").countDocuments({}),
  votes: await db.collection("votes").countDocuments({}),
}
console.log("\n=== invariants ===")
for (const coll of ["teams", "tickets", "votes"]) {
  const perRegion = []
  for (const r of REGIONS) perRegion.push(await db.collection(coll).countDocuments(regionFilter(r)))
  const sum = perRegion.reduce((a, b) => a + b, 0)
  check(`${coll}: editions partition the collection`, sum === totals[coll], `${sum} of ${totals[coll]}`)
}

// Every document must resolve to exactly one edition (no overlap).
for (const coll of ["teams", "tickets", "votes"]) {
  const stray = await db.collection(coll).countDocuments({
    region: { $exists: true, $nin: [...REGIONS, null] },
  })
  check(`${coll}: no document carries an unknown region`, stray === 0, `${stray} stray`)
}

console.log("\n=== new editions start clean ===")
for (const r of REGIONS.filter((r) => r !== DEFAULT_REGION)) {
  const round = await readRegionSetting(r, "current_round")
  const deadline = await readRegionSetting(r, "voting_deadline")
  const teams = await db.collection("teams").countDocuments(regionFilter(r))
  check(`${r}: no inherited round/deadline/teams`, round === null && deadline === null && teams === 0,
    `round=${round} deadline=${deadline} teams=${teams}`)
}

console.log("\n=== cross-edition query leaks ===")
// regionFilter() returns an $or for Bauchi, so spreading it beside another $or
// silently drops the region filter. Compare the naive spread against the
// correct $and form for EVERY edition: the moment a second edition has
// tickets, a leaky query starts matching them and this check fires.
for (const r of REGIONS) {
  const round = Number(await readRegionSetting(r, "current_round")) || 1
  const roundOr = [{ round }, { round: null }, { round: { $exists: false } }]
  const naive = await db.collection("tickets").countDocuments({
    ...regionFilter(r),
    isPaid: true,
    $or: roundOr,
  })
  const correct = await db.collection("tickets").countDocuments({
    $and: [regionFilter(r), { $or: roundOr }],
    isPaid: true,
  })
  check(`${r}: resend-shaped query cannot reach another edition`, naive === correct,
    naive === correct ? `${correct} ticket(s)` : `naive spread matches ${naive}, correct is ${correct}`)
}

console.log("\n=== bauchi keeps its state ===")
const bRound = await readRegionSetting(DEFAULT_REGION, "current_round")
const bPreset = await readRegionSetting(DEFAULT_REGION, "stage_preset")
check("bauchi resolves round 6 via legacy fallback", bRound === "6", `round=${bRound}`)
check("bauchi resolves knockout preset via legacy fallback", bPreset === "knockout", `preset=${bPreset}`)

console.log("\n=== auto-finalize re-run guard (the dangerous one) ===")
const markerName = `stage_finalized_round_${bRound}`
const namespaced = await S.findOne({ key: `${DEFAULT_REGION}:${markerName}` })
const legacy = await S.findOne({ key: markerName })
console.log(`  namespaced marker "${DEFAULT_REGION}:${markerName}": ${namespaced ? "present" : "ABSENT"}`)
console.log(`  legacy marker     "${markerName}": ${legacy ? "present" : "absent"}`)
const oldCodeWouldRerun = !namespaced && !!legacy
console.log(`  -> namespaced-only check would re-run finalization: ${oldCodeWouldRerun ? "YES (bug confirmed)" : "no"}`)
const resolved = await readRegionSetting(DEFAULT_REGION, markerName)
check("fallback marker lookup sees the past finalization", resolved !== null)

const deadline = await readRegionSetting(DEFAULT_REGION, "voting_deadline")
const mode = await readRegionSetting(DEFAULT_REGION, "voting_mode")
const past = deadline && Date.now() > new Date(deadline).getTime()
console.log(`  bauchi deadline passed=${past} mode=${mode} (danger mode + passed deadline = finalize would have been attempted)`)

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`)
await mongoose.disconnect()
process.exit(failures === 0 ? 0 : 1)
