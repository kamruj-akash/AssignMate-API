import envConfig from "../../config/env";
import type {
  IAssignmentAssignedEmail,
  IAssignmentCompletedEmail,
  IAssignmentSubmittedEmail,
  IBidAcceptedEmail,
  IEmailContent,
  IExpertApplicationEmail,
  IExpertDecisionEmail,
  IOtpEmail,
  IPaymentReceiptEmail,
  IWelcomeEmail,
} from "./email.interface";

const brandName = envConfig.email_from_name;
const appUrl = envConfig.frontend_url || "";
const supportEmail = envConfig.support_email;

const style = {
  body: "margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
  wrapper: "width:100%;background-color:#f4f5f7;padding:32px 12px;",
  card: "max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;",
  header: "padding:28px 32px 20px 32px;border-bottom:1px solid #f1f2f4;",
  brand:
    "margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;color:#111827;",
  content: "padding:28px 32px;",
  heading:
    "margin:0 0 14px 0;font-size:19px;font-weight:600;color:#111827;line-height:1.4;",
  text: "margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#374151;",
  muted: "margin:0;font-size:13px;line-height:1.6;color:#6b7280;",
  otp: "display:inline-block;padding:14px 28px;background-color:#111827;color:#ffffff;font-size:30px;font-weight:700;letter-spacing:9px;border-radius:10px;font-family:'SFMono-Regular',Consolas,monospace;",
  button:
    "display:inline-block;padding:12px 26px;background-color:#111827;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;",
  panel:
    "margin:0 0 20px 0;padding:16px 18px;background-color:#f9fafb;border:1px solid #eceef1;border-radius:10px;",
  row: "font-size:14px;line-height:1.9;color:#374151;",
  label: "color:#6b7280;",
  value: "font-weight:600;color:#111827;",
  divider: "margin:24px 0;border:0;border-top:1px solid #f1f2f4;",
  footer:
    "padding:20px 32px 28px 32px;background-color:#fafbfc;border-top:1px solid #f1f2f4;",
  footerText: "margin:0;font-size:12px;line-height:1.7;color:#9ca3af;",
  link: "color:#111827;",
};

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const detailRow = (label: string, value: string) =>
  `<div style="${style.row}"><span style="${style.label}">${label}:</span> <span style="${style.value}">${value}</span></div>`;

const button = (label: string, url: string) =>
  `<p style="margin:0 0 20px 0;"><a href="${url}" style="${style.button}">${label}</a></p>`;

const baseLayout = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="${style.body}">
    <div style="${style.wrapper}">
      <div style="${style.card}">
        <div style="${style.header}">
          <p style="${style.brand}">${brandName}</p>
        </div>
        <div style="${style.content}">
          ${body}
        </div>
        <div style="${style.footer}">
          <p style="${style.footerText}">
            You are receiving this because you have an account on ${brandName}.<br />
            Need help? Write to <a href="mailto:${supportEmail}" style="${style.link}">${supportEmail}</a>.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;

const otpBody = (heading: string, intro: string, payload: IOtpEmail) => `
  <h1 style="${style.heading}">${heading}</h1>
  <p style="${style.text}">Hi ${payload.name}, ${intro}</p>
  <p style="margin:0 0 20px 0;text-align:center;">
    <span style="${style.otp}">${payload.otp}</span>
  </p>
  <p style="${style.text}">
    This code expires in ${payload.expiresInMinutes} minutes and can only be used once.
  </p>
  <hr style="${style.divider}" />
  <p style="${style.muted}">
    Did not request this? Ignore this email — nothing changes until the code is used.
  </p>`;

const registrationOtp = (payload: IOtpEmail): IEmailContent => ({
  subject: `${payload.otp} is your ${brandName} verification code`,
  html: baseLayout(
    "Verify your email",
    otpBody(
      "Verify your email",
      "use the code below to finish creating your account.",
      payload,
    ),
  ),
  text: `Hi ${payload.name},\n\nUse this code to verify your ${brandName} account: ${payload.otp}\n\nIt expires in ${payload.expiresInMinutes} minutes and can only be used once.\n\nDid not request this? Ignore this email.\n\n— ${brandName}`,
});

