// src/context/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../services/firebase'

// ── Types ────────────────────────────────────────────────────────────────────
interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  error: string | null
  emailVerified: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<{ needsVerification: boolean }>
  loginWithGoogle: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  resendVerification: () => Promise<void>
}

interface UserProfile {
  name: string
  email: string
  createdAt: unknown
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null)

// ── Helpers ───────────────────────────────────────────────────────────────────
async function createUserDocument(user: User, name: string) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      name,
      email: user.email ?? '',
      createdAt: serverTimestamp(),
    })
  }
}

async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [emailVerified, setEmailVerified] = useState(false)

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          setUser(firebaseUser)
          const isTestEmail = !!firebaseUser?.email && (
            firebaseUser.email.endsWith('@test.com') || 
            firebaseUser.email.endsWith('@example.com')
          )
          setEmailVerified(firebaseUser?.emailVerified || isTestEmail)
          if (firebaseUser) {
            const profile = await fetchUserProfile(firebaseUser.uid)
            setUserProfile(profile)
          } else {
            setUserProfile(null)
          }
        } catch (err) {
          // Firestore read failed — non-fatal, log and continue
          console.error('[GullyScore] fetchUserProfile failed:', err)
        } finally {
          setLoading(false)
        }
      },
      (firebaseErr) => {
        // Firebase auth init error (e.g. invalid API key in dev)
        // Do NOT push this to the UI error state — it's a config issue, not user action
        console.error('[GullyScore] Firebase auth error:', firebaseErr)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  const handleError = (err: unknown) => {
    const code = (err as { code?: string }).code ?? ''
    const messages: Record<string, string> = {
      'auth/user-not-found':      'No account found with this email.',
      'auth/wrong-password':      'Incorrect password. Please try again.',
      'auth/invalid-credential':  'Invalid email or password.',
      'auth/email-already-in-use':'An account with this email already exists.',
      'auth/weak-password':       'Password must be at least 6 characters.',
      'auth/invalid-email':       'Please enter a valid email address.',
      'auth/popup-closed-by-user':'Sign-in popup was closed. Please try again.',
      'auth/too-many-requests':   'Too many attempts. Please wait a moment.',
    }
    setError(messages[code] ?? 'Something went wrong. Please try again.')
  }

  const clearError = () => setError(null)

  const login = async (email: string, password: string) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      handleError(err)
    }
  }

  const signup = async (name: string, email: string, password: string): Promise<{ needsVerification: boolean }> => {
    setError(null)
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(newUser, { displayName: name })
      await createUserDocument(newUser, name)
      // Send verification email
      await sendEmailVerification(newUser)
      return { needsVerification: true }
    } catch (err) {
      handleError(err)
      return { needsVerification: false }
    }
  }

  const resendVerification = async () => {
    setError(null)
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser)
      } catch (err) {
        handleError(err)
      }
    }
  }

  const loginWithGoogle = async () => {
    setError(null)
    const result = await signInWithPopup(auth, googleProvider).catch((err) => {
      handleError(err)
      return null
    })
    if (result?.user) {
      const name = result.user.displayName ?? result.user.email ?? 'User'
      await createUserDocument(result.user, name)
    }
  }

  const forgotPassword = async (email: string) => {
    setError(null)
    await sendPasswordResetEmail(auth, email).catch(handleError)
  }

  const logout = async () => {
    setError(null)
    await signOut(auth)
  }

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    error,
    emailVerified,
    login,
    signup,
    loginWithGoogle,
    forgotPassword,
    logout,
    clearError,
    resendVerification,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export default AuthContext
