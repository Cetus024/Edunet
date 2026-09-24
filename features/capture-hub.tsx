'use client';

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Upload,
  Pencil,
  Sparkles,
  Network,
  ClipboardList,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Calendar,
  Tag,
  Folder,
  MoreHorizontal,
  Eye,
  Trash2,
  RefreshCw,
  FileType,
  File,
  BookOpen,
  Library,
  ArrowLeft,
  Layers,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DisplayCards from '@/components/ui/display-cards';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useAtom } from 'jotai';
import {
  evaluateNotes as evaluateNotesApi,
  generateFlashcards as generateFlashcardsApi,
  generateTopicNotes as generateTopicNotesApi,
  ocrImage,
  summarizeNotes as summarizeNotesApi,
  type CaptureFailure,
  type Flashcard,
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
import {
  createLibraryMaterial,
  materialsLibraryAtom,
  type LibraryMaterial,
} from '@/features/materials/library-store';
import { EvaluationNextSteps } from '@/features/capture/evaluation-next-steps';
import { TopicFlashcardDeck } from '@/features/capture/topic-flashcard-deck';
import { StudyNotesView } from '@/features/notes/study-notes-view';

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

// Feature icon badge
function FeatureIcon({ feature }: { feature: string }) {
  const icons: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    quiz: { icon: Sparkles, color: 'text-[#EAA93C]', bg: 'bg-[#EAA93C]/20' },
    web: { icon: Network, color: 'text-[#6486B5]', bg: 'bg-[#6486B5]/20' },
    summary: { icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100' },
  };
  const { icon: Icon, color, bg } = icons[feature] || icons.quiz;
  return (
    <div className={`w-6 h-6 rounded-md ${bg} flex items-center justify-center`}>
      <Icon className={`w-3.5 h-3.5 ${color}`} />
    </div>
  );
}

// Pulls up to `max` representative sentences out of real captured text,
// spread across the whole passage rather than just its opening, so a long
// transcript still reads as an overview instead of only its first minute.
function extractKeyPoints(content: string, max = 5): string[] {
  const sentences = content
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12);
  if (sentences.length <= max) return sentences;
  const step = sentences.length / max;
  return Array.from({ length: max }, (_, index) => sentences[Math.floor(index * step)]);
}

// Legacy metadata overview for sample-library entries without captured text.
// Real notes use the server summary and show failures explicitly.
function buildMaterialSummary(material: LibraryMaterial): string[] {
  const subject = subjects.find((candidate) => candidate.id === material.subject);
  const subjectLabel = subject ? `${subject.icon} ${subject.name}` : 'this subject';
  const intro = `${material.topic} is the focus topic captured in "${material.name}" (${subjectLabel}).`;

  const keyPoints = material.content ? extractKeyPoints(material.content) : [];
  if (keyPoints.length > 0) return [intro, ...keyPoints];

  return [
    intro,
    `Covers ${subjectLabel} content uploaded on ${format(new Date(material.dateUploaded), 'dd MMM yyyy')}.`,
    material.features.includes('quiz')
      ? 'A Smart Quiz set was generated from this material to test recall.'
      : 'Generate a Smart Quiz from this material to test recall.',
    material.features.includes('web')
      ? 'Key terms from this material were linked into your Concept Web.'
      : 'Add this material to your Concept Web to connect its key terms.',
    'Revisit this summary before your next revision session to refresh the key ideas quickly.',
  ];
}

// Get type icon
function getTypeIcon(type: string) {
  switch (type) {
    case 'scan':
      return Camera;
    case 'document':
      return FileType;
    case 'paste':
      return Pencil;
    case 'generate':
      return Sparkles;
    default:
      return File;
  }
}