const expertRegistrationOtp = (payload: IOtpEmail): IEmailContent => ({
  subject: `${payload.otp} is your ${brandName} expert verification code`,
  html: baseLayout(
    "Verify your expert account",
    otpBody(
      "Verify your expert account",
      "use the code below to continue your expert application.",
      payload,
    ),
  ),
  text: `Hi ${payload.name},\n\nUse this code to continue your ${brandName} expert application: ${payload.otp}\n\nIt expires in ${payload.expiresInMinutes} minutes and can only be used once.\n\nDid not request this? Ignore this email.\n\n— ${brandName}`,
});

const passwordResetOtp = (payload: IOtpEmail): IEmailContent => ({
  subject: `${payload.otp} is your ${brandName} password reset code`,
  html: baseLayout(
    "Reset your password",
    otpBody(
      "Reset your password",
      "use the code below to set a new password.",
      payload,
    ),
  ),
  text: `Hi ${payload.name},\n\nUse this code to reset your ${brandName} password: ${payload.otp}\n\nIt expires in ${payload.expiresInMinutes} minutes and can only be used once.\n\nDid not request this? Ignore this email — your password stays as it is.\n\n— ${brandName}`,
});

const welcome = (payload: IWelcomeEmail): IEmailContent => {
  const nextStep =
    payload.role === "EXPERT"
      ? "Complete your profile and start bidding on assignments that match your expertise."
      : "Post your first assignment, compare expert bids and pick the one that fits your budget.";

  return {
    subject: `Welcome to ${brandName}, ${payload.name}!`,
    html: baseLayout(
      `Welcome to ${brandName}`,
      `
      <h1 style="${style.heading}">Welcome aboard, ${payload.name}!</h1>
      <p style="${style.text}">
        Your email is verified and your ${brandName} account is ready to use.
      </p>
      <p style="${style.text}">${nextStep}</p>
      ${appUrl ? button("Go to dashboard", appUrl) : ""}
      <p style="${style.muted}">Glad to have you here.</p>`,
    ),
    text: `Welcome aboard, ${payload.name}!\n\nYour email is verified and your ${brandName} account is ready to use.\n\n${nextStep}${appUrl ? `\n\nDashboard: ${appUrl}` : ""}\n\n— ${brandName}`,
  };
};

const expertApplicationReceived = (
  payload: IExpertApplicationEmail,
): IEmailContent => ({
  subject: `We received your ${brandName} expert application`,
  html: baseLayout(
    "Application received",
    `
    <h1 style="${style.heading}">Your application is in review</h1>
    <p style="${style.text}">
      Hi ${payload.name}, thanks for applying to become an expert on ${brandName}.
      Your student account stays exactly as it is while we review.
    </p>
    <div style="${style.panel}">
      ${detailRow("Documents received", String(payload.documentCount))}
      ${detailRow("Status", "Pending review")}
    </div>
    <p style="${style.text}">
      Our team checks every document by hand, so this can take a little time. We
      will email you as soon as there is a decision — you do not need to apply
      again in the meantime.
    </p>
    <p style="${style.muted}">
      Questions about your application? Just reply to this email or write to
      ${supportEmail}.
    </p>`,
  ),
  text: `Hi ${payload.name},\n\nThanks for applying to become an expert on ${brandName}. We received ${payload.documentCount} document(s) and your application is pending review.\n\nOur team checks every document by hand, so this can take a little time. We will email you as soon as there is a decision — you do not need to apply again in the meantime.\n\nQuestions? Reply to this email or write to ${supportEmail}.\n\n— ${brandName}`,
});

const expertApproved = (payload: IExpertDecisionEmail): IEmailContent => ({
  subject: `Your ${brandName} expert application is approved`,
  html: baseLayout(
    "Application approved",
    `
    <h1 style="${style.heading}">You are a verified expert 🎉</h1>
    <p style="${style.text}">
      Hi ${payload.name}, our team has reviewed your documents and approved your
      expert application.
    </p>
    <p style="${style.text}">
      You can now browse open assignments, place bids and get paid through escrow
      once your work is accepted.
    </p>
    ${appUrl ? button("Browse assignments", `${appUrl}/assignments`) : ""}`,
  ),
  text: `Hi ${payload.name},\n\nYour ${brandName} expert application has been approved. You can now browse open assignments, place bids and get paid through escrow once your work is accepted.${appUrl ? `\n\nBrowse assignments: ${appUrl}/assignments` : ""}\n\n— ${brandName}`,
});

