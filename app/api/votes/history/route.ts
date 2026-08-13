import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { connectToDatabase, TeamModel, VoteModel, SettingModel } from "@/lib/mongodb"
import { authOptions } from "@/lib/auth"
import { getPreset } from "@/lib/stages"

// Admin-only history of past stages, computed from the immutable vote records.
// GET            -> { rounds: [{ round, votes, stageName?, finalizedAt?, advanced? }] }
// GET ?round=N   -> adds { results: [{ name, team, votes, advanced }] } for that round
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Admin session required" }, { status: 401 })
    }

    await connectToDatabase()

    const [roundGroups, markers, teams] = await Promise.all([
      VoteModel.aggregate([
        { $group: { _id: "$round", votes: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      SettingModel.find({ key: /^stage_finalized_round_/ }).lean(),
      TeamModel.find().lean(),
    ])

    const markerByRound = new Map<number, any>()
    for (const m of markers) {
      const round = parseInt(m.key.replace("stage_finalized_round_", ""), 10)
      try {
        markerByRound.set(round, JSON.parse(m.value))
      } catch {
        /* running/empty markers are not JSON */
      }
    }

    const rounds = roundGroups.map((g) => {
      const round = g._id ?? null
      const marker = round != null ? markerByRound.get(round) : undefined
      return {
        round,
        votes: g.votes,
        stageName: marker?.stage ? getPreset(marker.stage).name : undefined,
        finalizedAt: marker?.at,
        advanced: marker?.advanced,
      }
    })

    const { searchParams } = new URL(request.url)
    const roundParam = searchParams.get("round")
    if (roundParam == null) {
      return NextResponse.json({ rounds })
    }

    const round = roundParam === "legacy" ? null : parseInt(roundParam, 10)
    const match = round == null ? { round: { $in: [null, undefined] } } : { round }
    const grouped = await VoteModel.aggregate([
      { $match: match },
      { $group: { _id: "$participantId", votes: { $sum: 1 } } },
      { $sort: { votes: -1 } },
    ])

    // Resolve poets wherever they live NOW (teams, Revived, Eliminated).
    const poetById = new Map<string, { name: string; team: string; originTeam?: string }>()
    for (const t of teams) {
      for (const p of t.participants ?? []) {
        poetById.set(p._id.toString(), { name: p.name, team: t.name, originTeam: p.originTeam })
      }
    }
    const advancedNames = new Set<string>(
      (round != null ? markerByRound.get(round)?.advanced : undefined) ?? []
    )

    const results = grouped.map((g) => {
      const poet = poetById.get(String(g._id))
      return {
        name: poet?.name ?? "(poet no longer in system)",
        team: poet ? poet.originTeam || poet.team : "—",
        votes: g.votes,
        advanced: poet ? advancedNames.has(poet.name) : false,
      }
    })

    return NextResponse.json({ rounds, results })
  } catch (error) {
    console.error("[VOTE_HISTORY_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch vote history" }, { status: 500 })
  }
}
