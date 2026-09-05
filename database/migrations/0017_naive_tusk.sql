CREATE TEMP TABLE "curriculum_v2_preserved_counts" AS
SELECT
  (SELECT count(*) FROM "user") AS "users",
  (SELECT count(*) FROM "profile") AS "profiles",
  (SELECT count(*) FROM "schools") AS "schools",
  (SELECT count(*) FROM "edunets"."study_squads") AS "squads",
  (SELECT count(*) FROM "edunets"."study_squad_members") AS "squad_members",
  (SELECT count(*) FROM "edunets"."study_squad_invitations") AS "squad_invitations";--> statement-breakpoint

DO $$
DECLARE
  user_count bigint;
  profile_count bigint;
  school_count bigint;
  squad_count bigint;
  squad_member_count bigint;
  squad_invitation_count bigint;
BEGIN
  SELECT count(*) INTO user_count FROM "user";
  SELECT count(*) INTO profile_count FROM "profile";
  SELECT count(*) INTO school_count FROM "schools";
  SELECT count(*) INTO squad_count FROM "edunets"."study_squads";
  SELECT count(*) INTO squad_member_count FROM "edunets"."study_squad_members";
  SELECT count(*) INTO squad_invitation_count FROM "edunets"."study_squad_invitations";
  RAISE NOTICE 'curriculum-v2 pre-migration counts users=%, profiles=%, schools=%, squads=%, squad_members=%, squad_invitations=%',
    user_count, profile_count, school_count, squad_count, squad_member_count, squad_invitation_count;
END $$;
--> statement-breakpoint

ALTER TABLE "subjects" ADD COLUMN "syllabus_code" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "syllabus_code" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "quiz_attempt_question" ADD COLUMN "subtopic_id" text;--> statement-breakpoint
ALTER TABLE "quiz_attempt_question" ADD COLUMN "subtopic_syllabus_code" text;--> statement-breakpoint
ALTER TABLE "quiz_attempt_question" ADD COLUMN "subtopic_name" text;--> statement-breakpoint

-- Topic-dependent evidence cannot be folded safely into the new parent model.
DELETE FROM "edunets"."notifications"
WHERE "type" IN (
  'squad_quiz_invitation', 'squad_quiz_finished',
  'revision_room_invitation', 'revision_room_started'
);--> statement-breakpoint
DELETE FROM "edunets"."squad_quiz_rooms";--> statement-breakpoint
DELETE FROM "discussion_room";--> statement-breakpoint
DELETE FROM "question_review";--> statement-breakpoint
DELETE FROM "user_topic_mode_progress";--> statement-breakpoint
DELETE FROM "user_topic_progress";--> statement-breakpoint
DELETE FROM "quiz_attempt";--> statement-breakpoint
DELETE FROM "onboarding_profile" op
USING "profile" p
WHERE op."user_id" = p."user_id"
  AND p."role" = 'student';--> statement-breakpoint

DELETE FROM "edunets"."enquiry_threads"
WHERE "is_demo" = true
   OR "subject_id" NOT IN ('e-math', 'chemistry');--> statement-breakpoint
DELETE FROM "edunets"."notifications" n
WHERE n."type" IN ('teacher_enquiry', 'teacher_reply')
  AND NOT EXISTS (
    SELECT 1 FROM "edunets"."enquiry_threads" t
    WHERE t."id" = n."resource_id"
  );--> statement-breakpoint
DELETE FROM "teaching_scope"
WHERE "subject_id" NOT IN ('e-math', 'chemistry');--> statement-breakpoint

-- A teacher with at least one surviving scope remains onboarded. Keep the
-- existing profile row, select its first valid scope as the primary subject,
-- and clear only the retired Topic/placement references.
UPDATE "onboarding_profile" op
SET "subject_id" = (
      SELECT ts."subject_id"
      FROM "teaching_scope" ts
      WHERE ts."user_id" = op."user_id"
        AND ts."subject_id" IN ('e-math', 'chemistry')
      ORDER BY ts."position", ts."id"
      LIMIT 1
    ),
    "topic_id" = NULL,
    "placement_attempt_id" = NULL,
    "updated_at" = now()
