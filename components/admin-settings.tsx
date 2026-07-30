"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { Save, RotateCw, Tag, Flame, CheckCircle2 } from "lucide-react"

import { STAGE_PRESETS, getPreset } from "@/lib/stages"

function advancementText(presetKey: string): string {
    const preset = getPreset(presetKey)
    const { slice, advance, advanceLabel } = preset.results
    if (!advance) return "Results are a full ranking — no automatic cut-off."
    if (slice === "perTeam") {
        return `Top ${advance} per team ${advanceLabel === "SAVED" ? "is saved" : "advance"} by audience vote.`
    }
    return `Top ${advance} overall ${advanceLabel === "REVIVED" ? "are revived" : "advance"} by audience vote.`
}

export default function AdminSettings() {
    const [teamLabel, setTeamLabel] = useState<string>("Team")
    const [round, setRound] = useState<number>(1)
    const [roundLabel, setRoundLabel] = useState<string>("")
    const [presetKey, setPresetKey] = useState<string>("team_voting")
    const [isLoading, setIsLoading] = useState(true)
    const [isSavingLabel, setIsSavingLabel] = useState(false)
    const [isSavingRoundLabel, setIsSavingRoundLabel] = useState(false)
    const [isAdvancing, setIsAdvancing] = useState(false)
    const [isSavingPreset, setIsSavingPreset] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            setIsLoading(true)
            const [labelRes, roundRes, presetRes] = await Promise.all([
                fetch("/api/settings/label"),
                fetch("/api/settings/round"),
                fetch("/api/settings/preset"),
            ])
            if (labelRes.ok) setTeamLabel((await labelRes.json()).label)
            if (roundRes.ok) {
                const roundData = await roundRes.json()
                setRound(roundData.round)
                setRoundLabel(roundData.label ?? "")
            }
            if (presetRes.ok) setPresetKey(getPreset((await presetRes.json()).preset).key)
        } catch (error) {
            toast.error("Error loading settings")
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetPreset = async (nextKey: string) => {
        if (nextKey === presetKey) return
        const next = getPreset(nextKey)
        const message =
            `Switch the live site to "${next.name}"?\n\n` +
            `Voters will see: "${next.heading}" — ${next.description}\n\n` +
            `Before switching: ${next.adminPrep}`
        if (!confirm(message)) return
        try {
            setIsSavingPreset(true)
            const response = await fetch("/api/settings/preset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preset: next.key }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to switch stage")
            }
            const data = await response.json()
            setPresetKey(getPreset(data.preset).key)
            toast.success(`"${next.name}" is now live`)
        } catch (error: any) {
            toast.error(error.message || "Error switching stage")
        } finally {
            setIsSavingPreset(false)
        }
    }

    const handleSaveLabel = async () => {
        try {
            setIsSavingLabel(true)
            const response = await fetch("/api/settings/label", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: teamLabel.trim() || "Team" }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to save label")
            }
            const data = await response.json()
            setTeamLabel(data.label)
            toast.success("Label saved successfully")
        } catch (error: any) {
            toast.error(error.message || "Error saving label")
        } finally {
            setIsSavingLabel(false)
        }
    }

    const handleSaveRoundLabel = async () => {
        try {
            setIsSavingRoundLabel(true)
            const response = await fetch("/api/settings/round", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "label", label: roundLabel.trim() }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to save round name")
            }
            const data = await response.json()
            setRoundLabel(data.label ?? "")
            toast.success("Round name saved")
        } catch (error: any) {
            toast.error(error.message || "Error saving round name")
        } finally {
            setIsSavingRoundLabel(false)
        }
    }

    const handleAdvanceRound = async () => {
        if (!confirm("Start a new round? This closes voting on all teams, clears the round name, and lets everyone buy a new ticket.")) {
            return
        }
        try {
            setIsAdvancing(true)
            const response = await fetch("/api/settings/round", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "advance" }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to start new round")
            }
            const data = await response.json()
            setRound(data.round)
            setRoundLabel(data.label ?? "")
            toast.success(`Round ${data.round} started. All teams closed — open the ones for this round.`)
        } catch (error: any) {
            toast.error(error.message || "Error starting new round")
        } finally {
            setIsAdvancing(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Spinner size="lg" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="bg-white border-border/40 backdrop-blur shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-red-600" />
                        <CardTitle>Competition Stage</CardTitle>
                    </div>
                    <CardDescription>
                        Pick the stage the competition is in right now. Each stage sets what voters see, which
                        poets are votable, and how results are counted in reports.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3">
                        {STAGE_PRESETS.map((stage) => {
                            const isActive = stage.key === presetKey
                            return (
                                <button
                                    key={stage.key}
                                    type="button"
                                    onClick={() => handleSetPreset(stage.key)}
                                    disabled={isSavingPreset}
                                    className={`text-left rounded-xl border-2 p-4 transition-all ${
                                        isActive ? "shadow-md" : "border-border/40 hover:border-border bg-white"
                                    }`}
                                    style={
                                        isActive
                                            ? {
                                                  borderColor: stage.accentColor,
                                                  background: `linear-gradient(135deg, ${stage.accentColor}14, ${stage.accentColor}05)`,
                                              }
                                            : undefined
                                    }
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-semibold text-foreground">{stage.name}</p>
                                        {isActive && (
                                            <span
                                                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full text-white whitespace-nowrap"
                                                style={{ backgroundColor: stage.accentColor }}
                                            >
                                                <CheckCircle2 className="w-3 h-3" /> LIVE
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">{advancementText(stage.key)}</p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        <strong>Prep:</strong> {stage.adminPrep}
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white border-border/40 backdrop-blur shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <RotateCw className="w-5 h-5 text-primary" />
                        <CardTitle>Voting Round</CardTitle>
                    </div>
                    <CardDescription>
                        Current round is <strong>{round}</strong>
                        {roundLabel ? <> — <strong>{roundLabel}</strong></> : null}. Each voting code casts a single
                        vote. Starting a new round closes all teams and lets every voter buy a fresh ticket.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <Input
                            value={roundLabel}
                            onChange={(e) => setRoundLabel(e.target.value)}
                            placeholder="e.g. Bauchi — Blind Audition Revival"
                            maxLength={80}
                            className="max-w-[320px]"
                        />
                        <Button
                            onClick={handleSaveRoundLabel}
                            disabled={isSavingRoundLabel}
                            variant="outline"
                            className="border-border/40 hover:bg-muted"
                        >
                            {isSavingRoundLabel ? <Spinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Round Name
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Name each round after its event so reports stay clear months later
                        (e.g. &ldquo;Kaduna — Knockout Audience Vote&rdquo;).
                    </p>
                    <Button
                        onClick={handleAdvanceRound}
                        disabled={isAdvancing}
                        variant="outline"
                        className="border-border/40 hover:bg-muted"
                    >
                        {isAdvancing ? (
                            <>
                                <Spinner size="sm" className="mr-2" />
                                Starting...
                            </>
                        ) : (
                            <>
                                <RotateCw className="w-4 h-4 mr-2" />
                                Start New Round
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-white border-border/40 backdrop-blur shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-primary" />
                        <CardTitle>Team Label</CardTitle>
                    </div>
                    <CardDescription>
                        What each group represents across the app (e.g. Team, State, LGA, Coach).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4 items-center">
                        <Input
                            id="teamLabel"
                            value={teamLabel}
                            onChange={(e) => setTeamLabel(e.target.value)}
                            placeholder="Team"
                            maxLength={30}
                            className="max-w-[200px]"
                        />
                        <p className="text-sm text-muted-foreground">
                            Shown wherever groups are referenced (e.g. &ldquo;{teamLabel || "Team"}&rdquo;).
                        </p>
                    </div>
                    <Button
                        onClick={handleSaveLabel}
                        disabled={isSavingLabel || !teamLabel.trim()}
                        className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                    >
                        {isSavingLabel ? (
                            <>
                                <Spinner size="sm" className="mr-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Label
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
