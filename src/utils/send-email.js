import nodemailer from "nodemailer";
import { config } from "../config/index.js";
// export const sendEmail = async (email, subject, text) => {
//   const resendEmail = new Resend(config.resend_api_key);
//   return await resendEmail.emails.send({
//     from: config.from_email,
//     to: email,
//     subject: subject,
//     html: `<section>
//           <h1>${subject}</h1>
//           ${text}
//       </section>`,
//   });
// };
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.email",
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: config.from_email,
    pass: process.env.APP_PASSWORD,
  },
});

export const sendEmail = async (receiver, subject, text) => {
  const mailOptions = {
    from: `UPTube <${config.from_email}>`,
    to: receiver, // list of receivers
    subject: subject, // Subject line
    html: `<section>
         <h1>${subject}</h1>
         ${text}
      </section>`, // html body
  };
  return await transporter.sendMail(mailOptions);
};
