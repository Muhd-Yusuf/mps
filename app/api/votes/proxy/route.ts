import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"

import { connectToDatabase, TicketModel, VoteModel, TeamModel } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import { DEFAULT_REGION, getRegion, regionFilter } from "@/lib/regions"
import { readRegionSetting, readRegionNumber } from "@/lib/settings"
import { getPreset, presetFromMode } from "@/lib/stages"
import { sendEmail, createProxyVoteEmailTemplate, createProxyVoteEmailText } from "@/lib/brevo"

// Admin casts a vote on a buyer's behalf.
//
// A buyer who paid for a code but couldn't vote before the deadline can ask the
// team to record their choice. This endpoint bypasses the VOTING WINDOW and
// nothing else: the code must still be paid, unused, and belong to the current
// round of its own edition, it is still spent atomically so it can never be used
// twice, and the poet must have been votable in that stage. Every such vote is
// stamped castByAdmin with a required note, and the buyer is emailed a receipt
// naming the poet — so the person whose code it is always learns what was cast.

/** Resolve the ticket and everything needed to validate a vote for it. */
async function loadContext(votingCode: string) {
  const ticket = await TicketModel.findOne({ votingCode: votingCode.toUpperCase().trim() })
  if (!ticket) return { error: "Voting code not found", status: 404 as const }
  if (!ticket.isPaid) return { error: "This code was never paid for", status: 400 as const }
  if (ticket.hasVoted) return { error: "This code has already been used to vote", status: 409 as const }

  const region = ticket.region || DEFAULT_REGION
  const currentRound = await readRegionNumber(region, "current_round", 1)

  if (ticket.round !== undefined && ticket.round !== null && ticket.round !== currentRound) {
    return {
      error: `This code was bought for round ${ticket.round} of the ${getRegion(region).short} edition, which has already moved on`,
      status: 409 as const,
    }
  }

  // Once a round is finalized the advancement has been applied and results are
  // out — adding a vote then would contradict what was already published.
  const finalized = await readRegionSetting(region, `stage_finalized_round_${currentRound}`)
  if (finalized !== null) {
    return {
      error: "This round has already been finalized and its results applied — votes can no longer be added",
      status: 409 as const,
    }
  }

  // The deadline is deliberately bypassed — that is the whole point. The START
  // time is not: proxy voting exists for people who missed their chance, never
  // to get votes in before the public can cast any.
  const startValue = await readRegionSetting(region, "voting_start")
  if (startValue) {
    const start = new Date(startValue)
    if (!Number.isNaN(start.getTime()) && Date.now() < start.getTime()) {
      return { error: "Voting has not opened yet for this stage", status: 409 as const }
    }
  }

  const [presetValue, modeValue] = await Promise.all([
    readRegionSetting(region, "stage_preset"),
    readRegionSetting(region, "voting_mode"),
  ])
  const preset = presetValue ? getPreset(presetValue) : presetFromMode(modeValue ?? undefined)

  return { ticket, region, currentRound, preset }
}

/**
 * GET ?code=XXX — the poets this code could legitimately have been spent on,
 * decided server-side by the same stage rules a real voter faced.
 */
export async function GET(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    await connectToDatabase()
    const code = new URL(request.url).searchParams.get("code") ?? ""
    if (!code.trim()) return NextResponse.json({ error: "Voting code is required" }, { status: 400 })

    const ctx = await loadContext(code)
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    const teams = await TeamModel.find(regionFilter(ctx.region)).sort({ order: 1, createdAt: 1 }).lean()
    const eligible: any[] = []
    for (const team of teams) {
      for (const p of team.participants ?? []) {
        const votable = ctx.preset.mode === "danger" ? Boolean(p.inDanger) : Boolean(team.votingOpen)
        if (!votable) continue
        eligible.push({
          id: p._id?.toString() ?? "",
          name: p.name,
          image: p.image ?? "",
          teamId: team._id.toString(),
          teamName: team.name,
        })
      }
    }

    return NextResponse.json({
      ticket: {
        email: ctx.ticket.email,
        votingCode: ctx.ticket.votingCode,
        round: ctx.currentRound,
        region: ctx.region,
        regionName: getRegion(ctx.region).short,
      },
      stage: ctx.preset.name,
      poets: eligible,
    })
  } catch (error) {
    console.error("[PROXY_VOTE_LOOKUP_ERROR]", error)
    return NextResponse.json({ error: "Failed to load the code" }, { status: 500 })
  }
}

