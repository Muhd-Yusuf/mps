import { NextResponse } from "next/server"
import { z } from "zod"
import https from "https"

import { connectToDatabase, TicketModel, TeamModel, SettingModel } from "@/lib/mongodb"
import { generateVotingCode } from "@/lib/code-utils"

const initializeSchema = z.object({
  email: z.string().email("Invalid email address"),
  amount: z.number().positive("Amount must be positive"),
})

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_BASE_URL = "https://api.paystack.co"

function makePaystackRequest(path: string, data: any) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data)

    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path: path,
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": postData.length,
      },
    }

    const req = https.request(options, (res) => {
      let responseData = ""

      res.on("data", (chunk) => {
        responseData += chunk
      })

      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseData)
          if (parsed.status) {
            resolve(parsed)
          } else {
            reject(new Error(parsed.message || "Paystack request failed"))
          }
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on("error", (error) => {
      reject(error)
    })

    req.write(postData)
    req.end()
  })
}

export async function POST(request: Request) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Paystack secret key not configured" }, { status: 500 })
    }

    const payload = await request.json()
    const parsed = initializeSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    await connectToDatabase()

    // A ticket can only be useful if there is at least one team open to vote for.
    const openTeamCount = await TeamModel.countDocuments({ votingOpen: true })
    if (openTeamCount === 0) {
      return NextResponse.json(
        { error: "Voting is not open right now. Please wait for the next round." },
        { status: 409 }
      )
    }

    // Tickets belong to the current round. Admin advances the round to reset limits.
    const roundSetting = await SettingModel.findOne({ key: "current_round" }).lean()
    const round = roundSetting ? parseInt(roundSetting.value, 10) || 1 : 1

    // One ticket per email per round: a new round frees the same email to buy again.
    const normalizedEmail = parsed.data.email.toLowerCase().trim()
    const existingPaidTicket = await TicketModel.findOne({
      email: normalizedEmail,
      isPaid: true,
      round,
    })
    if (existingPaidTicket) {
      return NextResponse.json(
        { error: "This email has already purchased a voting code for the current round." },
        { status: 409 }
      )
    }

    // Generate unique voting code
    let votingCode = generateVotingCode()
    let codeExists = true
    while (codeExists) {
      const existing = await TicketModel.findOne({ votingCode })
      if (!existing) {
        codeExists = false
      } else {
        votingCode = generateVotingCode()
      }
    }

    // Create ticket record
    const ticket = await TicketModel.create({
      email: normalizedEmail,
      votingCode,
      amount: parsed.data.amount,
      isPaid: false,
      round,
    })

    // Initialize Paystack payment
    const ticketId = ticket._id.toString()
    const paystackResponse: any = await makePaystackRequest("/transaction/initialize", {
      email: parsed.data.email,
      amount: parsed.data.amount * 100, // Convert to kobo
      reference: ticketId,
      metadata: {
        ticketId,
        votingCode,
      },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/purchase/verify?reference=${ticketId}&ticketId=${ticketId}`,
    })

    // Update ticket with Paystack reference
    await TicketModel.findByIdAndUpdate(ticket._id, {
      paystackReference: paystackResponse.data.reference,
    })

    return NextResponse.json({
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
      reference: paystackResponse.data.reference,
      ticketId: ticket._id.toString(),
    })
  } catch (error: any) {
    console.error("[INITIALIZE_PAYMENT_ERROR]", error)
    return NextResponse.json({ error: error?.message ?? "Failed to initialize payment" }, { status: 500 })
  }
}

