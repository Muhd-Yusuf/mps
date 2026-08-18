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

    const rows = votes.map((v: any) => {
      const ticket = ticketById.get(String(v.ticketId))
      const poet = poetById.get(String(v.participantId))
      return {
        email: ticket?.email ?? "(unknown ticket)",
        votingCode: ticket?.votingCode ?? "—",
        poet: poet?.name ?? "(poet removed)",
        team: poet ? poet.origin || poet.team : "—",
        round: v.round ?? null,
        at: v.createdAt?.toISOString?.() ?? v.createdAt,
      }
    })

    return NextResponse.json({ total: rows.length, rows })
  } catch (error) {
    console.error("[VOTER_LEDGER_ERROR]", error)
    return NextResponse.json({ error: "Failed to build voter ledger" }, { status: 500 })
  }
}
