import { z } from "zod";

// Error messages are i18n keys (see apps/web/src/i18n/locales), translated by the client.

export const passwordSchema = z
  .string()
  .min(8, "validation.passwordMin")
  .max(128, "validation.passwordMax")
  .regex(/[A-Za-z]/, "validation.passwordLetter")
  .regex(/[0-9]/, "validation.passwordNumber");

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "validation.firstNameRequired").max(50, "validation.tooLong"),
  lastName: z.string().trim().min(1, "validation.lastNameRequired").max(50, "validation.tooLong"),
  email: z.string().trim().toLowerCase().email("validation.emailInvalid"),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordRequired"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("validation.emailInvalid"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
