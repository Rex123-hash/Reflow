import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from "firebase/auth";

const environmentConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let authPromise: ReturnType<typeof loadAuth> | null = null;

async function loadAuth() {
  const configured = Object.values(environmentConfig).every(Boolean);
  const firebaseConfig = configured
    ? environmentConfig
    : ((await fetch("/__/firebase/init.json", {
        credentials: "same-origin",
      }).then((response) => {
        if (!response.ok)
          throw new Error("Firebase Hosting configuration is unavailable.");
        return response.json();
      })) as typeof environmentConfig);
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

function authClient() {
  authPromise ??= loadAuth();
  return authPromise;
}

async function exchangeCredential(idToken: string): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!response.ok)
    throw new Error("Reflow could not establish a secure product session.");
}

export async function continueWithGoogle(): Promise<void> {
  const auth = await authClient();
  await setPersistence(auth, inMemoryPersistence);
  const provider = new GoogleAuthProvider();
  // Product identity only. Gmail ingestion authorization is a separate OAuth system.
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  try {
    await exchangeCredential(await credential.user.getIdToken());
  } finally {
    await signOut(auth);
  }
}

export async function continueAsGuest(): Promise<void> {
  const auth = await authClient();
  await setPersistence(auth, inMemoryPersistence);
  const credential = await signInAnonymously(auth);
  try {
    await exchangeCredential(await credential.user.getIdToken());
  } finally {
    await signOut(auth);
  }
}

export async function clearProductSession(): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok && response.status !== 401) {
    throw new Error("Reflow could not end the product session.");
  }
}
