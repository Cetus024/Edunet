'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from '@/lib/navigation';
import { useAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ChevronRight,
  Clock,
  FileText,
  Zap,
  Brain,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useMascotFeedback } from '@/features/mascot';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  subjectsAtom,
  rescueNudgeLogsAtom,
  getEffectiveScore,
  type SubjectData,
  type RescueNudgeLog,
} from '@/lib/study-data';

import {
  getQuestionsForSelection,
  getQuizQuestionKey,
  isQuizAnswerCorrect,
  type QuizQuestion,
} from '@/lib/quiz-question-bank';
import { submitQuizAttempt, type QuizAttemptResult } from '@/lib/api/quiz';
import { useCurrentAccount } from '@/lib/api/me';
import { isTeachingRole } from '@/lib/roles';
import { TeacherQuizReview } from '@/components/teacher-quiz-review';

// Quiz mode types
type QuizMode = 'past-paper' | 'concept-check' | 'speed-round';
type QuizState = 'setup' | 'active' | 'results';

type Question = QuizQuestion;

// Get memory score status
function getMemoryStatus(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 70) return { label: 'Strong', color: 'text-[#186636]', bgColor: 'bg-[#186636]/10' };
  if (score >= 40) return { label: 'Needs Review', color: 'text-[#EAA93C]', bgColor: 'bg-[#EAA93C]/10' };
  return { label: 'Weak', color: 'text-[#D9534F]', bgColor: 'bg-[#D9534F]/10' };
}

// Get difficulty based on score
function getDifficulty(score: number): string {
  if (score >= 70) return 'Hard';
  if (score >= 40) return 'Medium';
  return 'Easy';
}

