import type { AssignmentStatus } from "../../../../prisma/src/generated/prisma/enums";

export interface ICreateAssignment {
  title: string;
  description: string;
  budget: number;
  deadline: Date;
}

export interface IAssignmentActionPayload {
  status: AssignmentStatus;
  reason?: string;
}
