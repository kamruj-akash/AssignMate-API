import { Resend } from "resend";
import envConfig from "../config/env";

if (!envConfig.resend_api) {
  throw new Error("RESEND_API is not set");
}

export const resendClient = new Resend(envConfig.resend_api);

export const emailSender = `${envConfig.email_from_name} <${envConfig.email_from_address}>`;

export default resendClient;
