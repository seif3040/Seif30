import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDocFromServer,
  type Firestore,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import config from "../../../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with forced long polling to avoid connection failures in sandboxed iframes
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    config.firestoreDatabaseId || undefined
  );
} catch {
  firestoreDb = getFirestore(app, config.firestoreDatabaseId || undefined);
}
export const db: Firestore = firestoreDb;
export const googleProvider = new GoogleAuthProvider();

// Silence verbose webchannel debug traces while retaining critical errors
setLogLevel("error");

// Operation types for Firestore error reporting per Firebase skill
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      // Sync user profile to Firestore
      await syncUserProfile(result.user);
      return result.user;
    }
    return null;
  } catch (popupError: any) {
    console.warn("Popup sign-in error, trying redirect fallback:", popupError);
    try {
      await signInWithRedirect(auth, googleProvider);
      return null;
    } catch (redirectError) {
      console.error("Redirect sign-in failed:", redirectError);
      throw redirectError;
    }
  }
}

export async function logoutFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function syncUserProfile(user: User, extraData: Record<string, any> = {}) {
  if (!user.uid) return;
  const path = `users/${user.uid}`;
  const userRef = doc(db, "users", user.uid);
  try {
    await setDoc(
      userRef,
      {
        userId: user.uid,
        email: user.email || "",
        displayName: user.displayName || "طالب Seif Study",
        photoURL: user.photoURL || "",
        updatedAt: new Date().toISOString(),
        ...extraData,
      },
      { merge: true }
    );
  } catch (err: any) {
    if (err?.code === "permission-denied" || err?.message?.includes("Missing or insufficient permissions")) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } else {
      console.warn("Firestore syncUserProfile note:", err?.message || err);
    }
  }
}

export async function saveStudySessionToFirestore(
  userId: string,
  sessionData: {
    subject: string;
    durationSeconds: number;
    coinsEarned: number;
    notes?: string;
  }
) {
  const path = `users/${userId}/sessions`;
  try {
    const ref = collection(db, "users", userId, "sessions");
    await addDoc(ref, {
      userId,
      ...sessionData,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err?.code === "permission-denied" || err?.message?.includes("Missing or insufficient permissions")) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } else {
      console.warn("Firestore saveStudySession note:", err?.message || err);
    }
  }
}

export async function saveNoteToFirestore(
  userId: string,
  noteData: {
    title: string;
    content: string;
    source?: string;
  }
) {
  const path = `users/${userId}/notes`;
  try {
    const ref = collection(db, "users", userId, "notes");
    return await addDoc(ref, {
      userId,
      ...noteData,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err?.code === "permission-denied" || err?.message?.includes("Missing or insufficient permissions")) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } else {
      console.warn("Firestore saveNote note:", err?.message || err);
      throw err;
    }
  }
}

export async function saveChatMessageToFirestore(
  userId: string,
  messageData: {
    role: "user" | "model" | "assistant";
    content: string;
    model?: string;
    sources?: any[];
  }
) {
  const path = `users/${userId}/chats`;
  try {
    const ref = collection(db, "users", userId, "chats");
    await addDoc(ref, {
      userId,
      role: messageData.role === "assistant" ? "model" : messageData.role,
      content: messageData.content,
      model: messageData.model || "gemini-3.5-flash",
      sources: messageData.sources ? JSON.stringify(messageData.sources) : "",
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err?.code === "permission-denied" || err?.message?.includes("Missing or insufficient permissions")) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } else {
      console.warn("Firestore saveChatMessage note:", err?.message || err);
    }
  }
}

export function useFirebaseUser() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        syncUserProfile(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  return {
    user,
    loading,
    loginWithGoogle,
    logout: logoutFirebase,
    isAuthenticated: !!user,
  };
}
