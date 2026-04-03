import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const getFirebaseConfig = () => {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
};

const firebaseConfig = getFirebaseConfig();

// Check if we have at least an API Key before initializing
const hasFirebaseConfig = !!firebaseConfig.apiKey;

// Initialize Firebase
let app;
if (getApps().length === 0) {
  if (hasFirebaseConfig) {
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApp();
}

const auth = app ? getAuth(app) : null;

export { auth, hasFirebaseConfig };
