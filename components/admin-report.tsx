"use client"

import { useState } from "react"
import { FileText, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import type { Team, Ticket } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

type ReportData = {
  teams: Team[]
  tickets: Ticket[]
  generatedAt: Date
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

async function loadReportData(): Promise<ReportData> {
  const [teamsRes, paymentsRes] = await Promise.all([
    fetch("/api/teams", { cache: "no-store" }),
    fetch("/api/payments", { cache: "no-store" }),
  ])

  if (!teamsRes.ok) throw new Error("Failed to load teams")
  const teamsData = await teamsRes.json()
  const teams: Team[] = teamsData?.teams ?? []

  let tickets: Ticket[] = []
  if (paymentsRes.ok) {
    const paymentsData = await paymentsRes.json()
    tickets = paymentsData?.tickets ?? []
  }

  return { teams, tickets, generatedAt: new Date() }
}

function summarize({ teams, tickets }: ReportData) {
  const participants = teams.flatMap((team) =>
    (team.participants ?? []).map((p) => ({
      team: team.name,
      name: p.name,
      votes: p.votes ?? 0,
    }))
  )
  const totalVotes = participants.reduce((sum, p) => sum + p.votes, 0)
  const revenue = tickets.reduce((sum, t) => sum + (t.amount ?? 0), 0)
  const votedTickets = tickets.filter((t) => t.hasVoted).length

  return {
    totalTeams: teams.length,
    totalParticipants: participants.length,
    totalVotes,
    ticketsSold: tickets.length,
    votedTickets,
    revenue,
    participants,
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function fileStamp(date: Date) {
  return date.toISOString().slice(0, 10)
}

function escapeCsv(value: string | number) {
  const str = String(value ?? "")
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function buildCsv(data: ReportData) {
  const s = summarize(data)
  const lines: string[] = []

  lines.push("MPS Poetry Challenge - Report")
  lines.push(`Generated,${escapeCsv(data.generatedAt.toLocaleString())}`)
  lines.push("")
  lines.push("Summary")
  lines.push(`Teams,${s.totalTeams}`)
  lines.push(`Participants,${s.totalParticipants}`)
  lines.push(`Total Votes,${s.totalVotes}`)
  lines.push(`Tickets Sold,${s.ticketsSold}`)
  lines.push(`Tickets Voted,${s.votedTickets}`)
  lines.push(`Total Revenue,${escapeCsv(currency.format(s.revenue))}`)
  lines.push("")
  lines.push("Rank,Team,Contestant,Votes")

  s.participants
    .slice()
    .sort((a, b) => b.votes - a.votes)
    .forEach((p, index) => {
      lines.push(
        [index + 1, escapeCsv(p.team), escapeCsv(p.name), p.votes].join(",")
      )
    })

  // BOM so Excel reads UTF-8 correctly.
  return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
}

async function buildPdf(data: ReportData) {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const s = summarize(data)
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text("MPS Poetry Challenge - Report", 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Generated: ${data.generatedAt.toLocaleString()}`, 14, 25)
  doc.setTextColor(0)

  autoTable(doc, {
    startY: 32,
    head: [["Summary", ""]],
    body: [
      ["Teams", String(s.totalTeams)],
      ["Participants", String(s.totalParticipants)],
      ["Total Votes", String(s.totalVotes)],
      ["Tickets Sold", String(s.ticketsSold)],
      ["Tickets Voted", String(s.votedTickets)],
      ["Total Revenue", currency.format(s.revenue)],
    ],
    theme: "striped",
    headStyles: { fillColor: [102, 126, 234] },
  })

  const ranked = s.participants
    .slice()
    .sort((a, b) => b.votes - a.votes)
    .map((p, index) => [String(index + 1), p.team, p.name, String(p.votes)])

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Rank", "Team", "Contestant", "Votes"]],
    body: ranked,
    theme: "striped",
    headStyles: { fillColor: [118, 75, 162] },
  })

  doc.save(`mps-report-${fileStamp(data.generatedAt)}.pdf`)
}

export default function AdminReport() {
  const [busy, setBusy] = useState<null | "csv" | "pdf">(null)

  const handleGenerate = async (format: "csv" | "pdf") => {
    try {
      setBusy(format)
      const data = await loadReportData()

      if (format === "csv") {
        triggerDownload(buildCsv(data), `mps-report-${fileStamp(data.generatedAt)}.csv`)
      } else {
        await buildPdf(data)
      }

      toast.success(`${format.toUpperCase()} report generated`)
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to generate report")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="bg-white border-border/40 backdrop-blur">
      <CardHeader>
        <CardTitle>Generate Report</CardTitle>
        <CardDescription>Download a full results and revenue report for the competition.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleGenerate("csv")}
            disabled={busy !== null}
            variant="outline"
            className="border-border/40 hover:bg-muted"
          >
            {busy === "csv" ? <Spinner size="sm" className="mr-2" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Download CSV
          </Button>
          <Button
            onClick={() => handleGenerate("pdf")}
            disabled={busy !== null}
            className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
          >
            {busy === "pdf" ? <Spinner size="sm" className="mr-2" /> : <FileText className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
