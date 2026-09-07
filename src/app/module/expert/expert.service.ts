import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import {
  ExpertVerificationStatus,
  Role,
} from "../../../../prisma/src/generated/prisma/enums";
import type { ExpertWhereInput } from "../../../../prisma/src/generated/prisma/models";
import { redisClient } from "../../config/redis";
import type { IQuery } from "../../interface";
import cloudinary from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/authCheck";
import { AppError } from "../../utils/AppError";
import { emailService } from "../../utils/email/email.service";
import type {
  IApproveExpert,
  IRegisterExpert,
  IStudentRegisterExpert,
  IVerifyExpert,
} from "./expert.interface";

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const registerExpert = async (payload: IRegisterExpert) => {
  const { name, email, password: payloadPass } = payload;
  const isUserExist = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExist) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User already exists, user another email!",
    );
  }
  const userKey = `expertRegister:${email}`;
  const otpKey = `expertRegisterOtp:${email}`;
  const otp = generateOtp();
  const storedUser = await redisClient.set(
    userKey,
    JSON.stringify({
      name,
      email,
      password: await bcrypt.hash(payloadPass, 10),
    }),
    {
      EX: 60 * 60,
    },
  );
  const storedOtp = await redisClient.set(otpKey, otp, {
    EX: 60 * 60,
  });
  if (!storedOtp && !storedUser) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to store OTP in Redis",
    );
  }

  try {
    await emailService.sendExpertRegistrationOtp(email, {
      name,
      otp,
      expiresInMinutes: 60,
    });
  } catch (error) {
    await redisClient.del(userKey);
    await redisClient.del(otpKey);
    throw error;
  }

  return;
};

const verifyExpert = async (
  payload: IVerifyExpert,
  documents: Express.Multer.File[],
) => {
  const { email: otpEmail, otp } = payload;
  const userKey = `expertRegister:${otpEmail}`;
  const otpKey = `expertRegisterOtp:${otpEmail}`;
  const storedUser = await redisClient.get(userKey);
  const storedOtp = await redisClient.get(otpKey);

  if (!storedUser || !storedOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP expired or user not found, please register again",
    );
  }

  if (storedOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
  }

  const { name, email, password } = JSON.parse(storedUser);
  const isUserExist = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExist) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User already exists, user another email!",
    );
  }

  const uploadedDocument = await Promise.all(
    documents.map((document) => {
      return new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: "auto",
              folder: "expert-documents",
            },
            async (error, result) => {
              if (error) {
                return reject(error);
              }
              if (!result) {
                throw new AppError(
                  httpStatus.INTERNAL_SERVER_ERROR,
                  "Failed to upload document",
                );
              }
              resolve(result);
            },
          )
          .end(document.buffer);
      });
    }),
  );

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password,
      role: Role.EXPERT,
      emailVerified: true,
      expert: {
        create: {
          documents: uploadedDocument.map((doc) => ({
            url: doc.secure_url,
            publicId: doc.public_id,
          })),
          department: payload.department,
          ratePerAssignment: payload.ratePerAssignment,
          university: payload.university,
          isVerified: false,
          verificationStatus: ExpertVerificationStatus.PENDING,
          bio: payload?.bio || null,
        },
      },
    },
    omit: {
      password: true,
    },
    include: {
      expert: true,
    },
  });

  await redisClient.del(userKey);
  await redisClient.del(otpKey);

  await emailService.sendWelcome(email, { name, role: Role.EXPERT });

  return user;
};

