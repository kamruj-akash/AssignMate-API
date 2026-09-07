// Bun auto-loads .env locally and Render injects env vars straight into the
// process, so no dotenv shim is needed. `loadEnvFile` covers plain `node`
// invocations; it throws when there is no .env, which is the normal case on the
// platform.
try {
  process.loadEnvFile?.();
} catch {
  // no local .env file — env vars come from the platform
}

const envConfig = {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  backend_url: process.env.BACKEND_URL,
  api_base_url: process.env.APP_BASE_URL,
  frontend_url: process.env.FRONTEND_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS as string,

  // jwt
  jwt_access_secret: process.env.JWT_ACCESS_SECRET as string,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET as string,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN as string,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN as string,

  // google auth
  gClient_id: process.env.GOOGLE_CLIENT_ID as string,
  gClient_secret: process.env.GOOGLE_CLIENT_SECRET as string,
  gRedirect_url: process.env.GOOGLE_REDIRECT_URL as string,

  // resend email
  resend_api: process.env.RESEND_API as string,
  email_from_name: process.env.EMAIL_FROM_NAME || "AssignMate",
  email_from_address: process.env.RESEND_EMAIL,
  email_reply_to: process.env.RESEND_EMAIL,
  support_email: process.env.SUPPORT_EMAIL || "assign_mate@withakash.dev",

  // redis
  redis_url: process.env.REDIS_URL,

  // cloudinary
  cloudinary_cloud_name: process.env.CLOUDINARY_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_SECRET,

  // bKash
  bkash_url: process.env.BKASH_BASE_URL as string,
  bkash_user: process.env.BKASH_USERNAME as string,
  bkash_pass: process.env.BKASH_PASSWORD as string,
  bkash_app_key: process.env.BKASH_APP_KEY as string,
  bkash_app_secret: process.env.BKASH_APP_SECRET as string,
  bkash_callback_url: process.env.APP_BASE_URL,
};

export default envConfig;
