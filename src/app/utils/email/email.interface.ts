export interface ISendEmail {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface IEmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface IOtpEmail {
  name: string;
  otp: string;
  expiresInMinutes: number;
}

export interface IWelcomeEmail {
  name: string;
  role: "STUDENT" | "EXPERT";
}

export interface IExpertDecisionEmail {
  name: string;
  reason?: string;
}

export interface IBidAcceptedEmail {
  expertName: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  proposedAmount: string;
  deadline: Date;
}

export interface IPaymentReceiptEmail {
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  amount: string;
  transactionId: string;
  paidAt: Date;
}

export interface IAssignmentAssignedEmail {
  expertName: string;
  assignmentId: string;
  assignmentTitle: string;
  amount: string;
  deadline: Date;
}

export interface IAssignmentSubmittedEmail {
  studentName: string;
  expertName: string;
  assignmentId: string;
  assignmentTitle: string;
}

export interface IAssignmentCompletedEmail {
  expertName: string;
  assignmentId: string;
  assignmentTitle: string;
  earnings: string;
}
