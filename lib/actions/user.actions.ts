"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { parseStringify } from "../utils";
import { Truculenta } from "next/font/google";
import { cookies } from "next/headers";
import { avatarPlaceholder } from "@/constants";

const handleError = (error: unknown, message: string) => {
    console.log(error, message);
    throw error;
}

const getUserByEmail = async (email: string) => {
  const { databases } = await createAdminClient();

  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.usersCollectionId,
    [Query.equal("email", [email])]
  );

  return res.total > 0 ? res.documents[0] : null;
};

export const sendEmailOTP = async ({ email }: { email: string }) => {
    const { account } = await createAdminClient();

    try {
        const session = await account.createEmailToken(ID.unique(), email);
        return session.userId;
    }
    catch (err) {
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
    await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.usersCollectionId,
        ID.unique(),
        {
            fullName,
            email,
            avatar: avatarPlaceholder,
            accountId,
        }
    )
  }

  return parseStringify({ accountId });

};

export const verifyOTP = async ({ accountId, password }: {accountId: string, password: string}) => {
    
    try{
        const { account } = await createAdminClient();

        const session = await account.createSession(accountId, password);
        (await cookies()).set('appwrite-session', session.secret, {
            path: '/',
            httpOnly: true,
            sameSite: 'strict',
            secure: true,
        });

        return parseStringify({ sessionId: session.$id });
    }
    catch (err) {
        handleError(err, "Failed to verify OTP")
    }
}

export const getCurrentUser = async () => {
  const { account, databases } = await createSessionClient();

  const res = await account.get();

  const user = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.usersCollectionId,
    [Query.equal("accountId", res.$id)]
  );

  if (user.total <= 0) {
    throw new Error("User not found");
  }

  return parseStringify(user.documents[0]);
}