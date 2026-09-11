"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { Save, RotateCw, Tag, Flame, CheckCircle2, Clock, XCircle, Lock, ShieldCheck, Send } from "lucide-react"

import { STAGE_PRESETS, getPreset } from "@/lib/stages"

// ISO timestamp -> value for <input type="datetime-local"> in the admin's timezone.
function toLocalInputValue(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ""
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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
    const [deadlineInput, setDeadlineInput] = useState<string>("")
    const [startInput, setStartInput] = useState<string>("")
    const [isSavingStart, setIsSavingStart] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSavingLabel, setIsSavingLabel] = useState(false)
    const [isSavingRoundLabel, setIsSavingRoundLabel] = useState(false)
    const [isAdvancing, setIsAdvancing] = useState(false)
    const [isSavingPreset, setIsSavingPreset] = useState(false)
    const [isSavingDeadline, setIsSavingDeadline] = useState(false)
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [otpEmail, setOtpEmail] = useState<string | null>(null)
    const [otpEmailInput, setOtpEmailInput] = useState("")
    const [otpPassword, setOtpPassword] = useState("")
    const [isSavingOtpEmail, setIsSavingOtpEmail] = useState(false)
    const [isSendingTestCode, setIsSendingTestCode] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            setIsLoading(true)
            const [labelRes, roundRes, presetRes, deadlineRes, startRes, otpRes] = await Promise.all([
                fetch("/api/settings/label"),
                fetch("/api/settings/round"),
                fetch("/api/settings/preset"),
                fetch("/api/settings/deadline"),
                fetch("/api/settings/start"),
                fetch("/api/settings/otp-email"),
            ])
            if (labelRes.ok) setTeamLabel((await labelRes.json()).label)
            if (roundRes.ok) {
                const roundData = await roundRes.json()
                setRound(roundData.round)
                setRoundLabel(roundData.label ?? "")
            }
            if (presetRes.ok) setPresetKey(getPreset((await presetRes.json()).preset).key)
            if (deadlineRes.ok) {
                const deadlineData = await deadlineRes.json()
                setDeadlineInput(deadlineData.deadline ? toLocalInputValue(deadlineData.deadline) : "")
            }
            if (startRes.ok) {
                const startData = await startRes.json()
                setStartInput(startData.start ? toLocalInputValue(startData.start) : "")
            }
            if (otpRes.ok) {
                const otpData = await otpRes.json()
                setOtpEmail(otpData.email ?? null)
                setOtpEmailInput(otpData.email ?? "")
            }
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

    const handleSaveStart = async (clear: boolean) => {
        if (!clear && !startInput) {
            toast.error("Pick a date and time first")
            return
        }
        if (clear && !confirm("Remove the scheduled start? Voting opens immediately (subject to the stage setup).")) return
        try {
            setIsSavingStart(true)
            const iso = clear ? "" : new Date(startInput).toISOString()
            const response = await fetch("/api/settings/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ start: iso }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(typeof data.error === "string" ? data.error : "Failed to save start time")
            }
            const data = await response.json()
            setStartInput(data.start ? toLocalInputValue(data.start) : "")
            toast.success(clear ? "Scheduled start removed — voting is open now" : "Start time set — the site shows a countdown until then")
        } catch (error: any) {
            toast.error(error.message || "Error saving start time")
        } finally {
            setIsSavingStart(false)
        }
    }

    const handleSaveDeadline = async (clear: boolean) => {
        if (!clear && !deadlineInput) {
            toast.error("Pick a date and time first")
            return
        }
        if (clear && !confirm("Remove the voting deadline? Voting stays open until you close it manually.")) return
        try {
            setIsSavingDeadline(true)
            const iso = clear ? "" : new Date(deadlineInput).toISOString()
            const response = await fetch("/api/settings/deadline", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deadline: iso }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(typeof data.error === "string" ? data.error : "Failed to save deadline")
            }
            const data = await response.json()
            setDeadlineInput(data.deadline ? toLocalInputValue(data.deadline) : "")
            toast.success(clear ? "Deadline removed — voting stays open" : "Deadline set — voting closes automatically")
        } catch (error: any) {
            toast.error(error.message || "Error saving deadline")
        } finally {
            setIsSavingDeadline(false)
        }
    }

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            toast.error("Fill in your current and new password")
            return
        }
        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters")
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error("New password and confirmation don't match")
            return
        }
        try {
            setIsChangingPassword(true)
            const response = await fetch("/api/admin/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to change password")
            }
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            toast.success("Admin password changed. Use the new password next time you log in.")
        } catch (error: any) {
            toast.error(error.message || "Error changing password")
        } finally {
            setIsChangingPassword(false)
        }
    }

    const handleSaveOtpEmail = async (clear: boolean) => {
        if (!otpPassword) {
            toast.error("Enter your current admin password to confirm this change")
            return
        }
        if (!clear && !otpEmailInput.trim()) {
            toast.error("Enter the email address that should receive login codes")
            return
        }
        if (
            clear &&
            !confirm(
                "Turn off login codes? Anyone with the admin password alone will be able to log in."
            )
        ) {
            return
        }
        try {
            setIsSavingOtpEmail(true)
            const response = await fetch("/api/settings/otp-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: clear ? "" : otpEmailInput.trim(),
                    currentPassword: otpPassword,
                }),
            })
            if (!response.ok) {
                const data = await response.json()
                throw new Error(typeof data.error === "string" ? data.error : "Failed to save login email")
            }
            const data = await response.json()
            setOtpEmail(data.email ?? null)
            setOtpEmailInput(data.email ?? "")
            setOtpPassword("")
            toast.success(
                clear
                    ? "Login codes turned off — the dashboard is password-only again"
                    : `Login codes on. Every login now needs a code sent to ${data.email}.`
            )
        } catch (error: any) {
            toast.error(error.message || "Error saving login email")
        } finally {
            setIsSavingOtpEmail(false)
        }
    }

    const handleSendTestCode = async () => {
        try {
            setIsSendingTestCode(true)
            const response = await fetch("/api/admin/otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ test: true }),
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(typeof data.error === "string" ? data.error : "Failed to send test code")
            }
            if (!data.otpRequired) {
                toast.error("No login email saved yet — save one first")
                return
            }
            toast.success(data.message || "Test code sent — check the inbox")
        } catch (error: any) {
            toast.error(error.message || "Error sending test code")
        } finally {
            setIsSendingTestCode(false)
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
        if (!confirm("Start a new round? This closes all teams, RESETS every poet's vote counter to zero for the new stage, clears the round name, and lets everyone buy a new ticket.\n\nDownload this round's reports FIRST — the on-screen counters start over (full history stays stored).")) {
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
                        <Lock className="w-5 h-5 text-primary" />
                        <CardTitle>Admin Password</CardTitle>
                    </div>
                    <CardDescription>
                        Change the password used to log into this dashboard. Do this now if you haven&apos;t
                        since setup — use at least 8 characters. The new password takes effect on your next login.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-w-sm">
                    <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        autoComplete="current-password"
                    />
                    <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (min 8 characters)"
                        autoComplete="new-password"
                    />
                    <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                    />
                    <Button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                    >
                        {isChangingPassword ? <Spinner size="sm" className="mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                        Change Password
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-white border-border/40 backdrop-blur shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <CardTitle>Login Security (Email Code)</CardTitle>
                        <span
                            className={`ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                                otpEmail ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                            }`}
                        >
                            {otpEmail ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {otpEmail ? "ON" : "OFF"}
                        </span>
                    </div>
                    <CardDescription>
                        Add an email address and every admin login will need a 6-digit code sent to it — so the
                        password alone is no longer enough to get in. Codes expire after 10 minutes and work
                        once. {otpEmail ? (
                            <>Currently sending codes to <strong>{otpEmail}</strong>.</>
                        ) : (
                            <>No address saved, so login is password-only right now.</>
                        )}{" "}
                        Send a test code first to confirm the inbox receives it.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-w-sm">
                    <Input
                        type="email"
                        value={otpEmailInput}
                        onChange={(e) => setOtpEmailInput(e.target.value)}
                        placeholder="admin@example.com"
                        autoComplete="email"
                    />
                    <Input
                        type="password"
                        value={otpPassword}
                        onChange={(e) => setOtpPassword(e.target.value)}
                        placeholder="Confirm with your admin password"
                        autoComplete="current-password"
                    />
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={() => handleSaveOtpEmail(false)}
                            disabled={isSavingOtpEmail}
                            className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                        >
                            {isSavingOtpEmail ? <Spinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {otpEmail ? "Update Email" : "Turn On"}
                        </Button>
                        {otpEmail && (
                            <>
                                <Button
                                    onClick={handleSendTestCode}
                                    disabled={isSendingTestCode}
                                    variant="outline"
                                    className="border-border/40 hover:bg-muted"
                                >
                                    {isSendingTestCode ? <Spinner size="sm" className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                    Send Test Code
                                </Button>
                                <Button
                                    onClick={() => handleSaveOtpEmail(true)}
                                    disabled={isSavingOtpEmail}
                                    variant="outline"
                                    className="border-border/40 hover:bg-destructive/10 hover:text-destructive"
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Turn Off
                                </Button>
                            </>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Use an inbox you can always reach. If codes ever stop arriving, the only way back in is to
                        delete the <code>admin_otp_email</code> setting from the database.
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-white border-border/40 backdrop-blur shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-red-600" />
                        <CardTitle>Competition Stage</CardTitle>
                    </div>
                    <CardDescription>
                        Pick the stage the competition is in right now. Each stage sets what voters see, which
                        poets are votable, and how results are counted in reports. For Danger Zone stages, when
                        the voting deadline passes the top poets are <strong>automatically moved to the
                        &ldquo;Revived&rdquo; team</strong> and the rest to &ldquo;Eliminated&rdquo; — then Assign
                        Team the revived poets onward.
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
                        <Clock className="w-5 h-5 text-primary" />
                        <CardTitle>Voting Schedule</CardTitle>
                    </div>
                    <CardDescription>
                        Both times are enforced automatically, even with no admin online. Before the start time,
                        the homepage shows a live &ldquo;Voting starts in…&rdquo; countdown and votes are rejected.
                        After the deadline, voting closes. Leave either empty to skip it.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Voting opens</p>
                        <div className="flex flex-wrap gap-3 items-center">
                            <Input
                                type="datetime-local"
                                value={startInput}
                                onChange={(e) => setStartInput(e.target.value)}
                                className="max-w-[240px]"
                            />
                            <Button
                                onClick={() => handleSaveStart(false)}
                                disabled={isSavingStart}
                                className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                            >
                                {isSavingStart ? <Spinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Set Start
                            </Button>
                            <Button
                                onClick={() => handleSaveStart(true)}
                                disabled={isSavingStart}
                                variant="outline"
                                className="border-border/40 hover:bg-muted"
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Remove
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Voting closes</p>
                        <div className="flex flex-wrap gap-3 items-center">
                            <Input
                                type="datetime-local"
                                value={deadlineInput}
                                onChange={(e) => setDeadlineInput(e.target.value)}
                                className="max-w-[240px]"
                            />
                            <Button
                                onClick={() => handleSaveDeadline(false)}
                                disabled={isSavingDeadline}
                                className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                            >
                                {isSavingDeadline ? <Spinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Set Deadline
                            </Button>
                            <Button
                                onClick={() => handleSaveDeadline(true)}
                                disabled={isSavingDeadline}
                                variant="outline"
                                className="border-border/40 hover:bg-muted"
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Remove
                            </Button>
                        </div>
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
