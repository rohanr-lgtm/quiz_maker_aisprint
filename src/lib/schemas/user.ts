import { z } from "zod";

/**
 * `passwordHash` is the client's SHA-256 digest of the plaintext password
 * (see `@/lib/crypto/client-hash`), never the plaintext itself. Password
 * strength is validated client-side before hashing, since the server never
 * sees the original password.
 */
export const RegisterInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  username: z.string().trim().min(1, "Username is required"),
  email: z.email("Enter a valid email address"),
  passwordHash: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  identifier: z.string().trim().min(1, "Username or email is required"),
  passwordHash: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