WHERE EXISTS (
  SELECT 1 FROM "profile" p
  WHERE p."user_id" = op."user_id" AND p."role" = 'teacher'
)
  AND EXISTS (
    SELECT 1 FROM "teaching_scope" ts
    WHERE ts."user_id" = op."user_id"
      AND ts."subject_id" IN ('e-math', 'chemistry')
  );--> statement-breakpoint
DELETE FROM "onboarding_profile" op
USING "profile" p
WHERE op."user_id" = p."user_id"
  AND p."role" = 'teacher'
  AND NOT EXISTS (
    SELECT 1 FROM "teaching_scope" ts
    WHERE ts."user_id" = op."user_id"
      AND ts."subject_id" IN ('e-math', 'chemistry')
  );--> statement-breakpoint

-- Upsert the two parents so the migration also succeeds on a fresh database,
-- where catalog seed data has not been inserted yet.
INSERT INTO "subjects" ("id", "name", "syllabus_code", "icon", "position") VALUES
  ('e-math', 'Mathematics', '4052', '📐', 0),
  ('chemistry', 'Chemistry', '6092', '⚗️', 1)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "syllabus_code" = EXCLUDED."syllabus_code",
  "icon" = EXCLUDED."icon",
  "position" = EXCLUDED."position";--> statement-breakpoint

-- Create all canonical parents before remapping preserved real enquiries.
INSERT INTO "topics" ("id", "subject_id", "syllabus_code", "name", "description", "position") VALUES
  ('math-number-algebra', 'e-math', 'N', 'NUMBER AND ALGEBRA', 'Numerical reasoning, proportional relationships, algebraic manipulation, functions, equations, sets and matrices.', 0),
  ('math-geometry-measurement', 'e-math', 'G', 'GEOMETRY AND MEASUREMENT', 'Geometrical reasoning, similarity, circles, trigonometry, mensuration, coordinates and vectors.', 1),
  ('math-statistics-probability', 'e-math', 'S', 'STATISTICS AND PROBABILITY', 'Collection, presentation and interpretation of data, together with probability models and calculations.', 2),
  ('chemistry-experimental-chemistry', 'chemistry', '1', 'Experimental Chemistry', 'Planning investigations and selecting techniques to separate, purify and analyse substances.', 0),
  ('chemistry-particulate-nature-matter', 'chemistry', '2', 'The Particulate Nature of Matter', 'Particle-model explanations of states and changes, and the subatomic structure of atoms and ions.', 1),
  ('chemistry-chemical-bonding-structure', 'chemistry', '3', 'Chemical Bonding and Structure', 'Bonding models and the relationship between structure and physical properties.', 2),
  ('chemistry-chemical-calculations', 'chemistry', '4', 'Chemical Calculations', 'Formula and equation writing, relative masses, moles, reacting quantities and concentrations.', 3),
  ('chemistry-acid-base-chemistry', 'chemistry', '5', 'Acid-Base Chemistry', 'Properties and reactions of acids, bases and salts, including ammonia.', 4),
  ('chemistry-qualitative-analysis', 'chemistry', '6', 'Qualitative Analysis', 'Use observations and prescribed tests to identify ions and gases.', 5),
  ('chemistry-redox-chemistry', 'chemistry', '7', 'Redox Chemistry', 'Oxidation and reduction in chemical reactions and electrochemical cells.', 6),
  ('chemistry-periodic-table-patterns', 'chemistry', '8', 'Patterns in the Periodic Table', 'Periodic trends, group behaviour, transition elements and metal reactivity.', 7),
  ('chemistry-chemical-energetics', 'chemistry', '9', 'Chemical Energetics', 'Energy changes in reactions, reaction profiles and bond-energy calculations.', 8),
  ('chemistry-rate-reactions', 'chemistry', '10', 'Rate of Reactions', 'Measuring and explaining reaction rates using collision theory and activation energy.', 9),
  ('chemistry-organic-chemistry', 'chemistry', '11', 'Organic Chemistry', 'Fuels, homologous series, functional groups, reactions and polymers.', 10),
  ('chemistry-maintaining-air-quality', 'chemistry', '12', 'Maintaining Air Quality', 'Composition of air, atmospheric pollutants, climate effects and control measures.', 11)
