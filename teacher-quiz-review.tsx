import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, MessageSquareText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ReviewQuestion = {
  id: string;
  subject: string;
  topic: string;
  questionText: string;
  correctAnswer: string;
  aiGeneratedExplanation: string;
  teacherEditedExplanation?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

const subjectOrder = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'];

const initialQuestions: ReviewQuestion[] = [
  { id: 'math-1', subject: 'Mathematics', topic: 'Algebraic Manipulation', questionText: 'Expand and simplify (x + 3)(x - 5).', correctAnswer: 'x² - 2x - 15', aiGeneratedExplanation: 'Multiply each term in the first bracket by each term in the second bracket, then collect like terms: x² - 5x + 3x - 15 = x² - 2x - 15.' },
  { id: 'math-2', subject: 'Mathematics', topic: 'Geometry & Angles', questionText: 'Why are angles on a straight line supplementary?', correctAnswer: 'They add up to 180°.', aiGeneratedExplanation: 'A straight line forms a half-turn, which measures 180°. Any adjacent angles along that line must therefore add to 180°.' },
  { id: 'math-3', subject: 'Mathematics', topic: 'Statistics', questionText: 'When is the median more useful than the mean?', correctAnswer: 'When data contains extreme values.', aiGeneratedExplanation: 'The median is less affected by outliers, so it gives a better typical value when a dataset has very large or very small extremes.' },
  { id: 'math-4', subject: 'Mathematics', topic: 'Probability', questionText: 'A fair die is rolled once. What is the probability of rolling an even number?', correctAnswer: '1/2', aiGeneratedExplanation: 'The even outcomes are 2, 4, and 6. There are 3 favourable outcomes out of 6 possible outcomes, so the probability is 3/6 = 1/2.' },
  { id: 'phy-1', subject: 'Physics', topic: 'Speed & Acceleration', questionText: 'A cyclist increases speed from 4 m/s to 12 m/s in 4 s. Calculate acceleration.', correctAnswer: '2 m/s²', aiGeneratedExplanation: 'Acceleration is change in velocity divided by time: (12 - 4) / 4 = 2 m/s².' },
  { id: 'phy-2', subject: 'Physics', topic: 'Forces & Moments', questionText: 'What happens to a stationary object when resultant force is zero?', correctAnswer: 'It remains stationary.', aiGeneratedExplanation: 'If the resultant force is zero, the forces are balanced. A stationary object will remain at rest because there is no net force causing acceleration.' },
  { id: 'phy-3', subject: 'Physics', topic: 'Waves', questionText: 'State the relationship between wave speed, frequency, and wavelength.', correctAnswer: 'v = fλ', aiGeneratedExplanation: 'Wave speed equals frequency multiplied by wavelength. Frequency tells how many waves pass per second, while wavelength is the distance between matching points.' },
  { id: 'phy-4', subject: 'Physics', topic: 'Electricity', questionText: 'Why does adding resistors in series increase total resistance?', correctAnswer: 'Current has to pass through each resistor in one path.', aiGeneratedExplanation: 'In series, charges move through every resistor one after another, so each resistor adds opposition to the same current path.' },
  { id: 'chem-1', subject: 'Chemistry', topic: 'Covalent Bonding', questionText: 'Why do simple covalent substances usually have low melting points?', correctAnswer: 'Weak intermolecular forces require little energy to overcome.', aiGeneratedExplanation: 'Simple covalent molecules have strong covalent bonds inside each molecule but weak intermolecular forces between molecules, so little energy is needed to separate the molecules.' },
  { id: 'chem-2', subject: 'Chemistry', topic: 'Atomic Structure', questionText: 'Which subatomic particle determines the element identity?', correctAnswer: 'Proton', aiGeneratedExplanation: 'The number of protons is the atomic number. Changing the proton number changes the element itself.' },
  { id: 'chem-3', subject: 'Chemistry', topic: 'Acids & Bases', questionText: 'What salt forms when hydrochloric acid reacts with sodium hydroxide?', correctAnswer: 'Sodium chloride', aiGeneratedExplanation: 'Neutralisation between hydrochloric acid and sodium hydroxide produces sodium chloride and water: HCl + NaOH → NaCl + H₂O.' },
  { id: 'chem-4', subject: 'Chemistry', topic: 'Rate of Reaction', questionText: 'Why does higher temperature increase reaction rate?', correctAnswer: 'Particles collide more often and with more energy.', aiGeneratedExplanation: 'Heating gives particles more kinetic energy, causing more frequent collisions and a greater proportion of successful collisions.' },
  { id: 'bio-1', subject: 'Biology', topic: 'Cell Division (Mitosis)', questionText: 'During which phase of mitosis do chromosomes line up at the cell equator?', correctAnswer: 'Metaphase', aiGeneratedExplanation: 'During metaphase, spindle fibres attach to the centromeres and align chromosomes at the metaphase plate so each daughter cell receives the same genetic material.' },
  { id: 'bio-2', subject: 'Biology', topic: 'Genetics', questionText: 'What does a recessive allele need in order to be expressed?', correctAnswer: 'Two copies of the recessive allele.', aiGeneratedExplanation: 'A recessive allele is only expressed when no dominant allele is present, so the organism must inherit the recessive allele from both parents.', teacherEditedExplanation: 'A recessive trait appears only when both alleles are recessive, because a dominant allele would mask it.', reviewedBy: 'Ms Tan', reviewedAt: '2026-07-28T09:00:00.000Z' },
  { id: 'bio-3', subject: 'Biology', topic: 'Respiration', questionText: 'Why is oxygen needed in aerobic respiration?', correctAnswer: 'It is the final electron acceptor.', aiGeneratedExplanation: 'Oxygen allows aerobic respiration to continue by accepting electrons at the end of the process, enabling efficient ATP production.' },
  { id: 'bio-4', subject: 'Biology', topic: 'Ecology', questionText: 'What does a food chain show?', correctAnswer: 'The transfer of energy between organisms.', aiGeneratedExplanation: 'A food chain shows how energy passes from one organism to another through feeding relationships.' },
  { id: 'eng-1', subject: 'English', topic: 'Summary Writing', questionText: 'What should be removed when writing a concise summary?', correctAnswer: 'Examples, repetition, and minor details.', aiGeneratedExplanation: 'A concise summary keeps only the main points and removes examples, repeated ideas, and details that do not change the central meaning.' },
  { id: 'eng-2', subject: 'English', topic: 'Comprehension Inference', questionText: 'What does it mean to infer a character’s mood?', correctAnswer: 'Use clues to work out feelings not directly stated.', aiGeneratedExplanation: 'Inference means reading between the lines by using words, actions, and context to decide what the writer implies.' },
  { id: 'eng-3', subject: 'English', topic: 'Situational Writing', questionText: 'Why is audience important in situational writing?', correctAnswer: 'It affects tone, format, and content.', aiGeneratedExplanation: 'Audience determines how formal the writing should be, what information matters, and how the message should be structured.' },
  { id: 'eng-4', subject: 'English', topic: 'Editing', questionText: 'What should you check first in an editing passage?', correctAnswer: 'Grammar and meaning in context.', aiGeneratedExplanation: 'The correct word or structure must fit both grammar rules and the meaning of the sentence around it.' },
  { id: 'hist-1', subject: 'History', topic: 'World War II', questionText: 'Give one reason why appeasement failed before World War II.', correctAnswer: 'It encouraged further aggression.', aiGeneratedExplanation: 'Appeasement failed because concessions made aggressive leaders believe they could continue expanding without strong resistance.' },
  { id: 'hist-2', subject: 'History', topic: 'The Cold War', questionText: 'Why was the Berlin Blockade significant?', correctAnswer: 'It intensified tensions between the USSR and the West.', aiGeneratedExplanation: 'The blockade showed the deep divide between Soviet and Western aims, and the airlift became a major symbol of resistance.' },
  { id: 'hist-3', subject: 'History', topic: 'Singapore History', questionText: 'Why was merger with Malaysia initially attractive to Singapore?', correctAnswer: 'It offered a larger common market and political stability.', aiGeneratedExplanation: 'Singapore hoped merger would support trade, jobs, and security by joining a larger federation.' },
  { id: 'geo-1', subject: 'Geography', topic: 'Weather & Climate', questionText: 'How does convectional rain form?', correctAnswer: 'Warm air rises, cools, condenses, and falls as rain.', aiGeneratedExplanation: 'Strong heating causes moist air to rise. As it rises, it cools and condenses into clouds, producing rainfall.' },
  { id: 'geo-2', subject: 'Geography', topic: 'Plate Tectonics', questionText: 'What happens at a destructive plate boundary?', correctAnswer: 'One plate subducts beneath another.', aiGeneratedExplanation: 'At destructive boundaries, denser oceanic crust is forced below another plate, causing earthquakes and volcanic activity.' },
  { id: 'geo-3', subject: 'Geography', topic: 'Tourism', questionText: 'Name one positive impact of tourism on local communities.', correctAnswer: 'Jobs and income.', aiGeneratedExplanation: 'Tourism can create employment and increase income for local businesses such as hotels, restaurants, and transport services.' },
];

function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short' }).format(new Date(value));
}