const expertRejected = (payload: IExpertDecisionEmail): IEmailContent => {
  const reason = payload.reason || "No reason provided";

  return {
    subject: `Update on your ${brandName} expert application`,
    html: baseLayout(
      "Application update",
      `
      <h1 style="${style.heading}">Your application was not approved</h1>
      <p style="${style.text}">
        Hi ${payload.name}, our team reviewed your expert application and could not
        approve it this time.
      </p>
      <div style="${style.panel}">
        ${detailRow("Reason", reason)}
      </div>
      <p style="${style.text}">
        You are welcome to apply again with updated documents. Reply to this email
        if anything above is unclear.
      </p>`,
    ),
    text: `Hi ${payload.name},\n\nYour ${brandName} expert application was not approved this time.\n\nReason: ${reason}\n\nYou are welcome to apply again with updated documents.\n\n— ${brandName}`,
  };
};

const bidAccepted = (payload: IBidAcceptedEmail): IEmailContent => ({
  subject: `Your bid on "${payload.assignmentTitle}" was accepted`,
  html: baseLayout(
    "Bid accepted",
    `
    <h1 style="${style.heading}">Your bid was accepted 🎉</h1>
    <p style="${style.text}">
      Hi ${payload.expertName}, ${payload.studentName} accepted your bid. The
      assignment is reserved for you while the payment is being placed in escrow.
    </p>
    <div style="${style.panel}">
      ${detailRow("Assignment", payload.assignmentTitle)}
      ${detailRow("Agreed amount", `BDT ${payload.proposedAmount}`)}
      ${detailRow("Deadline", formatDate(payload.deadline))}
    </div>
    <p style="${style.text}">
      We will email you again the moment the payment clears so you can start working.
    </p>
    ${appUrl ? button("View assignment", `${appUrl}/assignment/${payload.assignmentId}`) : ""}`,
  ),
  text: `Hi ${payload.expertName},\n\n${payload.studentName} accepted your bid on "${payload.assignmentTitle}".\n\nAgreed amount: BDT ${payload.proposedAmount}\nDeadline: ${formatDate(payload.deadline)}\n\nWe will email you again once the payment clears so you can start working.${appUrl ? `\n\nView assignment: ${appUrl}/assignment/${payload.assignmentId}` : ""}\n\n— ${brandName}`,
});

const paymentReceipt = (payload: IPaymentReceiptEmail): IEmailContent => ({
  subject: `Payment received for "${payload.assignmentTitle}"`,
  html: baseLayout(
    "Payment receipt",
    `
    <h1 style="${style.heading}">Payment received</h1>
    <p style="${style.text}">
      Hi ${payload.studentName}, we received your payment and moved it into escrow.
      Your expert has been notified and can start working right away.
    </p>
    <div style="${style.panel}">
      ${detailRow("Assignment", payload.assignmentTitle)}
      ${detailRow("Amount paid", `BDT ${payload.amount}`)}
      ${detailRow("Transaction ID", payload.transactionId)}
      ${detailRow("Paid on", formatDate(payload.paidAt))}
    </div>
    <p style="${style.text}">
      The amount stays in escrow and is released to the expert only after you mark
      the assignment as completed.
    </p>
    ${appUrl ? button("Track assignment", `${appUrl}/assignment/${payload.assignmentId}`) : ""}`,
  ),
  text: `Hi ${payload.studentName},\n\nWe received your payment for "${payload.assignmentTitle}" and moved it into escrow.\n\nAmount paid: BDT ${payload.amount}\nTransaction ID: ${payload.transactionId}\nPaid on: ${formatDate(payload.paidAt)}\n\nThe amount is released to the expert only after you mark the assignment as completed.${appUrl ? `\n\nTrack assignment: ${appUrl}/assignment/${payload.assignmentId}` : ""}\n\n— ${brandName}`,
});

