import mongoose, { Schema, model, Model } from "mongoose";

export interface IMember {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  phoneNumber?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, trim: true, default: undefined },
    address: { type: String, trim: true, default: undefined },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Case-insensitive index to speed up name lookups and dedupe checks.
MemberSchema.index({ fullName: "text" });

export const Member: Model<IMember> =
  mongoose.models.Member || model<IMember>("Member", MemberSchema);
