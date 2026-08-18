"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Download, Users } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type LedgerRow = {
  email: string
  votingCode: string
  poet: string
  team: string
  round: number | null
  at: string
}

export default function AdminVoterLog() {
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const perPage = 25

  useEffect(() => {
    fetch("/api/votes/ledger", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to load")
        return res.json()
      })
      .then((data) => setRows(data.rows ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        r.poet.toLowerCase().includes(q) ||
        r.team.toLowerCase().includes(q) ||
        r.votingCode.toLowerCase().includes(q)
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const shown = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  const downloadCsv = () => {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const lines = ["Email,Voting Code,Voted For,Team,When"]
    filtered.forEach((r) =>
      lines.push([r.email, r.votingCode, r.poet, r.team, new Date(r.at).toLocaleString()].map((x) => esc(String(x))).join(","))
    )
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mps-voter-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} votes`)
  }

  return (
    <Card className="bg-white border-border/40 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <CardTitle>Voter Log</CardTitle>
        </div>
        <CardDescription>
          Every vote cast: who bought the code, and the poet they chose. {rows.length} votes on record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by email, poet, team or code…"
              className="pl-9"
            />
          </div>
          <Button onClick={downloadCsv} disabled={!filtered.length} variant="outline" className="border-border/40 hover:bg-muted">
            <Download className="mr-2 h-4 w-4" />
            Export CSV ({filtered.length})
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        )}
        {error && <p className="text-sm text-destructive py-4">{error}</p>}

        {!isLoading && !error && (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Voted For</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r, i) => (
                    <TableRow key={`${r.votingCode}-${i}`}>
                      <TableCell className="whitespace-nowrap">{r.email}</TableCell>
                      <TableCell className="font-mono text-xs">{r.votingCode}</TableCell>
                      <TableCell className="font-medium text-foreground">{r.poet}</TableCell>
                      <TableCell className="text-muted-foreground">{r.team}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {new Date(r.at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No votes match this search.</p>
            )}
            {filtered.length > perPage && (
              <div className="flex items-center justify-end gap-2 py-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
