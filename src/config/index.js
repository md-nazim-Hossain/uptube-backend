import { DB_NAME, LIMIT } from "../constants.js";

export const config = {
  port: process.env.PORT || 5000,
  db_url: process.env.DATABASE_URL,
  cors_origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  constants: {
    db_name: DB_NAME,
    limit: LIMIT,
  },
  jwt: {
    access_token_secret: process.env.JWT_ACCESS_TOKEN_SECRET,
    access_token_expiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || "1d",
    refresh_token_secret: process.env.JWT_REFRESH_TOKEN_SECRET,
    refresh_token_expiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || "365d",
  },
  bcrypt: {
    salt: process.env.BCRYPT_SALT || 10,
  },
};
