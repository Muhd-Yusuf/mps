"use client"
import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Mail, Send, FileText, Vote } from "lucide-react"
import { toast } from "sonner"
import type { Ticket } from "@/lib/types"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"
import PoetAvatar from "@/components/poet-avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Filter = "all" | "voted" | "unvoted"
type ProxyPoet = { id: string; name: string; image?: string; teamId: string; teamName: string }

const naira = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n)

export default function AdminRevenue({ region }: { region: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState<Filter>("all")
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [isBulkResending, setIsBulkResending] = useState(false)
  // Casting a vote for a buyer who paid but couldn't vote before the deadline.
  const [proxyTicket, setProxyTicket] = useState<Ticket | null>(null)
  const [proxyPoets, setProxyPoets] = useState<ProxyPoet[]>([])
  const [proxyStage, setProxyStage] = useState("")
  const [proxyPoetId, setProxyPoetId] = useState("")
  const [proxyNote, setProxyNote] = useState("")
  const [proxyLoading, setProxyLoading] = useState(false)
  const [proxySubmitting, setProxySubmitting] = useState(false)
  const [proxyError, setProxyError] = useState<string | null>(null)
  const [busyPdf, setBusyPdf] = useState(false)
  const itemsPerPage = 10

  const fetchTickets = useCallback(async () => {
    if (!region) return
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`/api/payments?region=${encodeURIComponent(region)}`, { cache: "no-store" })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.error ?? "Unable to fetch revenue data")
      }
      const data = await response.json()
      setTickets(data?.tickets ?? [])
    } catch (error: any) {
      setError(error?.message ?? "Unable to fetch revenue data")
    } finally {
      setIsLoading(false)
    }
  }, [region])

  // Reload when the edition changes — revenue is per region.
  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  const totalRevenue = useMemo(() => tickets.reduce((sum, ticket) => sum + ticket.amount, 0), [tickets])
  const unvoted = useMemo(() => tickets.filter((t) => !t.hasVoted), [tickets])

  // Opening the dialog asks the server which poets this code could legitimately
  // have been spent on — the stage rules stay server-side, never re-implemented here.
  const openProxyDialog = async (ticket: Ticket) => {
    setProxyTicket(ticket)
    setProxyPoets([])
    setProxyPoetId("")
    setProxyNote("")
    setProxyError(null)
    setProxyLoading(true)
    try {
      const response = await fetch(`/api/votes/proxy?code=${encodeURIComponent(ticket.votingCode)}`, {
        cache: "no-store",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Could not load this code")
      setProxyPoets(data.poets ?? [])
      setProxyStage(data.stage ?? "")
      if (!data.poets?.length) setProxyError("No poets are votable in this stage right now.")
    } catch (error: any) {
      setProxyError(error?.message ?? "Could not load this code")
    } finally {
      setProxyLoading(false)
    }
  }

  const submitProxyVote = async () => {
    if (!proxyTicket) return
    const poet = proxyPoets.find((p) => p.id === proxyPoetId)
    if (!poet) {
      toast.error("Pick the poet they want to vote for")
      return
    }
    if (proxyNote.trim().length < 3) {
      toast.error("Record why you are casting this vote on their behalf")
      return
    }
    if (
      !confirm(
        `Cast ${proxyTicket.email}'s vote for ${poet.name}?\n\n` +
          `This spends their code permanently and emails them a confirmation naming ${poet.name}. ` +
          `It will be recorded as cast by an admin.`
      )
    ) {
      return
    }
    try {
      setProxySubmitting(true)
      const response = await fetch("/api/votes/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          votingCode: proxyTicket.votingCode,
          teamId: poet.teamId,
          participantId: poet.id,
          note: proxyNote.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to record the vote")
      if (data.emailed) {
        toast.success(`Vote recorded for ${data.poet}`, { description: `Confirmation sent to ${data.email}` })
      } else {
        toast.warning(`Vote recorded for ${data.poet}`, {
          description: `But the confirmation email failed: ${data.emailError ?? "unknown error"}. Tell them directly.`,
        })
      }
      setProxyTicket(null)
      await fetchTickets()
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to record the vote")
    } finally {
      setProxySubmitting(false)
    }
  }

  const resendCode = async (email: string) => {
    const response = await fetch("/api/tickets/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(typeof data?.error === "string" ? data.error : "Failed to resend")
    }
  }

  const handleResend = async (ticket: Ticket) => {
    try {
      setResendingId(ticket.id)
      await resendCode(ticket.email)
      toast.success(`Code re-sent to ${ticket.email}`)
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to resend code")
    } finally {
      setResendingId(null)
    }
  }

  // Nudge every buyer who hasn't voted yet — their code lands in their inbox again.
  const handleBulkResend = async () => {
    if (!unvoted.length) return
    if (!confirm(`Re-send voting codes to all ${unvoted.length} buyers who haven't voted yet?`)) return
    setIsBulkResending(true)
    let sent = 0
    let failed = 0
    for (const ticket of unvoted) {
      try {
        await resendCode(ticket.email)
        sent++
      } catch {
        failed++
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    setIsBulkResending(false)
    toast.success(`Re-sent ${sent} codes${failed ? `, ${failed} failed` : ""}`)
  }

  const filtered = useMemo(() => {
    if (filter === "voted") return tickets.filter((t) => t.hasVoted)
    if (filter === "unvoted") return unvoted
    return tickets
  }, [tickets, unvoted, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const currentTickets = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage)

  const filterTitle = filter === "unvoted" ? "Bought but Did Not Vote" : filter === "voted" ? "Voted" : "All Buyers"

  const downloadPdf = async () => {
    try {
      setBusyPdf(true)
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const drawHeader = (pageNumber: number) => {
        doc.setFillColor(102, 126, 234)
        doc.rect(0, 0, pageWidth, 24, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(14)
        doc.text("MPS Media Poetry Challenge", 14, 11)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        doc.text(`${filterTitle} — ${filtered.length} buyers`, 14, 18)
        doc.setFontSize(8)
        doc.text(`Page ${pageNumber}`, pageWidth - 14, 12, { align: "right" })
        doc.setTextColor(0, 0, 0)
      }
      autoTable(doc, {
        startY: 30,
        margin: { top: 28 },
        head: [["Email", "Voting Code", "Amount", "Voted?", "Purchased"]],
        body: filtered.map((t) => [
          t.email,
          t.votingCode,
          naira(t.amount),
          t.hasVoted ? "Yes" : "No",
          format(new Date(t.createdAt), "PPP p"),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [118, 75, 162] },
        theme: "striped",
        didDrawPage: (d: any) => drawHeader(d.pageNumber),
      })
      doc.save(`mps-${filter === "unvoted" ? "non-voters" : filter}-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success(`Exported ${filtered.length} buyers as PDF`)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to build PDF")
    } finally {
      setBusyPdf(false)
    }
  }

  const setFilterAndReset = (f: Filter) => {
    setFilter(f)
    setCurrentPage(1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue &amp; Codes</CardTitle>
        <CardDescription>
          Every paid code, who has used it, and who still needs a reminder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-primary/10 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{naira(totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Codes Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{tickets.length - unvoted.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-700">Bought, Not Voted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">{unvoted.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border/40 p-1">
            {(
              [
                ["all", `All (${tickets.length})`],
                ["voted", `Voted (${tickets.length - unvoted.length})`],
                ["unvoted", `Not Voted (${unvoted.length})`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={filter === key ? "default" : "ghost"}
                onClick={() => setFilterAndReset(key)}
                className={filter === key ? "bg-gradient-to-r from-primary to-accent" : ""}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={downloadPdf}
              disabled={busyPdf || filtered.length === 0}
              variant="outline"
              className="border-border/40 hover:bg-muted"
            >
              {busyPdf ? <Spinner size="sm" className="mr-2" /> : <FileText className="mr-2 h-4 w-4" />}
              PDF ({filterTitle})
            </Button>
            <Button
              onClick={handleBulkResend}
              disabled={isBulkResending || unvoted.length === 0}
              variant="outline"
              className="border-border/40 hover:bg-muted"
            >
              {isBulkResending ? <Spinner size="sm" className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
              Re-send code to all {unvoted.length} non-voters
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Voting Code</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.email}</TableCell>
                    <TableCell>{naira(ticket.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ticket.votingCode}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(ticket.createdAt), "PPP p")}</TableCell>
                    <TableCell>
                      {ticket.hasVoted ? (
                        <Badge className="bg-green-500 hover:bg-green-600">Voted</Badge>
                      ) : (
                        <Badge className="bg-amber-500 hover:bg-amber-600">Not Voted</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!ticket.hasVoted && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProxyDialog(ticket)}
                          disabled={isBulkResending}
                          className="border-border/40 hover:bg-muted mr-2"
                          title="Record this buyer's vote on their behalf"
                        >
                          <Vote className="mr-2 h-4 w-4" />
                          Vote for them
                        </Button>
                      )}
                      {!ticket.hasVoted && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResend(ticket)}
                          disabled={resendingId === ticket.id || isBulkResending}
                          className="border-border/40 hover:bg-muted"
                        >
                          {resendingId === ticket.id ? (
                            <Spinner size="sm" className="mr-2" />
                          ) : (
                            <Mail className="mr-2 h-4 w-4" />
                          )}
                          Resend Code
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filtered.length > 0 && (
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={safePage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-8">No tickets in this view.</div>
        )}
      </CardContent>

      {/* Cast a vote for a buyer who paid but could not vote in time. */}
      <Dialog open={Boolean(proxyTicket)} onOpenChange={(open) => !open && setProxyTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vote on their behalf</DialogTitle>
            <DialogDescription>
              Recording {proxyTicket?.email}&apos;s vote using code{" "}
              <span className="font-mono font-semibold">{proxyTicket?.votingCode}</span>
              {proxyStage ? <> in the <strong>{proxyStage}</strong> stage</> : null}. This spends their code
              permanently, is recorded as cast by an admin, and emails them a confirmation naming the poet.
            </DialogDescription>
          </DialogHeader>

          {proxyLoading && (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          )}

          {!proxyLoading && proxyError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {proxyError}
            </div>
          )}

          {!proxyLoading && !proxyError && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Who do they want to vote for?</label>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border/40 divide-y divide-border/40">
                  {proxyPoets.map((poet) => (
                    <button
                      key={poet.id}
                      type="button"
                      onClick={() => setProxyPoetId(poet.id)}
                      className={`w-full flex items-center gap-3 p-2.5 text-left transition-colors ${
                        proxyPoetId === poet.id ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                    >
                      <span className="relative h-9 w-9 rounded-full overflow-hidden shrink-0 border border-border/40">
                        <PoetAvatar src={poet.image} name={poet.name} textClassName="text-[10px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground truncate">{poet.name}</span>
                        <span className="block text-xs text-muted-foreground truncate">{poet.teamName}</span>
                      </span>
                      {proxyPoetId === poet.id && (
                        <span className="text-xs font-semibold text-primary shrink-0">SELECTED</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Why are you voting for them? <span className="text-muted-foreground">(recorded in the voter log)</span>
                </label>
                <Input
                  value={proxyNote}
                  onChange={(e) => setProxyNote(e.target.value)}
                  placeholder="e.g. called in, was travelling and missed the deadline"
                  maxLength={200}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProxyTicket(null)} disabled={proxySubmitting}>
              Cancel
            </Button>
            <Button
              onClick={submitProxyVote}
              disabled={proxySubmitting || proxyLoading || Boolean(proxyError) || !proxyPoetId}
              className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
            >
              {proxySubmitting ? <Spinner size="sm" className="mr-2" /> : <Vote className="mr-2 h-4 w-4" />}
              Record Vote & Email Them
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