// Animated circular gauge component
function AnimatedGauge({ score, previousScore, size = 160 }: { score: number; previousScore?: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getColor = (s: number) => {
    if (s >= 70) return '#186636';
    if (s >= 40) return '#EAA93C';
    return '#D9534F';
  };

  const improved = previousScore !== undefined && score > previousScore;
  const declined = previousScore !== undefined && score < previousScore;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={12}
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-4xl font-bold"
          style={{ color: getColor(score) }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {score}%
        </motion.span>
        {previousScore !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className={`flex items-center gap-1 text-sm font-medium ${improved ? 'text-[#186636]' : declined ? 'text-[#D9534F]' : 'text-muted-foreground'}`}
          >
            {improved ? <TrendingUp className="w-4 h-4" /> : declined ? <TrendingDown className="w-4 h-4" /> : null}
            {improved ? `+${score - previousScore}` : declined ? `${score - previousScore}` : 'No change'}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Quiz Setup Panel Component
function QuizSetupPanel({
  selectedSubject,
  setSelectedSubject,
  selectedTopic,
  setSelectedTopic,
  setSelectedTopicId,
  quizMode,
  setQuizMode,
  onGenerateQuiz,
  globalSubjects,
}: {
  selectedSubject: string;
  setSelectedSubject: (s: string) => void;
  selectedTopic: string;
  setSelectedTopic: (t: string) => void;
  setSelectedTopicId: (id: string) => void;
  quizMode: QuizMode;
  setQuizMode: (m: QuizMode) => void;
  onGenerateQuiz: () => void;
  globalSubjects: SubjectData[];
}) {
  const subjectData = globalSubjects.find((subject) => subject.name === selectedSubject) ?? null;
  const selectedGlobalTopic = subjectData?.topics.find((topic) => topic.name === selectedTopic);
  const memoryScore = selectedGlobalTopic ? getEffectiveScore(selectedGlobalTopic) : null;
  const memoryStatus = memoryScore === null
    ? { label: 'Not Started', color: 'text-slate-500', bgColor: 'bg-slate-100' }
    : getMemoryStatus(memoryScore);
  const difficulty = getDifficulty(memoryScore ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-studynow-dark flex items-center gap-2">
          <span className="w-1.5 h-6 bg-[#186636] rounded-full" />
          Quiz Setup
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Configure your personalized quiz</p>
      </div>

      {/* Subject Selection */}
      <div className="space-y-4 flex-1">
        <div>
          <label className="text-sm font-semibold text-studynow-dark mb-2 block">Select Subject</label>
          <Select value={selectedSubject} onValueChange={(val) => { setSelectedSubject(val); setSelectedTopic(''); setSelectedTopicId(''); }}>
            <SelectTrigger className="w-full h-12 bg-card border-border/50 rounded-xl">
              <SelectValue placeholder="Choose a subject..." />
            </SelectTrigger>
            <SelectContent>
              {globalSubjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.name}>
                  <span className="flex items-center gap-2">
                    <span>{subject.icon}</span>
                    <span>{subject.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Topic Selection */}
        <div>
          <label className="text-sm font-semibold text-studynow-dark mb-2 block">Select Topic</label>
          <Select value={selectedTopic} onValueChange={(val) => {
            setSelectedTopic(val);
            // Find the topic ID from the global state
            const subject = globalSubjects?.find(s => s.name === selectedSubject);
            const topic = subject?.topics.find(t => t.name === val);
            setSelectedTopicId(topic?.id ?? '');
          }} disabled={!selectedSubject}>
            <SelectTrigger className="w-full h-12 bg-card border-border/50 rounded-xl">
              <SelectValue placeholder={selectedSubject ? 'Choose a topic...' : 'Select a subject first'} />
            </SelectTrigger>
            <SelectContent>
              {subjectData?.topics.map((topic) => (
                <SelectItem key={topic.id} value={topic.name}>
                  {topic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Memory Score Badge */}
        <AnimatePresence>
          {selectedTopic && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className={`border-0 rounded-2xl overflow-hidden ${memoryStatus.bgColor}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Current Memory Score</p>
                      <p className={`text-2xl font-bold ${memoryStatus.color}`}>
                        {memoryScore === null ? 'Not Started' : `${memoryScore}%`}
                      </p>
                    </div>
                    <Badge className={`${memoryStatus.bgColor} ${memoryStatus.color} border-0 font-semibold`}>
                      {memoryStatus.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quiz Mode Toggle */}
        <div>
          <label className="text-sm font-semibold text-studynow-dark mb-3 block">Quiz Mode</label>
          <div className="flex gap-2 p-1 bg-muted/30 rounded-2xl">
            {[
              { id: 'past-paper' as QuizMode, label: 'Past Paper', icon: FileText, desc: 'O-Level questions' },
              { id: 'concept-check' as QuizMode, label: 'Concept', icon: Brain, desc: 'AI-generated' },
              { id: 'speed-round' as QuizMode, label: 'Speed', icon: Zap, desc: '5 rapid MCQs' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setQuizMode(mode.id)}
                className={`flex-1 py-3 px-2 rounded-xl text-center transition-all duration-200 ${
                  quizMode === mode.id
                    ? 'bg-[#6486b5] text-white shadow-lg'
                    : 'bg-transparent text-studynow-dark hover:bg-card'
                }`}
              >
                <mode.icon className={`w-5 h-5 mx-auto mb-1 ${quizMode === mode.id ? 'text-white' : ''}`} />
                <span className="text-xs font-semibold block">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Auto-label */}
        <AnimatePresence>
          {selectedTopic && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-3 bg-card rounded-xl border border-border/30"
            >
              <Sparkles className="w-4 h-4 text-[#EAA93C]" />
              <span className="text-sm text-muted-foreground">Difficulty set to:</span>
              <Badge className="bg-[#186636]/10 text-[#186636] border-0 font-bold">{difficulty}</Badge>
              <span className="text-xs text-muted-foreground">(based on your score)</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generate Quiz Button */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <Button
          onClick={onGenerateQuiz}
          disabled={!selectedSubject || !selectedTopic}
          className="w-full h-14 bg-[#EAA93C] hover:bg-[#d99a2f] text-studynow-dark font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all gold-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          Generate Quiz
          <ChevronRight className="w-6 h-6 ml-2" />
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3" />
          Questions tailored to your current memory score
        </p>
      </div>
    </motion.div>
  );
}

// MCQ Question Component
function MCQQuestion({
  question,
  selectedAnswer,
  onSelectAnswer,
  isAnswered,
}: {
  question: Question;
  selectedAnswer: number | null;
  onSelectAnswer: (idx: number) => void;
  isAnswered: boolean;
}) {
  return (
    <div className="space-y-4">
      {question.options?.map((option, idx) => {
        const isSelected = selectedAnswer === idx;
        const isCorrect = idx === question.correctAnswer;
        
        let buttonStyle = 'bg-card border-border/50 text-studynow-dark hover:border-[#186636] hover:bg-[#186636]/5';
        
        if (isAnswered) {
          if (isCorrect) {
            buttonStyle = 'bg-[#186636] border-[#186636] text-white';
          } else if (isSelected && !isCorrect) {
            buttonStyle = 'bg-[#D9534F] border-[#D9534F] text-white';
          } else {
            buttonStyle = 'bg-muted/30 border-border/30 text-muted-foreground';
          }
        } else if (isSelected) {
          buttonStyle = 'bg-[#186636]/10 border-[#186636] text-[#186636]';
        }

        return (
          <motion.button
            key={idx}
            onClick={() => !isAnswered && onSelectAnswer(idx)}
            disabled={isAnswered}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-3 ${buttonStyle}`}
          >
            <span className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {String.fromCharCode(65 + idx)}
            </span>
            <span className="font-medium">{option}</span>
            {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 ml-auto text-white" />}
            {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 ml-auto text-white" />}
          </motion.button>
        );
      })}
    </div>
  );
}

// Fill in the Blank Question Component
function FillBlankQuestion({
  question,
  answer,
  onAnswerChange,
  isAnswered,
}: {
  question: Question;
  answer: string;
  onAnswerChange: (val: string) => void;
  isAnswered: boolean;
}) {
  const parts = question.text.split('_____');
  const isCorrect = answer.toLowerCase().trim() === String(question.correctAnswer).toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="text-lg leading-relaxed">
        {parts[0]}
        <span className="inline-flex items-center mx-2">
          <Input
            value={answer}
            onChange={(e) => !isAnswered && onAnswerChange(e.target.value)}
            disabled={isAnswered}
            placeholder="..."
            className={`w-40 h-10 text-center font-semibold border-b-2 border-t-0 border-x-0 rounded-none bg-transparent focus:ring-0 ${
              isAnswered
                ? isCorrect
                  ? 'border-[#186636] text-[#186636]'
                  : 'border-[#D9534F] text-[#D9534F]'
                : 'border-[#EAA93C] focus:border-[#186636]'
            }`}
          />
        </span>
        {parts[1]}
      </div>
      {isAnswered && !isCorrect && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-[#186636] font-medium"
        >
          Correct answer: <span className="font-bold">{question.correctAnswer}</span>
        </motion.p>
      )}
    </motion.div>
  );
}

// Structured Question Component
function StructuredQuestion({
  question,
  answer,
  onAnswerChange,
  isAnswered,
}: {
  question: Question;
  answer: string;
  onAnswerChange: (val: string) => void;
  isAnswered: boolean;
}) {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <Textarea
        value={answer}
        onChange={(e) => !isAnswered && onAnswerChange(e.target.value)}
        disabled={isAnswered}
        placeholder="Type your answer here..."
        className="min-h-[120px] bg-card border-border/50 rounded-xl resize-none focus:border-[#186636]"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{wordCount} words</span>
        {question.wordLimit && (
          <span className={wordCount > question.wordLimit ? 'text-[#D9534F]' : ''}>
            Target: ~{question.wordLimit} words
          </span>
        )}
      </div>
    </motion.div>
  );
}

// Diagram Question Component
function DiagramQuestion({
  question,
  answer,
  onAnswerChange,
  isAnswered,
}: {
  question: Question;
  answer: string;
  onAnswerChange: (val: string) => void;
  isAnswered: boolean;
}) {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Diagram Image */}
      <div className="relative rounded-xl overflow-hidden bg-card border border-border/30">
        <img
          src={question.diagramUrl}
          alt="Question diagram"
          className="w-full h-48 object-cover"
        />
        <div className="absolute top-3 right-3">
          <Badge className="bg-[#186636] text-white border-0">
            <span className="mr-1">X</span> ← Identify this
          </Badge>
        </div>
      </div>

      {/* Answer Input */}
      <Textarea
        value={answer}
        onChange={(e) => !isAnswered && onAnswerChange(e.target.value)}
        disabled={isAnswered}
        placeholder="Identify structure X and explain its function..."
        className="min-h-[100px] bg-card border-border/50 rounded-xl resize-none focus:border-[#186636]"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{wordCount} words</span>
        {question.wordLimit && (
          <span className={wordCount > question.wordLimit ? 'text-[#D9534F]' : ''}>
            Target: ~{question.wordLimit} words
          </span>
        )}
      </div>
    </motion.div>
  );
}

// Answer Feedback Component
function AnswerFeedback({ question, isCorrect }: { question: Question; isCorrect: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-2xl ${isCorrect ? 'bg-[#186636]/10' : 'bg-[#D9534F]/10'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-[#186636]' : 'bg-[#D9534F]'}`}>
          {isCorrect ? (
            <CheckCircle2 className="w-6 h-6 text-white" />
          ) : (
            <XCircle className="w-6 h-6 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className={`font-bold text-lg mb-2 ${isCorrect ? 'text-[#186636]' : 'text-[#D9534F]'}`}>
            {isCorrect ? 'Correct!' : 'Not quite right'}
          </p>
          <p className="text-sm text-studynow-dark/80 leading-relaxed mb-3">
            {question.explanation}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">This concept connects to →</span>
            <Badge className="bg-[#EAA93C] text-studynow-dark border-0 font-semibold cursor-pointer hover:bg-[#d99a2f] transition-colors">
              {question.linkedConcept}
            </Badge>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Active Quiz Panel Component
function ActiveQuizPanel({
  questions,
  currentIndex,
  onAnswer,
  onSubmitAnswer,
  onNext,
  onFinish,
  answers,
  submittedAnswers,
  isFinishing,
  subject,
  topic,
}: {
  questions: Question[];
  currentIndex: number;
  onAnswer: (answer: string | number) => void;
  onSubmitAnswer: () => void;
  onNext: () => void;
  onFinish: () => void;
  answers: (string | number | null)[];
  submittedAnswers: boolean[];
  isFinishing: boolean;
  subject: string;
  topic: string;
}) {
  const [timeLeft, setTimeLeft] = useState(60);
  const question = questions[currentIndex];
  const displayedSource = question.source?.replace('Biology', subject || 'Biology');
  const currentAnswer = answers[currentIndex];
  const isAnswered = question.type === 'mcq'
    ? currentAnswer !== null
    : Boolean(submittedAnswers[currentIndex]);
  const shouldReduceMotion = useReducedMotion();
  
  // Timer effect
  useEffect(() => {
    if (isAnswered) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isAnswered, currentIndex]);

  // Reset timer on question change
  useEffect(() => {
    setTimeLeft(60);
  }, [currentIndex]);

  // Check if answer is correct
  const getIsCorrect = (): boolean => isQuizAnswerCorrect(question, currentAnswer);

  return (
    <motion.div
      key={currentIndex}
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 140, y: 18, rotate: 7, scale: 0.92 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -120, y: 12, rotate: -6, scale: 0.94 }}
      transition={shouldReduceMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 210, damping: 24, mass: 0.9 }}
      className="h-full flex flex-col origin-center will-change-transform"
    >
      {/* Question Card */}
      <Card className="flex-1 border-0 rounded-3xl overflow-hidden card-shadow">
        <CardContent className="p-6 lg:p-8 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Badge className="bg-[#186636]/10 text-[#186636] border-0 font-semibold">
                {topic}
              </Badge>
              <span className="text-sm text-muted-foreground font-medium">
                Question {currentIndex + 1} of {questions.length}
              </span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${timeLeft <= 10 ? 'bg-[#D9534F]/10 text-[#D9534F]' : 'bg-muted/30 text-muted-foreground'}`}>
              <Clock className="w-4 h-4" />
              <span className="font-mono font-semibold text-sm">{timeLeft}s</span>
            </div>
          </div>

          {/* Source tag for past paper questions */}
          {(displayedSource || question.resourceNumber) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-2 mb-4"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EAA93C]/10">
                <FileText className="w-4 h-4 text-[#EAA93C]" />
                <span className="text-sm text-[#EAA93C] font-medium">{displayedSource}</span>
              </div>
              {question.resourceNumber && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#186636]/10">
                  <span className="text-xs font-bold text-[#186636] tracking-wide">📋</span>
                  <span className="text-xs font-mono text-[#186636] font-semibold">{question.resourceNumber}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Progress Bar */}
          <div className="mb-6">
            <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2" />
          </div>

          {/* Question Text */}
          <h3 className="text-xl lg:text-2xl font-bold text-studynow-dark leading-relaxed mb-8">
            {question.type === 'fill-blank' ? '' : question.text}
          </h3>

          {/* Question Type Specific Content */}
          <div className="flex-1">
            {question.type === 'mcq' && (
              <MCQQuestion
                question={question}
                selectedAnswer={typeof currentAnswer === 'number' ? currentAnswer : null}
                onSelectAnswer={(idx) => onAnswer(idx)}
                isAnswered={isAnswered}
              />
            )}
            {question.type === 'fill-blank' && (
              <FillBlankQuestion
                question={question}
                answer={typeof currentAnswer === 'string' ? currentAnswer : ''}
                onAnswerChange={(val) => onAnswer(val)}
                isAnswered={isAnswered}
              />
            )}
            {question.type === 'structured' && (
              <StructuredQuestion
                question={question}
                answer={typeof currentAnswer === 'string' ? currentAnswer : ''}
                onAnswerChange={(val) => onAnswer(val)}
                isAnswered={isAnswered}
              />
            )}
            {question.type === 'diagram' && (
              <DiagramQuestion
                question={question}
                answer={typeof currentAnswer === 'string' ? currentAnswer : ''}
                onAnswerChange={(val) => onAnswer(val)}
                isAnswered={isAnswered}
              />
            )}
          </div>

          {/* Answer Feedback */}
          <AnimatePresence>
            {isAnswered && (
              <div className="mt-6">
                <AnswerFeedback question={question} isCorrect={getIsCorrect()} />
              </div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-6 pt-4 border-t border-border/30 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {question.type === 'mcq' ? 'Select an option' : question.type === 'fill-blank' ? 'Fill in the blank' : 'Write your answer'}
            </span>
            {isAnswered ? (
              <Button
                onClick={currentIndex < questions.length - 1 ? onNext : onFinish}
                disabled={isFinishing}
                className="bg-[#186636] hover:bg-[#186636]/90 text-white font-semibold rounded-xl px-6"
              >
                {currentIndex < questions.length - 1 ? (
                  <>
                    Next Question
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    {isFinishing ? 'Saving Results...' : 'View Results'}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              question.type !== 'mcq' && (
                <Button
                  onClick={onSubmitAnswer}
                  className="bg-[#EAA93C] hover:bg-[#d99a2f] text-studynow-dark font-semibold rounded-xl px-6"
                >
                  Submit Answer
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Auto-starting Quiz State
function AutoStartingState({ topic, isRescue }: { topic: string; isRescue: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-full flex flex-col items-center justify-center text-center p-8"
    >
      <motion.div 
        className="w-24 h-24 rounded-full bg-[#186636]/10 flex items-center justify-center mb-6"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <Sparkles className="w-12 h-12 text-[#EAA93C]" />
      </motion.div>
      <h3 className="text-2xl font-bold text-studynow-dark mb-3">{isRescue ? 'Starting 10-Minute Rescue...' : 'Generating Your Quiz...'}</h3>
      <p className="text-muted-foreground max-w-md leading-relaxed">
        {isRescue ? 'Opening Speed mode with a visible 10-minute target for ' : 'Creating personalized questions for '}<span className="font-semibold text-[#186636]">{topic}</span>{isRescue ? '.' : ' based on your memory score.'}
      </p>
      <motion.div
        className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-[#EAA93C]/10"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="w-2 h-2 rounded-full bg-[#EAA93C]" />
        <span className="text-sm font-medium text-[#EAA93C]">Loading questions...</span>
      </motion.div>
    </motion.div>
  );
}

// Quiz Setup Empty State
function QuizEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col items-center justify-center text-center p-8"
    >
      <div className="w-24 h-24 rounded-full bg-[#186636]/10 flex items-center justify-center mb-6">
        <Brain className="w-12 h-12 text-[#186636]" />
      </div>
      <h3 className="text-2xl font-bold text-studynow-dark mb-3">Ready to Test Your Knowledge?</h3>
      <p className="text-muted-foreground max-w-md leading-relaxed">
        Select a subject and topic from the left panel, then generate a personalized quiz tailored to your memory score.
      </p>
      <div className="flex gap-6 mt-8">
        {[
          { icon: FileText, label: 'Past Paper Questions', desc: 'Real O-Level papers' },
          { icon: Brain, label: 'Concept Checks', desc: 'AI-generated tests' },
          { icon: Zap, label: 'Speed Rounds', desc: '5 rapid-fire MCQs' },
        ].map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card/50"
          >
            <item.icon className="w-6 h-6 text-[#EAA93C]" />
            <span className="text-sm font-semibold text-studynow-dark">{item.label}</span>
            <span className="text-xs text-muted-foreground">{item.desc}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Results Panel Component
function ResultsPanel({
  questions,
  topic,
  previousScore,
  attemptResult,
  onRetake,
  onViewConceptWeb,
}: {
  questions: Question[];
  topic: string;
  previousScore: number;
  attemptResult: QuizAttemptResult;
  onRetake: () => void;
  onViewConceptWeb: () => void;
}) {
  const newScore = attemptResult.percentCorrect;
  
  // Question type breakdown
  const breakdown = {
    mcq: { total: 0, correct: 0 },
    'fill-blank': { total: 0, correct: 0 },
    structured: { total: 0, correct: 0 },
    diagram: { total: 0, correct: 0 },
  };

  questions.forEach((q, idx) => {
    breakdown[q.type].total++;
    const serverAnswer = attemptResult.answers.find((result) => result.questionIndex === idx);
    if (serverAnswer?.isCorrect === true) {
      breakdown[q.type].correct++;
    }
  });

  const nextReviewDate = new Date(attemptResult.nextReviewAt);
  const nextReviewDays = Math.max(
    0,
    Math.ceil((nextReviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const nextReviewLabel = nextReviewDays === 0
    ? 'Today'
    : nextReviewDays === 1
      ? 'Tomorrow'
      : `In ${nextReviewDays} days`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-full flex flex-col"
    >
      <Card className="flex-1 border-0 rounded-3xl overflow-hidden card-shadow">
        <CardContent className="p-8 h-full flex flex-col">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#186636]/10 mb-4"
            >
              <CheckCircle2 className="w-5 h-5 text-[#186636]" />
              <span className="font-semibold text-[#186636]">Quiz Completed!</span>
            </motion.div>
            <h2 className="text-2xl font-bold text-studynow-dark">{topic}</h2>
            <p className="text-muted-foreground mt-1">Here's how you performed</p>
          </div>

          {/* Main Score Gauge */}
          <div className="flex justify-center mb-8">
            <AnimatedGauge score={newScore} previousScore={previousScore} size={180} />
          </div>

          {/* Comparison Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <p className="text-sm font-semibold text-studynow-dark mb-3">This attempt vs last attempt</p>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Previous</span>
                  <span className="text-sm font-semibold text-muted-foreground">{previousScore}%</span>
                </div>
                <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${previousScore}%` }}
                    transition={{ delay: 0.7, duration: 0.8 }}
                    className="h-full bg-muted-foreground/40 rounded-full"
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-studynow-dark font-medium">Current</span>
                  <span className="text-sm font-bold text-[#186636]">{newScore}%</span>
                </div>
                <div className="h-3 bg-[#186636]/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${newScore}%` }}
                    transition={{ delay: 0.9, duration: 0.8 }}
                    className="h-full bg-[#186636] rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Breakdown by Question Type */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-8"
          >
            <p className="text-sm font-semibold text-studynow-dark mb-3">Breakdown by Question Type</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(breakdown)
                .filter(([, data]) => data.total > 0)
                .map(([type, data], idx) => (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 + idx * 0.1 }}
                    className="p-4 rounded-xl bg-muted/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-studynow-dark capitalize">
                        {type.replace('-', ' ')}
                      </span>
                      <span className="text-sm font-bold text-[#186636]">
                        {data.correct}/{data.total}
                      </span>
                    </div>
                    <Progress value={(data.correct / data.total) * 100} className="h-2" />
                  </motion.div>
                ))}
            </div>
          </motion.div>

          {/* Next Review Date */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-[#EAA93C]/10 mb-8"
          >
            <Calendar className="w-5 h-5 text-[#EAA93C]" />
            <div>
              <p className="text-sm font-semibold text-studynow-dark">
                Next review: {nextReviewLabel}
              </p>
              <p className="text-xs text-muted-foreground">Based on your score, spaced repetition optimized</p>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <div className="mt-auto flex gap-3">
            <Button
              onClick={onRetake}
              variant="outline"
              className="flex-1 h-12 rounded-xl border-[#186636] text-[#186636] hover:bg-[#186636]/10 font-semibold"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake Quiz
            </Button>
            <Button
              onClick={onViewConceptWeb}
              data-concept-web-button
              className="flex-1 h-12 rounded-xl bg-[#186636] hover:bg-[#186636]/90 text-white font-semibold"
            >
              View in Concept Web
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Main Quiz Page Component
export default function QuizPage() {
  const { data: account } = useCurrentAccount();

  return isTeachingRole(account?.profile?.role)
    ? <TeacherQuizReview />
    : <StudentQuizPage />;
}

function StudentQuizPage() {
  const { notify } = useMascotFeedback();
  const queryClient = useQueryClient();
  // URL params for auto-selection from concept web
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMode = searchParams.get('mode');
  const urlRescueId = searchParams.get('rescueId');
  const urlSubject = searchParams.get('subject');
  const urlTopic = searchParams.get('topic');
  const urlScore = searchParams.get('score');
  const [rescueLogs, setRescueLogs] = useAtom(rescueNudgeLogsAtom);
  const hasAutoStarted = useRef(false);
  const quizFinishNotifiedRef = useRef(false);
  
  // Global state
  const [subjects, setSubjects] = useAtom(subjectsAtom);
  
  // Local state
  const [selectedMemoryScore, setSelectedMemoryScore] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [quizMode, setQuizMode] = useState<QuizMode>('past-paper');
  const [activeRescueId, setActiveRescueId] = useState<string | null>(null);
  const [quizState, setQuizState] = useState<QuizState>('setup');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(string | number | null)[]>([]);
  const [submittedAnswers, setSubmittedAnswers] = useState<boolean[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [autoStarting, setAutoStarting] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [attemptStartedAt, setAttemptStartedAt] = useState('');
  const [attemptResult, setAttemptResult] = useState<QuizAttemptResult | null>(null);
  const [isSubmittingAttempt, setIsSubmittingAttempt] = useState(false);

  // Get current topic data from global state
  const currentTopic = useMemo(() => {
    if (!selectedSubject || !selectedTopicId) return null;
    const subject = subjects.find(s => s.name === selectedSubject);
    return subject?.topics.find(t => t.id === selectedTopicId) ?? null;
  }, [subjects, selectedSubject, selectedTopicId]);

  // Get previous memory score for comparison (effective score with decay)
  const previousScore = selectedMemoryScore ?? (currentTopic
    ? (getEffectiveScore(currentTopic) ?? 50)
    : 50);

  // Auto-select subject and topic from URL params (from concept web navigation)
  useEffect(() => {
    if (urlSubject && urlTopic && !hasAutoStarted.current) {
      const subjectData = subjects.find((subject) => subject.name === urlSubject);
      if (subjectData) {
        // Find a matching topic (case-insensitive, partial match)
        const matchingTopic = subjectData.topics.find((topic) =>
          topic.name.toLowerCase() === urlTopic.toLowerCase() ||
          topic.name.toLowerCase().includes(urlTopic.toLowerCase()) ||
          urlTopic.toLowerCase().includes(topic.name.toLowerCase())
        );
        
        if (matchingTopic) {
          const parsedScore = urlScore !== null ? Number(urlScore) : null;
          // Set the subject, topic, and exact dashboard memory score
          setSelectedSubject(urlSubject);
          setSelectedTopic(matchingTopic.name);
          setSelectedTopicId(matchingTopic.id);
          setSelectedMemoryScore(Number.isFinite(parsedScore) ? parsedScore : null);

          if (urlMode === 'past-paper' || urlMode === 'concept-check' || urlMode === 'speed-round') {
            setQuizMode(urlMode);
          }
          if (urlRescueId) setActiveRescueId(urlRescueId);

          // Mark as auto-starting and trigger quiz generation
          hasAutoStarted.current = true;
          setAutoStarting(true);

          // Clear URL params
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('subject');
          newParams.delete('topic');
          newParams.delete('mode');
          newParams.delete('rescueId');
          newParams.delete('score');
          setSearchParams(newParams, { replace: true });
          
          // Auto-generate quiz after a brief delay for UI to update
          setTimeout(() => {
            const selectedQuestions = getQuestionsForSelection(urlSubject, matchingTopic.name);
            if (!selectedQuestions) {
              setQuestions([]);
              setAnswers([]);
              setSubmittedAnswers([]);
              setQuizState('setup');
              setAutoStarting(false);
              toast.error('No questions available for this topic');
              return;
            }
            setQuestions(selectedQuestions);
            setAnswers(new Array(selectedQuestions.length).fill(null));
            setSubmittedAnswers(new Array(selectedQuestions.length).fill(false));
            setCurrentQuestionIndex(0);
            setSubmissionId(crypto.randomUUID());
            setAttemptStartedAt(new Date().toISOString());
            setAttemptResult(null);
            quizFinishNotifiedRef.current = false;
            setQuizState('active');
            setAutoStarting(false);
          }, 500);
        }
      }
    }
  }, [urlSubject, urlTopic, urlScore, urlMode, urlRescueId, subjects, searchParams, setSearchParams]);

  // Handle quiz generation
  const handleGenerateQuiz = () => {
    const selectedQuestions = getQuestionsForSelection(selectedSubject, selectedTopic);
    if (!selectedQuestions) {
      setQuestions([]);
      setAnswers([]);
      setSubmittedAnswers([]);
      setQuizState('setup');
      toast.error('No questions available for this topic');
      return;
    }
    setQuestions(selectedQuestions);
    setAnswers(new Array(selectedQuestions.length).fill(null));
    setSubmittedAnswers(new Array(selectedQuestions.length).fill(false));
    setCurrentQuestionIndex(0);
    setSubmissionId(crypto.randomUUID());
    setAttemptStartedAt(new Date().toISOString());
    setAttemptResult(null);
    quizFinishNotifiedRef.current = false;
    setQuizState('active');
  };

  // Handle answer submission
  const handleAnswer = (answer: string | number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answer;
    setAnswers(newAnswers);
  };

  const handleSubmitCurrentAnswer = () => {
    const answer = answers[currentQuestionIndex];
    if (answer === null || (typeof answer === 'string' && answer.trim() === '')) {
      toast.error('Enter an answer before continuing.');
      return;
    }
    setSubmittedAnswers((current) => current.map((submitted, index) => (
      index === currentQuestionIndex ? true : submitted
    )));
  };

  // Handle next question
  const handleNextQuestion = () => {
    setCurrentQuestionIndex((prev) => prev + 1);
  };

  // Persist the attempt first. The API grades against the shared static bank;
  // client-calculated scores are never accepted as the source of truth.
  const handleFinishQuiz = async () => {
    if (isSubmittingAttempt) return;
    if (!selectedTopicId || !submissionId || !attemptStartedAt) {
      toast.error('This quiz could not be identified. Please generate it again.');
      return;
    }
    if (answers.some((answer) => answer === null)) {
      toast.error('Answer every question before viewing results.');
      return;
    }

    setIsSubmittingAttempt(true);
    try {
      const result = await submitQuizAttempt({
        submissionId,
        topicId: selectedTopicId,
        mode: quizMode,
        startedAt: attemptStartedAt,
        answers: questions.map((question, index) => ({
          questionKey: getQuizQuestionKey(selectedTopicId, question.id),
          answer: answers[index] as string | number,
        })),
      });

      if (result.answers.length !== result.totalQuestions) {
        throw new Error('EduNets could not load the server-graded answer breakdown. Please try again.');
      }

      setAttemptResult(result);
      setSubjects((currentSubjects) => currentSubjects.map((subject) => ({
        ...subject,
        topics: subject.topics.map((topic) => topic.id === selectedTopicId
          ? {
              ...topic,
              memoryScore: result.resultingMemoryScore,
              lastReviewedAt: result.submittedAt,
              nextReviewAt: result.nextReviewAt,
              quizAttempts: topic.quizAttempts + (result.idempotentReplay ? 0 : 1),
            }
          : topic),
      })));
      await queryClient.invalidateQueries({ queryKey: ['study-state'] });

      if (activeRescueId) {
        const resolvedAt = Date.now();
        const completedLog = rescueLogs.find((log: RescueNudgeLog) => (
          log.id === activeRescueId && log.rescueStatus !== 'completed'
        ));
        setRescueLogs((currentLogs: RescueNudgeLog[]) => currentLogs.map((log: RescueNudgeLog) => {
          if (log.id !== activeRescueId || log.rescueStatus === 'completed') return log;
          return { ...log, pendingRescue: false, rescueStatus: 'completed', resolvedAt };
        }));
        if (completedLog) {
          toast.success(`${completedLog.memberName}'s rescue kept the streak alive — Day 19!`);
        }
        setActiveRescueId(null);
      }

      if (!quizFinishNotifiedRef.current) {
        quizFinishNotifiedRef.current = true;
        notify({
          type: 'quizFinished',
          score: result.correctAnswers,
          total: result.totalQuestions,
        });
      }
      setQuizState('results');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'EduNets could not save this quiz.');
    } finally {
      setIsSubmittingAttempt(false);
    }
  };

  // Handle retake
  const handleRetake = () => {
    setAnswers(new Array(questions.length).fill(null));
    setSubmittedAnswers(new Array(questions.length).fill(false));
    setCurrentQuestionIndex(0);
    setSubmissionId(crypto.randomUUID());
    setAttemptStartedAt(new Date().toISOString());
    setAttemptResult(null);
    quizFinishNotifiedRef.current = false;
    setQuizState('active');
  };

  // Handle view concept web
  const handleViewConceptWeb = () => {
    toast.info('Concept Web connection coming soon');
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 p-6 lg:p-8 pattern-overlay">
      {/* Left Panel - Quiz Setup */}
      <div className="w-full lg:w-[35%] flex-shrink-0">
        <Card className="h-full border-0 rounded-3xl overflow-hidden card-shadow bg-card">
          <CardContent className="p-6 h-full">
            <QuizSetupPanel
              selectedSubject={selectedSubject}
              setSelectedSubject={setSelectedSubject}
              selectedTopic={selectedTopic}
              setSelectedTopic={(topic: string) => {
                setSelectedTopic(topic);
                setSelectedMemoryScore(null);
              }}
              setSelectedTopicId={setSelectedTopicId}
              quizMode={quizMode}
              setQuizMode={setQuizMode}
              onGenerateQuiz={handleGenerateQuiz}
              globalSubjects={subjects}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Active Quiz / Results */}
      <div className="flex-1 min-h-[600px]">
        <AnimatePresence mode="wait">
          {quizState === 'setup' && !autoStarting && <QuizEmptyState key="empty" />}
          {quizState === 'setup' && autoStarting && <AutoStartingState key="auto-starting" topic={selectedTopic} isRescue={activeRescueId !== null} />}
          {quizState === 'active' && (
            <ActiveQuizPanel
              key="active"
              questions={questions}
              currentIndex={currentQuestionIndex}
              onAnswer={handleAnswer}
              onSubmitAnswer={handleSubmitCurrentAnswer}
              onNext={handleNextQuestion}
              onFinish={() => void handleFinishQuiz()}
              answers={answers}
              submittedAnswers={submittedAnswers}
              isFinishing={isSubmittingAttempt}
              subject={selectedSubject}
              topic={selectedTopic}
            />
          )}
          {quizState === 'results' && attemptResult && (
            <ResultsPanel
              key="results"
              questions={questions}
              topic={selectedTopic}
              previousScore={previousScore}
              attemptResult={attemptResult}
              onRetake={handleRetake}
              onViewConceptWeb={handleViewConceptWeb}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
