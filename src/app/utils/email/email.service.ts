import httpStatus from "http-status";
import envConfig from "../../config/env";
import { emailSender, resendClient } from "../../lib/resend";
import { AppError } from "../AppError";
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
  ISendEmail,
  IWelcomeEmail,
} from "./email.interface";
import { emailTemplate } from "./email.template";

const sendEmail = async (payload: ISendEmail) => {
  const { data, error } = await resendClient.emails.send({
    from: emailSender,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    replyTo: payload.replyTo || envConfig.email_reply_to,
  });

  if (error) {
    console.error("Resend send failed:", error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to send email, please try again",
    );
  }

  return data;
};

const sendEmailSafe = async (payload: ISendEmail) => {
  try {
    return await sendEmail(payload);
  } catch (error) {
    console.error(
      `Skipped email "${payload.subject}" to ${payload.to}:`,
      error,
    );
    return null;
  }
};

const send = (to: string, content: IEmailContent) =>
  sendEmail({ to, ...content });

const notify = (to: string, content: IEmailContent) =>
  sendEmailSafe({ to, ...content });

// auth =>
const sendRegistrationOtp = (to: string, payload: IOtpEmail) =>
  send(to, emailTemplate.registrationOtp(payload));

const sendExpertRegistrationOtp = (to: string, payload: IOtpEmail) =>
  send(to, emailTemplate.expertRegistrationOtp(payload));

const sendPasswordResetOtp = (to: string, payload: IOtpEmail) =>
  send(to, emailTemplate.passwordResetOtp(payload));

const sendWelcome = (to: string, payload: IWelcomeEmail) =>
  notify(to, emailTemplate.welcome(payload));

// notify(), not send(): the application row is already committed by the time
// this runs, so a mail outage must not fail the request the student just made.
const sendExpertApplicationReceived = (
  to: string,
  payload: IExpertApplicationEmail,
) => notify(to, emailTemplate.expertApplicationReceived(payload));

// expert =>

const sendExpertApproved = (to: string, payload: IExpertDecisionEmail) =>
  notify(to, emailTemplate.expertApproved(payload));

const sendExpertRejected = (to: string, payload: IExpertDecisionEmail) =>
  notify(to, emailTemplate.expertRejected(payload));

// assignment =>
const sendBidAccepted = (to: string, payload: IBidAcceptedEmail) =>
  notify(to, emailTemplate.bidAccepted(payload));

const sendPaymentReceipt = (to: string, payload: IPaymentReceiptEmail) =>
  notify(to, emailTemplate.paymentReceipt(payload));

const sendAssignmentAssigned = (
  to: string,
  payload: IAssignmentAssignedEmail,
) => notify(to, emailTemplate.assignmentAssigned(payload));

const sendAssignmentSubmitted = (
  to: string,
  payload: IAssignmentSubmittedEmail,
) => notify(to, emailTemplate.assignmentSubmitted(payload));

const sendAssignmentCompleted = (
  to: string,
  payload: IAssignmentCompletedEmail,
) => notify(to, emailTemplate.assignmentCompleted(payload));

export const emailService = {
  sendEmail,
  sendEmailSafe,
  sendRegistrationOtp,
  sendExpertRegistrationOtp,
  sendPasswordResetOtp,
  sendWelcome,
  sendExpertApplicationReceived,
  sendExpertApproved,
  sendExpertRejected,
  sendBidAccepted,
  sendPaymentReceipt,
  sendAssignmentAssigned,
  sendAssignmentSubmitted,
  sendAssignmentCompleted,
};
