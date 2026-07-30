// One-off importer: Google Sheet (name, stage name, Drive photo) -> Cloudinary + MongoDB.
// Usage:
//   node scripts/import-contestants.mjs           # dry run: parse + download check only
//   node scripts/import-contestants.mjs --live    # download, upload to Cloudinary, write to DB
//   node scripts/import-contestants.mjs --live --team "Contestants"
//
// Reads credentials from .env.import (pulled via `vercel env pull`). Idempotent:
// poets already in the target team (matched by name) are skipped, so it can be
// re-run after partial failures.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, "..")

// --- env ---------------------------------------------------------------
const envFile = path.join(projectRoot, ".env.import")
for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
}

const SHEET_ID = "1CML7R1MYu-WIYbu8-LZQdpizz0nBUwnSjGHD5jr8fP4"
const LIVE = process.argv.includes("--live")
const teamArgIndex = process.argv.indexOf("--team")
const TEAM_NAME = teamArgIndex > -1 ? process.argv[teamArgIndex + 1] : "Contestants"
const CACHE_DIR = path.join(projectRoot, ".import-cache")
fs.mkdirSync(CACHE_DIR, { recursive: true })

// --- sheet -------------------------------------------------------------
function parseCsv(text) {
  const rows = []
  let row = [], cell = "", inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ",") { row.push(cell); cell = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(cell); cell = ""
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); if (row.some((c) => c.trim())) rows.push(row) }
  return rows
}

async function fetchSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`
  const res = await fetch(url, { redirect: "follow" })
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`)
  const rows = parseCsv(await res.text())
  return rows.slice(1).map((r, i) => {
    const fullName = (r[0] ?? "").trim()
    const stageName = (r[1] ?? "").trim()
    const driveUrl = (r[2] ?? "").trim()
    const idMatch = driveUrl.match(/id=([\w-]+)/) || driveUrl.match(/\/d\/([\w-]+)/)
    return { row: i + 2, fullName, stageName, fileId: idMatch ? idMatch[1] : null }
  }).filter((r) => r.fullName)
}

// --- drive download ----------------------------------------------------
async function downloadDriveFile(fileId) {
  const cached = fs.readdirSync(CACHE_DIR).find((f) => f.startsWith(fileId + "."))
  if (cached) return path.join(CACHE_DIR, cached)

  let url = `https://drive.google.com/uc?export=download&id=${fileId}`
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { redirect: "follow" })
    const type = res.headers.get("content-type") ?? ""
    // Anything that isn't an HTML page is the file itself (some uploads are
    // HEIC/octet-stream — Cloudinary converts them on upload).
    if (!type.includes("text/html")) {
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("hei") ? "heic" : "jpg"
      const file = path.join(CACHE_DIR, `${fileId}.${ext}`)
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
      return file
    }
    const body = await res.text()
    if (body.includes("Google Drive: Sign-in") || body.includes("accounts.google.com")) {
      throw new Error("NOT_SHARED")
    }
    // Large-file interstitial: follow the confirm form.
    const action = body.match(/action="([^"]+)"/)?.[1]
    const inputs = [...body.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/g)]
    if (action && inputs.length) {
      const params = new URLSearchParams(inputs.map(([, n, v]) => [n, v]))
      url = `${action}${action.includes("?") ? "&" : "?"}${params}`
      continue
    }
    throw new Error("UNEXPECTED_RESPONSE")
  }
  throw new Error("TOO_MANY_REDIRECTS")
}

// --- main --------------------------------------------------------------
const contestants = await fetchSheet()
console.log(`Sheet parsed: ${contestants.length} contestants`)

const noFile = contestants.filter((c) => !c.fileId)
if (noFile.length) console.log(`WARNING: ${noFile.length} rows without a Drive link:`, noFile.map((c) => c.fullName))

// Probe the first photo to fail fast when the Drive folder isn't shared yet.
try {
  await downloadDriveFile(contestants[0].fileId)
  console.log("Drive access: OK")
} catch (e) {
  if (e.message === "NOT_SHARED") {
    console.error("\nDrive photos are still private. Share the form's upload folder as 'Anyone with the link – Viewer' and re-run.")
    process.exit(1)
  }
  throw e
}

if (!LIVE) {
  console.log("\nDry run only. Sample rows:")
  for (const c of contestants.slice(0, 5)) console.log(`  ${c.fullName} | ${c.stageName || "(no stage name)"} | ${c.fileId}`)
  console.log(`\nRe-run with --live to import all ${contestants.length} into team "${TEAM_NAME}".`)
  process.exit(0)
}

// Live: download all, upload to Cloudinary, insert into MongoDB.
const { v2: cloudinary } = await import(path.join(projectRoot, "node_modules/cloudinary/cloudinary.js"))
const mongoose = (await import(path.join(projectRoot, "node_modules/mongoose/index.js"))).default

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || undefined })
const TeamModel = mongoose.model("Team", new mongoose.Schema({}, { strict: false, collection: "teams" }))

let team = await TeamModel.findOne({ name: TEAM_NAME })
if (!team) {
  team = await TeamModel.create({
    name: TEAM_NAME,
    color: "#667EEA",
    coach: { name: "MPS Media" },
    votingOpen: false,
    order: 0,
    participants: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  console.log(`Created holding team "${TEAM_NAME}"`)
}

const existingNames = new Set((team.participants ?? []).map((p) => (p.name ?? "").toLowerCase()))
let imported = 0, skipped = 0, failed = []

for (const c of contestants) {
  const displayName = c.stageName ? `${c.fullName} (${c.stageName})` : c.fullName
  if (existingNames.has(displayName.toLowerCase())) { skipped++; continue }
  try {
    let imageUrl
    if (c.fileId) {
      const file = await downloadDriveFile(c.fileId)
      const upload = await cloudinary.uploader.upload(file, {
        folder: "mps/contestants",
        public_id: c.fileId,
        overwrite: false,
        format: "jpg",
        transformation: [{ width: 800, height: 800, crop: "limit" }],
      })
      imageUrl = upload.secure_url
    }
    await TeamModel.updateOne(
      { _id: team._id },
      {
        $push: {
          participants: {
            _id: new mongoose.Types.ObjectId(),
            name: displayName,
            image: imageUrl,
            votes: 0,
            inDanger: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      }
    )
    imported++
    console.log(`  [${imported}] ${displayName}`)
  } catch (e) {
    failed.push({ name: displayName, error: e.message })
    console.error(`  FAILED ${displayName}: ${e.message}`)
  }
}

console.log(`\nDone. Imported ${imported}, skipped ${skipped} already present, failed ${failed.length}.`)
if (failed.length) console.log("Failures:", failed)
await mongoose.disconnect()
