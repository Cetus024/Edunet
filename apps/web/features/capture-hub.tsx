'use client';

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Upload,
  Pencil,
  Sparkles,
  Lightbulb,
  Network,
  ClipboardList,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  RefreshCw,
  File,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Layers,
  Tag,
  Folder,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  evaluateNotes as evaluateNotesApi,
  generateFlashcards as generateFlashcardsApi,
  generateTopicNotes as generateTopicNotesApi,
  getFocusGuidance,
  ocrImage,
  summarizeNotes as summarizeNotesApi,
  type CaptureFailure,
  type Flashcard,
  type FocusGuidanceResult,
  type NoteEvaluation,
} from '@/lib/api/capture';
import { ApiConnectionError, isApiError } from '@/lib/api/client';
import { useCatalog } from '@/lib/api/study';
import {
  formatImageBytes,
  MAX_OCR_IMAGE_BYTES,
  MAX_SOURCE_IMAGE_BYTES,
  prepareImageForOcr,
} from '@/lib/capture-image';
import { CURRICULUM } from '@/lib/curriculum';
import { resolveRubricTopicId } from '@/lib/discussion-rubric';
import { EvaluationNextSteps } from '@/features/capture/evaluation-next-steps';
import { QuizRevisionGuidance } from '@/features/capture/quiz-revision-guidance';
import { TopicFlashcardDeck } from '@/features/capture/topic-flashcard-deck';
import { StudyNotesView } from '@/features/notes/study-notes-view';
import type { QuizRecap } from '@/lib/api/quiz';

// Subject data
const subjects = [
  { id: 'e-math', name: 'Mathematics', icon: '🔢' },
  { id: 'chemistry', name: 'Chemistry', icon: '⚗️' },
];

type DebugLogStatus = 'running' | 'success' | 'warning' | 'error';

type DebugLogEntry = {
  id: string;
  time: string;
  stage: string;
  status: DebugLogStatus;
  message: string;
};

function describeCaptureFailure(failure: CaptureFailure): string {
  if (failure.reason === 'incomplete_output') {
    return 'The AI response reached its token limit before finishing. Your notes are still available; try a shorter section.';
  }
  if (failure.reason === 'rate_limited') {
    return `The AI service has reached its request or token limit. Try again in ${Math.max(1, failure.retryAfterSeconds ?? 60)} seconds. Your notes are still available.`;
  }
  if (failure.reason === 'timeout') {
    return 'The AI service took too long to respond. Your notes are still available; please try again.';
  }
  if (failure.reason === 'not_configured') {
    return failure.stage === 'ocr'
      ? 'OCR is not connected: Gemini server credentials are not configured.'
      : failure.stage === 'generate'
        ? 'Note generation is not connected: Gemini 3.1 Flash-Lite is not configured on the server.'
        : 'Analysis is not connected: no Gemini model is configured on the server.';
  }
  if (failure.reason === 'no_textbook') {
    return 'This topic has no staff textbook in the syllabus database yet, so notes or flashcards cannot be generated.';
  }
  if (failure.reason === 'no_text') {
    return 'Gemini connected, but it could not detect readable text in this image.';
  }
  if (failure.reason === 'no_summary') {
    return 'The model connected, but it did not produce a usable summary from these notes.';
  }
  if (failure.reason === 'topic_not_found') {
    return 'The summary was created, but the selected topic was not found in the backend syllabus database.';
  }
  if (failure.reason === 'invalid_evaluation') {
    return 'The summary was created, but the model evaluation response could not be read safely.';
  }
  if (failure.stage === 'generate') {
    return 'Gemini is configured, but generating from the textbook failed or timed out.';
  }
  if (failure.stage === 'ocr') {
    return 'Gemini is configured, but the OCR request failed or timed out.';
  }
  if (failure.stage === 'summary') {
    return 'The analysis provider is configured, but summary generation failed or timed out.';
  }
  if (failure.stage === 'grounding') {
    return 'The summary was created, but the syllabus database could not be read.';
  }
  return 'The summary was created, but evaluation failed or timed out.';
}

function describeRequestError(error: unknown, operation: string): string {
  if (error instanceof ApiConnectionError) {
    return `${operation} could not start because Revision Hub cannot connect to the EduNets API.`;
  }
  if (isApiError(error)) {
    if (error.status === 413) {
      return `${operation} failed because the prepared image was still too large for the online service. Try cropping it to the note page.`;
    }
    const requestId = error.requestId ? ` Request ID: ${error.requestId}.` : '';
    return `${operation} failed: ${error.message}${requestId}`;
  }
  return `${operation} failed because of an unexpected client error.`;
}

function debugStatusClass(status: DebugLogStatus): string {
  if (status === 'success') return 'bg-emerald-500';
  if (status === 'warning') return 'bg-amber-500';
  if (status === 'error') return 'bg-red-500';
  return 'bg-blue-500 animate-pulse';
}

