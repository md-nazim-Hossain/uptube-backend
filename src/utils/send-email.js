import { Resend } from "resend";
import { config } from "../config/index.js";
export const sendEmail = async (email, subject, text) => {
  const resend = new Resend(config.resend_api_key);
  try {
    return await resend.send({
      from: config.from_email,
      to: email,
      subject: subject,
      text: text,
    });
  } catch (error) {
    return error;
  }
};
