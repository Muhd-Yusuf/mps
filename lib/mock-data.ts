import type { Team, Participant, Ticket, VotingTicket } from "./types"

export const teams: Team[] = [
  {
    id: "team-1",
    name: "Team Mu'ammar",
    color: "#FF6B6B",
    coach: {
      name: "Mu'ammar",
      image: "/hausa-man-coach-mu-ammar.jpg",
    },
  },
  {
    id: "team-2",
    name: "Team Nasir",
    color: "#4ECDC4",
    coach: {
      name: "Nasir",
      image: "/hausa-man-coach-nasir.jpg",
    },
  },
  {
    id: "team-3",
    name: "Team Indabawa",
    color: "#95E1D3",
    coach: {
      name: "Indabawa",
      image: "/hausa-man-coach-indabawa.jpg",
    },
  },
  {
    id: "team-4",
    name: "Team Abba",
    color: "#FFE66D",
    coach: {
      name: "Abba",
      image: "/hausa-man-coach-abba.jpg",
    },
  },
  {
    id: "team-5",
    name: "Team Aisha Ize",
    color: "#A8E6CF",
    coach: {
      name: "Aisha Ize",
      image: "/hausa-woman-coach-aisha.jpg",
    },
  },
]

export const participants: Participant[] = [
  // Team 1 - Team Mu'ammar
  {
    id: "p-1",
    teamId: "team-1",
    name: "Fatima Musa",
    votes: 245,
    image: "/hausa-woman-fatima.jpg",
  },
  {
    id: "p-2",
    teamId: "team-1",
    name: "Zainab Hassan",
    votes: 189,
    image: "/hausa-woman-zainab.jpg",
  },
  {
    id: "p-3",
    teamId: "team-1",
    name: "Amina Sani",
    votes: 156,
    image: "/hausa-woman-amina.jpg",
  },
  {
    id: "p-3b",
    teamId: "team-1",
    name: "Hadiza Bello",
    votes: 142,
    image: "/hausa-woman-hadiza.jpg",
  },

  // Team 2 - Team Nasir
  {
    id: "p-4",
    teamId: "team-2",
    name: "Aisha Karim",
    votes: 312,
    image: "/hausa-woman-aisha.jpg",
  },
  {
    id: "p-5",
    teamId: "team-2",
    name: "Mariam Adamu",
    votes: 198,
    image: "/hausa-woman-mariam.jpg",
  },
  {
    id: "p-6",
    teamId: "team-2",
    name: "Noor Ibrahim",
    votes: 167,
    image: "/hausa-woman-noor.jpg",
  },
  {
    id: "p-6b",
    teamId: "team-2",
    name: "Laila Yusuf",
    votes: 178,
    image: "/hausa-woman-laila.jpg",
  },

  // Team 3 - Team Indabawa
  {
    id: "p-7",
    teamId: "team-3",
    name: "Hawa Musa",
    votes: 234,
    image: "/hausa-woman-hawa.jpg",
  },
  {
    id: "p-8",
    teamId: "team-3",
    name: "Safiya Abdullahi",
    votes: 201,
    image: "/hausa-woman-safiya.jpg",
  },
  {
    id: "p-9",
    teamId: "team-3",
    name: "Rukhsana Ali",
    votes: 145,
    image: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "p-9b",
    teamId: "team-3",
    name: "Yasmin Suleiman",
    votes: 189,
    image: "/placeholder.svg?height=40&width=40",
  },

  // Team 4 - Team Abba
  {
    id: "p-10",
    teamId: "team-4",
    name: "Halima Rashid",
    votes: 289,
    image: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "p-11",
    teamId: "team-4",
    name: "Zara Mohammed",
    votes: 176,
    image: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "p-12",
    teamId: "team-4",
    name: "Leila Hassan",
    votes: 198,
    image: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "p-12b",
    teamId: "team-4",
    name: "Nadia Karim",
    votes: 165,
    image: "/placeholder.svg?height=40&width=40",
  },

  // Team 5 - Team Aisha Ize
  {
    id: "p-13",
    teamId: "team-5",
    name: "Salma Ismail",
    votes: 267,
    image: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "p-14",
    teamId: "team-5",
    name: "Amara Bello",
    votes: 213,
    image: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "p-15",
    teamId: "team-5",
    name: "Dina Sani",
    votes: 154,
    image: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "p-15b",
    teamId: "team-5",
    name: "Rania Yusuf",
    votes: 201,
    image: "/placeholder.svg?height=40&width=40",
  },
]

export const mockTickets: Ticket[] = [
  {
    id: "ticket-1",
    email: "voter1@example.com",
    purchaseDate: new Date("2025-01-15"),
    votes: [],
  },
]

export const mockVotingTickets: VotingTicket[] = [
  {
    id: "vt-1",
    email: "demo@example.com",
    votingCode: "MPS-2025-ABC123",
    purchaseDate: new Date(),
    amount: 2000,
    isPaid: true,
  },
  {
    id: "vt-2",
    email: "voter@example.com",
    votingCode: "MPS-2025-XYZ789",
    purchaseDate: new Date(),
    amount: 2000,
    isPaid: true,
  },
]
