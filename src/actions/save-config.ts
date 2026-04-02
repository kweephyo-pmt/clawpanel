"use server";

import fs from "fs";
import path from "path";

export async function saveFirebaseConfig(config: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}) {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    
    const envContent = [
      `NEXT_PUBLIC_FIREBASE_API_KEY=${config.apiKey}`,
      `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${config.authDomain}`,
      `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${config.projectId}`,
      `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${config.storageBucket}`,
      `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId}`,
      `NEXT_PUBLIC_FIREBASE_APP_ID=${config.appId}`,
    ].join("\n");

    fs.writeFileSync(envPath, envContent, "utf8");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to save .env.local:", error);
    return { success: false, error: error.message };
  }
}
