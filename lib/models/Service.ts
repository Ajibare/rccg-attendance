import mongoose, { Schema, model, Model } from "mongoose";

export interface IService {
  _id: mongoose.Types.ObjectId;
  title: string;
  serviceDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    title: { type: String, required: true, trim: true },
    serviceDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Service: Model<IService> =
  mongoose.models.Service || model<IService>("Service", ServiceSchema);