function NotesLibraryLayer({
  notesLibraryTab,
  setNotesLibraryTab,
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
  libraryFilter,
  setLibraryFilter,
  libraryCards,
  filteredMaterials,
  materials,
  setMaterials,
  openEvaluationSummary,
  setNoteMaterial,
  setSummaryMaterial,
}: {
  notesLibraryTab: 'generated' | 'materials';
  setNotesLibraryTab: (tab: 'generated' | 'materials') => void;
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
  libraryFilter: string;
  setLibraryFilter: (value: string) => void;
  libraryCards: Parameters<typeof DisplayCards>[0]['cards'];
  filteredMaterials: LibraryMaterial[];
  materials: LibraryMaterial[];
  setMaterials: (updater: LibraryMaterial[] | ((prev: LibraryMaterial[]) => LibraryMaterial[])) => void;
  openEvaluationSummary: (material: LibraryMaterial) => void;
  setNoteMaterial: (material: LibraryMaterial | null) => void;
  setSummaryMaterial: (material: LibraryMaterial | null) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={notesLibraryTab === 'generated' ? 'default' : 'outline'}
          onClick={() => setNotesLibraryTab('generated')}
          className={`rounded-xl ${notesLibraryTab === 'generated' ? 'bg-[#6486B5] hover:bg-[#6486B5]/90' : ''}`}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Generated Notes
        </Button>
        <Button
          type="button"
          variant={notesLibraryTab === 'materials' ? 'default' : 'outline'}
          onClick={() => setNotesLibraryTab('materials')}
          className={`rounded-xl ${notesLibraryTab === 'materials' ? 'bg-[#6486B5] hover:bg-[#6486B5]/90' : ''}`}
        >
          <Folder className="mr-2 h-4 w-4" />
          Materials Library
        </Button>
      </div>

      {notesLibraryTab === 'generated' ? (
        <Card className="rounded-2xl border-0 card-shadow">
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-bold text-studynow-dark">Generated Notes (Provided by EduNets)</h2>
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
      ) : (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6 space-y-6 text-center">
            <div className="mx-auto max-w-2xl space-y-3">
              <h2 className="flex items-center justify-center gap-2 text-lg font-bold text-studynow-dark">
                <span className="h-6 w-1.5 rounded-full bg-[#6486B5]" />
                Materials Library
              </h2>
              <p className="text-sm text-muted-foreground">
                Saved uploads and evaluation summaries from Revision Hub.
              </p>
              <div className="flex justify-center">
                <Select value={libraryFilter} onValueChange={setLibraryFilter}>
                  <SelectTrigger className="w-full max-w-[220px] rounded-xl">
                    <SelectValue placeholder="Filter by subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
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
            </div>
            <DisplayCards cards={libraryCards} layout="stack" />
          </div>

          {filteredMaterials.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filteredMaterials.map((material, index) => {
                  const subject = subjects.find((s) => s.id === material.subject);
                  const TypeIcon = getTypeIcon(material.type);
                  return (
                    <motion.div
                      key={material.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="group rounded-2xl border-0 card-shadow transition-shadow hover:shadow-lg">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6486B5]/10">
                              <TypeIcon className="h-5 w-5 text-[#6486B5]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate font-semibold text-studynow-dark transition-colors group-hover:text-[#6486B5]">
                                {material.name}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="border-0 bg-[#EAA93C]/20 text-xs text-[#EAA93C]">
                                  {subject?.icon} {subject?.name}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{material.topic}</span>
                              </div>
                              <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(material.dateUploaded), 'dd MMM yyyy')}
                                </div>
                                <div className="flex items-center gap-1">
                                  {material.features.map((f) => (
                                    <FeatureIcon key={f} feature={f} />
                                  ))}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setNoteMaterial(material)}
                                className="mt-4 w-full rounded-xl border-[#6486B5]/40 text-[#6486B5] hover:bg-[#6486B5]/10"
                              >
                                <BookOpen className="mr-2 h-4 w-4" />
                                Read note
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEvaluationSummary(material)}
                                className="mt-2 w-full rounded-xl border-[#EAA93C]/40 text-studynow-dark hover:bg-[#EAA93C]/10"
                              >
                                <ClipboardList className="mr-2 h-4 w-4" />
                                Evaluation summary
                              </Button>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem onClick={() => setNoteMaterial(material)}>
                                  <BookOpen className="mr-2 h-4 w-4" />
                                  Read note
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSummaryMaterial(material)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Summary
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEvaluationSummary(material)}>
                                  <ClipboardList className="mr-2 h-4 w-4" />
                                  Evaluation summary
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setMaterials((prev) => prev.filter((item) => item.id !== material.id));
                                    toast.success(`Removed "${material.name}"`);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EAA93C]/10">
                <Folder className="h-8 w-8 text-[#EAA93C]/50" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-studynow-dark">No materials yet</h3>
              <p className="text-sm text-muted-foreground">
                {materials.length === 0
                  ? 'Upload and save notes from Revision Hub to see them here.'
                  : 'No materials match this subject filter.'}
              </p>
            </div>
          )}
        </motion.section>
      )}
    </motion.div>
  );
}

