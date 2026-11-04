import mongoose, { Schema, model, Model } from "mongoose";

export interface IAdmin {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string; // bcrypt hash
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new Schema<IAdmin>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

// Guard against model re-registration during hot reload.
export const Admin: Model<IAdmin> =
  mongoose.models.Admin || model<IAdmin>("Admin", AdminSchema);
