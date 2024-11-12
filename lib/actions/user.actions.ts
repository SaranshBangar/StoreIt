"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { parseStringify } from "../utils";
import { Truculenta } from "next/font/google";
import { cookies } from "next/headers";
import { avatarPlaceholder } from "@/constants";
import { redirect } from "next/navigation";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

const getUserByEmail = async (email: string) => {
  const { databases } = await createAdminClient();

  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.usersCollectionId,
    [Query.equal("email", [email])],
  );

  return res.total > 0 ? res.documents[0] : null;
};

export const sendEmailOTP = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();

  try {
    const session = await account.createEmailToken(ID.unique(), email);
    return session.userId;
  } catch (err) {
    handleError(err, "Failed to send email OTP");
  }
};

export const createAccount = async ({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) => {
  const existingUser = await getUserByEmail(email);
  const accountId = await sendEmailOTP({ email });

  if (!accountId) {
    throw new Error("Failed to send OTP");
  }

  if (!existingUser) {
    const { databases } = await createAdminClient();

    const initials = fullName
      .split(" ")
      .map((namePart) => namePart[0])
      .join("")
      .toUpperCase();

    const avatarPlaceholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      initials,
    )}&background=random&color=fff&size=128`;

    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      ID.unique(),
      {
        fullName,
        email,
        avatar: avatarPlaceholder,
        accountId,
      },
    );
  }

  return parseStringify({ accountId });
};

export const verifyOTP = async ({
  accountId,
  password,
}: {
  accountId: string;
  password: string;
}) => {
  try {
    const { account } = await createAdminClient();

    const session = await account.createSession(accountId, password);
    (await cookies()).set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    return parseStringify({ sessionId: session.$id });
  } catch (err) {
    handleError(err, "Failed to verify OTP");
  }
};

export const getCurrentUser = async () => {
  const { account, databases } = await createSessionClient();

  try {
    const res = await account.get();

    const user = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal("accountId", res.$id)],
    );

    if (user.total <= 0) {
      redirect("/sign-up");
    }

    return parseStringify(user.documents[0]);
  } catch (error) {
    console.error("Error fetching current user:", error);
    redirect("/sign-in");
  }
};

export const signOutUser = async () => {
  const { account } = await createSessionClient();

  try {
    await account.deleteSession("current");
    (await cookies()).delete("appwrite-session");
  } catch (err) {
    handleError(err, "Failed to sign out user");
  } finally {
    window.location.href = "/sign-in";
  }
};

export const signInUser = async ({ email }: { email: string }) => {
  try {
    const existingUser = await getUserByEmail(email);

    if (!existingUser) {
      redirect("/sign-up");
    }

    if (existingUser) {
      await sendEmailOTP({ email });
      return parseStringify({ accountId: existingUser.accountId });
    }

    return parseStringify({ accountId: null, error: "User not found" });
  } catch (err) {
    handleError(err, "Failed to sign in user");
  }
};
