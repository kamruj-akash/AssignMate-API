export interface ICreateReview {
  assignmentId: string;
  rating: number;
  comment?: string;
}

export type IRatingDistribution = Record<"1" | "2" | "3" | "4" | "5", number>;
