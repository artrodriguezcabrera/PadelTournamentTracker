import { hashPassword } from "./auth";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

export async function resetUserPassword(email: string, newPassword: string) {
  const hashedPassword = await hashPassword(newPassword);

  const [updatedUser] = await db
    .update(users)
    .set({ 
      password: hashedPassword,
      isAdmin: true // Also ensure admin privilege is set
    })
    .where(eq(users.email, email))
    .returning();

  if (!updatedUser) {
    throw new Error(`No user found with email: ${email}`);
  }

  return updatedUser;
}