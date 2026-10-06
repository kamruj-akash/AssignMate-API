export interface IRegisterExpert {
  name: string;
  email: string;
  password: string;
}

export interface IVerifyExpert {
  email: string;
  otp: string;
  university: string;
  department: string;
  ratePerAssignment: number;
  bio: string;
}

export interface IApproveExpert {
  status: string;
  reason?: string;
  expertId: string;
}

export interface IStudentRegisterExpert {
  university: string;
  department: string;
  ratePerAssignment: number;
  bio?: string;
}

export interface IUpdateExpertProfile {
  name?: string;
  phoneNo?: string;
  bio?: string;
  ratePerAssignment?: number;
}