ON CONFLICT ("id") DO UPDATE SET
  "subject_id" = EXCLUDED."subject_id",
  "syllabus_code" = EXCLUDED."syllabus_code",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "position" = EXCLUDED."position";--> statement-breakpoint

UPDATE "edunets"."enquiry_threads"
SET "topic_id" = CASE "topic_id"
      WHEN 'e-math-numbers' THEN 'math-number-algebra'
      WHEN 'e-math-algebra' THEN 'math-number-algebra'
      WHEN 'e-math-geometry' THEN 'math-geometry-measurement'
      WHEN 'e-math-mensuration' THEN 'math-geometry-measurement'
      WHEN 'e-math-statistics' THEN 'math-statistics-probability'
      WHEN 'e-math-probability' THEN 'math-statistics-probability'
      WHEN 'chemistry-atomic-structure' THEN 'chemistry-particulate-nature-matter'
      WHEN 'chemistry-covalent-bonding' THEN 'chemistry-chemical-bonding-structure'
      WHEN 'chemistry-stoichiometry' THEN 'chemistry-chemical-calculations'
      WHEN 'chemistry-acids-bases' THEN 'chemistry-acid-base-chemistry'
      WHEN 'chemistry-redox-reactions' THEN 'chemistry-redox-chemistry'
      WHEN 'chemistry-organic-chemistry' THEN 'chemistry-organic-chemistry'
      WHEN 'chemistry-rate-of-reaction' THEN 'chemistry-rate-reactions'
      ELSE NULL
    END,
    "topic_name_snapshot" = CASE "topic_id"
      WHEN 'e-math-numbers' THEN 'NUMBER AND ALGEBRA'
      WHEN 'e-math-algebra' THEN 'NUMBER AND ALGEBRA'
      WHEN 'e-math-geometry' THEN 'GEOMETRY AND MEASUREMENT'
      WHEN 'e-math-mensuration' THEN 'GEOMETRY AND MEASUREMENT'
      WHEN 'e-math-statistics' THEN 'STATISTICS AND PROBABILITY'
      WHEN 'e-math-probability' THEN 'STATISTICS AND PROBABILITY'
      WHEN 'chemistry-atomic-structure' THEN 'The Particulate Nature of Matter'
      WHEN 'chemistry-covalent-bonding' THEN 'Chemical Bonding and Structure'
      WHEN 'chemistry-stoichiometry' THEN 'Chemical Calculations'
      WHEN 'chemistry-acids-bases' THEN 'Acid-Base Chemistry'
      WHEN 'chemistry-redox-reactions' THEN 'Redox Chemistry'
      WHEN 'chemistry-organic-chemistry' THEN 'Organic Chemistry'
      WHEN 'chemistry-rate-of-reaction' THEN 'Rate of Reactions'
      ELSE NULL
    END
WHERE "is_demo" = false
  AND "subject_id" IN ('e-math', 'chemistry');--> statement-breakpoint

DELETE FROM "topic_aliases";--> statement-breakpoint
DELETE FROM "quiz_questions";--> statement-breakpoint
DELETE FROM "topics"
WHERE "id" NOT IN (
  'math-number-algebra', 'math-geometry-measurement', 'math-statistics-probability',
  'chemistry-experimental-chemistry', 'chemistry-particulate-nature-matter',
  'chemistry-chemical-bonding-structure', 'chemistry-chemical-calculations',
  'chemistry-acid-base-chemistry', 'chemistry-qualitative-analysis',
  'chemistry-redox-chemistry', 'chemistry-periodic-table-patterns',
  'chemistry-chemical-energetics', 'chemistry-rate-reactions',
  'chemistry-organic-chemistry', 'chemistry-maintaining-air-quality'
);--> statement-breakpoint
DELETE FROM "subjects" WHERE "id" NOT IN ('e-math', 'chemistry');--> statement-breakpoint

