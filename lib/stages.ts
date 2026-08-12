// Competition stage presets — modelled on the Official Contestants' Manual.
// The competition runs per subregion (Bauchi, Kaduna, Nasarawa) and then the
// Regional Finals in Abuja. Each public-voting stage has its own mechanics:
//
//   Blind Audition  — poets no coach picked enter the Danger Zone; audience
//                     revives the top 6 (flat random list, no team grouping).
//   Battle Round    — losing poets from the head-to-head battles; audience
//                     revives the top 5 (flat random list).
//   Knockout Stage  — audience vote runs alongside the judges; the top 4
//                     audience-voted poets advance to the Regional Finals.
//   Quarter Final   — 5 new teams in Abuja; audience advances the top 2 POETS
//                     PER TEAM (normal team voting, results sliced per team).
//   Semi Final      — 4 poets per team enter the Danger Zone; the audience
//                     saves the top 1 PER TEAM (danger list grouped by team).
//
// A stage preset bundles the low-level voting mechanic ("teams" | "danger")
// with the voter-facing copy, the list layout, and how results are counted.
// Screening and the Grand Finale have no public voting, so they have no preset.

export type VotingMode = "teams" | "danger"

export type ResultRule = {
  // "overall" ranks every votable poet in one list; "perTeam" ranks within each team.
  slice: "overall" | "perTeam"
  // How many advance/are revived (per team when slice is "perTeam").
  advance: number
  // Label shown next to qualifying poets in results and reports.
  advanceLabel: string
}

export type StagePreset = {
  key: string
  name: string
  // What the public homepage banner shows while this stage is live.
  // Empty string = fall back to the admin's custom banner text.
  publicLabel: string
  mode: VotingMode
  // Danger-list layout: flat shuffled list vs grouped under team headers.
  dangerLayout?: "flat" | "grouped"
  accentColor: string
  heading: string
  description: string
  // What the admin must set up before switching to this stage.
  adminPrep: string
  results: ResultRule
}

export const DANGER_COLOR = "#DC2626"
export const BRAND_COLOR = "#667EEA"

export const STAGE_PRESETS: StagePreset[] = [
  {
    key: "team_voting",
    publicLabel: "",
    name: "Team Voting (General)",
    mode: "teams",
    accentColor: BRAND_COLOR,
    heading: "Cast Your Vote",
    description: "Choose the one poet you want to support. Each voting code gives you a single vote.",
    adminPrep: "Open voting on the teams that should appear, from the Teams tab.",
    results: { slice: "overall", advance: 0, advanceLabel: "" },
  },
  {
    key: "blind_audition",
    publicLabel: "Blind Audition — Danger Zone",
    name: "Blind Audition — Danger Zone",
    mode: "danger",
    dangerLayout: "flat",
    accentColor: DANGER_COLOR,
    heading: "Danger Zone",
    description:
      "Choose who you want to keep in the competition. These poets were not picked by any coach — your vote decides who stays.",
    adminPrep: "Flag every poet no coach picked as Danger Zone, from the Teams tab.",
    results: { slice: "overall", advance: 6, advanceLabel: "REVIVED" },
  },
  {
    key: "battle_round",
    publicLabel: "Battle Round — Revival Vote",
    name: "Battle Round — Revival",
    mode: "danger",
    // Battle poets already belong to coach teams, so the danger list shows
    // them under their team banner (unlike the blind audition, where the
    // whole point is that no coach picked them).
    dangerLayout: "grouped",
    accentColor: DANGER_COLOR,
    heading: "Danger Zone",
    description:
      "These poets lost their head-to-head battles. Choose who you want to keep in the competition — your vote decides who is revived.",
    adminPrep: "Flag the poets who lost their battles (and were not Saved or Stolen) as Danger Zone.",
    results: { slice: "overall", advance: 5, advanceLabel: "REVIVED" },
  },
  {
    key: "knockout",
    publicLabel: "Knockout Stage — Audience Vote",
    name: "Knockout Stage — Audience Vote",
    mode: "danger",
    // Knockout poets belong to coach teams — show them team by team.
    dangerLayout: "grouped",
    accentColor: BRAND_COLOR,
    heading: "Audience Vote",
    description:
      "The judges have made their picks — now it's your turn. Vote for the poet you want to send to the Arewa Regional Finals in Abuja.",
    adminPrep: "Flag the poets still in contention for the audience slots as Danger Zone.",
    results: { slice: "overall", advance: 4, advanceLabel: "ADVANCES" },
  },
  {
    key: "quarter_final",
    publicLabel: "Quarter Final — Abuja",
    name: "Quarter Final (Abuja)",
    mode: "teams",
    accentColor: BRAND_COLOR,
    heading: "Cast Your Vote",
    description:
      "Vote for the poet you want to advance to the Semi Final. The top two audience-voted poets from each team go through.",
    adminPrep: "Create the 5 new Abuja teams and open voting on them, from the Teams tab.",
    results: { slice: "perTeam", advance: 2, advanceLabel: "ADVANCES" },
  },
  {
    key: "semi_final",
    publicLabel: "Semi Final — Danger Zone",
    name: "Semi Final — Danger Zone",
    mode: "danger",
    dangerLayout: "grouped",
    accentColor: DANGER_COLOR,
    heading: "Danger Zone",
    description:
      "One poet per team was chosen by the judges. The rest are in the Danger Zone — vote to save one more poet from each team for the Grand Finale.",
    adminPrep: "Flag the four non-finalist poets in each team as Danger Zone.",
    results: { slice: "perTeam", advance: 1, advanceLabel: "SAVED" },
  },
]

export const DEFAULT_PRESET_KEY = "team_voting"

export function getPreset(key: string | null | undefined): StagePreset {
  return STAGE_PRESETS.find((p) => p.key === key) ?? STAGE_PRESETS[0]
}

// Legacy fallback: sessions that only have voting_mode stored map onto the
// closest preset so nothing breaks mid-competition.
export function presetFromMode(mode: string | null | undefined): StagePreset {
  return getPreset(mode === "danger" ? "blind_audition" : DEFAULT_PRESET_KEY)
}