export default function CaptureHubPage() {
  const { data: catalog } = useCatalog();

  // Note capture states. OCR and typed text are deliberately additive so a
  // student can photograph a handwritten page, correct it, and add details
  // from a phone or laptop without using voice transcription.
  const [activeMethod, setActiveMethod] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [uploads, setUploads] = useState<Array<{
    id: string;
    name: string;
    status: 'queued' | 'preparing' | 'reading' | 'success' | 'error';
    message?: string;
  }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const uploadBusyRef = useRef(false);
  const [ocrTranscript, setOcrTranscript] = useState('');
  const [isTextReviewExpanded, setIsTextReviewExpanded] = useState(false);
  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);

  // Processing state
  const [extractedContent, setExtractedContent] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [generateQuiz, setGenerateQuiz] = useState(true);
  const [generateSummary, setGenerateSummary] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);

  // Evaluate: how well the captured notes cover the selected topic's syllabus
  // content, judged against the same reference material the discussion room
  // uses. Only offered when the topic actually resolves to real syllabus
  // content -- these subject/topic pickers are demo data that only partly
  // line up with the real catalog, and a room that cannot score anything
  // should stay hidden rather than open to a blank result.
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isEditingGeneratedNotes, setIsEditingGeneratedNotes] = useState(false);
  const [evaluation, setEvaluation] = useState<NoteEvaluation | null>(null);
  const [evaluationSummaryPoints, setEvaluationSummaryPoints] = useState<string[]>([]);
  const [evaluationUnavailable, setEvaluationUnavailable] = useState(false);
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<{
    evaluation: NoteEvaluation;
    summaryPoints: string[];
  } | null>(null);

  // Landing vs Notes Library layer; flashcards and library-generated notes.
  const [hubView, setHubView] = useState<'home' | 'notes-library'>('home');
  const [notesLibraryTab, setNotesLibraryTab] = useState<'generated' | 'materials'>('generated');
  const [flashcardSubject, setFlashcardSubject] = useState('');
  const [flashcardTopic, setFlashcardTopic] = useState('');
  /** Empty string = whole topic; otherwise a curriculum subtopic id. */
  const [flashcardSubtopicId, setFlashcardSubtopicId] = useState('');
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [notesGenSubject, setNotesGenSubject] = useState('');
  const [notesGenTopic, setNotesGenTopic] = useState('');
  const [libraryNotes, setLibraryNotes] = useState('');

  // Keep generated summaries separate from loading/error states and demo metadata.
  const [realSummaryPoints, setRealSummaryPoints] = useState<string[] | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Materials library
  const [materials, setMaterials] = useAtom(materialsLibraryAtom);
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [noteMaterial, setNoteMaterial] = useState<LibraryMaterial | null>(null);
  const [summaryMaterial, setSummaryMaterial] = useState<LibraryMaterial | null>(null);

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

  const summaryRequests = useRef(new Map<string, ReturnType<typeof summarizeNotesApi>>());
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryAttempt, setSummaryAttempt] = useState(0);

  useEffect(() => {
    if (!summaryMaterial?.content) {
      setRealSummaryPoints(null);
      setSummaryError(null);
      setIsSummarizing(false);
      return;
    }
    let cancelled = false;
    setIsSummarizing(true);
    setRealSummaryPoints(null);
    setSummaryError(null);
    appendDebugLog('Summary', 'running', 'Sending the captured notes to the configured analysis provider.');
    const content = summaryMaterial.content;
    // Reuse completed/in-flight requests, including React's development effect
    // replay. Opening the same note again should not spend another quota slot.
    let request = summaryRequests.current.get(content);
    if (!request) {
      request = summarizeNotesApi(content);
      summaryRequests.current.set(content, request);
      void request.then((result) => {
        if (!result.points?.length) summaryRequests.current.delete(content);
      }, () => summaryRequests.current.delete(content));
    }
    request
      .then((result) => {
        if (cancelled) return;
        if (result.available && result.points && result.points.length > 0) {
          setRealSummaryPoints(result.points);
          appendDebugLog('Summary', 'success', `Generated ${result.points.length} summary points.`);
          return;
        }
        const message = result.failure
          ? describeCaptureFailure(result.failure)
          : 'The summary endpoint returned no usable points and no diagnostic reason.';
        appendDebugLog('Summary', result.available ? 'warning' : 'error', message);
        setSummaryError(message);
        toast.error(message);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = describeRequestError(error, 'Summary');
        setSummaryError(message);
        appendDebugLog('Connection', 'error', message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setIsSummarizing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appendDebugLog, summaryMaterial, summaryAttempt]);

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
      setNotesLibraryTab('generated');
      appendDebugLog('Generate', 'success', `Generated ${result.text.trim().length} characters of textbook notes.`);
      toast.success('Textbook notes ready in Notes Library.');
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

  const handleEvaluate = async () => {
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
        'Evaluation',
        'success',
        result.evaluation.improvements?.length
          ? `Evaluation ${result.evaluation.percentage}% with ${result.evaluation.improvements.length} improvement step(s).`
          : `Compared the summary with topic grounding: ${result.evaluation.percentage}% coverage.`,
      );
      toast.success('Nice work — your summary and evaluation are ready.');
    } catch (error: unknown) {
      const message = describeRequestError(error, 'Analysis');
      appendDebugLog('Connection', 'error', message);
      toast.error(message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleProcess = async () => {
    if (!extractedContent || !selectedSubject) {
      toast.error('Please add content and select a subject');
      return;
    }

    setIsProcessing(true);

    const newMaterial: LibraryMaterial = {
      ...createLibraryMaterial({
        name: selectedTopic ? `${selectedTopic} Notes` : 'New Notes',
        subject: selectedSubject,
        topic: selectedTopic || 'General',
        type: activeMethod || 'paste',
        features: [
          ...(generateQuiz ? ['quiz'] : []),
          ...(generateSummary ? ['summary'] : []),
        ],
        content: extractedContent,
      }),
      evaluation: latestEvaluation?.evaluation ?? null,
      evaluationSummaryPoints: latestEvaluation?.summaryPoints ?? [],
    };

    setMaterials((prev) => [newMaterial, ...prev]);
    setIsProcessing(false);

    toast.success(generateSummary ? 'Saved to Materials Library. Generating summary…' : 'Saved to Materials Library!');
    // Open the summary immediately so the result of "Summarise into Key
    // Points" is actually visible, not just a toast claiming it happened.
    if (generateSummary) setSummaryMaterial(newMaterial);
    setHubView('notes-library');
    setNotesLibraryTab('materials');

    // Reset
    setExtractedContent('');
    setActiveMethod(null);
    setUploads([]);
    setOcrTranscript('');
    setIsTextReviewExpanded(false);
    setPastedText('');
    setSelectedSubject('');
    setSelectedTopic('');
    setLatestEvaluation(null);
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
  };

  const openEvaluationSummary = (material: LibraryMaterial) => {
    setEvaluation(material.evaluation);
    setEvaluationSummaryPoints(material.evaluationSummaryPoints);
    setEvaluationUnavailable(false);
    setEvaluationOpen(true);
  };

  const filteredMaterials =
    libraryFilter === 'all' ? materials : materials.filter((m) => m.subject === libraryFilter);

  const libraryCards = [
    {
      icon: <span className="text-lg leading-none">🔢</span>,
      title: 'Mathematics',
      description: `${materials.filter((material) => material.subject === 'e-math').length} saved items`,
      date: 'Syllabus 4052',
      onClick: () => setLibraryFilter('e-math'),
      isActive: libraryFilter === 'e-math',
      className: "[grid-area:stack] hover:-translate-y-10 before:absolute before:left-0 before:top-0 before:h-full before:w-full before:rounded-2xl before:outline before:outline-1 before:outline-border before:bg-background/50 before:content-[''] before:transition-opacity before:duration-700 hover:before:opacity-0",
    },
    {
      icon: <span className="text-lg leading-none">⚗️</span>,
      title: 'Chemistry',
      description: `${materials.filter((material) => material.subject === 'chemistry').length} saved items`,
      date: 'Syllabus 6092',
      onClick: () => setLibraryFilter('chemistry'),
      isActive: libraryFilter === 'chemistry',
      className: '[grid-area:stack] translate-x-14 translate-y-12 hover:translate-y-2',
    },
  ];

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
            {hubView === 'notes-library' ? <Library className="w-6 h-6 text-white" /> : <Upload className="w-6 h-6 text-white" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-studynow-dark">
              {hubView === 'notes-library' ? 'Notes Library' : 'Revision Hub'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {hubView === 'notes-library'
                ? 'Textbook notes from EduNets, plus your saved uploads and evaluation summaries'
                : 'Upload handwritten notes to evaluate them, or generate flashcards from the textbook'}
            </p>
          </div>
          {hubView === 'home' ? (
            <Button
              type="button"
              onClick={() => setHubView('notes-library')}
              className="rounded-xl bg-[#6486B5] hover:bg-[#6486B5]/90"
            >
              <Library className="mr-2 h-4 w-4" />
              Notes Library
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
          notesLibraryTab={notesLibraryTab}
          setNotesLibraryTab={setNotesLibraryTab}
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
          libraryFilter={libraryFilter}
          setLibraryFilter={setLibraryFilter}
          libraryCards={libraryCards}
          filteredMaterials={filteredMaterials}
          materials={materials}
          setMaterials={setMaterials}
          openEvaluationSummary={openEvaluationSummary}
          setNoteMaterial={setNoteMaterial}
          setSummaryMaterial={setSummaryMaterial}
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
              <Label className="text-xs font-semibold text-muted-foreground">Or type / paste notes</Label>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Type or paste extra notes. They combine with any OCR text…"
                className="min-h-[100px] rounded-xl resize-none"
              />
              <Button
                onClick={handlePasteSubmit}
                disabled={!pastedText.trim()}
                className="w-full bg-[#6486B5] hover:bg-[#6486B5]/90 rounded-xl"
              >
                <Check className="w-4 h-4 mr-2" />
                Add to Notes
              </Button>
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
                    but syllabus evaluation will be skipped.
                  </div>
                )}

                {/* Action buttons - checkboxes */}
                <div className="mb-6">
                  <Label className="text-sm font-semibold text-studynow-dark mb-3 block">
                    What would you like to do with this material?
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {/* Generate Quiz */}
                    <motion.label
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        generateQuiz
                          ? 'border-[#EAA93C] bg-[#EAA93C]/10'
                          : 'border-border hover:border-[#EAA93C]/50'
                      }`}
                    >
                      <Checkbox
                        checked={generateQuiz}
                        onCheckedChange={(c) => setGenerateQuiz(!!c)}
                        className="data-[state=checked]:bg-[#EAA93C] data-[state=checked]:border-[#EAA93C]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📝</span>
                          <span className="font-semibold text-sm text-studynow-dark">
                            Generate Quiz
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Sends to Smart Quiz with content loaded
                        </p>
                      </div>
                    </motion.label>

                    {/* Summarise */}
                    <motion.label
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        generateSummary
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-border hover:border-blue-500/50'
                      }`}
                    >
                      <Checkbox
                        checked={generateSummary}
                        onCheckedChange={(c) => setGenerateSummary(!!c)}
                        className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📋</span>
                          <span className="font-semibold text-sm text-studynow-dark">
                            Summarise into Key Points
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          O-level style summary with <strong>key terms</strong>
                        </p>
                      </div>
                    </motion.label>
                  </div>
                </div>

                {/* Evaluation always summarizes first, then compares that exact
                    summary with the selected topic's database grounding. */}
                {resolvedTopicId && extractedContent && (
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleEvaluate()}
                      disabled={isEvaluating || isOcrRunning}
                      className="w-full h-12 rounded-xl border-2 border-[#6486B5] font-bold text-[#6486B5] hover:bg-[#6486B5]/10"
                    >
                      {isEvaluating ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="mr-2 h-4 w-4 rounded-full border-2 border-[#6486B5] border-t-transparent"
                          />
                          Summarizing and checking the database...
                        </>
                      ) : (
                        <>📊 Evaluate summary against the syllabus</>
                      )}
                    </Button>
                  </motion.div>
                )}

                {/* Process button */}
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button
                    onClick={handleProcess}
                    disabled={isProcessing || isOcrRunning || !selectedSubject}
                    className="w-full h-14 bg-[#EAA93C] hover:bg-[#EAA93C]/90 text-studynow-dark font-bold text-lg rounded-xl shadow-lg"
                  >
                    {isProcessing ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <RefreshCw className="w-5 h-5 mr-2" />
                        </motion.div>
                        Saving…
                      </>
                    ) : (
                      <>
                        Save to Materials Library
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.section>
        )}
      </AnimatePresence>
        </>
      )}

      <Dialog open={noteMaterial !== null} onOpenChange={(open) => !open && setNoteMaterial(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#6486B5]" />
              {noteMaterial?.name}
            </DialogTitle>
            <DialogDescription>
              {subjects.find((subject) => subject.id === noteMaterial?.subject)?.icon}{' '}
              {subjects.find((subject) => subject.id === noteMaterial?.subject)?.name}
              {noteMaterial ? ` · ${noteMaterial.topic}` : ''}
              {noteMaterial ? ` · ${format(new Date(noteMaterial.dateUploaded), 'dd MMM yyyy')}` : ''}
            </DialogDescription>
          </DialogHeader>

          {noteMaterial?.content ? (
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-[#6486B5]/20 bg-[#6486B5]/5 p-4">
              <StudyNotesView text={noteMaterial.content} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="font-semibold text-studynow-dark">Original note text is unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This is a demo library item. Notes you capture and process will show their full OCR or typed text here.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={summaryMaterial !== null} onOpenChange={(open) => !open && setSummaryMaterial(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{summaryMaterial?.name}</DialogTitle>
            <DialogDescription>
              {subjects.find((subject) => subject.id === summaryMaterial?.subject)?.icon}{' '}
              {subjects.find((subject) => subject.id === summaryMaterial?.subject)?.name}
              {summaryMaterial ? ` · ${summaryMaterial.topic}` : ''}
            </DialogDescription>
          </DialogHeader>
          {isSummarizing && (
            <p className="text-xs font-semibold text-muted-foreground">Summarizing with AI...</p>
          )}
          {summaryError && !isSummarizing && (
            <div className="space-y-3" role="alert">
              <p className="text-sm text-destructive">{summaryError}</p>
              <Button variant="outline" onClick={() => setSummaryAttempt((attempt) => attempt + 1)}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry summary
              </Button>
            </div>
          )}
          <ul className="space-y-2.5 text-sm leading-relaxed text-studynow-dark">
            {summaryMaterial && (realSummaryPoints ?? (summaryMaterial.content ? [] : buildMaterialSummary(summaryMaterial))).map((point) => (
              <li key={point} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6486B5]" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>Your next steps</DialogTitle>
            <DialogDescription>
              A short score and a few tips you can tick off as you improve your notes.
            </DialogDescription>
          </DialogHeader>
          {evaluation && (
            <EvaluationNextSteps
              percentage={evaluation.percentage}
              summary={evaluation.summary}
              improvements={evaluation.improvements ?? []}
            />
          )}
          {evaluationUnavailable && (
            <p className="text-sm text-muted-foreground">
              Evaluation is not configured for this deployment yet.
            </p>
          )}
          {!evaluation && !evaluationUnavailable && (
            <p className="text-sm text-muted-foreground">
              No evaluation summary is saved for this material. Evaluate the notes against the syllabus before saving them to the library.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
