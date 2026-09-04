import quizCatalogFixtureJson from './fixtures/quiz-catalog.json';
import { ACTIVE_SUBJECT_IDS } from './constants.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type QuizQuestionType = 'mcq' | 'fill-blank' | 'structured' | 'diagram';
type QuizQuestionUsage = 'practice' | 'placement' | 'both';

type QuizCatalogFixture = {
  version: number;
  subjects: Array<{
    id: string;
    name: string;
    icon: string | null;
    position: number;
    topics: Array<{
      id: string;
      name: string;
      position: number;
      questions: Array<{
        id: string;
        type: QuizQuestionType;
        text: string;
        correctAnswer: string;
        explanation: string;
        linkedConcept: string;
        options: string[] | null;
        blankWord: string | null;
        wordLimit: number | null;
        source: string | null;
        resourceNumber: string | null;
        diagramUrl: string | null;
      }>;
    }>;
  }>;
};

const completeQuizCatalogFixture = quizCatalogFixtureJson as QuizCatalogFixture;

export const quizCatalogFixture: QuizCatalogFixture = {
  ...completeQuizCatalogFixture,
  version: 2,
  subjects: ACTIVE_SUBJECT_IDS.map((subjectId, position) => {
    const subject = completeQuizCatalogFixture.subjects.find((candidate) => candidate.id === subjectId);
    if (!subject) throw new Error(`Active subject ${subjectId} is missing from quiz-catalog.json.`);
    return {
      ...subject,
      name: subjectId === 'e-math' ? 'Mathematics' : subject.name,
      position,
    };
  }),
};

