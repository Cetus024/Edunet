import { CURRICULUM, CURRICULUM_SUBTOPIC_BY_ID } from '../lib/curriculum.js';
import { AUTHORED_QUESTION_TOPICS } from './fixtures/active-question-bank.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

export const subjectSeed = CURRICULUM.map((subject, position) => ({
  id: subject.id,
  name: subject.name,
  syllabusCode: subject.syllabusCode,
  icon: subject.icon,
  position,
}));

export const topicSeed = CURRICULUM.flatMap((subject) => (
  subject.topics.map((topic, position) => ({
    id: topic.id,
    subjectId: subject.id,
    syllabusCode: topic.syllabusCode,
    name: topic.name,
    description: topic.description,
    position,
  }))
));

export const subtopicSeed = CURRICULUM.flatMap((subject) => subject.topics.flatMap((topic) => (
  topic.subtopics.map((child, position) => ({
    id: child.id,
    topicId: topic.id,
    syllabusCode: child.syllabusCode,
    name: child.name,
    description: child.description,
    position,
  }))
)));

export const topicAliasSeed = CURRICULUM.flatMap((subject) => subject.topics.flatMap((topic) => (
  [...new Set([topic.id, topic.name, ...topic.aliases])].map((alias, index) => ({
    id: `${topic.id}-alias-${String(index + 1).padStart(2, '0')}`,
    topicId: topic.id,
    alias,
  }))
)));

const subjectSource = new Map(CURRICULUM.map((subject) => [
  subject.id,
  `Singapore-Cambridge GCE O-Level ${subject.name} ${subject.syllabusCode} Syllabus (2026)`,
]));
const topicSubject = new Map(topicSeed.map((topic) => [topic.id, topic.subjectId]));

export const quizQuestionSeed = AUTHORED_QUESTION_TOPICS.flatMap((topic) => {
  const subjectId = topicSubject.get(topic.topicId);
  if (!subjectId) throw new Error(`Question topic ${topic.topicId} is not in the curriculum.`);
  if (topic.mcqs.length !== 10 || topic.essays.length !== 5) {
    throw new Error(`Question topic ${topic.topicId} must contain exactly 10 MCQs and 5 Essays.`);
  }
  const source = subjectSource.get(subjectId)!;
  const makeShared = (subtopicId: string | null, index: number) => {
    const child = subtopicId ? CURRICULUM_SUBTOPIC_BY_ID.get(subtopicId) : undefined;
    if (subtopicId && (!child || child.topicId !== topic.topicId)) {
      throw new Error(`Question subtopic ${subtopicId} does not belong to ${topic.topicId}.`);
    }
    return {
      id: `${topic.topicId}-q${String(index + 1).padStart(3, '0')}`,
      topicId: topic.topicId,
      subtopicId,
      source,
      resourceNumber: child?.syllabusCode ?? topicSeed.find((item) => item.id === topic.topicId)!.syllabusCode,
      diagramUrl: null,
    };
  };

  return [
    ...topic.mcqs.map(([subtopicId, text, options, correctIndex, explanation, linkedConcept], index) => ({
      ...makeShared(subtopicId, index),
      type: 'mcq' as const,
      usage: 'both' as const,
      text,
      correctAnswer: String(correctIndex),
      explanation,
      linkedConcept,
      options: JSON.stringify(options),
      blankWord: null,
      wordLimit: null,
      maxMarks: null,
    })),
    ...topic.essays.map(([subtopicId, text, markingGuide, linkedConcept], index) => ({
      ...makeShared(subtopicId, index + 10),
      type: 'structured' as const,
      usage: 'practice' as const,
      text,
      correctAnswer: markingGuide,
      explanation: markingGuide,
      linkedConcept,
      options: null,
      blankWord: null,
      wordLimit: 180,
      maxMarks: 10,
    })),
  ];
});
