import { initializeApp, getApps } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

const app = getFirebaseApp();
const auth: Auth | null = app ? getAuth(app) : null;

// Connect to Firebase Auth Emulator in dev (must only run once, client-side only)
if (auth && typeof window !== "undefined" && process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true") {
  import("firebase/auth").then(({ connectAuthEmulator }) => {
    connectAuthEmulator(
      auth,
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099",
      { disableWarnings: true }
    );
  });
}

export { app, auth };
