import { Resend } from "resend";
import { config } from "../config/index.js";
export const sendEmail = async (email, subject, text) => {
  const resendEmail = new Resend(config.resend_api_key);
  return await resendEmail.emails.send({
    from: config.from_email,
    to: email,
    subject: subject,
    html: `<section>
          <h1>${subject}</h1>
          ${text}
      </section>`,
  });
};
