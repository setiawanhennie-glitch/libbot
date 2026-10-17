import { model, models, Schema } from "mongoose";

const UserQuotaLockSchema = new Schema({
  _id: { type: String, required: true },
  revision: { type: Number, default: 0, required: true },
}, { versionKey: false });

const UserQuotaLock = models.UserQuotaLock || model("UserQuotaLock", UserQuotaLockSchema);

export default UserQuotaLock;