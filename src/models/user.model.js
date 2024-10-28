import { model, Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    country: {
      type: String,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    avatar: {
      type: String,
      // required: true,
    },
    coverImage: {
      type: String,
    },
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    password: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
    },
    verifyCode: {
      type: String,
    },
    verifyCodeExpiry: {
      type: Number,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lastPasswordChange: {
      type: Date,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (!config.bcrypt || !config.bcrypt.salt) {
    throw new Error("Salt is not defined in the configuration");
  }
  this.password = this.password.trim();
  this.password = await bcrypt.hash(this.password, parseInt(config.bcrypt.salt));
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password?.trim(), this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, username: this.username, fullName: this.fullName },
    config.jwt.access_token_secret,
    {
      expiresIn: config.jwt.access_token_expiry,
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id, email: this.email, username: this.username }, config.jwt.refresh_token_secret, {
    expiresIn: config.jwt.refresh_token_expiry,
  });
};
export const User = model("User", userSchema);
