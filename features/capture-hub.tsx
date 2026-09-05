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
import {
  evaluateNotes as evaluateNotesApi,
  ocrImage,
  summarizeNotes as summarizeNotesApi,
  type CaptureFailure,
  type NoteEvaluation,
} from '@/lib/api/capture';
import { ApiConnectionError, isApiError } from '@/lib/api/client';
import { useCatalog } from '@/lib/api/study';
import { resolveRubricTopicId } from '@/lib/discussion-rubric';

// Subject data
const subjects = [
  { id: 'e-math', name: 'Mathematics', icon: '🔢' },
  { id: 'chemistry', name: 'Chemistry', icon: '⚗️' },
];

// Sample topics per subject
const topicsMap: Record<string, string[]> = {
  'e-math': ['Numbers', 'Algebra', 'Geometry', 'Statistics', 'Probability', 'Mensuration'],
  chemistry: ['Atomic Structure', 'Covalent Bonding', 'Stoichiometry', 'Acids & Bases', 'Redox Reactions', 'Organic Chemistry', 'Rate of Reaction'],
};

type DebugLogStatus = 'running' | 'success' | 'warning' | 'error';

type DebugLogEntry = {
  id: string;
  time: string;
  stage: string;
  status: DebugLogStatus;
  message: string;
};

