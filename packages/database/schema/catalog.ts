import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, integer, uniqueIndex } from 'drizzle-orm/pg-core';

export const schools = pgTable('schools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
});

export const subjects = pgTable('subjects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  syllabusCode: text('syllabus_code').notNull(),
  icon: text('icon'),
  position: integer('position').notNull().default(0),
});

export const topics = pgTable('topics', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  syllabusCode: text('syllabus_code').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  position: integer('position').notNull().default(0),
}, (table) => [
  uniqueIndex('topics_subject_syllabus_code_idx').on(table.subjectId, table.syllabusCode),
]);

export const subtopics = pgTable('subtopics', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  syllabusCode: text('syllabus_code').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  position: integer('position').notNull().default(0),
}, (table) => [
  uniqueIndex('subtopics_topic_syllabus_code_idx').on(table.topicId, table.syllabusCode),
]);

export const topicAliases = pgTable('topic_aliases', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
});

export const quizQuestions = pgTable('quiz_questions', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  subtopicId: text('subtopic_id').references(() => subtopics.id, { onDelete: 'set null' }),
  type: text('type', { enum: ['mcq', 'fill-blank', 'structured', 'diagram'] }).notNull(),
  usage: text('usage', { enum: ['practice', 'placement', 'both'] as const }).notNull().default('practice'),
  text: text('text').notNull(),
  correctAnswer: text('correct_answer').notNull(),
  explanation: text('explanation').notNull(),
  linkedConcept: text('linked_concept').notNull(),
  options: text('options'), // JSON array for MCQ options
  blankWord: text('blank_word'), // For fill-blank questions
  wordLimit: integer('word_limit'), // For structured questions
  maxMarks: integer('max_marks'), // Phase 1 Essay questions use 10 marks
  source: text('source'),
  resourceNumber: text('resource_number'),
  diagramUrl: text('diagram_url'),
}, (table) => [
  index('quiz_questions_subtopic_idx').on(table.subtopicId),
  check('quiz_questions_usage_check', sql`${table.usage} in ('practice', 'placement', 'both')`),
  check('quiz_questions_max_marks_check', sql`(${table.type} = 'structured' and ${table.maxMarks} = 10) or (${table.type} <> 'structured' and ${table.maxMarks} is null)`),
]);
