import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  getDocs,
  doc,
  setDoc,
  getDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Book as BookIcon, LogOut, Plus, Home as HomeIcon, CheckCircle, ChevronRight, BookOpen, Sparkles, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateBookQuestions, generateBookLessons } from './lib/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Firestore Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- Types ---
interface Book {
  id: string;
  uid: string;
  title: string;
  author: string;
  dateAdded: Timestamp;
  questions: { question: string; answer: string }[];
  lessons: string[];
}

interface DailyLesson {
  uid: string;
  bookId: string;
  lesson: string;
  date: string;
}

// --- Components ---

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <BookIcon className="w-6 h-6" />
          <span>WisdomLog</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/add" className="p-2 hover:bg-indigo-50 rounded-full text-indigo-600 transition-colors">
            <Plus className="w-6 h-6" />
          </Link>
          <button onClick={handleLogout} className="p-2 hover:bg-red-50 rounded-full text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      
      // Ensure user doc exists
      await setDoc(doc(db, 'users', userCred.user.uid), {
        uid: userCred.user.uid,
        email: userCred.user.email,
        displayName: userCred.user.displayName
      }, { merge: true });
      
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookIcon className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500">Sign in to your wisdom log</p>
        </div>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-6 shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">Or email</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              required 
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              required 
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
            Sign In
          </button>
        </form>
        <p className="text-center mt-6 text-gray-600 text-sm">
          Don't have an account? <Link to="/register" className="text-indigo-600 font-semibold">Register</Link>
        </p>
      </motion.div>
    </div>
  );
};

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName: name });
      
      // Create user doc
      await setDoc(doc(db, 'users', userCred.user.uid), {
        uid: userCred.user.uid,
        email: email,
        displayName: name
      });
      
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      
      await setDoc(doc(db, 'users', userCred.user.uid), {
        uid: userCred.user.uid,
        email: userCred.user.email,
        displayName: userCred.user.displayName
      }, { merge: true });
      
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500">Start your reading journey today</p>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-6 shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">Or email</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input 
              type="text" 
              required 
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              required 
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              required 
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
            Register
          </button>
        </form>
        <p className="text-center mt-6 text-gray-600 text-sm">
          Already have an account? <Link to="/login" className="text-indigo-600 font-semibold">Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
};

const Home = () => {
  const { user } = useAuth();
  const [dailyLesson, setDailyLesson] = useState<DailyLesson | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const lessonPath = 'daily_lessons';
    const booksPath = 'books';

    // Fetch daily lesson
    const qLesson = query(
      collection(db, lessonPath),
      where('uid', '==', user.uid),
      where('date', '==', today),
      limit(1)
    );

    const unsubLesson = onSnapshot(qLesson, (snap) => {
      if (!snap.empty) {
        setDailyLesson(snap.docs[0].data() as DailyLesson);
      } else {
        // If no lesson today, pick one from books
        generateDailyLesson(user.uid, today);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, lessonPath));

    // Fetch books
    const qBooks = query(
      collection(db, booksPath),
      where('uid', '==', user.uid),
      orderBy('dateAdded', 'desc')
    );

    const unsubBooks = onSnapshot(qBooks, (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Book)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, booksPath));

    return () => {
      unsubLesson();
      unsubBooks();
    };
  }, [user]);

  const generateDailyLesson = async (uid: string, date: string) => {
    const booksRef = collection(db, 'books');
    const q = query(booksRef, where('uid', '==', uid));
    const snap = await getDocs(q);
    
    if (snap.empty) return;

    const allBooks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Book));
    const randomBook = allBooks[Math.floor(Math.random() * allBooks.length)];
    
    if (randomBook.lessons && randomBook.lessons.length > 0) {
      const randomLesson = randomBook.lessons[Math.floor(Math.random() * randomBook.lessons.length)];
      
      await addDoc(collection(db, 'daily_lessons'), {
        uid,
        bookId: randomBook.id,
        lesson: randomLesson,
        date
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        {dailyLesson ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl text-white shadow-2xl mb-12 relative overflow-hidden"
          >
            <Sparkles className="absolute top-4 right-4 w-12 h-12 text-white/20" />
            <div className="relative z-10">
              <span className="text-indigo-100 font-medium text-sm uppercase tracking-wider">Today's Wisdom</span>
              <h2 className="text-3xl font-serif mt-2 mb-6 leading-tight italic">
                "{dailyLesson.lesson}"
              </h2>
              <div className="flex items-center gap-2 text-indigo-100">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">From your reading list</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="bg-gray-100 p-12 rounded-3xl text-center mb-12 border-2 border-dashed border-gray-200">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-500">Add a book to start receiving daily wisdom</h2>
            <Link to="/add" className="mt-4 inline-flex items-center gap-2 text-indigo-600 font-semibold hover:underline">
              Add your first book <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </AnimatePresence>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Your Library</h3>
          <span className="text-sm text-gray-500">{books.length} books logged</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => (
            <motion.div 
              key={book.id}
              layout
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {new Date(book.dateAdded.toDate()).toLocaleDateString()}
                </span>
              </div>
              <h4 className="font-bold text-gray-900 line-clamp-1">{book.title}</h4>
              <p className="text-sm text-gray-500 mb-4">{book.author}</p>
              <div className="flex flex-wrap gap-2">
                {book.lessons?.slice(0, 2).map((l: string, i: number) => (
                  <span key={i} className="text-[10px] bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                    Lesson {i + 1}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

const AddBook = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const qs = await generateBookQuestions(title, author);
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(''));
      setStep(2);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const qAndA = questions.map((q, i) => ({ question: q.question, answer: answers[i] }));
      const lessons = await generateBookLessons(title, author, qAndA);
      
      await addDoc(collection(db, 'books'), {
        uid: user.uid,
        title,
        author,
        dateAdded: serverTimestamp(),
        questions: qAndA,
        lessons
      });
      
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">What are you reading?</h2>
            <p className="text-gray-500 mb-8">Tell us about the book you've completed.</p>
            <form onSubmit={handleStart} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Book Title</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Atomic Habits"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. James Clear"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
              <button 
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Generating Questions...' : 'Continue'}
                {!loading && <ChevronRight className="w-5 h-5" />}
              </button>
            </form>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Reflection Time</h2>
            <p className="text-gray-500 mb-8">Answer these AI-generated questions to unlock your daily lessons.</p>
            <div className="space-y-8">
              {questions.map((q, i) => (
                <div key={i}>
                  <p className="font-medium text-gray-900 mb-3 flex gap-2">
                    <span className="text-indigo-600 font-bold">{i + 1}.</span>
                    {q.question}
                  </p>
                  <textarea 
                    required
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    placeholder="Your reflection..."
                    value={answers[i]}
                    onChange={(e) => {
                      const newAnswers = [...answers];
                      newAnswers[i] = e.target.value;
                      setAnswers(newAnswers);
                    }}
                  />
                </div>
              ))}
              <button 
                onClick={handleFinish}
                disabled={loading || answers.some(a => !a.trim())}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Extracting Wisdom...' : 'Finish & Log Book'}
                {!loading && <CheckCircle className="w-5 h-5" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
          <Navbar />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/add" element={<PrivateRoute><AddBook /></PrivateRoute>} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}
