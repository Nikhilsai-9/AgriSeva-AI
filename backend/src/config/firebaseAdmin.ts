import admin from 'firebase-admin';
import { appConfig } from './app.js';

export function ensureFirebaseAdminInitialized(): void {
  if (admin.apps.length) {
    return;
  }

  const { projectId, clientEmail, privateKey } = appConfig.firebase;

  // If running in Google Cloud/Firebase Functions environment (K_SERVICE or FIREBASE_CONFIG), or if service account keys are omitted, prefer Application Default Credentials (ADC)
  const isGcpEnvironment = Boolean(
    process.env.K_SERVICE ||
    process.env.FUNCTION_TARGET ||
    process.env.FIREBASE_CONFIG
  );

  if (isGcpEnvironment && (!clientEmail || !privateKey)) {
    console.log('[FirebaseAdmin] Initializing with Google Application Default Credentials');
    admin.initializeApp(projectId ? { projectId } : undefined);
    return;
  }

  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
      return;
    } catch (err) {
      console.warn('[FirebaseAdmin] Certificate init failed, falling back to default credentials:', err);
    }
  }

  // Fallback default initialization
  admin.initializeApp(projectId ? { projectId } : undefined);
}

export function getFirebaseAuth(): admin.auth.Auth {
  ensureFirebaseAdminInitialized();
  return admin.auth();
}
