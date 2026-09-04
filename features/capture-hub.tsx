'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
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
import { evaluateNotes as evaluateNotesApi, ocrImage, summarizeNotes as summarizeNotesApi, type NoteEvaluation } from '@/lib/api/capture';
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
  const [scannedPreview, setScannedPreview] = useState<string | null>(null);

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

  useEffect(() => {
    if (!summaryMaterial?.content) {
      setRealSummaryPoints(null);
      return;
    }
    let cancelled = false;
    setIsSummarizing(true);
    setRealSummaryPoints(null);
    summarizeNotesApi(summaryMaterial.content)
      .then((result) => {
        if (cancelled) return;
        if (result.available && result.points && result.points.length > 0) {
          setRealSummaryPoints(result.points);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsSummarizing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [summaryMaterial]);

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mimeType = file.type === 'image/jpeg' || file.type === 'image/webp' ? file.type : 'image/png';

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setScannedPreview(dataUrl);
      setActiveMethod('scan');
      setIsOcrRunning(true);

      // Handwriting recognition, not a canned string -- this used to return the
      // same "Mitosis is the process of..." text regardless of what photo was
      // uploaded. Most O-Level students have a phone camera and not a laptop
      // microphone, which is why this path exists at all.
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      try {
        const result = await ocrImage({ imageBase64: base64, mimeType });
        if (!result.available) {
          toast.error('Handwriting recognition is not set up for this deployment yet.');
        } else if (!result.text?.trim()) {
          toast.error('No text was recognized in that photo. Try a clearer or closer shot.');
        } else {
          setExtractedContent((current) =>
            [current.trim(), result.text?.trim()].filter(Boolean).join('\n\n')
          );
          toast.success('Text extracted from your photo!');
        }
      } catch {
        toast.error('Could not process that photo. Try again.');
      } finally {
        setIsOcrRunning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePasteSubmit = () => {
    const typedNotes = pastedText.trim();
    if (!typedNotes) return;
    setActiveMethod((current) => current ?? 'paste');
    setExtractedContent((current) =>
      [current.trim(), typedNotes].filter(Boolean).join('\n\n')
    );
    setPastedText('');
    toast.success('Typed notes added!');
  };

  const resolvedTopicId = useMemo(() => {
    const subjectName = subjects.find((subject) => subject.id === selectedSubject)?.name;
    if (!subjectName || !selectedTopic) return null;
    return resolveRubricTopicId(subjectName, selectedTopic);
  }, [selectedSubject, selectedTopic]);

  const handleEvaluate = async () => {
    if (!resolvedTopicId || !extractedContent) return;
    setIsEvaluating(true);
    setEvaluationUnavailable(false);
    setEvaluationSummaryPoints([]);
    try {
      const result = await evaluateNotesApi({ topicId: resolvedTopicId, text: extractedContent });
      if (!result.available) {
        setEvaluationUnavailable(true);
        toast.error('Evaluation is not set up for this deployment yet.');
        return;
      }
      if (!result.evaluation) {
        toast.error('Could not evaluate these notes -- try adding more content.');
        return;
      }
      setEvaluationSummaryPoints(result.summaryPoints ?? []);
      setEvaluation(result.evaluation);
      setEvaluationOpen(true);
    } catch {
      toast.error('Could not evaluate these notes. Try again.');
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
    setScannedPreview(null);
    setPastedText('');
    setSelectedSubject('');
    setSelectedTopic('');
  };

  const clearContent = () => {
    setExtractedContent('');
    setActiveMethod(null);
    setScannedPreview(null);
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

  // Real catalog topics for the chosen subject, not the old hardcoded list --
  // see resolvedTopicId above for why that mattered. subjects[].name and the
  // catalog's subject names are the same eight strings (Biology, Chemistry,
  // Physics, English, History, Geography, A-Math, E-Math), so the lookup is a
  // name match, not an id one.
  const availableTopics = useMemo(() => {
    const subjectName = subjects.find((candidate) => candidate.id === selectedSubject)?.name;
    const catalogSubject = catalog?.subjects.find((candidate) => candidate.name === subjectName);
    return catalogSubject?.topics.map((topic) => topic.name) ?? [];
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
          description="Take a photo on your phone or upload an image"
          isActive={activeMethod === 'scan'}
        >
          <div className="space-y-4">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {scannedPreview ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="relative h-40 overflow-hidden rounded-xl border-2 border-[#EAA93C]/30">
                  <Image
                    src={scannedPreview}
                    alt="Scanned notes"
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 h-8 w-8 rounded-lg"
                    onClick={() => {
                      setScannedPreview(null);
                      setActiveMethod(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {isOcrRunning ? (
                  <div className="flex items-center gap-2 text-sm text-[#6486B5]">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="h-4 w-4 rounded-full border-2 border-[#6486B5] border-t-transparent"
                    />
                    <span>Microsoft Azure AI Vision is reading your notes...</span>
                  </div>
                ) : extractedContent ? (
                  <div className="flex items-center gap-2 text-sm text-[#6486B5]">
                    <Check className="w-4 h-4" />
                    <span>Text extracted with Microsoft Azure AI Vision</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No text was recognized yet. Try a clearer photo, or type your notes instead.
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.button
                onClick={() => imageInputRef.current?.click()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full h-40 border-2 border-dashed border-[#EAA93C]/40 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[#EAA93C] hover:bg-[#EAA93C]/5 transition-all"
              >
                <div className="w-14 h-14 rounded-full bg-[#EAA93C]/20 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-[#EAA93C]" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-studynow-dark">Click to upload image</p>
                  <p className="text-xs text-muted-foreground">Microsoft Azure AI Vision OCR</p>
                </div>
              </motion.button>
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
              <Button variant="ghost" size="sm" onClick={clearContent} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>

            <Card className="border-0 rounded-2xl card-shadow overflow-hidden">
              <CardContent className="p-6">
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
                    <Select value={selectedTopic} onValueChange={setSelectedTopic} disabled={!selectedSubject || !catalog}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={!selectedSubject ? 'Select subject first' : !catalog ? 'Loading topics...' : 'Select topic'} />
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
                      disabled={isEvaluating}
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
                    disabled={isProcessing || !selectedSubject}
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
