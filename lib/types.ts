export interface Coach {
  name: string
  email?: string
  phone?: string
  image?: string
}

export interface Participant {
  id: string
  teamId?: string
  name: string
  votes: number
  image?: string
  createdAt?: string
  updatedAt?: string
}

export interface Team {
  id: string
  name: string
  color: string
  coach: Coach
  participants?: Participant[]
  votingOpen?: boolean
  order?: number
  createdAt?: string
  updatedAt?: string
}

export interface Vote {
  id: string
  participantId: string
  ticketId: string
  timestamp: Date
}

export type VoteSelection = {
  teamId: string
  participantId: string
}[]

export interface Ticket {
  id: string;
  email: string;
  votingCode: string;
  amount: number;
  isPaid: boolean;
  paystackReference?: string;
  hasVoted: boolean;
  roundTeamId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VotingSession {
  code: string
  email: string
  selections: VoteSelection
  verified: boolean
  votedAt?: Date
}
