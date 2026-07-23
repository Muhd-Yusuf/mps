import { NextResponse } from "next/server"
import https from "https"

import { connectToDatabase, TicketModel } from "@/lib/mongodb"
import { sendEmail, createVotingCodeEmailTemplate, createVotingCodeEmailText } from "@/lib/brevo"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

function verifyPaystackTransaction(reference: string) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
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
            reject(new Error(parsed.message || "Verification failed"))
          }
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on("error", (error) => {
      reject(error)
    })

    req.end()
  })
}

export async function GET(request: Request) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Paystack secret key not configured" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const reference = searchParams.get("reference")

    if (!reference) {
      return NextResponse.json({ error: "Reference is required" }, { status: 400 })
    }

    await connectToDatabase()

    // Verify with Paystack
    const verification: any = await verifyPaystackTransaction(reference)

    if (verification.data.status !== "success") {
      return NextResponse.json({ error: "Payment not successful", status: verification.data.status }, { status: 400 })
    }

    // Find ticket by reference (which is the ticket ID)
    const ticket = await TicketModel.findById(reference)

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    // Check if ticket was already paid to avoid sending duplicate emails
    const wasAlreadyPaid = ticket.isPaid

    // One code per email per round: if this email already has a paid ticket for the
    // same round, do NOT grant a second code. Guards the race where several tickets
    // were initialized before any of them was paid.
    if (!wasAlreadyPaid) {
      const duplicatePaid = await TicketModel.findOne({
        _id: { $ne: ticket._id },
        email: ticket.email,
        isPaid: true,
        ...(ticket.round != null ? { round: ticket.round } : {}),
      })
      if (duplicatePaid) {
        return NextResponse.json(
          {
            success: false,
            error: "This email already has a voting code for the current round. Only one is allowed per email.",
          },
          { status: 409 }
        )
      }
    }

    // Update ticket as paid
    await TicketModel.findByIdAndUpdate(ticket._id, {
      isPaid: true,
      paystackReference: verification.data.reference,
      paidAt: new Date(),
      paymentMetadata: verification.data,
    })

    // Send voting code email only if ticket wasn't already paid
    if (!wasAlreadyPaid) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        await sendEmail({
          to: ticket.email,
          subject: "Your MPS Media Poetry Challenge Voting Code",
          htmlContent: createVotingCodeEmailTemplate(ticket.votingCode, appUrl),
          textContent: createVotingCodeEmailText(ticket.votingCode, appUrl),
        })
      } catch (emailError: any) {
        // Log email error but don't fail the request
        console.error("[SEND_EMAIL_ERROR]", emailError)
        // Continue with the response even if email fails
      }
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket._id.toString(),
        email: ticket.email,
        votingCode: ticket.votingCode,
        amount: ticket.amount,
        isPaid: true,
      },
    })
  } catch (error: any) {
    console.error("[VERIFY_PAYMENT_ERROR]", error)
    return NextResponse.json({ error: error?.message ?? "Failed to verify payment" }, { status: 500 })
  }
}

