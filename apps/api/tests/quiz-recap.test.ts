import { describe, expect, it, vi } from 'vitest';
import { generateQuizRecap, generateFocusGuidance, cleanWhereWrongPhrasing, type GenerateRecapInput } from '../src/services/quiz-recap.js';

describe('cleanWhereWrongPhrasing', () => {
  it('corrects "You didn\'t provide an answer, but..." to indicate wrong answer', () => {
    const input = "You didn't provide an answer, but the main challenge here is relating the mass of the product (CaO) back to the mass of the element (Ca) in the original sample.";
    const result = cleanWhereWrongPhrasing(input);
    expect(result).toBe("Your answer was incorrect: the main challenge here is relating the mass of the product (CaO) back to the mass of the element (Ca) in the original sample.");
  });

  it('corrects "You didn\'t answer, but..." to indicate wrong answer', () => {
    const input = "You didn't answer, but the trick is converting both masses into moles before finding the ratio.";
    const result = cleanWhereWrongPhrasing(input);
    expect(result).toBe("Your answer was incorrect: the trick is converting both masses into moles before finding the ratio.");
  });

  it('corrects "You didn\'t answer. ..." to indicate wrong answer', () => {
    const input = "You didn't answer. This question tests the gas stoichiometry equation 2CO + O2 -> 2CO2.";
    const result = cleanWhereWrongPhrasing(input);
    expect(result).toBe("Your answer was incorrect. This question tests the gas stoichiometry equation 2CO + O2 -> 2CO2.");
  });
});