// Singapore secondary schools (mainstream, religious, madrasah, and NT/special-needs
// secondary schools), sourced from https://en.wikipedia.org/wiki/List_of_secondary_schools_in_Singapore.
// Junior colleges were excluded as they are post-secondary, not secondary, institutions.
const REAL_SCHOOL_NAMES = [
  'Admiralty Secondary School',
  'Ahmad Ibrahim Secondary School',
  'Anderson Secondary School',
  'Anglican High School',
  'Anglo-Chinese School (Barker Road)',
  'Anglo-Chinese School (Independent)',
  'Ang Mo Kio Secondary School',
  'Assumption English School',
  'Bartley Secondary School',
  'Beatty Secondary School',
  'Bedok Green Secondary School',
  'Bedok South Secondary School',
  'Bedok View Secondary School',
  'Bendemeer Secondary School',
  'Boon Lay Secondary School',
  'Bowen Secondary School',
  'Broadrick Secondary School',
  'Bukit Batok Secondary School',
  'Bukit Merah Secondary School',
  'Bukit Panjang Government High School',
  'Bukit View Secondary School',
  'Catholic High School',
  'Canberra Secondary School',
  "Cedar Girls' Secondary School",
  'Changkat Changi Secondary School',
  'CHIJ Katong Convent (Secondary)',
  'CHIJ Secondary (Toa Payoh)',
  "CHIJ St. Joseph's Convent",
  "CHIJ St. Nicholas Girls' School",
  "CHIJ St. Theresa's Convent",
  'Chua Chu Kang Secondary School',
  'Christ Church Secondary School',
  'Chung Cheng High School (Main)',
  'Chung Cheng High School (Yishun)',
  'Clementi Town Secondary School',
  'Commonwealth Secondary School',
  'Compassvale Secondary School',
  "Crescent Girls' School",
  'Damai Secondary School',
  'Deyi Secondary School',
  'Dunearn Secondary School',
  'Dunman High School',
  'Dunman Secondary School',
  'East Spring Secondary School',
  'Edgefield Secondary School',
  'Evergreen Secondary School',
  'Fairfield Methodist School (Secondary)',
  'Fuchun Secondary School',
  'Fuhua Secondary School',
  'Gan Eng Seng School',
  'Geylang Methodist School (Secondary)',
  'Greendale Secondary School',
  'Greenridge Secondary School',
  'Guangyang Secondary School',
  'Hai Sing Catholic School',
  'Hillgrove Secondary School',
  "Holy Innocents' High School",
  'Hougang Secondary School',
  'Hua Yi Secondary School',
  'Hwa Chong Institution',
  'Junyuan Secondary School',
  'Jurong Secondary School',
  'Jurong West Secondary School',
  'Jurongville Secondary School',
  'Juying Secondary School',
  'Kent Ridge Secondary School',
  'Kranji Secondary School',
  'Kuo Chuan Presbyterian Secondary School',
  'Loyang View Secondary School',
  'Manjusri Secondary School',
  'Maris Stella High School',
  'Marsiling Secondary School',
  'Mayflower Secondary School',
  'Meridian Secondary School',
  "Methodist Girls' School (Secondary)",
  'Montfort Secondary School',
  'Nan Chiau High School',
  'Nan Hua High School',
  "Nanyang Girls' High School",
  'Naval Base Secondary School',
  'New Town Secondary School',
  'Ngee Ann Secondary School',
  'North Vista Secondary School',
  'Northbrooks Secondary School',
  'Northland Secondary School',
  'NUS High School of Math and Science',
  'Orchid Park Secondary School',
  'Outram Secondary School',
  'Pasir Ris Crest Secondary School',
  'Pasir Ris Secondary School',
  "Paya Lebar Methodist Girls' School (Secondary)",
  'Pei Hwa Secondary School',
  'Peicai Secondary School',
  'Peirce Secondary School',
  'Presbyterian High School',
  'Punggol Secondary School',
  'Queenstown Secondary School',
  'Queensway Secondary School',
  "Raffles Girls' School (Secondary)",
  'Raffles Institution',
  'Regent Secondary School',
  'Riverside Secondary School',
  'River Valley High School',
  "St Andrew's School (Secondary)",
  "St. Patrick's School",
  'School of Science and Technology, Singapore',
  'School of the Arts',
  'Sembawang Secondary School',
  'Sengkang Secondary School',
  'Serangoon Garden Secondary School',
  'Serangoon Secondary School',
  "Singapore Chinese Girls' School",
  'Singapore Sports School',
  'Springfield Secondary School',
  "St. Anthony's Canossian Secondary School",
  "St. Gabriel's Secondary School",
  "St. Hilda's Secondary School",
  "St. Margaret's Secondary School",
  "St. Joseph's Institution",
  'Swiss Cottage Secondary School',
  'Tanglin Secondary School',
  'Tampines Secondary School',
  "Tanjong Katong Girls' School",
  'Tanjong Katong Secondary School',
  'Temasek Secondary School',
  'Unity Secondary School',
  'Victoria School',
  'West Spring Secondary School',
  'Westwood Secondary School',
  'Whitley Secondary School',
  'Woodgrove Secondary School',
  'Woodlands Ring Secondary School',
  'Woodlands Secondary School',
  'Xinmin Secondary School',
  'Yio Chu Kang Secondary School',
  'Yishun Secondary School',
  'Yishun Town Secondary School',
  'Yuan Ching Secondary School',
  'Yuhua Secondary School',
  'Yusof Ishak Secondary School',
  'Yuying Secondary School',
  'Zhenghua Secondary School',
  'Zhonghua Secondary School',
  'San Yu Adventist School',
  'Madrasah Aljunied Al-Islamiah',
  'Madrasah Irsyad Zuhri Al-Islamiah',
  'Madrasah Al-Arabiah Al-Islamiah',
  'Madrasah Al-Maarif Al-Islamiah',
  'Madrasah Alsagoff Al-Arabiah',
  'Madrasah Wak Tanjong Al-Islamiah',
  'Crest Secondary School',
] as const;

export const schoolSeed = REAL_SCHOOL_NAMES.map((name, index) => ({
  id: slugify(name),
  name,
  position: index,
}));

export const subjectSeed = quizCatalogFixture.subjects.map((subject) => ({
  id: subject.id,
  name: subject.name,
  icon: subject.icon,
  position: subject.position,
}));

export const topicSeed = quizCatalogFixture.subjects.flatMap((subject) => (
  subject.topics.map((topic) => ({
    id: topic.id,
    subjectId: subject.id,
    name: topic.name,
    position: topic.position,
  }))
));

