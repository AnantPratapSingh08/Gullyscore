// src/services/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDJdzeFqZJq4590lrbYORATuHMMsBzq7i8",
  authDomain: "gully-score-a1727.firebaseapp.com",
  projectId: "gully-score-a1727",
  storageBucket: "gully-score-a1727.firebasestorage.app",
  messagingSenderId: "759991202280",
  appId: "1:759991202280:web:29bb041c012db20578b45d",
  measurementId: "G-4H0TVF1QHG",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

googleProvider.setCustomParameters({ prompt: 'select_account' })

export default app