const assignmentAssigned = (
  payload: IAssignmentAssignedEmail,
): IEmailContent => ({
  subject: `Payment cleared — you can start "${payload.assignmentTitle}"`,
  html: baseLayout(
    "Assignment assigned",
    `
    <h1 style="${style.heading}">Payment cleared, you can start now</h1>
    <p style="${style.text}">
      Hi ${payload.expertName}, the student's payment is secured in escrow and the
      assignment is officially yours.
    </p>
    <div style="${style.panel}">
      ${detailRow("Assignment", payload.assignmentTitle)}
      ${detailRow("You earn", `BDT ${payload.amount}`)}
      ${detailRow("Deadline", formatDate(payload.deadline))}
    </div>
    <p style="${style.text}">
      Submit your work before the deadline — the escrow is released to your wallet
      once the student accepts the submission.
    </p>
    ${appUrl ? button("Start working", `${appUrl}/assignment/${payload.assignmentId}`) : ""}`,
  ),
  text: `Hi ${payload.expertName},\n\nThe payment for "${payload.assignmentTitle}" is secured in escrow and the assignment is officially yours.\n\nYou earn: BDT ${payload.amount}\nDeadline: ${formatDate(payload.deadline)}\n\nSubmit your work before the deadline — the escrow is released to your wallet once the student accepts the submission.${appUrl ? `\n\nStart working: ${appUrl}/assignment/${payload.assignmentId}` : ""}\n\n— ${brandName}`,
});

const assignmentSubmitted = (
  payload: IAssignmentSubmittedEmail,
): IEmailContent => ({
  subject: `${payload.expertName} submitted "${payload.assignmentTitle}"`,
  html: baseLayout(
    "Work submitted",
    `
    <h1 style="${style.heading}">Your assignment has been submitted</h1>
    <p style="${style.text}">
      Hi ${payload.studentName}, ${payload.expertName} submitted the work for
      <strong>${payload.assignmentTitle}</strong>.
    </p>
    <p style="${style.text}">
      Review the submission and mark it as completed to release the escrow, or raise
      a dispute if something is not right.
    </p>
    ${appUrl ? button("Review submission", `${appUrl}/assignment/${payload.assignmentId}`) : ""}`,
  ),
  text: `Hi ${payload.studentName},\n\n${payload.expertName} submitted the work for "${payload.assignmentTitle}".\n\nReview the submission and mark it as completed to release the escrow, or raise a dispute if something is not right.${appUrl ? `\n\nReview submission: ${appUrl}/assignment/${payload.assignmentId}` : ""}\n\n— ${brandName}`,
});

const assignmentCompleted = (
  payload: IAssignmentCompletedEmail,
): IEmailContent => ({
  subject: `Escrow released — BDT ${payload.earnings} added to your wallet`,
  html: baseLayout(
    "Escrow released",
    `
    <h1 style="${style.heading}">Your earnings are released 💸</h1>
    <p style="${style.text}">
      Hi ${payload.expertName}, the student marked
      <strong>${payload.assignmentTitle}</strong> as completed and the escrow has
      been released to your wallet.
    </p>
    <div style="${style.panel}">
      ${detailRow("Assignment", payload.assignmentTitle)}
      ${detailRow("Credited", `BDT ${payload.earnings}`)}
    </div>
    <p style="${style.text}">Thanks for the good work — keep it coming.</p>
    ${appUrl ? button("View wallet", `${appUrl}/dashboard/wallet`) : ""}`,
  ),
  text: `Hi ${payload.expertName},\n\nThe student marked "${payload.assignmentTitle}" as completed and the escrow has been released to your wallet.\n\nCredited: BDT ${payload.earnings}\n\nThanks for the good work.${appUrl ? `\n\nView wallet: ${appUrl}/dashboard/wallet` : ""}\n\n— ${brandName}`,
});

export const emailTemplate = {
  registrationOtp,
  expertRegistrationOtp,
  passwordResetOtp,
  welcome,
  expertApplicationReceived,
  expertApproved,
  expertRejected,
  bidAccepted,
  paymentReceipt,
  assignmentAssigned,
  assignmentSubmitted,
  assignmentCompleted,
};