function ReviewBadge({ reviewed, label }: { reviewed: boolean; label?: string }) {
  if (reviewed) {
    return <Badge className="border-0 bg-primary text-primary-foreground"><CheckCircle2 className="mr-1 h-3 w-3" />{label ?? 'Teacher-reviewed'}</Badge>;
  }
  return <Badge className="border border-accent bg-card text-card-foreground">{label ?? 'AI-generated'}</Badge>;
}

export function TeacherQuizReview() {
  const [selectedSubject, setSelectedSubject] = useState('Biology');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>(initialQuestions);
  const selectedQuestion = questions.find((question: ReviewQuestion) => question.id === selectedQuestionId);
  const [draft, setDraft] = useState('');

  const topics = useMemo(() => {
    const grouped = new Map<string, ReviewQuestion[]>();
    questions.filter((question: ReviewQuestion) => question.subject === selectedSubject).forEach((question: ReviewQuestion) => {
      grouped.set(question.topic, [...(grouped.get(question.topic) ?? []), question]);
    });
    return Array.from(grouped.entries()).map(([topic, topicQuestions]: [string, ReviewQuestion[]]) => ({ topic, questions: topicQuestions }));
  }, [questions, selectedSubject]);

  const openQuestion = (question: ReviewQuestion) => {
    setSelectedQuestionId(question.id);
    setDraft(question.teacherEditedExplanation ?? question.aiGeneratedExplanation);
  };

  const handleSave = () => {
    if (!selectedQuestion) return;
    const reviewedAt = new Date().toISOString();
    setQuestions((currentQuestions: ReviewQuestion[]) => currentQuestions.map((question: ReviewQuestion) => question.id === selectedQuestion.id ? { ...question, teacherEditedExplanation: draft, reviewedBy: 'Current teacher', reviewedAt } : question));
    toast.success('Saved in this demonstration view.');
  };

  return (
    <div className="min-h-screen pattern-overlay p-6 lg:p-8">
      <div className="mb-6 rounded-[2rem] bg-card p-6 text-card-foreground shadow-[0_12px_30px_rgba(29,58,98,0.10)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-primary">Smart Quiz review</h1>
            <p className="mt-2 text-sm text-muted-foreground">Preview how teachers can review explanations shown after a wrong answer.</p>
          </div>
          <Badge className="border border-primary/35 bg-primary/15 text-primary">
            Demonstration data
          </Badge>
        </div>
      </div>

      <div className="mb-6 flex gap-3 overflow-x-auto border-b border-border">
        {subjectOrder.map((subject: string) => (
          <button key={subject} type="button" onClick={() => { setSelectedSubject(subject); setSelectedTopic(null); setSelectedQuestionId(null); }} className={cn('shrink-0 border-b-4 px-3 py-3 text-sm font-black transition-colors', selectedSubject === subject ? 'border-primary text-primary' : 'border-transparent text-foreground hover:text-primary')}>
            {subject}
          </button>
        ))}
      </div>

      {!selectedTopic ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {topics.map(({ topic, questions: topicQuestions }: { topic: string; questions: ReviewQuestion[] }) => {
            const reviewedCount = topicQuestions.filter((question: ReviewQuestion) => question.teacherEditedExplanation).length;
            const allReviewed = reviewedCount === topicQuestions.length;
            return (
              <Card key={topic} className="border-0 bg-card text-card-foreground shadow-[0_12px_30px_rgba(29,58,98,0.10)]">
                <CardContent className="p-5">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-black text-primary">{topic}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{topicQuestions.length} AI-generated questions</p>
                    </div>
                    <ReviewBadge reviewed={allReviewed} label={allReviewed ? 'All reviewed ✓' : `${reviewedCount} of ${topicQuestions.length} reviewed`} />
                  </div>
                  <Button onClick={() => setSelectedTopic(topic)} className="w-full rounded-2xl bg-primary text-primary-foreground hover:bg-accent">Review →</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <Button variant="ghost" onClick={() => { setSelectedTopic(null); setSelectedQuestionId(null); }} className="mb-4"><ChevronLeft className="mr-2 h-4 w-4" />Back to topics</Button>
            <div className="space-y-3">
              {questions.filter((question: ReviewQuestion) => question.subject === selectedSubject && question.topic === selectedTopic).map((question: ReviewQuestion) => (
                <button key={question.id} type="button" onClick={() => openQuestion(question)} className="w-full rounded-[1.25rem] bg-card p-4 text-left text-card-foreground shadow-[0_12px_30px_rgba(29,58,98,0.10)] transition hover:-translate-y-0.5">
                  <div className="mb-3 flex items-center justify-between gap-3"><ReviewBadge reviewed={Boolean(question.teacherEditedExplanation)} /><span className="text-xs text-muted-foreground">Tap the AI explanation to refine</span></div>
                  <p className="font-black text-primary">{question.questionText}</p>
                  <p className="mt-3 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground"><MessageSquareText className="mr-2 inline h-4 w-4" />{question.teacherEditedExplanation ?? question.aiGeneratedExplanation}</p>
                  {question.reviewedBy && question.reviewedAt && <p className="mt-2 text-xs font-bold text-muted-foreground">Reviewed by {question.reviewedBy} · {formatReviewDate(question.reviewedAt)}</p>}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {selectedQuestion && (
              <motion.aside initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="fixed inset-x-3 bottom-3 z-50 max-h-[82vh] overflow-y-auto rounded-[1.5rem] bg-card p-5 text-card-foreground shadow-[0_18px_45px_rgba(29,58,98,0.18)] xl:sticky xl:top-6 xl:max-h-none">
                <h2 className="text-xl font-black text-primary">Approve explanation</h2>
                <p className="mt-1 text-sm text-muted-foreground">Here's what the AI suggested — tweak it if you'd explain it differently.</p>
                <div className="mt-5 rounded-2xl bg-muted p-4 text-muted-foreground"><p className="text-xs font-black uppercase">Original question</p><p className="mt-2 text-sm">{selectedQuestion.questionText}</p></div>
                <label className="mt-5 block text-sm font-black text-foreground">Mark scheme / explanation</label>
                <Textarea value={draft} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)} className="mt-2 min-h-44 rounded-2xl bg-background" />
                <Button onClick={handleSave} className="mt-4 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-accent">Save</Button>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
