import mongoose, { Schema, model, Model } from "mongoose";

export type AttendanceStatus = "present" | "absent";

export interface IAttendance {
  _id: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  status: AttendanceStatus;
  markedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    status: { type: String, enum: ["present", "absent"], default: "present" },
    markedAt: { type: Date },
  },
  { timestamps: true }
);

// One attendance record per member per service.
AttendanceSchema.index({ memberId: 1, serviceId: 1 }, { unique: true });

export const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ||
  model<IAttendance>("Attendance", AttendanceSchema);
