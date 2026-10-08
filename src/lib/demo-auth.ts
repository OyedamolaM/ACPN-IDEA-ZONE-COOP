import { z } from "zod";

export const DEMO_EMAIL = "oyedamola@example.com";
export const DEMO_PASSWORD = "DemoPass123!";

export const emailSchema = z.string().trim().email("Enter a valid email address.").max(255);
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use no more than 128 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    accepted: z.boolean().refine(Boolean, "Confirm your eligibility to continue."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Your passwords do not match.",
  });

export type SignupDraft = { email: string; password: string };
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
