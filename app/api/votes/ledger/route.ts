import { NextResponse } from "next/server"

import { connectToDatabase, TeamModel, VoteModel, TicketModel } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"

// Admin-only voter ledger: every vote with the buyer's email + code, the poet
// they chose, and when. Reconstructed from the immutable vote records.
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: "Admin session required" }, { status: 401 })
    }

    await connectToDatabase()

    const [votes, tickets, teams] = await Promise.all([
      VoteModel.find().sort({ createdAt: -1 }).lean(),
      TicketModel.find().lean(),
      TeamModel.find().lean(),
    ])

    const ticketById = new Map(tickets.map((t: any) => [t._id.toString(), t]))
    const poetById = new Map<string, { name: string; team: string; origin?: string }>()
    for (const team of teams) {
      for (const p of team.participants ?? []) {
        poetById.set(p._id.toString(), { name: p.name, team: team.name, origin: p.originTeam })
      }
    }

    // Split votes into STAGES. Round-stamped votes group by their round; the
    // older unstamped votes (cast on the legacy deployment) are clustered by
    // time — a gap over 6 hours marks a new voting session/stage.
    const GAP = 6 * 3600 * 1000
    const asc = [...votes].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    const stageOf = new Map<string, string>() // voteId -> stageKey
    const stageInfo = new Map<string, { from: string; to: string; count: number; round: number | null }>()
    let clusterIdx = 0
    let lastTime = 0
    for (const v of asc) {
      const t = new Date(v.createdAt).getTime()
      let key: string
      if (v.round != null) {
        key = `round-${v.round}`
      } else {
        if (lastTime === 0 || t - lastTime > GAP) clusterIdx++
        key = `session-${clusterIdx}`
      }
      lastTime = t
      stageOf.set(v._id.toString(), key)
      const info = stageInfo.get(key)
      if (info) {
        info.to = v.createdAt
        info.count++
      } else {
        stageInfo.set(key, { from: v.createdAt, to: v.createdAt, count: 1, round: v.round ?? null })
      }
    }

    // Order stages newest-first, with a friendly label.
    const stages = [...stageInfo.entries()]
      .map(([key, info]) => ({
        key,
        round: info.round,
        from: info.from,
        to: info.to,
        count: info.count,
        label:
          info.round != null
            ? `Round ${info.round}`
            : `Stage — ${new Date(info.from).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      }))
      .sort((a, b) => new Date(b.to).getTime() - new Date(a.to).getTime())

    const rows = votes.map((v: any) => {
      const ticket = ticketById.get(String(v.ticketId))
      const poet = poetById.get(String(v.participantId))
      return {
        email: ticket?.email ?? "(unknown ticket)",
        votingCode: ticket?.votingCode ?? "—",
        poet: poet?.name ?? "(poet removed)",
        team: poet ? poet.origin || poet.team : "—",
        stageKey: stageOf.get(v._id.toString()) ?? "session-0",
        at: v.createdAt?.toISOString?.() ?? v.createdAt,
      }
    })

    return NextResponse.json({ total: rows.length, stages, rows })
  } catch (error) {
    console.error("[VOTER_LEDGER_ERROR]", error)
    return NextResponse.json({ error: "Failed to build voter ledger" }, { status: 500 })
  }
}
