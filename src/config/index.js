export const config = {
  port: process.env.PORT || 5000,
  db_url: process.env.DATABASE_URL,
  from_email: process.env.FROM_EMAIL,
  clientUrl: process.env.NODE_ENV === "production" ? "https://uptube.vercel.app" : "http://localhost:3000",
  constants: {
    db_name: "up-tube",
    limit: "100mb",
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
    salt: process.env.BCRYPT_SALT || 10,
  },
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  redis: {
    passowrd: process.env.REDIS_PASSWORD,
    host: process.env.REDIS_HOST,
    port: 19979,
  },
};
