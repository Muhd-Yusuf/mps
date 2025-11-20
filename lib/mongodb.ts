import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose"

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable")
}

declare global {
  // eslint-disable-nexsst-line no-var
  var _mongoose: {
    conn: typeof mongoose | null
    promise: Promise<typeof mongoose> | null
  } | undefined
}

const cached = global._mongoose || { conn: null, promise: null }
global._mongoose = cached

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri!, {
      dbName: process.env.MONGODB_DB || "mps",
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}

const coachSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    image: { type: String, trim: true },
  },
  { _id: false }
)

const participantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    votes: { type: Number, default: 0 },
    image: { type: String, trim: true },
  },
  { timestamps: true }
)

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    coach: { type: coachSchema, required: true },
    participants: { type: [participantSchema], default: [] },
  },
  { timestamps: true }
)

export type TeamDocument = InferSchemaType<typeof teamSchema>

export const TeamModel: Model<TeamDocument> = mongoose.models.Team || mongoose.model("Team", teamSchema)

const ticketSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    votingCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    amount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    paystackReference: { type: String, trim: true },
    hasVoted: { type: Boolean, default: false },
    paidAt: { type: Date },
    paymentMetadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
)

export type TicketDocument = InferSchemaType<typeof ticketSchema>

export const TicketModel: Model<TicketDocument> = mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema)

const voteSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    participantId: { type: String, required: true },
    teamId: { type: String, required: true },
  },
  { timestamps: true }
)

export type VoteDocument = InferSchemaType<typeof voteSchema>

export const VoteModel: Model<VoteDocument> = mongoose.models.Vote || mongoose.model("Vote", voteSchema)

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { timestamps: true }
)

export type SettingDocument = InferSchemaType<typeof settingSchema>

export const SettingModel: Model<SettingDocument> =
  mongoose.models.Setting || mongoose.model("Setting", settingSchema)
