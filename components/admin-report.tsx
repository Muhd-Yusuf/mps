"use client"

import { useState } from "react"
import { FileText, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import type { Team, Ticket } from "@/lib/types"
import { getPreset, type StagePreset } from "@/lib/stages"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

type ReportScope = "full" | "results"

type ReportData = {
  teams: Team[]
  tickets: Ticket[]
  label: string
  preset: StagePreset
  round: number
  roundLabel: string
  generatedAt: Date
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

async function loadReportData(): Promise<ReportData> {
  const [teamsRes, paymentsRes, labelRes, presetRes, roundRes] = await Promise.all([
    fetch("/api/teams", { cache: "no-store" }),
    fetch("/api/payments", { cache: "no-store" }),
    fetch("/api/settings/label", { cache: "no-store" }),
    fetch("/api/settings/preset", { cache: "no-store" }),
    fetch("/api/settings/round", { cache: "no-store" }),
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

  let preset = getPreset(null)
  if (presetRes.ok) {
    preset = getPreset((await presetRes.json())?.preset)
  }

  let round = 1
  let roundLabel = ""
  if (roundRes.ok) {
    const roundData = await roundRes.json()
    round = roundData?.round ?? 1
    roundLabel = roundData?.label ?? ""
  }

  return { teams, tickets, label, preset, round, roundLabel, generatedAt: new Date() }
}

type RankedRow = {
  rank: number
  team: string
  name: string
  votes: number
  status: string
}

// Rank poets the way the current stage counts them: danger stages rank only the
// flagged poets; "perTeam" slices rank within each team; the top N get the
// stage's advance label (REVIVED / ADVANCES / SAVED).
function rankForStage(teams: Team[], preset: StagePreset): RankedRow[] {
  const { slice, advance, advanceLabel } = preset.results
  const isDanger = preset.mode === "danger"

  const pool = teams.flatMap((team) =>
    (team.participants ?? [])
      .filter((p) => (isDanger ? p.inDanger : true))
      .map((p) => ({ team: team.name, name: p.name, votes: p.votes ?? 0 }))
  )

  if (slice === "perTeam" && advance > 0) {
    const rows: RankedRow[] = []
    const teamNames = [...new Set(pool.map((p) => p.team))]
    teamNames.forEach((teamName) => {
      pool
        .filter((p) => p.team === teamName)
        .sort((a, b) => b.votes - a.votes)
        .forEach((p, index) => {
          rows.push({
            rank: index + 1,
            team: p.team,
            name: p.name,
            votes: p.votes,
            status: index < advance && p.votes > 0 ? advanceLabel : "",
          })
        })
    })
    return rows
  }

  return pool
    .sort((a, b) => b.votes - a.votes)
    .map((p, index) => ({
      rank: index + 1,
      team: p.team,
      name: p.name,
      votes: p.votes,
      status: advance > 0 && index < advance && p.votes > 0 ? advanceLabel : "",
    }))
}

function summarize({ teams, tickets, preset }: ReportData) {
  const ranked = rankForStage(teams, preset)
  const totalVotes = ranked.reduce((sum, p) => sum + p.votes, 0)
  const revenue = tickets.reduce((sum, t) => sum + (t.amount ?? 0), 0)
  const votedTickets = tickets.filter((t) => t.hasVoted).length

  return {
    totalTeams: teams.length,
    totalParticipants: ranked.length,
    totalVotes,
    ticketsSold: tickets.length,
    votedTickets,
    revenue,
    ranked,
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

function buildCsv(data: ReportData, scope: ReportScope) {
  const s = summarize(data)
  const includeRevenue = scope === "full"
  const lines: string[] = []

  lines.push(`MPS Media Poetry Challenge - ${includeRevenue ? "Full Statement" : "Results"}`)
  lines.push(`Stage,${escapeCsv(data.preset.name)}`)
  lines.push(`Round,${escapeCsv(data.roundLabel ? `${data.round} — ${data.roundLabel}` : String(data.round))}`)
  lines.push(`Generated,${escapeCsv(data.generatedAt.toLocaleString())}`)
  lines.push("")
  lines.push("Summary")
  lines.push(`Teams,${s.totalTeams}`)
  lines.push(`Poets,${s.totalParticipants}`)
  lines.push(`Total Votes,${s.totalVotes}`)
  if (includeRevenue) {
    lines.push(`Tickets Sold,${s.ticketsSold}`)
    lines.push(`Tickets Voted,${s.votedTickets}`)
    lines.push(`Total Revenue,${escapeCsv(currency.format(s.revenue))}`)
  }
  lines.push("")
  const hasStatus = data.preset.results.advance > 0
  lines.push(`Rank,${escapeCsv(data.label)},Contestant,Votes${hasStatus ? ",Status" : ""}`)

  s.ranked.forEach((p) => {
    const row = [p.rank, escapeCsv(p.team), escapeCsv(p.name), p.votes]
    if (hasStatus) row.push(escapeCsv(p.status))
    lines.push(row.join(","))
  })

  // BOM so Excel reads UTF-8 correctly.
  return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
}

const BRAND_INDIGO: [number, number, number] = [102, 126, 234]
const BRAND_PURPLE: [number, number, number] = [118, 75, 162]

async function buildPdf(data: ReportData, scope: ReportScope) {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const s = summarize(data)
  const includeRevenue = scope === "full"
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
    doc.text(includeRevenue ? "Official Results & Revenue Statement" : "Official Results Report", 32, 19.5)
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
      ["Stage", data.preset.name],
      ["Round", data.roundLabel ? `${data.round} — ${data.roundLabel}` : String(data.round)],
      ["Teams", String(s.totalTeams)],
      ["Poets", String(s.totalParticipants)],
      ["Total Votes", String(s.totalVotes)],
      ...(includeRevenue
        ? [
            ["Tickets Sold", String(s.ticketsSold)],
            ["Tickets Voted", String(s.votedTickets)],
            ["Total Revenue", currency.format(s.revenue)],
          ]
        : []),
    ],
    theme: "striped",
    headStyles: { fillColor: BRAND_INDIGO },
  })

  const hasStatus = data.preset.results.advance > 0
  const ranked = s.ranked.map((p) => [
    String(p.rank),
    p.team,
    p.name,
    String(p.votes),
    ...(hasStatus ? [p.status] : []),
  ])

  autoTable(doc, {
    ...pageOpts,
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Rank", data.label, "Contestant", "Votes", ...(hasStatus ? ["Status"] : [])]],
    body: ranked,
    theme: "striped",
    headStyles: { fillColor: BRAND_PURPLE },
    // Bold the qualifying rows so the cut-off is obvious at a glance.
    didParseCell: hasStatus
      ? (hook: any) => {
          if (hook.section === "body" && hook.row.raw?.[4]) {
            hook.cell.styles.fontStyle = "bold"
          }
        }
      : undefined,
  })

  doc.save(`mps-report-${fileStamp(data.generatedAt)}.pdf`)
}

export default function AdminReport() {
  const [busy, setBusy] = useState<null | "csv" | "pdf">(null)
  const [scope, setScope] = useState<ReportScope>("full")

  const handleGenerate = async (format: "csv" | "pdf") => {
    try {
      setBusy(format)
      const data = await loadReportData()
      const suffix = scope === "full" ? "statement" : "results"

      if (format === "csv") {
        triggerDownload(buildCsv(data, scope), `mps-${suffix}-${fileStamp(data.generatedAt)}.csv`)
      } else {
        await buildPdf(data, scope)
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
        <CardDescription>Download the competition report as a spreadsheet or branded PDF.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground mb-2">What to include</p>
          <div className="inline-flex rounded-lg border border-border/40 p-1">
            <Button
              type="button"
              size="sm"
              variant={scope === "full" ? "default" : "ghost"}
              onClick={() => setScope("full")}
              disabled={busy !== null}
              className={scope === "full" ? "bg-gradient-to-r from-primary to-accent" : ""}
            >
              Full statement (with revenue)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scope === "results" ? "default" : "ghost"}
              onClick={() => setScope("results")}
              disabled={busy !== null}
              className={scope === "results" ? "bg-gradient-to-r from-primary to-accent" : ""}
            >
              Results only
            </Button>
          </div>
        </div>

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
