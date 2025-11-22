"use client"
import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Ticket } from "@/lib/types"
import { format } from "date-fns"

export default function AdminRevenue() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
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

  const totalRevenue = useMemo(() => {
    return tickets.reduce((sum, ticket) => sum + ticket.amount, 0)
  }, [tickets])

  const formattedTotalRevenue = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(totalRevenue)

  const totalPages = Math.ceil(tickets.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTickets = tickets.slice(startIndex, endIndex)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
        <CardDescription>
          Total revenue generated from ticket sales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-primary">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formattedTotalRevenue}</div>
          </CardContent>
        </Card>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.email}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(ticket.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ticket.votingCode}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(ticket.createdAt), "PPP p")}</TableCell>
                    <TableCell>
                      {ticket.isPaid ? (
                        <Badge className="bg-green-500 hover:bg-green-600">Paid</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {tickets.length > 0 && (
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
        {!isLoading && !error && tickets.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No paid tickets found.
          </div>
        )}
      </CardContent>
    </Card>
  )
}