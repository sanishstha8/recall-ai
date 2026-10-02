import { z } from "zod";

const email = z.string().trim().min(1, "Email is required").email("Enter a valid email address");
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .refine((v) => !/^\d+$/.test(v), "Password can't be entirely numeric");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    first_name: z.string().trim().max(150).optional(),
    last_name: z.string().trim().max(150).optional(),
    email,
    password: newPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ new_password: newPassword, confirm: z.string() })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export const changePasswordSchema = z
  .object({ current_password: z.string().min(1, "Required"), new_password: newPassword, confirm: z.string() })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export const knowledgeBaseSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(120),
  description: z.string().trim().max(2000).optional(),
  icon: z.string(),
});
export type KnowledgeBaseValues = z.infer<typeof knowledgeBaseSchema>;
