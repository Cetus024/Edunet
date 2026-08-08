import { pgTable, text, integer, primaryKey } from 'drizzle-orm/pg-core';

export const schools = pgTable('schools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
});

export const subjects = pgTable('subjects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
  position: integer('position').notNull().default(0),
});

export const topics = pgTable('topics', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
});

export const topicAliases = pgTable('topic_aliases', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull().references(() => topics.id),
  alias: text('alias').notNull(),
});

export const quizQuestions = pgTable('quiz_questions', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull().references(() => topics.id),
  type: text('type', { enum: ['mcq', 'fill-blank', 'structured', 'diagram'] }).notNull(),
  text: text('text').notNull(),
  correctAnswer: text('correct_answer').notNull(),
  explanation: text('explanation').notNull(),
  linkedConcept: text('linked_concept').notNull(),
  options: text('options'), // JSON array for MCQ options
  blankWord: text('blank_word'), // For fill-blank questions
  wordLimit: integer('word_limit'), // For structured questions
  source: text('source'),
  resourceNumber: text('resource_number'),
  diagramUrl: text('diagram_url'),
});