const studentRegisterExpert = async (
  payload: IStudentRegisterExpert,
  documents: Express.Multer.File[],
  user: RequestUser,
) => {
  const { university, department, ratePerAssignment, bio } = payload;
  const isUserExist = await prisma.user.findUnique({
    where: { id: user.userId, role: Role.STUDENT },
  });
  if (isUserExist && isUserExist?.role !== Role.STUDENT) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to register as an expert",
    );
  }

  const uploadedDocuments = await Promise.all(
    documents.map((doc) => {
      return new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { resource_type: "auto", folder: "expert-documents" },
            (error, result) => {
              if (error) {
                return reject(error);
              }
              if (!result) {
                throw new AppError(
                  httpStatus.INTERNAL_SERVER_ERROR,
                  "Failed to upload document",
                );
              }
              resolve(result);
            },
          )
          .end(doc.buffer);
      });
    }),
  );

  if (uploadedDocuments.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "At least one document is required for verification",
    );
  }
  const registeredExpert = await prisma.expert.create({
    data: {
      userId: user.userId,
      university,
      department,
      ratePerAssignment,
      bio: bio || null,
      isVerified: false,
      verificationStatus: ExpertVerificationStatus.PENDING,
      documents: uploadedDocuments.map((doc) => ({
        url: doc.secure_url,
        publicId: doc.public_id,
      })),
    },
  });
  return registeredExpert;
};

const approveExpert = async (payload: IApproveExpert, user: RequestUser) => {
  let { expertId, status, reason } = payload;
  status = status.toUpperCase();
  if (!status || !expertId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Expert ID and status are required",
    );
  }
  if (user.role !== Role.ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to approve expert",
    );
  }

  if (
    status !== ExpertVerificationStatus.APPROVE &&
    status !== ExpertVerificationStatus.REJECT
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid status, must be either APPROVE or REJECT",
    );
  }
  const isExpertExist = await prisma.expert.findUnique({
    where: { id: expertId },
    include: {
      user: { omit: { password: true } },
    },
  });

  if (!isExpertExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Expert not found");
  }
  if (isExpertExist.verificationStatus !== ExpertVerificationStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Expert is already verified or rejected",
    );
  }

  if (status === ExpertVerificationStatus.REJECT && !reason) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Reason is required when rejecting an expert",
    );
  }

  const updatedExpert = await prisma.$transaction(async (tx) => {
    if (status === ExpertVerificationStatus.REJECT) {
      return tx.expert.update({
        where: { id: expertId },
        data: {
          isVerified: false,
          verificationStatus: ExpertVerificationStatus.REJECT,
          rejectionReason: reason || "No reason provided",
        },
      });
    }

    const expert = await tx.expert.update({
      where: { id: expertId },
      data: {
        isVerified: true,
        verificationStatus: ExpertVerificationStatus.APPROVE,
      },
    });

    await tx.user.update({
      where: { id: isExpertExist.userId },
      data: { role: Role.EXPERT },
    });

    await tx.student.delete({
      where: { userId: isExpertExist.userId },
    });

    return expert;
  });

  if (status === ExpertVerificationStatus.REJECT) {
    await emailService.sendExpertRejected(isExpertExist.user.email, {
      name: isExpertExist.user.name,
      reason: updatedExpert.rejectionReason || reason,
    });
  } else {
    await emailService.sendExpertApproved(isExpertExist.user.email, {
      name: isExpertExist.user.name,
    });
  }

  return updatedExpert;
};

const getAllExperts = async (query: IQuery, user: RequestUser) => {
  const status = query.status && query.status.toUpperCase();
  const searchTerm = query.searchTerm || "";
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "asc";

  const ANDConditions: ExpertWhereInput[] = [
    { verificationStatus: status ?? ExpertVerificationStatus.PENDING },
  ];

  if (searchTerm) {
    ANDConditions.push({
      OR: [
        { user: { name: { contains: searchTerm, mode: "insensitive" } } },
        { user: { email: { contains: searchTerm, mode: "insensitive" } } },
      ],
    });
  }

  const experts = await prisma.expert.findMany({
    where: { AND: ANDConditions },
    select: {
      id: true,
      isVerified: true,
      ratePerAssignment: true,
      verificationStatus: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  const totalExperts = await prisma.expert.count({
    where: { AND: ANDConditions },
  });

  return {
    experts,
    meta: {
      page,
      limit,
      totalExperts,
      totalPages: Math.ceil(totalExperts / limit),
    },
  };
};

export const expertService = {
  registerExpert,
  verifyExpert,
  approveExpert,
  studentRegisterExpert,
  getAllExperts,
};
