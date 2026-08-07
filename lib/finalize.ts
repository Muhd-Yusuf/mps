import { SettingModel, TeamModel } from "./mongodb"
import { getPreset, presetFromMode } from "./stages"

const ELIMINATED_TEAM = "Eliminated"

// Automatic stage finalization: once the voting deadline passes on a danger
// stage, the top-N most-voted poets automatically advance (they simply stay in
// their teams) and every other flagged poet is moved to the "Eliminated"
// archive team. Runs lazily on the first request after the deadline — no cron
// or online admin needed — and exactly once per round thanks to the atomic
// settings marker.
//
// Team-voting stages (e.g. Quarter Final) are NOT auto-finalized: their open
// team lists also contain judges' picks, which the audience result must not
// eliminate. The admin applies those from the ranked results instead.
export async function finalizeStageIfDue(): Promise<void> {
  const [deadlineSetting, presetSetting, modeSetting, roundSetting] = await Promise.all([
    SettingModel.findOne({ key: "voting_deadline" }).lean(),
    SettingModel.findOne({ key: "stage_preset" }).lean(),
    SettingModel.findOne({ key: "voting_mode" }).lean(),
    SettingModel.findOne({ key: "current_round" }).lean(),
  ])

  if (!deadlineSetting?.value) return
  const deadline = new Date(deadlineSetting.value)
  if (Number.isNaN(deadline.getTime()) || Date.now() <= deadline.getTime()) return

  const preset = presetSetting?.value ? getPreset(presetSetting.value) : presetFromMode(modeSetting?.value)
  if (preset.mode !== "danger" || preset.results.advance <= 0) return

  const round = roundSetting ? parseInt(roundSetting.value, 10) || 1 : 1
  const markerKey = `stage_finalized_round_${round}`

  // Atomic claim: only the first request past the deadline performs the move.
  const alreadyClaimed = await SettingModel.findOneAndUpdate(
    { key: markerKey },
    { $setOnInsert: { value: "running" } },
    { upsert: true, new: false, lean: true }
  )
  if (alreadyClaimed) return

  try {
    const teams = await TeamModel.find()
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

    let elimTeam = await TeamModel.findOne({ name: ELIMINATED_TEAM })
    if (!elimTeam) {
      elimTeam = await TeamModel.create({
        name: ELIMINATED_TEAM,
        color: "#6B7280",
        coach: { name: "—" },
        votingOpen: false,
        order: 9999,
        participants: [],
      })
    }

    // Copy into Eliminated first, then pull from the source — a crash between
    // the two leaves a visible duplicate rather than a lost poet.
    for (const { team, participant } of eliminated) {
      const poet = participant.toObject ? participant.toObject() : participant
      await TeamModel.updateOne(
        { _id: elimTeam._id, "participants._id": { $ne: poet._id } },
        { $push: { participants: { ...poet, updatedAt: new Date() } } }
      )
      await TeamModel.updateOne({ _id: team._id }, { $pull: { participants: { _id: poet._id } } })
    }

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
    console.log(`[AUTO_FINALIZE] round ${round} (${preset.key}): advanced ${advanced.length}, eliminated ${eliminated.length}`)
  } catch (error) {
    // Release the claim so a later request can retry the finalization.
    await SettingModel.deleteOne({ key: markerKey, value: "running" }).catch(() => {})
    throw error
  }
}
