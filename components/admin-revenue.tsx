"use client"
import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Mail, Send } from "lucide-react"
import { toast } from "sonner"
import type { Ticket } from "@/lib/types"
import { format } from "date-fns"

type Filter = "all" | "voted" | "unvoted"

const naira = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n)

export default function AdminRevenue() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState<Filter>("all")
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [isBulkResending, setIsBulkResending] = useState(false)
  const itemsPerPage = 10

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await fetch("/api/payments", { cache: "no-store" })
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
    }
    fetchTickets()
  }, [])

  const totalRevenue = useMemo(() => tickets.reduce((sum, ticket) => sum + ticket.amount, 0), [tickets])
  const unvoted = useMemo(() => tickets.filter((t) => !t.hasVoted), [tickets])

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
    </Card>
  )
}
