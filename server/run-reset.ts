import { resetUserPassword } from "./reset-password";

async function main() {
  const email = "artrodriguezcabrera@gmail.com";
  const newPassword = "password";

  try {
    console.log(`Attempting to reset password for user: ${email}`);
    const updatedUser = await resetUserPassword(email, newPassword);
    console.log("Password reset successful for user:", {
      id: updatedUser.id,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin
    });
  } catch (error) {
    console.error("Failed to reset password:", error);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(console.error);