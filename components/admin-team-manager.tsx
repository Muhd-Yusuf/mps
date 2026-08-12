"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Plus, UserPlus, Trash2, Edit2, Radio, Flame, ArrowRightLeft, Search } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

import type { Team, Participant } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AdminTeamManagerProps = {
  teams: Team[]
  isLoading: boolean
  onRefresh: () => Promise<void> | void
}

type ParticipantDraft = Pick<Participant, "name" | "image">

const emptyParticipant: ParticipantDraft = { name: "", image: "" }

const placeholderImage = "/placeholder.svg"

export default function AdminTeamManager({ teams, isLoading, onRefresh }: AdminTeamManagerProps) {
  const { toast } = useToast()
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [newTeamForm, setNewTeamForm] = useState({
    name: "",
    color: "#2563eb",
    coach: {
      name: "",
      email: "",
      phone: "",
      image: "",
    },
    participants: [{ ...emptyParticipant }],
  })

  const [isUploadingCoachImage, setIsUploadingCoachImage] = useState(false)
  const [participantUploadStatus, setParticipantUploadStatus] = useState<Record<number, boolean>>({})

  const [addParticipantDialog, setAddParticipantDialog] = useState({
    open: false,
    teamId: "",
  })
  const [participantRows, setParticipantRows] = useState<ParticipantDraft[]>([{ ...emptyParticipant }])
  const [dialogParticipantUploadStatus, setDialogParticipantUploadStatus] = useState<Record<number, boolean>>({})
  const [isAddingParticipants, setIsAddingParticipants] = useState(false)

  const [editTeamDialog, setEditTeamDialog] = useState({
    open: false,
    teamId: "",
  })
  const [editTeamForm, setEditTeamForm] = useState({
    name: "",
    color: "#2563eb",
    coach: {
      name: "",
      email: "",
      phone: "",
      image: "",
    },
    participants: [] as (ParticipantDraft & { id?: string })[],
  })
  const [isEditingTeam, setIsEditingTeam] = useState(false)
  const [isUploadingEditCoachImage, setIsUploadingEditCoachImage] = useState(false)
  const [editParticipantUploadStatus, setEditParticipantUploadStatus] = useState<Record<number, boolean>>({})

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    teamId: "",
    teamName: "",
  })
  const [isDeletingTeam, setIsDeletingTeam] = useState(false)
  const [togglingTeamId, setTogglingTeamId] = useState<string | null>(null)
  const [togglingDangerId, setTogglingDangerId] = useState<string | null>(null)
  const [movingParticipantId, setMovingParticipantId] = useState<string | null>(null)
  const [bulkFlaggingTeamId, setBulkFlaggingTeamId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const teamOptions = useMemo(() => teams ?? [], [teams])

  const selectedTeam = useMemo(
    () => teamOptions.find((team) => team.id === addParticipantDialog.teamId),
    [teamOptions, addParticipantDialog.teamId]
  )

  const teamToEdit = useMemo(
    () => teamOptions.find((team) => team.id === editTeamDialog.teamId),
    [teamOptions, editTeamDialog.teamId]
  )

  const resetTeamForm = () => {
    setNewTeamForm({
      name: "",
      color: "#2563eb",
      coach: {
        name: "",
        email: "",
        phone: "",
        image: "",
      },
      participants: [{ ...emptyParticipant }],
    })
  }

  const handleTeamInputChange = (field: string, value: string) => {
    setNewTeamForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCoachInputChange = (field: string, value: string) => {
    setNewTeamForm((prev) => ({
      ...prev,
      coach: {
        ...prev.coach,
        [field]: value,
      },
    }))
  }

  const handleParticipantDraftChange = (index: number, field: keyof ParticipantDraft, value: string) => {
    setNewTeamForm((prev) => {
      const participants = [...prev.participants]
      participants[index] = { ...participants[index], [field]: value }
      return { ...prev, participants }
    })
  }

  const addParticipantDraftRow = () => {
    setNewTeamForm((prev) => ({
      ...prev,
      participants: [...prev.participants, { ...emptyParticipant }],
    }))
  }

  const removeParticipantDraftRow = (index: number) => {
    setNewTeamForm((prev) => ({
      ...prev,
      participants: prev.participants.filter((_, idx) => idx !== index),
    }))
    setParticipantUploadStatus((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const uploadImage = async (file: File, folder: string) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", folder)

    const response = await fetch("/api/uploads/image", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error?.error ?? "Unable to upload image")
    }

    const data = await response.json()
    return data.url as string
  }

  const handleCoachImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingCoachImage(true)
      const url = await uploadImage(file, "coaches")
      handleCoachInputChange("image", url)
      toast({ title: "Coach photo uploaded" })
    } catch (error: any) {
      toast({
        title: "Coach photo upload failed",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setIsUploadingCoachImage(false)
      event.target.value = ""
    }
  }

  const handleParticipantImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, index: number, type: "form" | "dialog") => {
    const file = event.target.files?.[0]
    if (!file) return

    const setStatus = type === "form" ? setParticipantUploadStatus : setDialogParticipantUploadStatus
    const setParticipants = type === "form" ? setNewTeamForm : setParticipantRows

    try {
      setStatus((prev) => ({ ...prev, [index]: true }))
      const url = await uploadImage(file, type === "form" ? "participants" : "participants")
      if (type === "form") {
        setParticipants((prev: any) => {
          const participants = [...prev.participants]
          participants[index] = { ...participants[index], image: url }
          return { ...prev, participants }
        })
      } else {
        setParticipants((prev: ParticipantDraft[]) => {
          const next = [...prev]
          next[index] = { ...next[index], image: url }
          return next
        })
      }
      toast({ title: "Image uploaded" })
    } catch (error: any) {
      toast({
        title: "Image upload failed",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setStatus((prev) => ({ ...prev, [index]: false }))
      event.target.value = ""
    }
  }

  const clearCoachImage = () => {
    handleCoachInputChange("image", "")
  }

  const clearParticipantImage = (index: number, type: "form" | "dialog") => {
    if (type === "form") {
      setNewTeamForm((prev) => {
        const participants = [...prev.participants]
        participants[index] = { ...participants[index], image: "" }
        return { ...prev, participants }
      })
    } else {
      setParticipantRows((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], image: "" }
        return next
      })
    }
  }

  const handleCreateTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newTeamForm.name.trim() || !newTeamForm.coach.name.trim()) {
      toast({ title: "Please provide both team and coach names", variant: "destructive" })
      return
    }

    try {
      setIsCreatingTeam(true)
      const participantsPayload = newTeamForm.participants
        .filter((participant) => participant.name.trim().length)
        .map((participant) => ({
          name: participant.name.trim(),
          image: participant.image?.trim(),
        }))

      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeamForm.name,
          color: newTeamForm.color,
          coach: {
            name: newTeamForm.coach.name,
            email: newTeamForm.coach.email,
            phone: newTeamForm.coach.phone,
            image: newTeamForm.coach.image,
          },
          participants: participantsPayload,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to create team")
      }

      toast({ title: "Team created", description: `${newTeamForm.name} has been added successfully.` })
      resetTeamForm()
      await onRefresh?.()
    } catch (error: any) {
      toast({
        title: "Failed to create team",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setIsCreatingTeam(false)
    }
  }

  const openParticipantDialog = (teamId: string) => {
    setAddParticipantDialog({ open: true, teamId })
    setParticipantRows([{ ...emptyParticipant }])
  }

  const handleParticipantRowsChange = (index: number, field: keyof ParticipantDraft, value: string) => {
    setParticipantRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addParticipantRow = () => {
    setParticipantRows((prev) => [...prev, { ...emptyParticipant }])
  }

  const removeParticipantRow = (index: number) => {
    setParticipantRows((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleAddParticipants = async () => {
    const filtered = participantRows.filter((participant) => participant.name.trim().length)

    if (!addParticipantDialog.teamId || !filtered.length) {
      toast({ title: "Add poet details", description: "Include at least one poet name." })
      return
    }

    try {
      setIsAddingParticipants(true)

      const response = await fetch(`/api/teams/${addParticipantDialog.teamId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: filtered.map((participant) => ({
            name: participant.name.trim(),
            image: participant.image?.trim(),
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to add poets")
      }

      toast({
        title: "Poets added",
        description: `${filtered.length} poet(s) added to ${selectedTeam?.name ?? "the team"}.`,
      })
      setAddParticipantDialog({ open: false, teamId: "" })
      await onRefresh?.()
    } catch (error: any) {
      toast({
        title: "Failed to add poets",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setIsAddingParticipants(false)
    }
  }

  const openEditDialog = (team: Team) => {
    setEditTeamDialog({ open: true, teamId: team.id })
    setEditTeamForm({
      name: team.name,
      color: team.color,
      coach: {
        name: team.coach?.name ?? "",
        email: team.coach?.email ?? "",
        phone: team.coach?.phone ?? "",
        image: team.coach?.image ?? "",
      },
      participants: (team.participants || []).map((p) => ({
        // Carry the id so the server keeps votes/flags even when the poet is renamed.
        id: p.id,
        name: p.name,
        image: p.image ?? "",
      })),
    })
    setEditParticipantUploadStatus({})
  }

  const handleEditTeamInputChange = (field: string, value: string) => {
    setEditTeamForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleEditCoachInputChange = (field: string, value: string) => {
    setEditTeamForm((prev) => ({
      ...prev,
      coach: {
        ...prev.coach,
        [field]: value,
      },
    }))
  }

  const handleEditParticipantDraftChange = (index: number, field: keyof ParticipantDraft, value: string) => {
    setEditTeamForm((prev) => {
      const participants = [...prev.participants]
      participants[index] = { ...participants[index], [field]: value }
      return { ...prev, participants }
    })
  }

  const addEditParticipantDraftRow = () => {
    setEditTeamForm((prev) => ({
      ...prev,
      participants: [...prev.participants, { ...emptyParticipant }],
    }))
  }

  const removeEditParticipantDraftRow = (index: number) => {
    setEditTeamForm((prev) => ({
      ...prev,
      participants: prev.participants.filter((_, idx) => idx !== index),
    }))
    setEditParticipantUploadStatus((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const handleEditCoachImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingEditCoachImage(true)
      const url = await uploadImage(file, "coaches")
      handleEditCoachInputChange("image", url)
      toast({ title: "Coach photo uploaded" })
    } catch (error: any) {
      toast({
        title: "Coach photo upload failed",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setIsUploadingEditCoachImage(false)
      event.target.value = ""
    }
  }

  const handleEditParticipantImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setEditParticipantUploadStatus((prev) => ({ ...prev, [index]: true }))
      const url = await uploadImage(file, "participants")
      handleEditParticipantDraftChange(index, "image", url)
      toast({ title: "Image uploaded" })
    } catch (error: any) {
      toast({
        title: "Image upload failed",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setEditParticipantUploadStatus((prev) => ({ ...prev, [index]: false }))
      event.target.value = ""
    }
  }

  const handleUpdateTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editTeamForm.name.trim() || !editTeamForm.coach.name.trim()) {
      toast({ title: "Please provide both team and coach names", variant: "destructive" })
      return
    }

    try {
      setIsEditingTeam(true)
      const participantsPayload = editTeamForm.participants
        .filter((participant) => participant.name.trim().length)
        .map((participant) => ({
          id: (participant as any).id,
          name: participant.name.trim(),
          image: participant.image?.trim(),
        }))

      const response = await fetch(`/api/teams/${editTeamDialog.teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTeamForm.name,
          color: editTeamForm.color,
          coach: {
            name: editTeamForm.coach.name,
            email: editTeamForm.coach.email,
            phone: editTeamForm.coach.phone,
            image: editTeamForm.coach.image,
          },
          participants: participantsPayload,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to update team")
      }

      toast({ title: "Team updated", description: `${editTeamForm.name} has been updated successfully.` })
      setEditTeamDialog({ open: false, teamId: "" })
      await onRefresh?.()
    } catch (error: any) {
      toast({
        title: "Failed to update team",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setIsEditingTeam(false)
    }
  }

  const handleToggleVoting = async (team: Team) => {
    const nextOpen = !team.votingOpen
    try {
      setTogglingTeamId(team.id)
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingOpen: nextOpen }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to update voting status")
      }

      toast({
        title: nextOpen ? "Voting opened" : "Voting closed",
        description: nextOpen
          ? `${team.name} is now open for voting.`
          : `${team.name} is now closed for voting.`,
      })
      await onRefresh?.()
    } catch (error: any) {
      toast({
        title: "Failed to update voting status",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setTogglingTeamId(null)
    }
  }

  // Blind audition: flag poets no coach picked so they appear in the public
  // Danger Zone save vote (random list, no team grouping).
  const handleToggleDanger = async (team: Team, participant: Participant) => {
    const nextInDanger = !participant.inDanger
    try {
      setTogglingDangerId(participant.id)
      const response = await fetch(`/api/teams/${team.id}/participants/${participant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inDanger: nextInDanger }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to update Danger Zone status")
      }

      toast({
        title: nextInDanger ? "Added to Danger Zone" : "Removed from Danger Zone",
        description: nextInDanger
          ? `${participant.name} will appear in the Danger Zone save vote.`
          : `${participant.name} is no longer in the Danger Zone.`,
      })
      await onRefresh?.()
    } catch (error: any) {
      toast({
        title: "Failed to update Danger Zone status",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setTogglingDangerId(null)
    }
  }

  // New-stage setup: flag (or unflag) every poet in a team in one click, e.g.
  // when the whole surviving roster faces the audience vote in the next stage.
  const handleBulkDanger = async (team: Team, flagAll: boolean) => {
    const message = flagAll
      ? `Flag ALL ${team.participants?.length ?? 0} poets in ${team.name} as Danger Zone?`
      : `Remove the Danger Zone flag from every poet in ${team.name}?`
    if (!confirm(message)) return
    try {
      setBulkFlaggingTeamId(team.id)
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dangerAll: flagAll }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to update flags")
      }
      toast({
        title: flagAll ? "Whole team flagged" : "Flags cleared",
        description: flagAll
          ? `Every poet in ${team.name} is now in the Danger Zone vote.`
          : `No poet in ${team.name} is flagged anymore.`,
      })
      await onRefresh?.()
    } catch (error: any) {
      toast({
        title: "Failed to update flags",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setBulkFlaggingTeamId(null)
    }
  }

  // Blind Audition flow: when a coach picks a poet, move them from the
  // "Contestants" pool into that coach's team. Votes and photo travel along.
  const handleMoveParticipant = async (fromTeam: Team, participant: Participant, toTeam: Team) => {
    try {
      setMovingParticipantId(participant.id)
      const response = await fetch(`/api/teams/${fromTeam.id}/participants/${participant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toTeamId: toTeam.id }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to move poet")
      }

      toast({
        title: "Poet moved",
        description: `${participant.name} is now in ${toTeam.name}.`,
      })
      await onRefresh?.()
    } catch (error: any) {
      toast({
        title: "Failed to move poet",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setMovingParticipantId(null)
    }
  }

  const openDeleteDialog = (team: Team) => {
    setDeleteDialog({ open: true, teamId: team.id, teamName: team.name })
  }

  const handleDeleteTeam = async () => {
    try {
      setIsDeletingTeam(true)

      const response = await fetch(`/api/teams/${deleteDialog.teamId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to delete team")
      }

      toast({ title: "Team deleted", description: `${deleteDialog.teamName} has been deleted successfully.` })
      setDeleteDialog({ open: false, teamId: "", teamName: "" })
      await onRefresh?.()
    } catch (error: any) {
      toast({
        title: "Failed to delete team",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    } finally {
      setIsDeletingTeam(false)
    }
  }

  const hasTeams = teamOptions?.length > 0

  return (
    <div className="space-y-8">
      <Card className="border-border/40 bg-white backdrop-blur">
            <CardHeader>
          <CardTitle>Add a New Team</CardTitle>
          <CardDescription>Create teams, assign a coach, and preload poets.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleCreateTeam}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={newTeamForm.name}
                  onChange={(event) => handleTeamInputChange("name", event.target.value)}
                  placeholder="Team Mu'ammar"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamColor">Team Color</Label>
                <Input
                  id="teamColor"
                  type="color"
                  value={newTeamForm.color}
                  onChange={(event) => handleTeamInputChange("color", event.target.value)}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Coach Details</h3>
                <p className="text-xs text-muted-foreground">Coach information is required for every team.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="coachName">Coach Name</Label>
                  <Input
                    id="coachName"
                    value={newTeamForm.coach.name}
                    onChange={(event) => handleCoachInputChange("name", event.target.value)}
                    placeholder="Coach Mu'ammar"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coachPhoto">Coach Photo</Label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border/40 bg-muted">
                      {newTeamForm.coach.image ? (
                        <Image src={newTeamForm.coach.image} alt="Coach photo" fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No photo</div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <Input
                        id="coachPhoto"
                        type="file"
                        accept="image/*"
                        onChange={handleCoachImageUpload}
                        disabled={isUploadingCoachImage}
                      />
                      <div className="flex gap-2">
                        {isUploadingCoachImage && (
                          <span className="text-xs text-muted-foreground flex items-center gap-2">
                            <Spinner size="sm" /> Uploading...
                          </span>
                        )}
                        {newTeamForm.coach.image && (
                          <Button type="button" variant="ghost" size="sm" onClick={clearCoachImage}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">PNG or JPG, up to 2MB.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coachEmail">Coach Email</Label>
                  <Input
                    id="coachEmail"
                    type="email"
                    value={newTeamForm.coach.email}
                    onChange={(event) => handleCoachInputChange("email", event.target.value)}
                    placeholder="coach@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coachPhone">Coach Phone</Label>
                  <Input
                    id="coachPhone"
                    value={newTeamForm.coach.phone}
                    onChange={(event) => handleCoachInputChange("phone", event.target.value)}
                    placeholder="+234 810 000 0000"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">Poets</h3>
                  <p className="text-xs text-muted-foreground">
                    Optional: preload poets for this team. You can add more later.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addParticipantDraftRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Poet
                </Button>
              </div>

              <div className="space-y-4">
                {newTeamForm.participants.map((participant, index) => (
                  <div key={`participant-${index}`} className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`participant-name-${index}`}>Name</Label>
                      <Input
                        id={`participant-name-${index}`}
                        value={participant.name}
                        onChange={(event) => handleParticipantDraftChange(index, "name", event.target.value)}
                        placeholder="Poet name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`participant-image-${index}`}>Poet Photo</Label>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-border/40 bg-muted">
                            {participant.image ? (
                              <Image src={participant.image} alt={`${participant.name || "Poet"} photo`} fill className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No photo</div>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <Input
                              id={`participant-image-${index}`}
                              type="file"
                              accept="image/*"
                              onChange={(event) => handleParticipantImageUpload(event, index, "form")}
                              disabled={participantUploadStatus[index]}
                            />
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {participantUploadStatus[index] && (
                                <span className="flex items-center gap-2">
                                  <Spinner size="sm" /> Uploading...
                                </span>
                              )}
                              {participant.image && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => clearParticipantImage(index, "form")}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Remove Photo
                                </Button>
                              )}
                              {newTeamForm.participants.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeParticipantDraftRow(index)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Row
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Upload poet headshot.</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isCreatingTeam}>
              {isCreatingTeam ? <Spinner size="sm" className="mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
              {isCreatingTeam ? "Creating team..." : "Create Team"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {isLoading && (
          <Card className="border-border/40 bg-white backdrop-blur">
            <CardContent className="py-10 text-center text-muted-foreground">Loading teams...</CardContent>
          </Card>
        )}

        {!isLoading && !hasTeams && (
          <Card className="border-dashed border-border/50 bg-white backdrop-blur">
            <CardContent className="py-10 text-center text-muted-foreground">
              No teams yet. Create your first team above to get started.
            </CardContent>
          </Card>
        )}

        {!isLoading && hasTeams && (
          <Card className="border-border/40 bg-white backdrop-blur">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search poets or teams by name…"
                  className="pl-9"
                />
              </div>
              {search.trim() && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {teamOptions.reduce(
                    (sum, t) =>
                      sum +
                      (t.participants ?? []).filter((p) =>
                        p.name.toLowerCase().includes(search.trim().toLowerCase())
                      ).length,
                    0
                  )}{" "}
                  poet(s) match &ldquo;{search.trim()}&rdquo;
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {teamOptions.map((team) => {
          const query = search.trim().toLowerCase()
          const allParticipants = team.participants ?? []
          const teamParticipants = query
            ? allParticipants.filter((p) => p.name.toLowerCase().includes(query))
            : allParticipants

          // While searching, hide teams with no matching poets (unless the
          // team name itself matches the query).
          if (query && teamParticipants.length === 0 && !team.name.toLowerCase().includes(query)) {
            return null
          }

          return (
            <Card key={team.id} className="bg-white border-border/40">
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border/40">
                    <Image
                        src={team.coach?.image || placeholderImage}
                        alt={team.coach?.name ?? "Coach"}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-foreground">{team.name}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Coach: {team.coach?.name ?? "Unknown"} • {teamParticipants.length} poet
                        {teamParticipants.length === 1 ? "" : "s"}
                    </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={team.votingOpen ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleVoting(team)}
                      disabled={togglingTeamId === team.id}
                      className={team.votingOpen ? "" : "border-border/40 hover:bg-muted"}
                    >
                      {togglingTeamId === team.id ? (
                        <Spinner size="sm" className="mr-2" />
                      ) : (
                        <Radio className="mr-2 h-4 w-4" />
                      )}
                      {team.votingOpen ? "Close Voting" : "Open Voting"}
                    </Button>
                    {allParticipants.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleBulkDanger(team, !allParticipants.every((p) => p.inDanger))
                        }
                        disabled={bulkFlaggingTeamId === team.id}
                        className={
                          allParticipants.every((p) => p.inDanger)
                            ? "border-red-600/50 text-red-600 hover:bg-red-50 hover:border-red-600"
                            : "border-border/40 hover:bg-muted"
                        }
                      >
                        {bulkFlaggingTeamId === team.id ? (
                          <Spinner size="sm" className="mr-2" />
                        ) : (
                          <Flame className="mr-2 h-4 w-4" />
                        )}
                        {allParticipants.every((p) => p.inDanger) ? "Clear All Flags" : "Flag All Danger"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(team)}
                      className="border-border/40 hover:bg-muted"
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                     
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openParticipantDialog(team.id)}
                      className="border-border/40 hover:bg-muted"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Poet
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(team)}
                      className="border-red-600/50 text-red-600 hover:bg-red-50 hover:border-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      
                    </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                  {teamParticipants.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border/40 p-4 text-center text-sm text-muted-foreground">
                      No poets yet. Use the button above to add the first poet.
                    </div>
                  )}
                {teamParticipants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                      <div className="flex flex-1 items-center gap-3">
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-border/40">
                        <Image
                            src={participant.image || placeholderImage}
                          alt={participant.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{participant.name}</p>
                          <p className="text-sm text-muted-foreground">{participant.votes ?? 0} votes</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {participant.originTeam && (
                          <Badge variant="outline" className="text-muted-foreground border-border/60">
                            from {participant.originTeam}
                          </Badge>
                        )}
                        {participant.inDanger && (
                          <Badge className="bg-red-600 text-white hover:bg-red-600">Danger Zone</Badge>
                        )}
                        <Badge variant="outline" className="text-foreground">
                          {participant.votes && participant.votes > 0 ? "Competing" : "New"}
                        </Badge>
                        {teams.length > 1 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={movingParticipantId === participant.id}
                                className="border-border/40 hover:bg-muted"
                              >
                                {movingParticipantId === participant.id ? (
                                  <Spinner size="sm" className="mr-2" />
                                ) : (
                                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                                )}
                                Assign Team
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Assign {participant.name} to…</DropdownMenuLabel>
                              {teams
                                .filter((t) => t.id !== team.id)
                                .map((t) => (
                                  <DropdownMenuItem
                                    key={t.id}
                                    onClick={() => handleMoveParticipant(team, participant, t)}
                                  >
                                    <span
                                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: t.color }}
                                    />
                                    {t.name}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleDanger(team, participant)}
                          disabled={togglingDangerId === participant.id}
                          className={
                            participant.inDanger
                              ? "border-red-600/50 text-red-600 hover:bg-red-50 hover:border-red-600"
                              : "border-border/40 hover:bg-muted"
                          }
                        >
                          {togglingDangerId === participant.id ? (
                            <Spinner size="sm" className="mr-2" />
                          ) : (
                            <Flame className="mr-2 h-4 w-4" />
                          )}
                          {participant.inDanger ? "Remove from Danger" : "Danger Zone"}
                        </Button>
                      </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
      </div>

      <Dialog
        open={addParticipantDialog.open}
        onOpenChange={(open) => {
          setAddParticipantDialog((prev) => ({ ...prev, open }))
          if (!open) {
            setParticipantRows([{ ...emptyParticipant }])
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Poets</DialogTitle>
            <DialogDescription>
              Add one or more poets to {selectedTeam?.name ?? "the selected team"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {participantRows.map((participant, index) => (
              <div key={`dialog-participant-${index}`} className="space-y-3 rounded-md border border-border/40 p-4">
                <div className="space-y-2">
                  <Label htmlFor={`dialog-participant-name-${index}`}>Poet Name</Label>
                  <Input
                    id={`dialog-participant-name-${index}`}
                    value={participant.name}
                    onChange={(event) => handleParticipantRowsChange(index, "name", event.target.value)}
                    placeholder="Poet name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`dialog-participant-image-${index}`}>Poet Photo</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-full border border-border/40 bg-muted">
                      {participant.image ? (
                        <Image src={participant.image} alt={`${participant.name || "Poet"} photo`} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No photo</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        id={`dialog-participant-image-${index}`}
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleParticipantImageUpload(event, index, "dialog")}
                        disabled={dialogParticipantUploadStatus[index]}
                      />
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {dialogParticipantUploadStatus[index] && (
                          <span className="flex items-center gap-2">
                            <Spinner size="sm" /> Uploading...
                          </span>
                        )}
                        {participant.image && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => clearParticipantImage(index, "dialog")}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remove Photo
                          </Button>
                        )}
                        {participantRows.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeParticipantRow(index)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Row
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full" onClick={addParticipantRow}>
              <Plus className="mr-2 h-4 w-4" />
              Add another poet
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAddParticipantDialog({ open: false, teamId: "" })}>
              Cancel
            </Button>
            <Button onClick={handleAddParticipants} disabled={isAddingParticipants}>
              {isAddingParticipants ? <Spinner size="sm" className="mr-2" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {isAddingParticipants ? "Saving..." : "Save Poets"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editTeamDialog.open}
        onOpenChange={(open) => {
          setEditTeamDialog({ open, teamId: "" })
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update team information, coach details, and poets.</DialogDescription>
          </DialogHeader>

          <form className="space-y-6" onSubmit={handleUpdateTeam}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-teamName">Team Name</Label>
                <Input
                  id="edit-teamName"
                  value={editTeamForm.name}
                  onChange={(event) => handleEditTeamInputChange("name", event.target.value)}
                  placeholder="Team Mu'ammar"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-teamColor">Team Color</Label>
                <Input
                  id="edit-teamColor"
                  type="color"
                  value={editTeamForm.color}
                  onChange={(event) => handleEditTeamInputChange("color", event.target.value)}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Coach Details</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-coachName">Coach Name</Label>
                  <Input
                    id="edit-coachName"
                    value={editTeamForm.coach.name}
                    onChange={(event) => handleEditCoachInputChange("name", event.target.value)}
                    placeholder="Coach Mu'ammar"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-coachPhoto">Coach Photo</Label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border/40 bg-muted">
                      {editTeamForm.coach.image ? (
                        <Image src={editTeamForm.coach.image} alt="Coach photo" fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No photo</div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <Input
                        id="edit-coachPhoto"
                        type="file"
                        accept="image/*"
                        onChange={handleEditCoachImageUpload}
                        disabled={isUploadingEditCoachImage}
                      />
                      {isUploadingEditCoachImage && (
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <Spinner size="sm" /> Uploading...
                        </span>
                      )}
                      {editTeamForm.coach.image && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleEditCoachInputChange("image", "")}>
                          <Trash2 className="mr-2 h-4 w-4" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-coachEmail">Coach Email</Label>
                  <Input
                    id="edit-coachEmail"
                    type="email"
                    value={editTeamForm.coach.email}
                    onChange={(event) => handleEditCoachInputChange("email", event.target.value)}
                    placeholder="coach@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-coachPhone">Coach Phone</Label>
                  <Input
                    id="edit-coachPhone"
                    value={editTeamForm.coach.phone}
                    onChange={(event) => handleEditCoachInputChange("phone", event.target.value)}
                    placeholder="+234 810 000 0000"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">Poets</h3>
                  <p className="text-xs text-muted-foreground">Update poet information for this team.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addEditParticipantDraftRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Poet
                </Button>
              </div>

              <div className="space-y-4">
                {editTeamForm.participants.map((participant, index) => (
                  <div key={`edit-participant-${index}`} className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-participant-name-${index}`}>Name</Label>
                      <Input
                        id={`edit-participant-name-${index}`}
                        value={participant.name}
                        onChange={(event) => handleEditParticipantDraftChange(index, "name", event.target.value)}
                        placeholder="Poet name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-participant-image-${index}`}>Poet Photo</Label>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-border/40 bg-muted">
                            {participant.image ? (
                              <Image src={participant.image} alt={`${participant.name || "Poet"} photo`} fill className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No photo</div>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <Input
                              id={`edit-participant-image-${index}`}
                              type="file"
                              accept="image/*"
                              onChange={(event) => handleEditParticipantImageUpload(event, index)}
                              disabled={editParticipantUploadStatus[index]}
                            />
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {editParticipantUploadStatus[index] && (
                                <span className="flex items-center gap-2">
                                  <Spinner size="sm" /> Uploading...
                                </span>
                              )}
                              {participant.image && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => handleEditParticipantDraftChange(index, "image", "")}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Remove Photo
                                </Button>
                              )}
                              {editTeamForm.participants.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeEditParticipantDraftRow(index)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Row
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditTeamDialog({ open: false, teamId: "" })}>
                Cancel
              </Button>
              <Button type="submit" disabled={isEditingTeam}>
                {isEditingTeam ? <Spinner size="sm" className="mr-2" /> : <Edit2 className="mr-2 h-4 w-4" />}
                {isEditingTeam ? "Updating..." : "Update Team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, teamId: "", teamName: "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the team <strong>{deleteDialog.teamName}</strong> and all its participants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTeam}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam} disabled={isDeletingTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingTeam ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Team"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