describe('generateQuizRecap', () => {
  it('generates an MCQ recap highlighting where the student scored wrongly', async () => {
    const input: GenerateRecapInput = {
      mode: 'mcq',
      subjectName: 'Chemistry',
      topicName: 'Acids and Bases',
      questions: [
        {
          questionIndex: 0,
          questionKey: 'chem-ab-q1',
          type: 'mcq',
          topic: 'Acids and Bases',
          text: 'Which ion is responsible for acidic properties in aqueous solutions?',
          options: ['H+ ions', 'OH- ions', 'Na+ ions', 'Cl- ions'],
          correctAnswer: 0,
          explanation: 'Acids produce hydrogen ions (H+) in aqueous solutions.',
          linkedConcept: 'Arrhenius Acid Theory',
        },
        {
          questionIndex: 1,
          questionKey: 'chem-ab-q2',
          type: 'mcq',
          topic: 'Acids and Bases',
          text: 'What is the color of universal indicator in a strongly alkaline solution (pH 14)?',
          options: ['Red', 'Green', 'Purple', 'Yellow'],
          correctAnswer: 2,
          explanation: 'Universal indicator turns purple / dark violet in strong alkalis (pH 13-14).',
          linkedConcept: 'pH and Indicators',
        },
      ],
      answers: [
        {
          questionIndex: 0,
          questionKey: 'chem-ab-q1',
          submittedAnswer: 0,
          isCorrect: true,
          marksObtained: 1,
          maximumMarks: 1,
        },
        {
          questionIndex: 1,
          questionKey: 'chem-ab-q2',
          submittedAnswer: 0, // Chose Red instead of Purple!
          isCorrect: false,
          marksObtained: 0,
          maximumMarks: 1,
        },
      ],
    };

    const recap = await generateQuizRecap(input);

    expect(recap.mode).toBe('mcq');
    expect(recap.wrongCount).toBe(1);
    expect(recap.correctCount).toBe(1);
    expect(recap.totalQuestions).toBe(2);
    expect(recap.items.length).toBe(1);
    expect(recap.items[0]?.questionNumber).toBe(2);
    expect(recap.items[0]?.whereWrongOrMisconception).toBeDefined();
    expect(recap.items[0]?.adviceOrCorrection).toBeDefined();
    expect(recap.summary).toBeDefined();
    expect(recap.keyTakeaways.length).toBeGreaterThan(0);
  });

  it('correctly parses string submittedAnswer and correctAnswer without saying student did not answer', async () => {
    const input: GenerateRecapInput = {
      mode: 'mcq',
      subjectName: 'Chemistry',
      topicName: 'The Mole Concept and Stoichiometry',
      questions: [
        {
          questionIndex: 0,
          questionKey: 'chem-mole-q1',
          type: 'mcq',
          topic: 'The Mole Concept and Stoichiometry',
          text: 'What mass of calcium is in 14g of CaO?',
          options: ['10g', '7g', '14g', '40g'],
          correctAnswer: '0',
          explanation: 'Find the mass of Calcium in the 14g of CaO using relative atomic masses.',
          linkedConcept: 'The Mole Concept and Stoichiometry',
        },
      ],
      answers: [
        {
          questionIndex: 0,
          questionKey: 'chem-mole-q1',
          submittedAnswer: '1', // String '1' from database
          isCorrect: false,
          marksObtained: 0,
          maximumMarks: 1,
        },
      ],
    };

    const recap = await generateQuizRecap(input);
    expect(recap.items[0]?.studentAnswerText).toContain('Option B');
    expect(recap.items[0]?.whereWrongOrMisconception).not.toContain("didn't answer");
    expect(recap.items[0]?.whereWrongOrMisconception).toMatch(/Option B|7g/i);
  });

  it('generates an Essay recap highlighting misconceptions and where the student answered wrongly', async () => {
    const input: GenerateRecapInput = {
      mode: 'essay',
      subjectName: 'Physics',
      topicName: 'Thermal Physics',
      questions: [
        {
          questionIndex: 0,
          questionKey: 'phys-tp-q1',
          type: 'structured',
          topic: 'Thermal Physics',
          text: 'Explain in terms of molecular motion why temperature remains constant during boiling.',
          options: null,
          correctAnswer: 'Thermal energy supplied is used to overcome intermolecular forces between molecules, not to increase average kinetic energy.',
          explanation: 'Latent heat of vaporisation breaks intermolecular bonds.',
          linkedConcept: 'Latent Heat and Molecular Forces',
          maxMarks: 5,
        },
      ],
      answers: [
        {
          questionIndex: 0,
          questionKey: 'phys-tp-q1',
          submittedAnswer: 'The temperature stays constant because covalent bonds inside the water molecules are broken.',
          isCorrect: false,
          marksObtained: 2,
          maximumMarks: 5,
          gradingFeedback: {
            summary: 'Conflated intermolecular bonds with covalent bonds.',
            parts: [
              {
                label: 'a',
                verdict: 'partial',
                marksObtained: 2,
                maximumMarks: 5,
                feedback: 'Student states bonds break, but incorrectly mentions covalent bonds rather than intermolecular forces.',
              },
            ],
          },
        },
      ],
    };

    const recap = await generateQuizRecap(input);

    expect(recap.mode).toBe('essay');
    expect(recap.wrongCount).toBe(1);
    expect(recap.totalQuestions).toBe(1);
    expect(recap.items.length).toBe(1);
    expect(recap.items[0]?.whereWrongOrMisconception).toContain('covalent');
    expect(recap.items[0]?.adviceOrCorrection).toBeDefined();
  });

  it('generates targeted positive focus guidance for pasted quiz recap notes', async () => {
    const rawRecap = `
Quiz Recap · Separation Techniques (Score: 1/10)
Mistakes made in quiz:
• Q1 (Separation Techniques): Confused paper chromatography with simple distillation for obtaining water from seawater.
  Take note: Simple distillation separates pure liquid from solution; chromatography separates dissolved solutes.
• Q2 (Filtration): Missed role of filter paper in separating insoluble solids.
  Take note: Filtration is only for insoluble solids.
`;
    const result = await generateFocusGuidance({
      text: rawRecap,
      topicName: 'Separation Techniques',
    });

    expect(result.spideyGreeting).toBeDefined();
    expect(result.focusAreas.length).toBeGreaterThan(0);
    expect(result.focusAreas[0]?.concept).toBeDefined();
    expect(result.focusAreas[0]?.priority).toBe('High Priority');
    expect(result.focusAreas[0]?.whatWasWrongPositive).toBeDefined();
    expect(result.focusAreas[0]?.takeNoteOf).toBeDefined();
    expect(result.positiveEncouragement).toBeDefined();
  });

  it('adjusts spidey motivation for 0 score to be comforting and encouraging', async () => {
    const rawRecap = `
Quiz Recap · Kinematics (Score: 0/10)
Mistakes made in quiz:
• Q1 (Velocity vs Speed): Mixed up scalar and vector quantities.
  Take note: Velocity includes direction, speed is scalar.
`;
    const result = await generateFocusGuidance({
      text: rawRecap,
      topicName: 'Kinematics',
    });

    expect(result.spideyGreeting.toLowerCase()).toContain("don't worry");
    expect(result.positiveEncouragement.toLowerCase()).toContain("step by step");
  });
});
