import { SettingModel, TeamModel } from "./mongodb"
import { getPreset, presetFromMode } from "./stages"
import { getActiveRegion, regionFilter } from "./regions"
import { readRegionSetting, readRegionNumber, regionSettingKey } from "./settings"

const ELIMINATED_TEAM = "Eliminated"
const REVIVED_TEAM = "Revived"

// Automatic stage finalization: once the voting deadline passes on a danger
// stage, the top-N most-voted poets are moved to the "Revived" team and every
// other flagged poet is moved to the "Eliminated" archive team — both outcomes
// gathered in one place each, ready for the admin to Assign Team onward.
// Runs lazily on the first request after the deadline — no cron or online
// admin needed — and exactly once per round thanks to the atomic settings
// marker.
//
// Team-voting stages (e.g. Quarter Final) are NOT auto-finalized: their open
// team lists also contain judges' picks, which the audience result must not
// eliminate. The admin applies those from the ranked results instead.
export async function finalizeStageIfDue(regionOverride?: string): Promise<void> {
  // Only ever finalizes the LIVE edition — a dashboard visit that happens to be
  // scoped to a finished region must not re-run its advancement.
  const region = regionOverride ?? (await getActiveRegion())
  const [deadlineValue, presetValue, modeValue, round] = await Promise.all([
    readRegionSetting(region, "voting_deadline"),
    readRegionSetting(region, "stage_preset"),
    readRegionSetting(region, "voting_mode"),
    readRegionNumber(region, "current_round", 1),
  ])

  if (!deadlineValue) return
  const deadline = new Date(deadlineValue)
  if (Number.isNaN(deadline.getTime()) || Date.now() <= deadline.getTime()) return

  const preset = presetValue ? getPreset(presetValue) : presetFromMode(modeValue ?? undefined)
  if (preset.mode !== "danger" || preset.results.advance <= 0) return

  // Marker is per region as well as per round, so each edition finalizes once.
  const markerKey = regionSettingKey(region, `stage_finalized_round_${round}`)

  // Atomic claim: only the first request past the deadline performs the move.
  const alreadyClaimed = await SettingModel.findOneAndUpdate(
    { key: markerKey },
    { $setOnInsert: { value: "running" } },
    { upsert: true, new: false, lean: true }
  )
  if (alreadyClaimed) return

  try {
    const teams = await TeamModel.find(regionFilter(region))
    const flagged = teams.flatMap((team: any) =>
      (team.participants ?? [])
        .filter((p: any) => p.inDanger)
        .map((p: any) => ({ team, participant: p }))
    )
    if (!flagged.length) {
      await SettingModel.updateOne({ key: markerKey }, { value: JSON.stringify({ advanced: [], eliminated: [], note: "no flagged poets" }) })
      return
    }

    const { slice, advance } = preset.results
    const byVotes = (a: any, b: any) => (b.participant.votes ?? 0) - (a.participant.votes ?? 0)

    let advanced: typeof flagged = []
    let eliminated: typeof flagged = []
    if (slice === "perTeam") {
      for (const team of teams) {
        const group = flagged.filter((f) => f.team._id.equals(team._id)).sort(byVotes)
        advanced = advanced.concat(group.slice(0, advance))
        eliminated = eliminated.concat(group.slice(advance))
      }
    } else {
      const ranked = [...flagged].sort(byVotes)
      advanced = ranked.slice(0, advance)
      eliminated = ranked.slice(advance)
    }

    // Each edition gets its OWN archive teams — Kaduna's eliminated poets must
    // not land in the same bucket as Bauchi's.
    const ensureTeam = async (name: string, color: string, order: number) => {
      let team = await TeamModel.findOne({ ...regionFilter(region), name })
      if (!team) {
        team = await TeamModel.create({
          name,
          color,
          coach: { name: "—" },
          votingOpen: false,
          order,
          participants: [],
          region,
        })
      }
      return team
    }
    const [elimTeam, revivedTeam] = await Promise.all([
      ensureTeam(ELIMINATED_TEAM, "#6B7280", 9999),
      ensureTeam(REVIVED_TEAM, "#16A34A", 9998),
    ])

    // Copy into the destination first, then pull from the source — a crash
    // between the two leaves a visible duplicate rather than a lost poet.
    const moveTo = async (destId: any, moves: typeof flagged) => {
      for (const { team, participant } of moves) {
        if (team._id.equals(destId)) continue
        const poet = participant.toObject ? participant.toObject() : participant
        // Remember where the poet came from so the admin never loses track.
        const originTeam =
          poet.originTeam || ([ELIMINATED_TEAM, REVIVED_TEAM].includes(team.name) ? "" : team.name)
        await TeamModel.updateOne(
          { _id: destId, "participants._id": { $ne: poet._id } },
          { $push: { participants: { ...poet, originTeam, updatedAt: new Date() } } }
        )
        await TeamModel.updateOne({ _id: team._id }, { $pull: { participants: { _id: poet._id } } })
      }
    }
    await moveTo(elimTeam._id, eliminated)
    await moveTo(revivedTeam._id, advanced)

    await SettingModel.updateOne(
      { key: markerKey },
      {
        value: JSON.stringify({
          stage: preset.key,
          advanced: advanced.map((f) => f.participant.name),
          eliminated: eliminated.map((f) => f.participant.name),
          at: new Date().toISOString(),
        }),
      }
    )
    console.log(`[AUTO_FINALIZE] ${region} round ${round} (${preset.key}): advanced ${advanced.length}, eliminated ${eliminated.length}`)
  } catch (error) {
    // Release the claim so a later request can retry the finalization.
    await SettingModel.deleteOne({ key: markerKey, value: "running" }).catch(() => {})
    throw error
  }
}