UPDATE "profile"
SET "onboarding_completed" = false,
    "onboarding_completed_at" = NULL,
    "updated_at" = now()
WHERE "role" = 'student';--> statement-breakpoint
UPDATE "profile" p
SET "onboarding_completed" = false,
    "onboarding_completed_at" = NULL,
    "updated_at" = now()
WHERE p."role" = 'teacher'
  AND NOT EXISTS (
    SELECT 1 FROM "teaching_scope" ts
    WHERE ts."user_id" = p."user_id"
      AND ts."subject_id" IN ('e-math', 'chemistry')
  );--> statement-breakpoint

ALTER TABLE "subjects" ALTER COLUMN "syllabus_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "syllabus_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint

CREATE TABLE "subtopics" (
  "id" text PRIMARY KEY NOT NULL,
  "topic_id" text NOT NULL,
  "syllabus_code" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "subtopic_id" text;--> statement-breakpoint

ALTER TABLE "quiz_questions" DROP CONSTRAINT "quiz_questions_topic_id_topics_id_fk";--> statement-breakpoint
ALTER TABLE "topic_aliases" DROP CONSTRAINT "topic_aliases_topic_id_topics_id_fk";--> statement-breakpoint
ALTER TABLE "topics" DROP CONSTRAINT "topics_subject_id_subjects_id_fk";--> statement-breakpoint
ALTER TABLE "subtopics" ADD CONSTRAINT "subtopics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_aliases" ADD CONSTRAINT "topic_aliases_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subtopics_topic_syllabus_code_idx" ON "subtopics" USING btree ("topic_id","syllabus_code");--> statement-breakpoint
CREATE INDEX "quiz_questions_subtopic_idx" ON "quiz_questions" USING btree ("subtopic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_subject_syllabus_code_idx" ON "topics" USING btree ("subject_id","syllabus_code");--> statement-breakpoint

DO $$
DECLARE
  invalid_subjects bigint;
  invalid_topics bigint;
  expected record;
BEGIN
  SELECT count(*) INTO invalid_subjects FROM "subjects" WHERE "id" NOT IN ('e-math', 'chemistry');
  SELECT count(*) INTO invalid_topics FROM "topics" WHERE "id" NOT IN (
    'math-number-algebra', 'math-geometry-measurement', 'math-statistics-probability',
    'chemistry-experimental-chemistry', 'chemistry-particulate-nature-matter',
    'chemistry-chemical-bonding-structure', 'chemistry-chemical-calculations',
    'chemistry-acid-base-chemistry', 'chemistry-qualitative-analysis',
    'chemistry-redox-chemistry', 'chemistry-periodic-table-patterns',
    'chemistry-chemical-energetics', 'chemistry-rate-reactions',
    'chemistry-organic-chemistry', 'chemistry-maintaining-air-quality'
  );
  IF invalid_subjects <> 0 OR invalid_topics <> 0 THEN
    RAISE EXCEPTION 'curriculum-v2 cleanup failed: invalid subjects=%, invalid topics=%', invalid_subjects, invalid_topics;
  END IF;
  SELECT * INTO expected FROM "curriculum_v2_preserved_counts";
  IF expected."users" <> (SELECT count(*) FROM "user")
    OR expected."profiles" <> (SELECT count(*) FROM "profile")
    OR expected."schools" <> (SELECT count(*) FROM "schools")
    OR expected."squads" <> (SELECT count(*) FROM "edunets"."study_squads")
    OR expected."squad_members" <> (SELECT count(*) FROM "edunets"."study_squad_members")
    OR expected."squad_invitations" <> (SELECT count(*) FROM "edunets"."study_squad_invitations") THEN
    RAISE EXCEPTION 'curriculum-v2 changed a preserved table count';
  END IF;
  RAISE NOTICE 'curriculum-v2 cleanup complete: authentication, schools and Study Squads retained; run db:initialize to seed 41 subtopics and 225 questions';
END $$;
--> statement-breakpoint
DROP TABLE "curriculum_v2_preserved_counts";
