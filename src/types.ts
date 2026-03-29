export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: any;
}

export interface Question {
  id: string;
  categoryId: string;
  question: string;
  a: string;
  b: string;
  c: string;
  d: string;
  answer: string;
  createdAt: any;
}

export interface QuizState {
  questions: Question[];
  currentIndex: number;
  userAnswers: (string | null)[];
  stats: {
    correct: number;
    wrong: number;
  };
  timeLeft: number;
  isFinished: boolean;
}
