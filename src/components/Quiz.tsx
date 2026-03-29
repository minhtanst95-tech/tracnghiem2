import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, QuizState } from '../types';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Timer, Send, Home } from 'lucide-react';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Quiz() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedCategories, limit, time, useLocalBank, localQuestions } = location.state || { 
    selectedCategories: [], 
    limit: 100, 
    time: 100, 
    useLocalBank: false, 
    localQuestions: [] 
  };

  const [quiz, setQuiz] = useState<QuizState>({
    questions: [],
    currentIndex: 0,
    userAnswers: [],
    stats: { correct: 0, wrong: 0 },
    timeLeft: time * 60,
    isFinished: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        let systemQs: Question[] = [];
        
        // Fetch from Firebase if any categories selected OR if not explicitly using ONLY local bank
        // (Actually, if selectedCategories is empty, it means "All system categories")
        // We only skip system fetch if user explicitly chose to use ONLY local bank and no system categories? 
        // Let's assume user can mix them.
        
        try {
          let q;
          if (selectedCategories.length > 0) {
            q = query(collection(db, 'questions'), where('categoryId', 'in', selectedCategories));
          } else {
            q = collection(db, 'questions');
          }
          const snap = await getDocs(q);
          systemQs = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as Question));
        } catch (e) {
          console.error("System questions fetch failed:", e);
        }

        let allQs = [...systemQs];
        if (useLocalBank && localQuestions) {
          allQs = [...allQs, ...localQuestions];
        }
        
        // Shuffle and limit
        allQs = allQs.sort(() => 0.5 - Math.random()).slice(0, Math.min(limit, allQs.length));
        
        if (allQs.length === 0) {
          toast.error("Không tìm thấy câu hỏi nào");
          navigate('/');
          return;
        }

        setQuiz(prev => ({
          ...prev,
          questions: allQs,
          userAnswers: new Array(allQs.length).fill(null)
        }));
      } catch (error) {
        console.error("Error fetching questions:", error);
        toast.error("Lỗi khi tải câu hỏi");
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [selectedCategories, limit, navigate, useLocalBank, localQuestions]);

  useEffect(() => {
    if (quiz.isFinished || loading) return;

    const timer = setInterval(() => {
      setQuiz(prev => {
        if (prev.timeLeft <= 0) {
          clearInterval(timer);
          return { ...prev, isFinished: true };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz.isFinished, loading]);

  const handleSelect = (label: string) => {
    if (quiz.isFinished || quiz.userAnswers[quiz.currentIndex] !== null) return;

    const currentQ = quiz.questions[quiz.currentIndex];
    const isCorrect = label === currentQ.answer.toUpperCase();

    setQuiz(prev => {
      const newUserAnswers = [...prev.userAnswers];
      newUserAnswers[prev.currentIndex] = label;
      
      return {
        ...prev,
        userAnswers: newUserAnswers,
        stats: {
          correct: prev.stats.correct + (isCorrect ? 1 : 0),
          wrong: prev.stats.wrong + (isCorrect ? 0 : 1)
        }
      };
    });

    // Auto next after 1s
    setTimeout(() => {
      setQuiz(prev => {
        if (prev.currentIndex < prev.questions.length - 1) {
          return { ...prev, currentIndex: prev.currentIndex + 1 };
        }
        return prev;
      });
    }, 1000);
  };

  const finishQuiz = () => {
    if (window.confirm("Bạn có chắc chắn muốn nộp bài?")) {
      setQuiz(prev => ({ ...prev, isFinished: true }));
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-agri-red"></div>
      </div>
    );
  }

  if (quiz.isFinished) {
    const wrongQuestions = quiz.questions.filter((q, i) => quiz.userAnswers[i] !== q.answer.toUpperCase());

    return (
      <div className="p-4 space-y-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center border-t-8 border-agri-red">
          <p className="text-gray-400 font-bold text-xs uppercase mb-2 tracking-widest">Kết quả của bạn</p>
          <div className="text-7xl font-black text-agri-red mb-6">
            {quiz.stats.correct}/{quiz.questions.length}
          </div>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-agri-green text-white py-4 rounded-2xl font-bold shadow-lg uppercase text-sm tracking-widest transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Home size={18} />
            Quay về trang chủ
          </button>
        </div>

        <div className="space-y-4">
          <p className="font-black text-slate-400 text-[10px] uppercase mb-4 tracking-widest text-center">
            — {wrongQuestions.length > 0 ? 'DANH SÁCH CÂU SAI' : 'BẠN ĐÃ LÀM ĐÚNG HẾT!'} —
          </p>
          {wrongQuestions.map((q, i) => {
            const originalIndex = quiz.questions.findIndex(item => item.id === q.id);
            const userAnswer = quiz.userAnswers[originalIndex];
            return (
              <div key={q.id} className="p-6 rounded-3xl bg-white shadow-sm border-l-8 border-agri-red">
                <p className="font-bold text-slate-800 text-sm mb-3">{originalIndex + 1}. {q.question}</p>
                <div className="space-y-1">
                  <p className="text-[11px] text-agri-red font-bold uppercase italic">
                    Bạn chọn: {userAnswer || 'Bỏ qua'}
                  </p>
                  <p className="text-[11px] text-agri-green font-black uppercase">
                    Đáp án đúng: {q.answer} — {q[q.answer.toLowerCase() as keyof Question]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const currentQ = quiz.questions[quiz.currentIndex];
  const m = Math.floor(quiz.timeLeft / 60);
  const s = quiz.timeLeft % 60;
  const timeStr = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;

  return (
    <div className="quiz-container">
      <div className="scrollable-content p-4">
        <div className="flex justify-between items-end mb-4 px-2">
          <div className="text-4xl font-black text-agri-red font-mono leading-none flex items-center gap-2">
            <Timer size={28} />
            {timeStr}
          </div>
          <button 
            onClick={finishQuiz}
            className="text-[10px] font-black bg-gray-200 text-gray-600 px-4 py-2 rounded-full uppercase flex items-center gap-1"
          >
            <Send size={12} />
            Nộp bài
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-50 min-h-[300px] flex flex-col justify-center relative overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-2 bg-agri-green transition-all duration-1000 rounded-t-3xl" 
            style={{ width: `${(quiz.timeLeft / (time * 60)) * 100}%` }}
          ></div>
          
          <p className="text-lg font-bold text-gray-800 leading-snug mb-8">
            {quiz.currentIndex + 1}. {currentQ.question}
          </p>

          <div className="space-y-3">
            {['A', 'B', 'C', 'D'].map(label => {
              const optionText = currentQ[label.toLowerCase() as keyof Question];
              if (!optionText) return null;

              const isSelected = quiz.userAnswers[quiz.currentIndex] === label;
              const isCorrect = label === currentQ.answer.toUpperCase();
              const hasAnswered = quiz.userAnswers[quiz.currentIndex] !== null;

              return (
                <button
                  key={label}
                  disabled={hasAnswered}
                  onClick={() => handleSelect(label)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border-2 transition-all font-semibold flex items-center bg-white shadow-sm",
                    !hasAnswered && "border-slate-100 hover:border-agri-red active:scale-95",
                    hasAnswered && isCorrect && "choice-correct",
                    hasAnswered && isSelected && !isCorrect && "choice-wrong",
                    hasAnswered && !isSelected && !isCorrect && "border-slate-50 opacity-50"
                  )}
                >
                  <span className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center mr-3 text-[10px] font-black",
                    hasAnswered && (isCorrect || isSelected) ? "bg-white/20 border-white/20 text-white" : "bg-slate-50 border-slate-200 text-slate-400"
                  )}>
                    {label}
                  </span>
                  <span className="flex-1 text-sm">{optionText}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation - Solves the "obscured buttons" issue */}
      <div className="fixed-bottom-nav">
        <div className="max-w-md mx-auto">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center border-r border-gray-100 leading-tight">
              <p className="text-[9px] text-gray-400 font-black uppercase">Tiến độ</p>
              <p className="font-black text-gray-700 text-lg">{quiz.currentIndex + 1}/{quiz.questions.length}</p>
            </div>
            <div className="text-center border-r border-gray-100 leading-tight">
              <p className="text-[9px] text-green-600 font-black uppercase">Đúng</p>
              <p className="font-black text-green-600 text-lg">{quiz.stats.correct}</p>
            </div>
            <div className="text-center leading-tight">
              <p className="text-[9px] text-agri-red font-black uppercase">Sai</p>
              <p className="font-black text-agri-red text-lg">{quiz.stats.wrong}</p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button 
              onClick={() => setQuiz(prev => ({ ...prev, currentIndex: Math.max(0, prev.currentIndex - 1) }))}
              disabled={quiz.currentIndex === 0}
              className="flex items-center gap-1 font-bold text-gray-400 disabled:opacity-0 text-xs uppercase p-2"
            >
              <ChevronLeft size={16} />
              Câu trước
            </button>
            <button 
              onClick={() => {
                if (quiz.currentIndex < quiz.questions.length - 1) {
                  setQuiz(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
                } else {
                  finishQuiz();
                }
              }}
              className="flex items-center gap-1 font-bold text-agri-red text-xs uppercase underline tracking-widest p-2"
            >
              {quiz.currentIndex === quiz.questions.length - 1 ? "Nộp bài" : "Câu tiếp"}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