function describeCaptureFailure(failure: CaptureFailure): string {
  if (failure.reason === 'not_configured') {
    return failure.stage === 'ocr'
      ? 'OCR is not connected: Azure Vision server credentials are not configured.'
      : 'Analysis is not connected: no Microsoft Foundry model is configured on the server.';
  }
  if (failure.reason === 'no_text') {
    return 'Azure Vision connected, but it could not detect readable text in this image.';
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
  if (failure.stage === 'ocr') {
    return 'Azure Vision is configured, but the OCR request failed or timed out.';
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
    return `${operation} could not start because Capture Hub cannot connect to the EduNets API.`;
  }
  if (isApiError(error)) {
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

// Sample materials library
const materialsSample = [
  {
    id: '1',
    name: 'Mitosis Lecture Notes',
    subject: 'bio',
    topic: 'Cell Division',
    dateUploaded: '2024-01-15',
    type: 'scan',
    features: ['quiz', 'web'],
  },
  {
    id: '2',
    name: 'Organic Chemistry Summary',
    subject: 'chemistry',
    topic: 'Organic Chemistry',
    dateUploaded: '2024-01-14',
    type: 'document',
    features: ['summary', 'quiz'],
  },
  {
    id: '3',
    name: 'Handwritten Physics Formulas',
    subject: 'phys',
    topic: 'Kinematics',
    dateUploaded: '2024-01-13',
    type: 'scan',
    features: ['web'],
  },
  {
    id: '4',
    name: 'WWII Essay Notes',
    subject: 'hist',
    topic: 'World War II',
    dateUploaded: '2024-01-12',
    type: 'paste',
    features: ['quiz', 'summary', 'web'],
  },
  {
    id: '5',
    name: 'Geography Rivers Chapter',
    subject: 'geo',
    topic: 'Rivers',
    dateUploaded: '2024-01-11',
    type: 'document',
    features: ['summary'],
  },
  {
    id: '6',
    name: 'A-Math Quadratics Worked Examples',
    subject: 'amath',
    topic: 'Quadratics',
    dateUploaded: '2024-01-10',
    type: 'document',
    features: ['quiz', 'summary'],
  },
  {
    id: '7',
    name: 'Mathematics Geometry Formula Sheet',
    subject: 'e-math',
    topic: 'Geometry',
    dateUploaded: '2024-01-09',
    type: 'scan',
    features: ['web', 'summary'],
  },
  {
    id: '8',
    name: 'Calculus Revision Notes',
    subject: 'amath',
    topic: 'Calculus',
    dateUploaded: '2024-01-08',
    type: 'paste',
    features: ['quiz', 'web'],
  },
  {
    id: '9',
    name: 'English Argument Essay Draft',
    subject: 'eng',
    topic: 'Essay Writing',
    dateUploaded: '2024-01-07',
    type: 'paste',
    features: ['quiz', 'summary'],
  },
  {
    id: '10',
    name: 'History Source Analysis Notes',
    subject: 'hist',
    topic: 'Source Analysis',
    dateUploaded: '2024-01-06',
    type: 'document',
    features: ['summary', 'web'],
  },
  // Sample entries have no captured text of their own, so their summary
  // falls back to metadata-only bullets — see buildMaterialSummary below.
]
  .filter((material) => ['e-math', 'chemistry'].includes(material.subject))
  .map((material) => ({ ...material, content: null as string | null }));

// Upload tile component
function UploadTile({
  icon: Icon,
  emoji,
  title,
  description,
  children,
  isActive,
  onClick,
  className = '',
}: {
  icon?: React.ElementType;
  emoji?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`relative overflow-hidden border-2 transition-all duration-300 rounded-2xl ${
          isActive
            ? 'border-[#6486B5] bg-[#6486B5]/5 shadow-lg'
            : 'border-transparent bg-card hover:border-[#EAA93C]/30'
        } ${className}`}
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {emoji && <span className="text-2xl">{emoji}</span>}
            {Icon && !emoji && (
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-[#6486B5]' : 'bg-[#EAA93C]/20'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#EAA93C]'}`} />
              </div>
            )}
            <div>
              <h3 className="font-bold text-studynow-dark">{title}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          {children}
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

// O-level style key-point summary for a saved material. Capture Hub has no
// real backend (see known-gaps notes), so nothing is summarised server-side -
// when the material has its own captured text (anything just processed in
// this session), the summary is genuinely extracted from that text. Older
// sample-library entries have no stored text, so they fall back to a
// metadata-only summary instead of nothing.
function buildMaterialSummary(material: (typeof materialsSample)[number]): string[] {
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
    default:
      return File;
  }
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
    status: 'queued' | 'reading' | 'success' | 'error';
    message?: string;
  }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const uploadBusyRef = useRef(false);
  const [ocrTranscript, setOcrTranscript] = useState('');
  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);

  // Processing state
  const [extractedContent, setExtractedContent] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [generateQuiz, setGenerateQuiz] = useState(true);
  const [addToWeb, setAddToWeb] = useState(false);
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
  const [evaluation, setEvaluation] = useState<NoteEvaluation | null>(null);
  const [evaluationSummaryPoints, setEvaluationSummaryPoints] = useState<string[]>([]);
  const [evaluationUnavailable, setEvaluationUnavailable] = useState(false);
  const [evaluationOpen, setEvaluationOpen] = useState(false);

  // Summarize: tried against the real model first, when one is configured;
  // falls back to the local heuristic in buildMaterialSummary otherwise, so
  // opening a summary never shows nothing.
  const [realSummaryPoints, setRealSummaryPoints] = useState<string[] | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Materials library
  const [materials, setMaterials] = useState(materialsSample);
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [summaryMaterial, setSummaryMaterial] = useState<(typeof materialsSample)[number] | null>(null);

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

  useEffect(() => {
    if (!summaryMaterial?.content) {
      setRealSummaryPoints(null);
      return;
    }
    let cancelled = false;
    setIsSummarizing(true);
    setRealSummaryPoints(null);
    appendDebugLog('Summary', 'running', 'Sending the captured notes to the configured analysis provider.');
    summarizeNotesApi(summaryMaterial.content)
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
        toast.error(message);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = describeRequestError(error, 'Summary');
        appendDebugLog('Connection', 'error', message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setIsSummarizing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appendDebugLog, summaryMaterial]);

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (files: File[]) => {
    if (uploadBusyRef.current || isProcessing || files.length === 0) return;
    uploadBusyRef.current = true;
    setIsOcrRunning(true);
    setActiveMethod('scan');
    const batch = files.map((file) => ({ file, id: crypto.randomUUID() }));
    setUploads((current) => [...current, ...batch.map(({ file, id }) => ({
      id, name: file.name, status: 'queued' as const,
    }))]);
    const updateUpload = (id: string, status: 'reading' | 'success' | 'error', message?: string) => {
      setUploads((current) => current.map((item) => item.id === id ? { ...item, status, message } : item));
    };
    let succeeded = 0;
    try {
      for (const { file, id } of batch) {
        try {
          const mimeType = file.type;
          if (mimeType !== 'image/png' && mimeType !== 'image/jpeg' && mimeType !== 'image/webp') {
            throw new Error('Use a PNG, JPEG, or WebP image.');
          }
          if (file.size === 0 || file.size > 8 * 1024 * 1024) {
            throw new Error('Choose a non-empty image up to 8 MB.');
          }
          updateUpload(id, 'reading');
          appendDebugLog('OCR', 'running', `Reading ${file.name} with Microsoft Azure AI Vision.`);
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Could not read this file. Try uploading it again.'));
            reader.onabort = () => reject(new Error('File reading was interrupted.'));
            reader.readAsDataURL(file);
          });
          let result;
          try {
            result = await ocrImage({ imageBase64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType });
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
          updateUpload(id, 'success', `${transcript.length} characters extracted`);
          appendDebugLog('OCR', 'success', `${file.name}: ${transcript.length} characters extracted.`);
          succeeded += 1;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Could not process this image.';
          updateUpload(id, 'error', message);
          appendDebugLog('OCR', 'error', `${file.name}: ${message}`);
        }
      }
      if (succeeded) toast.success(`Extracted text from ${succeeded} of ${batch.length} images.`);
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

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    const subjectName = subjects.find((subject) => subject.id === selectedSubject)?.name;
    if (subjectName && !resolveRubricTopicId(subjectName, topic)) {
      const message = `${subjectName} · ${topic} is not connected to backend syllabus grounding, so evaluation will not run.`;
      appendDebugLog('Grounding', 'warning', message);
      toast.warning(message);
    }
  };

  const handleEvaluate = async () => {
    if (!resolvedTopicId || !extractedContent) return;
    setIsEvaluating(true);
    setEvaluationUnavailable(false);
    setEvaluationSummaryPoints([]);
    appendDebugLog('Summary', 'running', 'Generating a summary before syllabus evaluation.');
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
      appendDebugLog(
        'Evaluation',
        'success',
        `Compared the summary with the syllabus database: ${result.evaluation.percentage}% coverage.`,
      );
      toast.success('Summary and syllabus evaluation completed.');
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

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newMaterial = {
      id: Date.now().toString(),
      name: selectedTopic ? `${selectedTopic} Notes` : 'New Notes',
      subject: selectedSubject,
      topic: selectedTopic || 'General',
      dateUploaded: new Date().toISOString().split('T')[0],
      type: activeMethod || 'paste',
      features: [
        ...(generateQuiz ? ['quiz'] : []),
        ...(addToWeb ? ['web'] : []),
        ...(generateSummary ? ['summary'] : []),
      ],
      // Stored so buildMaterialSummary can genuinely summarise this specific
      // material's own captured text, instead of only describing its metadata.
      content: extractedContent,
    };

    setMaterials((prev) => [newMaterial, ...prev]);
    setIsProcessing(false);

    const actions = [];
    if (generateQuiz) actions.push('Quiz generated');
    if (addToWeb) actions.push('Added to Concept Web');
    if (generateSummary) actions.push('Summary created');

    toast.success(actions.join(' • ') || 'Material saved!');
    // Open the summary immediately so the result of "Summarise into Key
    // Points" is actually visible, not just a toast claiming it happened.
    if (generateSummary) setSummaryMaterial(newMaterial);

    // Reset
    setExtractedContent('');
    setActiveMethod(null);
    setUploads([]);
    setOcrTranscript('');
    setPastedText('');
    setSelectedSubject('');
    setSelectedTopic('');
  };

  const clearContent = () => {
    setExtractedContent('');
    setActiveMethod(null);
    setUploads([]);
    setOcrTranscript('');
    setPastedText('');
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

  // Prefer the real catalog so the selected topic resolves to backend data.
  // Shisa's focused Mathematics/Chemistry topic map remains as a loading
  // fallback, and the warning/debug flow below reports any topic that still
  // cannot resolve to syllabus grounding.
  const availableTopics = useMemo(() => {
    const subjectName = subjects.find((candidate) => candidate.id === selectedSubject)?.name;
    const catalogSubject = catalog?.subjects.find((candidate) => candidate.name === subjectName);
    const catalogTopics = catalogSubject?.topics.map((topic) => topic.name);
    return catalogTopics?.length ? catalogTopics : (topicsMap[selectedSubject] ?? []);
  }, [catalog, selectedSubject]);

  return (
    <div className="p-6 lg:p-8 pattern-overlay">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-[#6486B5] flex items-center justify-center">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-studynow-dark">Capture Hub 2.0</h1>
            <p className="text-muted-foreground text-sm">
              Turn handwritten and typed notes into a summary, then check them against your syllabus
            </p>
          </div>
        </div>
      </motion.div>

      {/* Phone-first capture: image OCR and typed notes, with no microphone dependency. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid md:grid-cols-2 gap-4 mb-8"
      >
        {/* Scan handwritten notes with Microsoft Azure AI Vision OCR. */}
        <UploadTile
          emoji="📷"
          title="Scan Handwritten Notes"
          description="Upload or drop photos of your notes for OCR"
          isActive={activeMethod === 'scan'}
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
              className={`w-full min-h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 p-4 transition-all disabled:opacity-60 disabled:cursor-wait ${
                isDragging ? 'border-[#6486B5] bg-[#6486B5]/10' : 'border-[#EAA93C]/40 hover:border-[#EAA93C] hover:bg-[#EAA93C]/5'
              }`}
            >
              <Upload className="w-7 h-7 text-[#EAA93C]" />
              <div className="text-center">
                <p className="font-semibold text-studynow-dark">
                  {isOcrRunning ? 'Reading your images...' : isDragging ? 'Drop images here' : 'Drag images here or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground">Select multiple images · PNG, JPEG, WebP · Up to 8 MB each</p>
              </div>
            </motion.button>
            {uploads.length > 0 && (
              <div className="space-y-2" aria-live="polite" aria-atomic="false">
                <p className="text-xs text-muted-foreground">
                  {uploads.filter((item) => item.status === 'success' || item.status === 'error').length} of {uploads.length} files processed
                </p>
                <ul className="max-h-60 space-y-2 overflow-y-auto">
                  {uploads.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 rounded-xl border p-3 text-sm">
                      {item.status === 'success' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        : item.status === 'error' ? <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        : <RefreshCw className={`mt-0.5 h-4 w-4 shrink-0 ${item.status === 'reading' ? 'animate-spin' : ''}`} />}
                      <div className="min-w-0">
                        <p className="break-all font-medium">{item.name}</p>
                        <p className={`text-xs ${item.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {item.message ?? (item.status === 'reading' ? 'Extracting text...' : 'Waiting to scan')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </UploadTile>

        {/* Type or paste notes, including additions to OCR text. */}
        <UploadTile
          emoji="✏️"
          title="Type or Paste Notes"
          description="Add typed notes to the same summary"
          isActive={activeMethod === 'paste'}
        >
          <div className="space-y-3">
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Type or paste your notes here. They will be combined with any OCR text..."
              className="min-h-[140px] rounded-xl resize-none"
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-studynow-dark flex items-center gap-2">
                <span className="w-1.5 h-6 bg-[#EAA93C] rounded-full"></span>
                Process My Material
              </h2>
              <Button variant="ghost" size="sm" onClick={clearContent} disabled={isOcrRunning || isProcessing} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>

            <Card className="border-0 rounded-2xl card-shadow overflow-hidden">
              <CardContent className="p-6">
                {ocrTranscript && (
                  <div className="mb-6 rounded-xl border border-[#EAA93C]/30 bg-[#EAA93C]/5 p-4">
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
                      This is exactly what Azure Vision returned. Make corrections in Review Combined Notes below.
                    </p>
                  </div>
                )}

                {/* Editable combined OCR + typed notes. */}
                <div className="mb-6">
                  <Label className="text-sm font-semibold text-studynow-dark mb-2 block">
                    Review Combined Notes
                  </Label>
                  <Textarea
                    value={extractedContent}
                    onChange={(event) => setExtractedContent(event.target.value)}
                    aria-label="Review combined OCR and typed notes"
                    className="min-h-40 resize-y rounded-xl bg-muted/30 leading-relaxed"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Fix any handwriting-recognition mistakes or add missing details before summarizing.
                  </p>
                </div>

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
                  <div className="grid sm:grid-cols-3 gap-3">
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

                    {/* Add to Concept Web */}
                    <motion.label
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        addToWeb
                          ? 'border-[#6486B5] bg-[#6486B5]/10'
                          : 'border-border hover:border-[#6486B5]/50'
                      }`}
                    >
                      <Checkbox
                        checked={addToWeb}
                        onCheckedChange={(c) => setAddToWeb(!!c)}
                        className="data-[state=checked]:bg-[#6486B5] data-[state=checked]:border-[#6486B5]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🕸️</span>
                          <span className="font-semibold text-sm text-studynow-dark">
                            Add to Concept Web
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          AI extracts key concepts as nodes
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
                        Processing...
                      </>
                    ) : (
                      <>
                        Process Now
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

      {/* My Materials Library */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="mb-6 space-y-6 text-center">
          <div className="mx-auto max-w-2xl space-y-3">
            <h2 className="justify-center text-lg font-bold text-studynow-dark flex items-center gap-2">
              <span className="w-1.5 h-6 bg-[#6486B5] rounded-full"></span>
              My Materials Library
            </h2>
            <p className="text-sm text-muted-foreground">
              Choose a subject card to filter your saved materials, or use the picker to view everything.
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <Card className="border-0 rounded-2xl card-shadow hover:shadow-lg transition-shadow cursor-pointer group">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Type icon */}
                          <div className="w-10 h-10 rounded-xl bg-[#6486B5]/10 flex items-center justify-center shrink-0">
                            <TypeIcon className="w-5 h-5 text-[#6486B5]" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-studynow-dark truncate group-hover:text-[#6486B5] transition-colors">
                              {material.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge
                                variant="secondary"
                                className="bg-[#EAA93C]/20 text-[#EAA93C] border-0 text-xs"
                              >
                                {subject?.icon} {subject?.name}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {material.topic}
                              </span>
                            </div>

                            {/* Date and features */}
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(material.dateUploaded), 'dd MMM yyyy')}
                              </div>
                              <div className="flex items-center gap-1">
                                {material.features.map((f) => (
                                  <FeatureIcon key={f} feature={f} />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={() => setSummaryMaterial(material)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Summary
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toast.info('Re-processing is not available for saved materials yet.')}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Re-process
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setMaterials((prev) => prev.filter((item) => item.id !== material.id));
                                  toast.success(`Removed "${material.name}"`);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 rounded-full bg-[#EAA93C]/10 flex items-center justify-center mx-auto mb-4">
              <Folder className="w-8 h-8 text-[#EAA93C]/50" />
            </div>
            <h3 className="text-lg font-semibold text-studynow-dark mb-2">No materials yet</h3>
            <p className="text-muted-foreground text-sm">
              Upload your first material using the tiles above
            </p>
          </motion.div>
        )}
      </motion.section>

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
          <ul className="space-y-2.5 text-sm leading-relaxed text-studynow-dark">
            {summaryMaterial && (realSummaryPoints ?? buildMaterialSummary(summaryMaterial)).map((point) => (
              <li key={point} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6486B5]" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Evaluate result: a percentage the student sees at a glance, plus the
          breakdown behind it. The rubric this scores against detects whether a
          reference point was contradicted or never mentioned, not whether the
          notes were merely worded differently -- so the copy says covered /
          missing, never a grade on writing quality. */}
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
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Evaluation</DialogTitle>
            <DialogDescription>Your generated summary compared with the syllabus data for this topic.</DialogDescription>
          </DialogHeader>
          {evaluation && (
            <div className="space-y-4">
              {evaluationSummaryPoints.length > 0 && (
                <div className="rounded-xl border border-[#6486B5]/30 bg-[#6486B5]/5 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-[#6486B5]">
                    Summary used for this evaluation
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-studynow-dark">
                    {evaluationSummaryPoints.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span aria-hidden="true">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#6486B5] text-2xl font-black text-[#6486B5]">
                  {evaluation.percentage}%
                </div>
              </div>
              <p className="text-sm font-semibold text-studynow-dark">{evaluation.summary}</p>

              {evaluation.incorrect.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wide text-destructive">To fix</p>
                  {evaluation.incorrect.map((item, index) => (
                    <div key={`wrong-${index}`} className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                      <p className="text-sm font-bold text-studynow-dark">{item.point}</p>
                      {item.quote && <p className="mt-1 text-xs italic text-muted-foreground">“{item.quote}”</p>}
                      <p className="mt-1.5 text-sm text-studynow-dark">{item.correction}</p>
                    </div>
                  ))}
                </div>
              )}

              {evaluation.missing.length > 0 && (
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-secondary-foreground">Not in your notes</p>
                  <p className="mt-1 text-sm text-secondary-foreground">{evaluation.missing.join(' · ')}</p>
                </div>
              )}

              {evaluation.correct.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Covered well</p>
                  {evaluation.correct.map((item, index) => (
                    <div key={`right-${index}`} className="rounded-xl border border-border p-3">
                      <p className="text-sm font-bold text-studynow-dark">{item.point}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {evaluationUnavailable && (
            <p className="text-sm text-muted-foreground">
              Evaluation is not configured for this deployment yet.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
