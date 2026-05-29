import { z } from "zod";

export const RegisterSchema = z
  .object({
    email: z.string().email("Email tidak valid"),
    username: z
      .string()
      .min(4, "Min 4 karakter")
      .max(24, "Max 24 karakter")
      .regex(/^[a-zA-Z0-9_]+$/, "Hanya huruf, angka, underscore"),
    phone: z
      .string()
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Nomor HP Indonesia tidak valid")
      .optional(),
    fullName: z.string().min(2).max(80).optional(),
    password: z
      .string()
      .min(8, "Min 8 karakter")
      .regex(/[A-Z]/, "Harus mengandung huruf besar")
      .regex(/[a-z]/, "Harus mengandung huruf kecil")
      .regex(/[0-9]/, "Harus mengandung angka"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  identifier: z.string().min(1, "Email / username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const PinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, "PIN harus 6 digit angka"),
});