const practiceQuestionSeed = quizCatalogFixture.subjects.flatMap((subject) => (
  subject.topics.flatMap((topic) => (
    topic.questions.map((question) => ({
      id: question.id,
      topicId: topic.id,
      type: question.type,
      usage: (question.type === 'mcq' ? 'both' : 'practice') as QuizQuestionUsage,
      text: question.text,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      linkedConcept: question.linkedConcept,
      options: question.options ? JSON.stringify(question.options) : null,
      blankWord: question.blankWord,
      wordLimit: question.wordLimit,
      maxMarks: question.type === 'structured' ? 10 : null,
      source: question.source,
      resourceNumber: question.resourceNumber,
      diagramUrl: question.diagramUrl,
    }))
  ))
));

/**
 * Placement needs ten MCQs for every selectable topic, while the existing
 * practice modes must retain their original five-question concept checks and
 * paper sizes. The fixed fixture supplies three MCQs per topic. These seven
 * additional, placement-only concept-recognition questions are derived from
 * the fixture's reviewed explanations and are still persisted as ordinary DB
 * question rows by initializeDB.ts.
 */
const placementQuestionSeed = quizCatalogFixture.subjects.flatMap((subject) => {
  const subjectExplanationPool = subject.topics.flatMap((topic) => (
    topic.questions.map((question) => question.explanation)
  ));

  return subject.topics.flatMap((topic) => Array.from({ length: 7 }, (_, index) => {
    const sourceQuestion = topic.questions[index % topic.questions.length]!;
    const correctExplanation = sourceQuestion.explanation;
    const offset = (topic.position * 7 + index) % subjectExplanationPool.length;
    const rotatedPool = [
      ...subjectExplanationPool.slice(offset),
      ...subjectExplanationPool.slice(0, offset),
    ];
    const distractors = [...new Set(rotatedPool)]
      .filter((candidate) => candidate !== correctExplanation)
      .slice(0, 3);
    if (distractors.length !== 3) {
      throw new Error(`Topic ${topic.id} does not have enough distinct placement distractors.`);
    }

    const correctIndex = (topic.position + index) % 4;
    const options = [...distractors];
    options.splice(correctIndex, 0, correctExplanation);
    const variant = index < topic.questions.length
      ? `Which statement best explains "${sourceQuestion.linkedConcept}" in ${topic.name}?`
      : `Which statement gives the most accurate account of "${sourceQuestion.linkedConcept}" when revising ${topic.name}?`;

    return {
      id: `${topic.id}-q${String(index + 6).padStart(3, '0')}`,
      topicId: topic.id,
      type: 'mcq' as const,
      usage: 'placement' as const,
      text: variant,
      correctAnswer: String(correctIndex),
      explanation: correctExplanation,
      linkedConcept: sourceQuestion.linkedConcept,
      options: JSON.stringify(options),
      blankWord: null,
      wordLimit: null,
      maxMarks: null,
      source: 'EduNets placement bank',
      resourceNumber: null,
      diagramUrl: null,
    };
  }));
});

const essayQuestionSeed = quizCatalogFixture.subjects.flatMap((subject) => (
  subject.topics.flatMap((topic) => {
    const sourceQuestions = topic.questions.filter((question) => question.type !== 'structured').slice(0, 4);
    if (sourceQuestions.length !== 4) {
      throw new Error(`Topic ${topic.id} does not have four source questions for Essay derivation.`);
    }
    return sourceQuestions.map((question, index) => ({
      id: `${topic.id}-q${String(index + 13).padStart(3, '0')}`,
      topicId: topic.id,
      type: 'structured' as const,
      usage: 'practice' as const,
      text: `Explain "${question.linkedConcept}" in ${topic.name}. Include the relevant reasoning and key details.`,
      correctAnswer: question.explanation,
      explanation: question.explanation,
      linkedConcept: question.linkedConcept,
      options: null,
      blankWord: null,
      wordLimit: 120,
      maxMarks: 10,
      source: 'EduNets Phase 1 Essay test bank',
      resourceNumber: null,
      diagramUrl: null,
    }));
  })
));

export const quizQuestionSeed = [...practiceQuestionSeed, ...placementQuestionSeed, ...essayQuestionSeed];
