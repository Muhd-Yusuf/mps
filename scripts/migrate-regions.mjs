/**
 * One-time, idempotent migration to the regional-edition model.
 *
 *   1. Stamps every pre-existing team, ticket and vote as Bauchi.
 *   2. Copies the current global settings into Bauchi's namespaced keys, so the
 *      first edition keeps its round, stage, schedule and labels exactly as-is.
 *   3. Sets the active region to Bauchi if it has never been set.
 *
 * Dry run by default — pass --live to write. Reads .env.import (pull it with
 * `vercel env pull .env.import --environment production`), same as
 * scripts/import-contestants.mjs.
 *
 *   node scripts/migrate-regions.mjs            # report only
 *   node scripts/migrate-regions.mjs --live     # apply
 */
import { readFileSync } from "node:fs"
import mongoose from "mongoose"

const LIVE = process.argv.includes("--live")
const DEFAULT_REGION = "bauchi"

// Every setting that describes where a competition is right now. Global keys
// (admin_password_hash, admin_otp_email, active_region) are deliberately absent.
const SCOPED_KEYS = [
  "current_round",
  "round_label",
  "stage_preset",
  "voting_mode",
  "current_stage",
  "voting_start",
  "voting_deadline",
  "team_label",
  "max_votes_per_ticket",
]

function loadEnv() {
  if (process.env.MONGODB_URI) return
  for (const file of [".env.import", ".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (!match) continue
        const value = match[2].replace(/^["']|["']$/g, "")
        if (!process.env[match[1]]) process.env[match[1]] = value
      }
      if (process.env.MONGODB_URI) return
    } catch {
      // try the next candidate
    }
  }
}

loadEnv()
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set — pull it with: vercel env pull .env.import --environment production")
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "mps" })
const db = mongoose.connection.db
console.log(`${LIVE ? "APPLYING" : "DRY RUN"} — database "${db.databaseName}"\n`)

// 1. Stamp existing documents.
const missing = { region: { $exists: false } }
for (const name of ["teams", "tickets", "votes"]) {
  const count = await db.collection(name).countDocuments(missing)
  console.log(`${name}: ${count} document(s) without a region -> "${DEFAULT_REGION}"`)
  if (LIVE && count) {
    const res = await db.collection(name).updateMany(missing, { $set: { region: DEFAULT_REGION } })
    console.log(`  stamped ${res.modifiedCount}`)
  }
}

// 2. Copy global settings into Bauchi's namespace (never overwrite an existing
//    namespaced value — re-running must not clobber later edits).
console.log("\nsettings:")
for (const key of SCOPED_KEYS) {
  const legacy = await db.collection("settings").findOne({ key })
  if (!legacy) continue
  const scopedKey = `${DEFAULT_REGION}:${key}`
  const existing = await db.collection("settings").findOne({ key: scopedKey })
  if (existing) {
    console.log(`  ${scopedKey} already set (${JSON.stringify(existing.value)}) — left alone`)
    continue
  }
  console.log(`  ${key} = ${JSON.stringify(legacy.value)} -> ${scopedKey}`)
  if (LIVE) {
    await db.collection("settings").updateOne(
      { key: scopedKey },
      { $set: { key: scopedKey, value: legacy.value, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    )
  }
}

// Stage-finalized markers are per round AND per region from now on.
const markers = await db.collection("settings").find({ key: /^stage_finalized_round_\d+$/ }).toArray()
for (const marker of markers) {
  const scopedKey = `${DEFAULT_REGION}:${marker.key}`
  const existing = await db.collection("settings").findOne({ key: scopedKey })
  if (existing) continue
  console.log(`  ${marker.key} -> ${scopedKey}`)
  if (LIVE) {
    await db.collection("settings").updateOne(
      { key: scopedKey },
      { $set: { key: scopedKey, value: marker.value, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    )
  }
}

// 3. Active region.
const active = await db.collection("settings").findOne({ key: "active_region" })
console.log(`\nactive_region: ${active ? JSON.stringify(active.value) + " (unchanged)" : `not set -> "${DEFAULT_REGION}"`}`)
if (LIVE && !active) {
  await db.collection("settings").updateOne(
    { key: "active_region" },
    { $set: { key: "active_region", value: DEFAULT_REGION, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  )
}

console.log(`\n${LIVE ? "Done." : "Dry run complete — re-run with --live to apply."}`)
await mongoose.disconnect()
