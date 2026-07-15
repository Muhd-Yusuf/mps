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
  label: string
  generatedAt: Date
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

async function loadReportData(): Promise<ReportData> {
  const [teamsRes, paymentsRes, labelRes] = await Promise.all([
    fetch("/api/teams", { cache: "no-store" }),
    fetch("/api/payments", { cache: "no-store" }),
    fetch("/api/settings/label", { cache: "no-store" }),
  ])

  if (!teamsRes.ok) throw new Error("Failed to load teams")
  const teamsData = await teamsRes.json()
  const teams: Team[] = teamsData?.teams ?? []

  let tickets: Ticket[] = []
  if (paymentsRes.ok) {
    const paymentsData = await paymentsRes.json()
    tickets = paymentsData?.tickets ?? []
  }

  let label = "Team"
  if (labelRes.ok) {
    label = (await labelRes.json())?.label || "Team"
  }

  return { teams, tickets, label, generatedAt: new Date() }
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

  lines.push("MPS Media Poetry Challenge - Official Report")
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
  lines.push(`Rank,${escapeCsv(data.label)},Contestant,Votes`)

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

const BRAND_INDIGO: [number, number, number] = [102, 126, 234]
const BRAND_PURPLE: [number, number, number] = [118, 75, 162]

async function buildPdf(data: ReportData) {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const s = summarize(data)
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const generated = data.generatedAt.toLocaleString()

  // Branded header banner + footer, redrawn on every page.
  const drawBranding = (pageNumber: number) => {
    doc.setFillColor(BRAND_INDIGO[0], BRAND_INDIGO[1], BRAND_INDIGO[2])
    doc.rect(0, 0, pageWidth, 26, "F")
    doc.setFillColor(BRAND_PURPLE[0], BRAND_PURPLE[1], BRAND_PURPLE[2])
    doc.rect(0, 26, pageWidth, 1.6, "F")

    // "MPS" logo badge
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(14, 6.5, 13, 13, 2, 2, "F")
    doc.setTextColor(BRAND_INDIGO[0], BRAND_INDIGO[1], BRAND_INDIGO[2])
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text("MPS", 20.5, 14.5, { align: "center" })

    // Title + tagline
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(15)
    doc.text("MPS Media Poetry Challenge", 32, 13)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text("Official Results & Revenue Report", 32, 19.5)
    doc.setFontSize(8)
    doc.text(`Generated: ${generated}`, pageWidth - 14, 12, { align: "right" })

    // Footer
    doc.setDrawColor(BRAND_INDIGO[0], BRAND_INDIGO[1], BRAND_INDIGO[2])
    doc.setLineWidth(0.3)
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12)
    doc.setTextColor(130, 130, 130)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.text("MPS Media Poetry Challenge", 14, pageHeight - 7)
    doc.text(`Page ${pageNumber}`, pageWidth - 14, pageHeight - 7, { align: "right" })
    doc.setTextColor(0, 0, 0)
  }

  const pageOpts = {
    margin: { top: 34, bottom: 16 },
    didDrawPage: (d: any) => drawBranding(d.pageNumber),
  }

  autoTable(doc, {
    ...pageOpts,
    startY: 36,
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
    headStyles: { fillColor: BRAND_INDIGO },
  })

  const ranked = s.participants
    .slice()
    .sort((a, b) => b.votes - a.votes)
    .map((p, index) => [String(index + 1), p.team, p.name, String(p.votes)])

  autoTable(doc, {
    ...pageOpts,
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Rank", data.label, "Contestant", "Votes"]],
    body: ranked,
    theme: "striped",
    headStyles: { fillColor: BRAND_PURPLE },
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
