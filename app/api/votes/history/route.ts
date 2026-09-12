import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { connectToDatabase, TeamModel, VoteModel, SettingModel } from "@/lib/mongodb"
import { authOptions } from "@/lib/auth"
import { getPreset } from "@/lib/stages"
import { regionFromRequest, regionFilter, ALL_REGIONS } from "@/lib/regions"
import { regionSettingKey } from "@/lib/settings"

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

    const region = await regionFromRequest(request)
    const scope = regionFilter(region)
    // Finalization markers are namespaced per region; "all" keeps the legacy
    // un-namespaced ones in view too.
    const markerPattern =
      region === ALL_REGIONS
        ? /stage_finalized_round_/
        : new RegExp(`^(${regionSettingKey(region, "")})?stage_finalized_round_`)
    const [roundGroups, markers, teams] = await Promise.all([
      VoteModel.aggregate([
        { $match: scope },
        { $group: { _id: "$round", votes: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      SettingModel.find({ key: markerPattern }).lean(),
      TeamModel.find(scope).lean(),
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
    // Scoped to the edition being viewed: Kaduna round 1 and Bauchi round 1 are
    // different stages and must never be summed into one result table.
    const match = {
      ...scope,
      ...(round == null ? { round: { $in: [null, undefined] } } : { round }),
    }
    const grouped = await VoteModel.aggregate([
      { $match: match },
      { $group: { _id: "$participantId", votes: { $sum: 1 } } },
      { $sort: { votes: -1 } },
    ])

    // Resolve poets wherever they live NOW (teams, Revived, Eliminated).
    // Carry the portrait through: a poet is never listed by name alone.
    const poetById = new Map<string, { name: string; team: string; originTeam?: string; image?: string }>()
    for (const t of teams) {
      for (const p of t.participants ?? []) {
        poetById.set(p._id.toString(), { name: p.name, team: t.name, originTeam: p.originTeam, image: p.image })
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
        image: poet?.image ?? "",
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
