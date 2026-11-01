const crypto = require("crypto");
const mongoose = require("mongoose");

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["superadmin", "company_admin"],
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

adminUserSchema.methods.setPassword = function setPassword(password) {
  this.passwordSalt = crypto.randomBytes(16).toString("hex");
  this.passwordHash = crypto
    .pbkdf2Sync(password, this.passwordSalt, 120000, 64, "sha512")
    .toString("hex");
};

adminUserSchema.methods.verifyPassword = function verifyPassword(password) {
  const hash = crypto
    .pbkdf2Sync(password, this.passwordSalt, 120000, 64, "sha512")
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(this.passwordHash, "hex"));
};

adminUserSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    companyId: this.companyId,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("AdminUser", adminUserSchema);