function UploadTile({
  icon: Icon,
  emoji,
  title,
  description,
  children,
  isActive,
  onClick,
  className = '',
  hideHeader = false,
}: {
  icon?: React.ElementType;
  emoji?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  hideHeader?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="h-full min-w-0"
    >
      <Card
        className={`relative h-full overflow-hidden border-2 transition-all duration-300 rounded-2xl ${
          isActive
            ? 'border-[#6486B5] bg-[#6486B5]/5 shadow-lg'
            : 'border-transparent bg-card hover:border-[#EAA93C]/30'
        } ${className}`}
        onClick={onClick}
      >
        <CardContent className="flex h-full flex-col p-6">
          {!hideHeader && (
            <div className="mb-4 flex items-center gap-3">
              {emoji && <span className="text-2xl">{emoji}</span>}
              {Icon && !emoji && (
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isActive ? 'bg-[#6486B5]' : 'bg-[#EAA93C]/20'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-[#EAA93C]'}`} />
                </div>
              )}
              <div>
                <h3 className="font-bold text-studynow-dark">{title}</h3>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1">{children}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function NotesLibraryLayer({
  notesGenSubject,
  setNotesGenSubject,
  notesGenTopic,
  setNotesGenTopic,
  notesGenTopics,
  resolvedNotesGenTopicId,
  isGeneratingNotes,
  onGenerateNotes,
  libraryNotes,
  isEditingGeneratedNotes,
  setIsEditingGeneratedNotes,
  setLibraryNotes,
}: {
  notesGenSubject: string;
  setNotesGenSubject: (value: string) => void;
  notesGenTopic: string;
  setNotesGenTopic: (value: string) => void;
  notesGenTopics: string[];
  resolvedNotesGenTopicId: string | null;
  isGeneratingNotes: boolean;
  onGenerateNotes: () => void;
  libraryNotes: string;
  isEditingGeneratedNotes: boolean;
  setIsEditingGeneratedNotes: (value: boolean | ((current: boolean) => boolean)) => void;
  setLibraryNotes: (value: string) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="rounded-2xl border-0 card-shadow">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-bold text-studynow-dark">Textbook Notes (Provided by EduNets)</h2>
            <p className="text-sm text-muted-foreground">
              Textbook-grounded revision notes by subject and topic.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={notesGenSubject}
              onValueChange={(value) => {
                setNotesGenSubject(value);
                setNotesGenTopic('');
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    <span className="flex items-center gap-2">
                      <span>{subject.icon}</span>
                      <span>{subject.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={notesGenTopic}
              onValueChange={setNotesGenTopic}
              disabled={!notesGenSubject}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={!notesGenSubject ? 'Select subject first' : 'Select topic'} />
              </SelectTrigger>
              <SelectContent>
                {notesGenTopics.map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {notesGenTopic && !resolvedNotesGenTopicId && (
            <p className="text-xs text-amber-800">
              This topic is not connected to syllabus data, so notes cannot be generated.
            </p>
          )}
          <Button
            onClick={onGenerateNotes}
            disabled={!resolvedNotesGenTopicId || isGeneratingNotes}
            className="rounded-xl bg-[#6486B5] hover:bg-[#6486B5]/90"
          >
            {isGeneratingNotes ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Writing from the textbook…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate notes
              </>
            )}
          </Button>

          {libraryNotes ? (
            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-semibold text-studynow-dark">Revision notes</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingGeneratedNotes((current) => !current)}
                  className="h-8 rounded-lg text-xs"
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  {isEditingGeneratedNotes ? 'Show formatted notes' : 'Edit notes'}
                </Button>
              </div>
              {isEditingGeneratedNotes ? (
                <Textarea
                  value={libraryNotes}
                  onChange={(event) => setLibraryNotes(event.target.value)}
                  className="min-h-48 resize-y rounded-xl"
                />
              ) : (
                <div className="rounded-xl border border-[#6486B5]/20 bg-white p-4">
                  <StudyNotesView text={libraryNotes} />
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-xl bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
              Pick a subject and topic, then generate notes to study here.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const CAPTURE_HUB_PROGRESS_STORAGE_KEY = 'edunets_capture_hub_progress';

type StoredCaptureProgress = {
  pastedText: string;
  extractedContent: string;
  selectedSubject: string;
  selectedTopic: string;
  activeMethod: string | null;
  quizRecapData: QuizRecap | null;
  focusGuidanceData: FocusGuidanceResult | null;
  evaluation: NoteEvaluation | null;
  evaluationSummaryPoints: string[];
  isTextReviewExpanded: boolean;
  hubView: 'home' | 'notes-library';
  flashcardSubject: string;
  flashcardTopic: string;
  flashcardSubtopicId: string;
  flashcards: Flashcard[];
};

function getStoredCaptureProgress(): StoredCaptureProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CAPTURE_HUB_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCaptureProgress;
  } catch {
    return null;
  }
}

export default function CaptureHubPage() {
  const { data: catalog } = useCatalog();

  // Lazy initialize from sessionStorage so switching between features retains notes and feedback
  const [initialCaptureProgress] = useState(() => getStoredCaptureProgress());

  // Note capture states. OCR and typed text are deliberately additive so a
  // student can photograph a handwritten page, correct it, and add details
  // from a phone or laptop without using voice transcription.
  const [activeMethod, setActiveMethod] = useState<string | null>(() => initialCaptureProgress?.activeMethod ?? null);
  const [pastedText, setPastedText] = useState(() => initialCaptureProgress?.pastedText ?? '');
  const [uploads, setUploads] = useState<Array<{
    id: string;
    name: string;
    status: 'queued' | 'preparing' | 'reading' | 'success' | 'error';
    message?: string;
  }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const uploadBusyRef = useRef(false);
  const [ocrTranscript, setOcrTranscript] = useState('');
  const [isTextReviewExpanded, setIsTextReviewExpanded] = useState(() => initialCaptureProgress?.isTextReviewExpanded ?? false);
  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);

  // Processing state
  const [extractedContent, setExtractedContent] = useState(() => initialCaptureProgress?.extractedContent ?? '');
  const [selectedSubject, setSelectedSubject] = useState(() => initialCaptureProgress?.selectedSubject ?? '');
  const [selectedTopic, setSelectedTopic] = useState(() => initialCaptureProgress?.selectedTopic ?? '');
  const [isOcrRunning, setIsOcrRunning] = useState(false);

  // Evaluate: how well the captured notes cover the selected topic's syllabus
  // content, judged against the same reference material the discussion room
  // uses. Only offered when the topic actually resolves to real syllabus
  // content -- these subject/topic pickers are demo data that only partly
  // line up with the real catalog, and a room that cannot score anything
  // should stay hidden rather than open to a blank result.
  const [isEvaluating, setIsEvaluating] = useState(false);
  const isProcessing = isEvaluating;
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isEditingGeneratedNotes, setIsEditingGeneratedNotes] = useState(false);
  const [evaluation, setEvaluation] = useState<NoteEvaluation | null>(() => initialCaptureProgress?.evaluation ?? null);
  const [evaluationSummaryPoints, setEvaluationSummaryPoints] = useState<string[]>(() => initialCaptureProgress?.evaluationSummaryPoints ?? []);
  const [evaluationUnavailable, setEvaluationUnavailable] = useState(false);
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<{
    evaluation: NoteEvaluation;
    summaryPoints: string[];
  } | null>(null);

  // Landing vs Notes Library layer; flashcards and library-generated notes.
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quizRecapData, setQuizRecapData] = useState<QuizRecap | null>(() => initialCaptureProgress?.quizRecapData ?? null);
  const [focusGuidanceData, setFocusGuidanceData] = useState<FocusGuidanceResult | null>(() => initialCaptureProgress?.focusGuidanceData ?? null);
  const [isGettingGuidance, setIsGettingGuidance] = useState(false);
  const [hubView, setHubView] = useState<'home' | 'notes-library'>(() => initialCaptureProgress?.hubView ?? 'home');
  const [flashcardSubject, setFlashcardSubject] = useState(() => initialCaptureProgress?.flashcardSubject ?? '');
  const [flashcardTopic, setFlashcardTopic] = useState(() => initialCaptureProgress?.flashcardTopic ?? '');
  /** Empty string = whole topic; otherwise a curriculum subtopic id. */
  const [flashcardSubtopicId, setFlashcardSubtopicId] = useState(() => initialCaptureProgress?.flashcardSubtopicId ?? '');
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>(() => initialCaptureProgress?.flashcards ?? []);
  const [notesGenSubject, setNotesGenSubject] = useState('');
  const [notesGenTopic, setNotesGenTopic] = useState('');
  const [libraryNotes, setLibraryNotes] = useState('');

  // Persist Revision Hub progress so switching tabs or features keeps user work
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasAnyContent = Boolean(
      pastedText.trim() ||
      extractedContent.trim() ||
      focusGuidanceData ||
      quizRecapData ||
      evaluation ||
      flashcards.length > 0
    );

    if (hasAnyContent) {
      const data: StoredCaptureProgress = {
        pastedText,
        extractedContent,
        selectedSubject,
        selectedTopic,
        activeMethod,
        quizRecapData,
        focusGuidanceData,
        evaluation,
        evaluationSummaryPoints,
        isTextReviewExpanded,
        hubView,
        flashcardSubject,
        flashcardTopic,
        flashcardSubtopicId,
        flashcards,
      };
      sessionStorage.setItem(CAPTURE_HUB_PROGRESS_STORAGE_KEY, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(CAPTURE_HUB_PROGRESS_STORAGE_KEY);
    }
  }, [
    pastedText,
    extractedContent,
    selectedSubject,
    selectedTopic,
    activeMethod,
    quizRecapData,
    focusGuidanceData,
    evaluation,
    evaluationSummaryPoints,
    isTextReviewExpanded,
    hubView,
    flashcardSubject,
    flashcardTopic,
    flashcardSubtopicId,
    flashcards,
  ]);

  // Load Quiz Recap into Typed Notes if navigated from quiz
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isRecap = searchParams.get('recap') === 'true';
    const querySubject = searchParams.get('subject');
    const queryTopic = searchParams.get('topic');

    let loadedRecap: QuizRecap | null = null;
    const raw = sessionStorage.getItem('edunets_quiz_recap_revision');
    if (raw) {
      try {
        loadedRecap = JSON.parse(raw);
      } catch {
        loadedRecap = null;
      }
    }

    if (isRecap || loadedRecap) {
      if (loadedRecap) {
        setQuizRecapData(loadedRecap);
        if (loadedRecap.typedNotesText) {
          setPastedText(loadedRecap.typedNotesText);
          setExtractedContent(loadedRecap.typedNotesText);
        }
      }
      if (querySubject || loadedRecap?.subjectId) {
        const targetSub = querySubject || loadedRecap?.subjectId || '';
        const match = subjects.find(
          (s) => s.id === targetSub || s.name.toLowerCase() === targetSub.toLowerCase()
        );
        if (match) setSelectedSubject(match.id);
      }
      if (queryTopic || loadedRecap?.topicName) {
        setSelectedTopic(queryTopic || loadedRecap?.topicName || '');
      }
      setActiveMethod('paste');
      setIsTextReviewExpanded(true);
      toast.success('Quiz recap loaded into typed notes for revision.');
    }
  }, [searchParams]);

  const appendDebugLog = useCallback(
    (stage: string, status: DebugLogStatus, message: string) => {
      const now = new Date();
      setDebugLog((current) => [
        {
          id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
          time: format(now, 'HH:mm:ss'),
          stage,
          status,
          message,
        },
        ...current,
      ].slice(0, 20));
    },
    [],
  );

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const processSectionRef = useRef<HTMLElement>(null);

  const openTextReview = () => {
    setIsTextReviewExpanded(true);
    window.requestAnimationFrame(() => {
      processSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleImageUpload = async (files: File[]) => {
    if (uploadBusyRef.current || isProcessing || files.length === 0) return;
    uploadBusyRef.current = true;
    setIsOcrRunning(true);
    setActiveMethod('scan');
    const batch = files.map((file) => ({ file, id: crypto.randomUUID() }));
    setUploads((current) => [...current, ...batch.map(({ file, id }) => ({
      id, name: file.name, status: 'queued' as const,
    }))]);
    const updateUpload = (
      id: string,
      status: 'preparing' | 'reading' | 'success' | 'error',
      message?: string,
    ) => {
      setUploads((current) => current.map((item) => item.id === id ? { ...item, status, message } : item));
    };
    let succeeded = 0;
    try {
      for (const { file, id } of batch) {
        try {
          updateUpload(
            id,
            'preparing',
            file.size > MAX_OCR_IMAGE_BYTES ? 'Compressing this phone photo for upload...' : 'Preparing image...',
          );
          const prepared = await prepareImageForOcr(file);
          const sizeMessage = prepared.optimized
            ? `Compressed ${formatImageBytes(prepared.originalBytes)} → ${formatImageBytes(prepared.preparedBytes)}`
            : `Prepared ${formatImageBytes(prepared.preparedBytes)}`;
          updateUpload(id, 'reading', `${sizeMessage} · Extracting text...`);
          if (prepared.optimized) {
            appendDebugLog('Upload', 'success', `${file.name}: ${sizeMessage} before OCR.`);
          }
          appendDebugLog('OCR', 'running', `Reading ${file.name} with Gemini 3.5 Flash.`);
          let result;
          try {
            result = await ocrImage({ imageBase64: prepared.base64, mimeType: prepared.mimeType });
          } catch (error: unknown) {
            throw new Error(describeRequestError(error, 'OCR'));
          }
          if (!result.available || !result.text?.trim()) {
            throw new Error(result.failure
              ? describeCaptureFailure(result.failure)
              : 'OCR returned no readable text. Try a clearer image.');
          }
          const transcript = result.text.trim();
          setOcrTranscript((current) =>
            [current.trim(), transcript].filter(Boolean).join('\n\n--- Next scanned page ---\n\n')
          );
          setExtractedContent((current) =>
            [current.trim(), transcript].filter(Boolean).join('\n\n')
          );
          updateUpload(id, 'success', `${transcript.length} characters extracted · ${sizeMessage}`);
          appendDebugLog('OCR', 'success', `${file.name}: ${transcript.length} characters extracted.`);
          succeeded += 1;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Could not process this image.';
          updateUpload(id, 'error', message);
          appendDebugLog('OCR', 'error', `${file.name}: ${message}`);
        }
      }
      if (succeeded) {
        setIsTextReviewExpanded(false);
        toast.success(`Extracted text from ${succeeded} of ${batch.length} images.`);
      }
      if (succeeded < batch.length) toast.error('Some images could not be read. See the file list for details.');
    } finally {
      uploadBusyRef.current = false;
      setIsOcrRunning(false);
    }
  };

  const handlePasteSubmit = () => {
    const typedNotes = pastedText.trim();
    if (!typedNotes) return;
    setActiveMethod((current) => current ?? 'paste');
    setExtractedContent((current) =>
      [current.trim(), typedNotes].filter(Boolean).join('\n\n')
    );
    setPastedText('');
    appendDebugLog('Input', 'success', `Added ${typedNotes.length} typed characters to the combined notes.`);
    toast.success('Typed notes added!');
  };

  const resolvedTopicId = useMemo(() => {
    const subjectName = subjects.find((subject) => subject.id === selectedSubject)?.name;
    if (!subjectName || !selectedTopic) return null;
    return resolveRubricTopicId(subjectName, selectedTopic);
  }, [selectedSubject, selectedTopic]);

  const resolvedFlashcardTopicId = useMemo(() => {
    const subjectName = subjects.find((subject) => subject.id === flashcardSubject)?.name;
    if (!subjectName || !flashcardTopic) return null;
    return resolveRubricTopicId(subjectName, flashcardTopic);
  }, [flashcardSubject, flashcardTopic]);

  const flashcardSubtopics = useMemo(() => {
    if (!flashcardSubject || !flashcardTopic) return [];
    return CURRICULUM
      .find((subject) => subject.id === flashcardSubject)
      ?.topics.find((topic) => topic.name === flashcardTopic)
      ?.subtopics ?? [];
  }, [flashcardSubject, flashcardTopic]);

  const flashcardFocus = useMemo(() => {
    if (!flashcardSubtopicId) return undefined;
    const subtopic = flashcardSubtopics.find((candidate) => candidate.id === flashcardSubtopicId);
    if (!subtopic) return undefined;
    return { name: subtopic.name, description: subtopic.description };
  }, [flashcardSubtopicId, flashcardSubtopics]);

  const flashcardStudyLabel = useMemo(() => {
    const subjectName = subjects.find((subject) => subject.id === flashcardSubject)?.name;
    if (!subjectName || !flashcardTopic) return undefined;
    if (flashcardFocus?.name) return `${flashcardTopic} · ${flashcardFocus.name}`;
    return flashcardTopic;
  }, [flashcardFocus?.name, flashcardSubject, flashcardTopic]);

  const resolvedNotesGenTopicId = useMemo(() => {
    const subjectName = subjects.find((subject) => subject.id === notesGenSubject)?.name;
    if (!subjectName || !notesGenTopic) return null;
    return resolveRubricTopicId(subjectName, notesGenTopic);
  }, [notesGenSubject, notesGenTopic]);

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    const subjectName = subjects.find((subject) => subject.id === selectedSubject)?.name;
    if (subjectName && !resolveRubricTopicId(subjectName, topic)) {
      const message = `${subjectName} · ${topic} is not connected to backend syllabus grounding, so evaluation will not run.`;
      appendDebugLog('Grounding', 'warning', message);
      toast.warning(message);
    }
  };

  const handleGenerateNotes = async () => {
    if (!resolvedNotesGenTopicId) {
      toast.error('Select a subject and topic first');
      return;
    }
    setIsGeneratingNotes(true);
    appendDebugLog('Generate', 'running', 'Writing study notes from the staff textbook.');
    try {
      const result = await generateTopicNotesApi({ topicId: resolvedNotesGenTopicId });
      if (!result.available) {
        const message = result.failure
          ? describeCaptureFailure(result.failure)
          : 'Note generation is unavailable and the server did not provide a diagnostic reason.';
        appendDebugLog('Generate', 'error', message);
        toast.error(message);
        return;
      }
      if (result.failure || !result.text?.trim()) {
        const message = result.failure
          ? describeCaptureFailure(result.failure)
          : 'No notes were returned and the server did not provide a diagnostic reason.';
        appendDebugLog('Generate', 'error', message);
        toast.error(message);
        return;
      }
      setLibraryNotes(result.text.trim());
      setIsEditingGeneratedNotes(false);
      appendDebugLog('Generate', 'success', `Generated ${result.text.trim().length} characters of textbook notes.`);
      toast.success('Textbook notes ready.');
    } catch (error: unknown) {
      const message = describeRequestError(error, 'Generate notes');
      appendDebugLog('Connection', 'error', message);
      toast.error(message);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!resolvedFlashcardTopicId) {
      toast.error('Select a subject and topic first');
      return;
    }
    setFlashcards([]);
    setIsGeneratingFlashcards(true);
    appendDebugLog(
      'Flashcards',
      'running',
      flashcardFocus
        ? `Writing flashcards for ${flashcardFocus.name} from the staff textbook.`
        : 'Writing flashcards from the staff textbook.',
    );
    try {
      const result = await generateFlashcardsApi({
        topicId: resolvedFlashcardTopicId,
        focus: flashcardFocus,
      });
      if (!result.available) {
        const message = result.failure
          ? describeCaptureFailure(result.failure)
          : 'Flashcard generation is unavailable and the server did not provide a diagnostic reason.';
        appendDebugLog('Flashcards', 'error', message);
        toast.error(message);
        return;
      }
      if (result.failure || !result.cards?.length) {
        const message = result.failure
          ? describeCaptureFailure(result.failure)
          : 'No flashcards were returned and the server did not provide a diagnostic reason.';
        appendDebugLog('Flashcards', 'error', message);
        toast.error(message);
        return;
      }
      setFlashcards(result.cards);
      appendDebugLog('Flashcards', 'success', `Generated ${result.cards.length} flashcards.`);
      toast.success(`${result.cards.length} flashcards ready — flip, then mark Know it or Still learning.`);
    } catch (error: unknown) {
      const message = describeRequestError(error, 'Generate flashcards');
      appendDebugLog('Connection', 'error', message);
      toast.error(message);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleGetFocusGuidance = async () => {
    const textToAnalyze = pastedText.trim() || extractedContent.trim();
    if (!textToAnalyze) {
      toast.error('Paste or type your notes first to get focus guidance.');
      return;
    }

    setIsGettingGuidance(true);
    appendDebugLog('Focus Guidance', 'running', 'Spidey is analyzing your notes to find which concepts you should focus on first.');
    try {
      const result = await getFocusGuidance({
        text: textToAnalyze,
        topicId: resolvedTopicId || undefined,
        topicName: selectedTopic || undefined,
        subjectId: selectedSubject || undefined,
      });

      if (result.guidance) {
        setFocusGuidanceData(result.guidance);
        setEvaluationOpen(true);
        appendDebugLog('Focus Guidance', 'success', `Targeted focus guidance ready with ${result.guidance.focusAreas.length} focus points.`);
      } else {
        setEvaluationOpen(true);
      }
    } catch (err) {
      console.warn('Focus guidance API error, opening revision guidance view:', err);
      setEvaluationOpen(true);
    } finally {
      setIsGettingGuidance(false);
    }
  };

  const handleEvaluate = async () => {
    if (quizRecapData || (!uploads.length && (pastedText.trim() || extractedContent.trim()))) {
      void handleGetFocusGuidance();
      return;
    }
    if (!resolvedTopicId || !extractedContent) return;
    setIsEvaluating(true);
    setEvaluationUnavailable(false);
    setEvaluationSummaryPoints([]);
    appendDebugLog('Summary', 'running', 'Generating a summary before textbook evaluation.');
    try {
      const result = await evaluateNotesApi({ topicId: resolvedTopicId, text: extractedContent });
      if (result.summaryPoints?.length) {
        setEvaluationSummaryPoints(result.summaryPoints);
        appendDebugLog('Summary', 'success', `Generated ${result.summaryPoints.length} summary points.`);
      }
      if (!result.available) {
        setEvaluationUnavailable(true);
        const message = result.failure
          ? describeCaptureFailure(result.failure)
          : 'Analysis is unavailable and the server did not provide a diagnostic reason.';
        appendDebugLog(result.failure?.stage ?? 'Analysis', 'error', message);
        toast.error(message);
        return;
      }
      if (result.failure) {
        const message = describeCaptureFailure(result.failure);
        appendDebugLog(result.failure.stage, 'error', message);
        toast.error(message);
        return;
      }
      if (!result.evaluation) {
        const message = 'No evaluation was returned and the server did not provide a diagnostic reason.';
        appendDebugLog('Evaluation', 'error', message);
        toast.error(message);
        return;
      }
      setEvaluation(result.evaluation);
      setEvaluationOpen(true);
      setLatestEvaluation({
        evaluation: result.evaluation,
        summaryPoints: result.summaryPoints ?? [],
      });
      appendDebugLog(
        'Feedback',
        'success',
        result.evaluation.improvements?.length
          ? `Feedback with ${result.evaluation.improvements.length} improvement step(s).`
          : `Feedback ready.`,
      );
      toast.success('Nice work — your summary and feedback are ready.');
    } catch (error: unknown) {
      const message = describeRequestError(error, 'Analysis');
      appendDebugLog('Connection', 'error', message);
      toast.error(message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const clearContent = () => {
    setExtractedContent('');
    setActiveMethod(null);
    setUploads([]);
    setOcrTranscript('');
    setIsTextReviewExpanded(false);
    setIsEditingGeneratedNotes(false);
    setPastedText('');
    setLatestEvaluation(null);
    setQuizRecapData(null);
    setFocusGuidanceData(null);
    setEvaluation(null);
    setEvaluationSummaryPoints([]);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('edunets_quiz_recap_revision');
      sessionStorage.removeItem(CAPTURE_HUB_PROGRESS_STORAGE_KEY);
    }
  };

  // Prefer the API catalog, while keeping the local canonical curriculum as
  // the loading/error fallback so every option resolves to backend grounding.
  const availableTopics = useMemo(() => {
    const subjectName = subjects.find((candidate) => candidate.id === selectedSubject)?.name;
    const catalogSubject = catalog?.subjects.find((candidate) => candidate.name === subjectName);
    const catalogTopics = catalogSubject?.topics.map((topic) => topic.name);
    const fallbackTopics = CURRICULUM
      .find((subject) => subject.id === selectedSubject)
      ?.topics.map((topic) => topic.name) ?? [];
    return catalogTopics?.length ? catalogTopics : fallbackTopics;
  }, [catalog, selectedSubject]);

  const flashcardTopics = useMemo(() => {
    const subjectName = subjects.find((candidate) => candidate.id === flashcardSubject)?.name;
    const catalogSubject = catalog?.subjects.find((candidate) => candidate.name === subjectName);
    const catalogTopics = catalogSubject?.topics.map((topic) => topic.name);
    const fallbackTopics = CURRICULUM
      .find((subject) => subject.id === flashcardSubject)
      ?.topics.map((topic) => topic.name) ?? [];
    return catalogTopics?.length ? catalogTopics : fallbackTopics;
  }, [catalog, flashcardSubject]);

  const notesGenTopics = useMemo(() => {
    const subjectName = subjects.find((candidate) => candidate.id === notesGenSubject)?.name;
    const catalogSubject = catalog?.subjects.find((candidate) => candidate.name === subjectName);
    const catalogTopics = catalogSubject?.topics.map((topic) => topic.name);
    const fallbackTopics = CURRICULUM
      .find((subject) => subject.id === notesGenSubject)
      ?.topics.map((topic) => topic.name) ?? [];
    return catalogTopics?.length ? catalogTopics : fallbackTopics;
  }, [catalog, notesGenSubject]);

  const flashcardDeckKey = useMemo(
    () => flashcards.map((card) => `${card.front}|${card.back}`).join('||'),
    [flashcards],
  );

  return (
    <div className="p-6 lg:p-8 pattern-overlay">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-[#6486B5] flex items-center justify-center">
            {hubView === 'notes-library' ? <BookOpen className="w-6 h-6 text-white" /> : <Upload className="w-6 h-6 text-white" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-studynow-dark">
              {hubView === 'notes-library' ? 'Textbook Notes' : 'Revision Hub'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {hubView === 'notes-library'
                ? 'Textbook notes from EduNets grounded in the Singapore Cambridge O-Level syllabus'
                : 'Upload handwritten notes to evaluate them, or generate flashcards from the textbook'}
            </p>
          </div>
          {hubView === 'home' ? (
            <Button
              type="button"
              onClick={() => setHubView('notes-library')}
              className="rounded-xl bg-[#6486B5] hover:bg-[#6486B5]/90"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Textbook Notes
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setHubView('home')}
              className="rounded-xl"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Revision Hub
            </Button>
          )}
        </div>
      </motion.div>

      {hubView === 'notes-library' ? (
        <NotesLibraryLayer
          notesGenSubject={notesGenSubject}
          setNotesGenSubject={setNotesGenSubject}
          notesGenTopic={notesGenTopic}
          setNotesGenTopic={setNotesGenTopic}
          notesGenTopics={notesGenTopics}
          resolvedNotesGenTopicId={resolvedNotesGenTopicId}
          isGeneratingNotes={isGeneratingNotes}
          onGenerateNotes={() => void handleGenerateNotes()}
          libraryNotes={libraryNotes}
          isEditingGeneratedNotes={isEditingGeneratedNotes}
          setIsEditingGeneratedNotes={setIsEditingGeneratedNotes}
          setLibraryNotes={setLibraryNotes}
        />
      ) : (
        <>
      {/* Phone-first: upload & evaluate, or generate flashcards. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8 grid items-stretch gap-4 md:grid-cols-2"
      >
        {/* Scan + type under one Upload tile. */}
        <UploadTile
          emoji="📷"
          title="Upload handwritten notes"
          description="Scan photos or type notes, then evaluate against the syllabus"
          isActive={activeMethod === 'scan' || activeMethod === 'paste'}
        >
          <div
            className="space-y-4"
            onDragEnter={(event) => {
              event.preventDefault();
              if (event.dataTransfer.types.includes('Files')) setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = isOcrRunning || isProcessing ? 'none' : 'copy';
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void handleImageUpload(Array.from(event.dataTransfer.files));
            }}
          >
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={isOcrRunning || isProcessing}
              aria-label="Upload images for OCR"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                void handleImageUpload(files);
              }}
              className="hidden"
            />
            <motion.button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isOcrRunning || isProcessing}
              whileTap={{ scale: 0.98 }}
              className={`w-full min-h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 p-4 transition-all disabled:opacity-60 disabled:cursor-wait ${
                isDragging ? 'border-[#6486B5] bg-[#6486B5]/10' : 'border-[#EAA93C]/40 hover:border-[#EAA93C] hover:bg-[#EAA93C]/5'
              }`}
            >
              <Upload className="w-7 h-7 text-[#EAA93C]" />
              <div className="text-center">
                <p className="font-semibold text-studynow-dark">
                  {isOcrRunning ? 'Reading your images...' : isDragging ? 'Drop images here' : 'Drag images here or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPEG or WebP · Up to {formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}
                </p>
              </div>
            </motion.button>
            {uploads.length > 0 && (
              <div className="space-y-2" aria-live="polite" aria-atomic="false">
                <p className="text-xs text-muted-foreground">
                  {uploads.filter((item) => item.status === 'success' || item.status === 'error').length} of {uploads.length} files processed
                </p>
                <ul className="max-h-40 space-y-2 overflow-y-auto">
                  {uploads.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 rounded-xl border p-3 text-sm">
                      {item.status === 'success' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        : item.status === 'error' ? <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        : <RefreshCw className={`mt-0.5 h-4 w-4 shrink-0 ${item.status === 'reading' || item.status === 'preparing' ? 'animate-spin' : ''}`} />}
                      <div className="min-w-0">
                        <p className="break-all font-medium">{item.name}</p>
                        <p className={`text-xs ${item.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {item.message ?? (item.status === 'reading'
                            ? 'Extracting text...'
                            : item.status === 'preparing' ? 'Preparing image...' : 'Waiting to scan')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ocrTranscript && !isOcrRunning && (
              <Button
                type="button"
                variant="outline"
                onClick={openTextReview}
                className="w-full rounded-xl border-[#EAA93C]/50 bg-white/70 font-bold text-studynow-dark hover:bg-[#EAA93C]/10"
              >
                <ClipboardList className="mr-2 h-4 w-4 text-[#EAA93C]" />
                Review scanned text
                <ChevronRight className="ml-auto h-4 w-4" />
              </Button>
            )}
            <div className="space-y-2 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {quizRecapData ? 'Typed Notes · Quiz Recap' : 'Or type / paste notes'}
                </Label>
                {quizRecapData && (
                  <Badge variant="outline" className="border-amber-400/80 bg-amber-50 text-[10px] font-bold text-amber-900">
                    <Sparkles className="mr-1 h-3 w-3 text-amber-600" />
                    Quiz Recap Loaded
                  </Badge>
                )}
              </div>
              <Textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  setExtractedContent(e.target.value);
                }}
                placeholder="Type or paste extra notes. They combine with any OCR text…"
                className="min-h-[110px] rounded-xl resize-none text-xs sm:text-sm font-mono leading-relaxed"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  onClick={() => void handleGetFocusGuidance()}
                  disabled={isGettingGuidance || (!pastedText.trim() && !extractedContent.trim())}
                  className="flex-1 bg-[#EAA93C] hover:bg-[#EAA93C]/90 text-studynow-dark font-bold rounded-xl shadow-xs"
                >
                  {isGettingGuidance ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing focus points...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 text-amber-900" />
                      Get focus guidance
                    </>
                  )}
                </Button>
                {(quizRecapData || pastedText.trim()) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuizRecapData(null);
                      setPastedText('');
                      setExtractedContent('');
                      setFocusGuidanceData(null);
                      setEvaluation(null);
                      setEvaluationSummaryPoints([]);
                      if (typeof window !== 'undefined') {
                        sessionStorage.removeItem('edunets_quiz_recap_revision');
                        sessionStorage.removeItem(CAPTURE_HUB_PROGRESS_STORAGE_KEY);
                      }
                      toast.info('Cleared notes.');
                    }}
                    className="rounded-xl text-xs text-muted-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        </UploadTile>

        <UploadTile
          emoji="🃏"
          title="Generate flashcards"
          description="Exam-critical cards from the staff textbook for your topic"
          isActive={flashcards.length > 0 || isGeneratingFlashcards}
          hideHeader={isGeneratingFlashcards || flashcards.length > 0}
        >
          {isGeneratingFlashcards ? (
            <div
              className="flex min-h-[14rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#6486B5]/35 bg-[#6486B5]/5 px-4 py-8 text-center"
              aria-live="polite"
            >
              <RefreshCw className="h-6 w-6 animate-spin text-[#6486B5]" />
              <div>
                <p className="text-sm font-semibold text-studynow-dark">Writing flashcards…</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pulling the important points from the textbook for this topic.
                </p>
              </div>
            </div>
          ) : flashcards.length > 0 ? (
            <div className="space-y-3">
              <TopicFlashcardDeck
                key={flashcardDeckKey}
                cards={flashcards}
                topicLabel={flashcardStudyLabel}
                onBackToTopics={() => setFlashcards([])}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleGenerateFlashcards()}
                disabled={!resolvedFlashcardTopicId || isOcrRunning || isProcessing}
                className="w-full rounded-xl"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate again
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Select
                value={flashcardSubject}
                onValueChange={(value) => {
                  setFlashcardSubject(value);
                  setFlashcardTopic('');
                  setFlashcardSubtopicId('');
                  setFlashcards([]);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      <span className="flex items-center gap-2">
                        <span>{subject.icon}</span>
                        <span>{subject.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={flashcardTopic}
                onValueChange={(topic) => {
                  setFlashcardTopic(topic);
                  setFlashcardSubtopicId('');
                  setFlashcards([]);
                }}
                disabled={!flashcardSubject}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={!flashcardSubject ? 'Select subject first' : 'Select topic'} />
                </SelectTrigger>
                <SelectContent>
                  {flashcardTopics.map((topic) => (
                    <SelectItem key={topic} value={topic}>
                      {topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {flashcardTopic && flashcardSubtopics.length > 0 ? (
                <Select
                  value={flashcardSubtopicId || '__whole__'}
                  onValueChange={(value) => {
                    setFlashcardSubtopicId(value === '__whole__' ? '' : value);
                    setFlashcards([]);
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Whole topic or pick a subtopic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__whole__">Whole topic</SelectItem>
                    {flashcardSubtopics.map((subtopic) => (
                      <SelectItem key={subtopic.id} value={subtopic.id}>
                        {subtopic.syllabusCode ? `${subtopic.syllabusCode} · ${subtopic.name}` : subtopic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {flashcardTopic && !resolvedFlashcardTopicId && (
                <p className="text-xs text-amber-800">
                  This topic is not connected to syllabus data, so flashcards cannot be generated.
                </p>
              )}
              <Button
                onClick={() => void handleGenerateFlashcards()}
                disabled={!resolvedFlashcardTopicId || isOcrRunning || isProcessing}
                className="w-full rounded-xl bg-[#6486B5] hover:bg-[#6486B5]/90"
              >
                <Layers className="mr-2 h-4 w-4" />
                Generate flashcards
              </Button>
            </div>
          )}
        </UploadTile>
      </motion.div>

      <Card className="mb-8 overflow-hidden rounded-2xl border border-[#6486B5]/25 bg-white/80 card-shadow">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-studynow-dark">Capture Debug Log</h2>
              <p className="text-xs text-muted-foreground">
                Live connection, OCR, summary, and syllabus-analysis status. No credentials are shown.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDebugLog([])}
              disabled={debugLog.length === 0}
            >
              Clear log
            </Button>
          </div>

          <div className="mt-4 max-h-52 space-y-2 overflow-y-auto" aria-live="polite">
            {debugLog.length === 0 ? (
              <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                No capture or analysis request has run yet.
              </p>
            ) : (
              debugLog.map((entry) => (
                <div key={entry.id} className="flex gap-3 rounded-xl border border-border/70 px-3 py-2 text-sm">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${debugStatusClass(entry.status)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-bold text-studynow-dark">{entry.stage}</span>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{entry.status}</span>
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{entry.time}</span>
                    </div>
                    <p className="mt-0.5 break-words text-muted-foreground">{entry.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Process My Material Section */}
      <AnimatePresence>
        {extractedContent && (
          <motion.section
            ref={processSectionRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-studynow-dark flex items-center gap-2">
                <span className="w-1.5 h-6 bg-[#EAA93C] rounded-full"></span>
                Process & evaluate
              </h2>
              <Button variant="ghost" size="sm" onClick={clearContent} disabled={isOcrRunning || isProcessing || isGeneratingNotes} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>

            <Card className="border-0 rounded-2xl card-shadow overflow-hidden">
              <CardContent className="p-6">
                <button
                  type="button"
                  aria-expanded={isTextReviewExpanded}
                  aria-controls="captured-text-review"
                  onClick={() => setIsTextReviewExpanded((current) => !current)}
                  className="mb-6 flex w-full items-center gap-3 rounded-xl border border-[#EAA93C]/30 bg-[#EAA93C]/5 px-4 py-3 text-left transition-colors hover:bg-[#EAA93C]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAA93C] focus-visible:ring-offset-2"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAA93C]/15">
                    <ClipboardList className="h-4 w-4 text-[#C98618]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-studynow-dark">
                      Scanned text & transcript
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ocrTranscript
                        ? `${ocrTranscript.length} OCR characters · ${extractedContent.length} combined characters`
                        : `${extractedContent.length} characters`}
                    </span>
                  </span>
                  <Badge variant="outline" className="hidden shrink-0 border-[#EAA93C]/40 text-studynow-dark sm:inline-flex">
                    {isTextReviewExpanded ? 'Hide' : 'Review'}
                  </Badge>
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isTextReviewExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isTextReviewExpanded && (
                    <motion.div
                      id="captured-text-review"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-6 overflow-hidden"
                    >
                      {ocrTranscript && (
                        <div className="mb-4 rounded-xl border border-[#EAA93C]/30 bg-[#EAA93C]/5 p-4">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <Label className="text-sm font-semibold text-studynow-dark">
                              OCR Transcript (raw)
                            </Label>
                            <Badge variant="outline" className="border-[#EAA93C]/40 text-studynow-dark">
                              {ocrTranscript.length} characters
                            </Badge>
                          </div>
                          <Textarea
                            value={ocrTranscript}
                            readOnly
                            aria-label="Raw OCR transcript"
                            className="min-h-32 resize-y rounded-xl bg-white/80 font-mono text-xs leading-relaxed"
                          />
                          <p className="mt-2 text-xs text-muted-foreground">
                            This is exactly what Gemini returned. Make corrections in the combined notes below.
                          </p>
                        </div>
                      )}

                      <div>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <Label className="text-sm font-semibold text-studynow-dark">
                            Review Combined Notes
                          </Label>
                        </div>
                        <Textarea
                          value={extractedContent}
                          onChange={(event) => setExtractedContent(event.target.value)}
                          aria-label="Review combined OCR and typed notes"
                          className="min-h-40 resize-y rounded-xl bg-muted/30 leading-relaxed"
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          Fix any handwriting-recognition mistakes or add missing details before evaluating.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Subject & Topic Selection */}
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <Label className="text-sm font-semibold text-studynow-dark mb-2 block">
                      <Tag className="w-4 h-4 inline mr-1" />
                      Subject
                    </Label>
                    <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedTopic(''); }}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span>{s.icon}</span>
                              <span>{s.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-studynow-dark mb-2 block">
                      <Folder className="w-4 h-4 inline mr-1" />
                      Topic
                    </Label>
                    <Select value={selectedTopic} onValueChange={handleTopicSelect} disabled={!selectedSubject}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={!selectedSubject ? 'Select subject first' : 'Select topic'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTopics.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedTopic && !resolvedTopicId && (
                  <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This topic is not connected to backend syllabus data. You can still save and summarize the notes,
                    but syllabus feedback will be skipped.
                  </div>
                )}

                {/* Primary Action: Get feedback */}
                <div className="space-y-4 pt-2">
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      type="button"
                      onClick={() => void handleEvaluate()}
                      disabled={isEvaluating || isGettingGuidance || isOcrRunning || !selectedSubject || !extractedContent}
                      className="w-full h-14 bg-[#6486B5] hover:bg-[#6486B5]/90 text-white font-bold text-lg rounded-xl shadow-lg flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      {isEvaluating || isGettingGuidance ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="mr-2 h-5 w-5 rounded-full border-2 border-white border-t-transparent"
                          />
                          {quizRecapData || !uploads.length ? 'Analyzing focus points…' : 'Evaluating notes against syllabus…'}
                        </>
                      ) : quizRecapData || (!uploads.length && extractedContent) ? (
                        <>
                          <Sparkles className="mr-2 h-5 w-5 text-amber-300" />
                          Get feedback on what to focus on
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5" />
                          Get feedback
                        </>
                      )}
                    </Button>
                  </motion.div>

                  {!extractedContent && (
                    <p className="text-center text-xs text-muted-foreground">
                      Upload photos or type your notes above to get syllabus feedback.
                    </p>
                  )}
                  {extractedContent && !selectedSubject && (
                    <p className="text-center text-xs text-amber-700 font-medium">
                      Select a subject and topic to evaluate your notes against the syllabus.
                    </p>
                  )}

                  {/* After feedback: Spidey suggestion on page with button to Smart Quiz */}
                  {latestEvaluation && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border-2 border-[#EAA93C]/40 bg-gradient-to-br from-[#EAA93C]/10 via-[#6486B5]/10 to-amber-500/5 p-4 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row items-center gap-3.5">
                        <div className="relative shrink-0">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-xs border border-[#EAA93C]/30 p-1">
                            <Image
                              src="/branding/spidey-chat-avatar.png"
                              alt="Spidey"
                              width={40}
                              height={40}
                              className="h-10 w-10 object-contain"
                            />
                          </div>
                        </div>
                        <div className="flex-1 text-center sm:text-left space-y-1">
                          <p className="text-xs font-black uppercase tracking-wider text-[#6486B5]">Spidey's Recommendation</p>
                          <p className="text-xs font-semibold text-studynow-dark">
                            Notes evaluated! Ready to test your knowledge again and reinforce your memory?
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            const query = new URLSearchParams();
                            if (selectedSubject) query.set('subject', selectedSubject);
                            if (selectedTopic) query.set('topic', selectedTopic);
                            const queryStr = query.toString();
                            router.push(queryStr ? `/quiz?${queryStr}` : '/quiz');
                          }}
                          className="shrink-0 h-10 rounded-xl bg-[#EAA93C] hover:bg-[#EAA93C]/90 text-studynow-dark font-bold text-xs px-4 shadow-sm"
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Back to Smart Quiz
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}
      </AnimatePresence>
        </>
      )}

      {/* Short motivational next-steps checklist; scoring still runs in the backend. */}
      <Dialog
        open={evaluationOpen}
        onOpenChange={(open) => {
          setEvaluationOpen(open);
          if (!open) {
            setEvaluation(null);
            setEvaluationSummaryPoints([]);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {focusGuidanceData || quizRecapData ? "Spidey's Focus Guidance" : 'Get feedback'}
            </DialogTitle>
            <DialogDescription>
              {focusGuidanceData || quizRecapData
                ? 'Overall feedback on what concepts you need to focus on, combined with a quick tip and encouragement from Spidey.'
                : 'Helpful tips and next steps you can tick off as you improve your notes.'}
            </DialogDescription>
          </DialogHeader>
          {focusGuidanceData || quizRecapData ? (
            <QuizRevisionGuidance
              focusGuidance={focusGuidanceData}
              recap={quizRecapData}
              onGoToSmartQuiz={() => {
                setEvaluationOpen(false);
                const query = new URLSearchParams();
                if (selectedSubject) query.set('subject', selectedSubject);
                if (selectedTopic) query.set('topic', selectedTopic);
                const queryStr = query.toString();
                router.push(queryStr ? `/quiz?${queryStr}` : '/quiz');
              }}
            />
          ) : evaluation ? (
            <EvaluationNextSteps
              summary={evaluation.summary}
              improvements={evaluation.improvements ?? []}
              incorrect={evaluation.incorrect ?? []}
              correct={evaluation.correct ?? []}
              missing={evaluation.missing ?? []}
              topicName={selectedTopic}
              subjectName={subjects.find((s) => s.id === selectedSubject)?.name}
              onGoToSmartQuiz={() => {
                setEvaluationOpen(false);
                const query = new URLSearchParams();
                if (selectedSubject) query.set('subject', selectedSubject);
                if (selectedTopic) query.set('topic', selectedTopic);
                const queryStr = query.toString();
                router.push(queryStr ? `/quiz?${queryStr}` : '/quiz');
              }}
            />
          ) : evaluationUnavailable ? (
            <p className="text-sm text-muted-foreground">
              Feedback is not configured for this deployment yet.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No feedback is available for these notes yet. Click &quot;Get feedback&quot; to evaluate your notes against the syllabus.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
