import { DB_NAME, LIMIT } from "../constants.js";

export const config = {
  port: process.env.PORT || 5000,
  db_url: process.env.DATABASE_URL,
  resend_api_key: process.env.RESEND_API_KEY,
  from_email: "Acme <onboarding@resend.dev>",
  clientUrl: process.env.NODE_ENV === "production" ? "https://up-tube.vercel.app" : "http://localhost:3000",
  constants: {
    db_name: DB_NAME,
    limit: LIMIT,
  },
  jwt: {
    access_token_secret: process.env.JWT_ACCESS_TOKEN_SECRET,
    access_token_expiry: "3d",
    refresh_token_secret: process.env.JWT_REFRESH_TOKEN_SECRET,
    refresh_token_expiry: "365d",
    reset_password_token_secret: process.env.JWT_RESET_PASSWORD_TOKEN_SECRET,
    reset_password_token_expiry: "1h",
  },
  bcrypt: {
    salt: +process.env.BCRYPT_SALT || 10,
  },
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
};