const castSchema = z.object({
  votingCode: z.string().min(1, "Voting code is required"),
  teamId: z.string().min(1, "Team is required"),
  participantId: z.string().min(1, "Poet is required"),
  note: z.string().trim().min(3, "Record why this vote is being cast on their behalf").max(200),
})

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const parsed = castSchema.safeParse(await request.json())
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request"
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    await connectToDatabase()
    const ctx = await loadContext(parsed.data.votingCode)
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    let teamObjectId: mongoose.Types.ObjectId
    try {
      teamObjectId = new mongoose.Types.ObjectId(parsed.data.teamId)
    } catch {
      return NextResponse.json({ error: "Invalid team" }, { status: 400 })
    }

    const team = await TeamModel.findById(teamObjectId)
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 400 })
    if ((team.region || DEFAULT_REGION) !== ctx.region) {
      return NextResponse.json({ error: "That team is not part of this code's edition" }, { status: 400 })
    }

    const participant = team.participants?.find((p: any) => p._id.toString() === parsed.data.participantId)
    if (!participant) return NextResponse.json({ error: "Poet not found" }, { status: 400 })

    // The same rules the buyer faced — a proxy vote can only go to someone who
    // was actually on the ballot for this stage.
    if (ctx.preset.mode === "danger") {
      if (!participant.inDanger) {
        return NextResponse.json({ error: "That poet is not in this stage's Danger Zone vote" }, { status: 400 })
      }
    } else if (!team.votingOpen) {
      return NextResponse.json({ error: `Voting for ${team.name} is not open` }, { status: 400 })
    }

    // Atomically spend the code — identical guard to the public cast route, so a
    // proxy vote can never race with the buyer voting themselves.
    const claimed = await TicketModel.findOneAndUpdate(
      { _id: ctx.ticket._id, isPaid: true, hasVoted: false },
      { $set: { hasVoted: true } }
    )
    if (!claimed) {
      return NextResponse.json({ error: "This code has already been used to vote" }, { status: 409 })
    }

    await VoteModel.create({
      ticketId: ctx.ticket._id,
      participantId: parsed.data.participantId,
      teamId: parsed.data.teamId,
      round: ctx.currentRound,
      region: ctx.region,
      castByAdmin: true,
      adminNote: parsed.data.note,
    })

    await TeamModel.updateOne(
      { _id: teamObjectId, "participants._id": new mongoose.Types.ObjectId(parsed.data.participantId) },
      { $inc: { "participants.$.votes": 1 } }
    )

    // The buyer is always told what was cast in their name. If the email fails
    // the vote still stands — it is already recorded — but say so plainly.
    let emailed = true
    let emailError: string | null = null
    try {
      const castAt = new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })
      await sendEmail({
        to: ctx.ticket.email,
        subject: `Your vote for ${participant.name} has been recorded`,
        htmlContent: createProxyVoteEmailTemplate(participant.name, ctx.ticket.votingCode, castAt),
        textContent: createProxyVoteEmailText(participant.name, ctx.ticket.votingCode, castAt),
      })
    } catch (error: any) {
      emailed = false
      emailError = error?.message ?? "Email failed to send"
      console.error("[PROXY_VOTE_EMAIL_ERROR]", error)
    }

    return NextResponse.json({
      success: true,
      poet: participant.name,
      email: ctx.ticket.email,
      emailed,
      emailError,
    })
  } catch (error: any) {
    console.error("[PROXY_VOTE_ERROR]", error)
    return NextResponse.json({ error: error?.message ?? "Failed to record the vote" }, { status: 500 })
  }
}
