export type CurriculumSubtopic = {
  id: string;
  syllabusCode: string;
  name: string;
  description: string;
};

export type CurriculumTopic = {
  id: string;
  subjectId: 'e-math' | 'chemistry';
  syllabusCode: string;
  name: string;
  description: string;
  aliases: string[];
  subtopics: CurriculumSubtopic[];
  /** Learning-outcome groupings for discussion/capture only. Never catalog rows. */
  rubricFacets?: string[];
};

export type CurriculumSubject = {
  id: 'e-math' | 'chemistry';
  name: string;
  syllabusCode: string;
  icon: string;
  topics: CurriculumTopic[];
};

const subtopic = (
  id: string,
  syllabusCode: string,
  name: string,
  description: string,
): CurriculumSubtopic => ({ id, syllabusCode, name, description });

export const CURRICULUM: CurriculumSubject[] = [
  {
    id: 'e-math',
    name: 'Mathematics',
    syllabusCode: '4052',
    icon: '📐',
    topics: [
      {
        id: 'math-number-algebra',
        subjectId: 'e-math',
        syllabusCode: 'N',
        name: 'NUMBER AND ALGEBRA',
        description: 'Numerical reasoning, proportional relationships, algebraic manipulation, functions, equations, sets and matrices.',
        aliases: ['Numbers', 'Algebra', 'e-math-numbers', 'e-math-algebra', 'Number and Algebra'],
        subtopics: [
          subtopic('math-n1-numbers-operations', 'N1', 'Numbers and their operations', 'Use number representations, arithmetic operations, estimation, standard form and bounds.'),
          subtopic('math-n2-ratio-proportion', 'N2', 'Ratio and proportion', 'Solve problems involving ratios, direct proportion and inverse proportion.'),
          subtopic('math-n3-percentage', 'N3', 'Percentage', 'Apply percentages to change, comparison, finance and reverse-percentage problems.'),
          subtopic('math-n4-rate-speed', 'N4', 'Rate and speed', 'Use compound measures, average speed and unit conversion in rate problems.'),
          subtopic('math-n5-algebraic-expressions-formulae', 'N5', 'Algebraic expressions and formulae', 'Manipulate expressions, indices, formulae and algebraic fractions.'),
          subtopic('math-n6-functions-graphs', 'N6', 'Functions and graphs', 'Interpret functions and represent linear, quadratic and other relationships graphically.'),
          subtopic('math-n7-equations-inequalities', 'N7', 'Equations and inequalities', 'Solve equations, simultaneous equations and inequalities algebraically and graphically.'),
          subtopic('math-n8-set-language-notation', 'N8', 'Set language and notation', 'Use set notation, Venn diagrams and counting relationships.'),
          subtopic('math-n9-matrices', 'N9', 'Matrices', 'Perform matrix operations and use matrices to represent transformations and information.'),
        ],
      },
      {
        id: 'math-geometry-measurement',
        subjectId: 'e-math',
        syllabusCode: 'G',
        name: 'GEOMETRY AND MEASUREMENT',
        description: 'Geometrical reasoning, similarity, circles, trigonometry, mensuration, coordinates and vectors.',
        aliases: ['Geometry', 'Mensuration', 'e-math-geometry', 'e-math-mensuration', 'Geometry and Measurement'],
        subtopics: [
          subtopic('math-g1-angles-triangles-polygons', 'G1', 'Angles, triangles and polygons', 'Apply angle facts and properties of triangles, quadrilaterals and polygons.'),
          subtopic('math-g2-congruence-similarity', 'G2', 'Congruence and similarity', 'Establish congruence or similarity and use the associated scale factors.'),
          subtopic('math-g3-properties-circles', 'G3', 'Properties of circles', 'Use symmetry, tangent and angle properties of circles.'),
          subtopic('math-g4-pythagoras-trigonometry', 'G4', "Pythagoras' theorem and trigonometry", 'Solve two- and three-dimensional problems with Pythagoras and trigonometric ratios.'),
          subtopic('math-g5-mensuration', 'G5', 'Mensuration', 'Calculate perimeter, area, surface area and volume of plane and solid figures.'),
          subtopic('math-g6-coordinate-geometry', 'G6', 'Coordinate geometry', 'Use gradients, distances, midpoints and equations of straight lines.'),
          subtopic('math-g7-vectors-two-dimensions', 'G7', 'Vectors in two dimensions', 'Represent and reason with vectors in two-dimensional geometry.'),
        ],
      },
      {
        id: 'math-statistics-probability',
        subjectId: 'e-math',
        syllabusCode: 'S',
        name: 'STATISTICS AND PROBABILITY',
        description: 'Collection, presentation and interpretation of data, together with probability models and calculations.',
        aliases: ['Statistics', 'Probability', 'e-math-statistics', 'e-math-probability', 'Statistics and Probability'],
        subtopics: [
          subtopic('math-s1-data-handling-analysis', 'S1', 'Data handling and analysis', 'Organise, represent and interpret data using statistical diagrams and summary measures.'),
          subtopic('math-s2-probability', 'S2', 'Probability', 'Calculate probabilities for single and combined events using appropriate representations.'),
        ],
      },
    ],
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    syllabusCode: '6092',
    icon: '⚗️',
    topics: [
      {
        id: 'chemistry-experimental-chemistry', subjectId: 'chemistry', syllabusCode: '1', name: 'Experimental Chemistry',
        description: 'Planning investigations and selecting techniques to separate, purify and analyse substances.',
        aliases: ['Experimental Chemistry'],
        subtopics: [
          subtopic('chemistry-1-1-experimental-design', '1.1', 'Experimental Design', 'Plan fair, safe and reliable experiments, including variables, apparatus, measurements and evaluation.'),
          subtopic('chemistry-1-2-purification-analysis', '1.2', 'Methods of Purification and Analysis', 'Choose and explain filtration, crystallisation, distillation, chromatography and purity tests.'),
        ],
      },
      {
        id: 'chemistry-particulate-nature-matter', subjectId: 'chemistry', syllabusCode: '2', name: 'The Particulate Nature of Matter',
        description: 'Particle-model explanations of states and changes, and the subatomic structure of atoms and ions.',
        aliases: ['Atomic Structure', 'chemistry-atomic-structure', 'Particulate Nature of Matter'],
        subtopics: [
          subtopic('chemistry-2-1-kinetic-particle-theory', '2.1', 'Kinetic Particle Theory', 'Explain states, diffusion and changes of state using particle arrangement, motion and energy.'),
          subtopic('chemistry-2-2-atomic-structure', '2.2', 'Atomic Structure', 'Relate proton, neutron and electron numbers to atoms, ions, isotopes and electronic structure.'),
        ],
      },
      {
        id: 'chemistry-chemical-bonding-structure', subjectId: 'chemistry', syllabusCode: '3', name: 'Chemical Bonding and Structure',
        description: 'Bonding models and the relationship between structure and physical properties.',
        aliases: ['Covalent Bonding', 'chemistry-covalent-bonding', 'Chemical Bonding'],
        subtopics: [
          subtopic('chemistry-3-1-ionic-bonding', '3.1', 'Ionic Bonding', 'Describe ion formation, electrostatic attraction and properties of ionic compounds.'),
          subtopic('chemistry-3-2-covalent-bonding', '3.2', 'Covalent Bonding', 'Describe electron sharing and properties of simple molecular substances.'),
          subtopic('chemistry-3-3-metallic-bonding', '3.3', 'Metallic Bonding', 'Explain metallic structure, conductivity, malleability and related properties.'),
          subtopic('chemistry-3-4-structure-properties-materials', '3.4', 'Structure and Properties of Materials', 'Compare simple molecular, giant covalent, ionic and metallic structures and properties.'),
        ],
      },
      {
        id: 'chemistry-chemical-calculations', subjectId: 'chemistry', syllabusCode: '4', name: 'Chemical Calculations',
        description: 'Formula and equation writing, relative masses, moles, reacting quantities and concentrations.',
        aliases: ['Stoichiometry', 'chemistry-stoichiometry', 'Chemical Calculations'],
        subtopics: [
          subtopic('chemistry-4-1-formulae-equations', '4.1', 'Formulae and Equation Writing', 'Construct chemical formulae and balanced symbol, ionic and state equations.'),
          subtopic('chemistry-4-2-mole-stoichiometry', '4.2', 'The Mole Concept and Stoichiometry', 'Use moles, masses, gas volumes, concentrations, yields and reacting ratios.'),
        ],
      },
      {
        id: 'chemistry-acid-base-chemistry', subjectId: 'chemistry', syllabusCode: '5', name: 'Acid-Base Chemistry',
        description: 'Properties and reactions of acids, bases and salts, including ammonia.',
        aliases: ['Acids & Bases', 'Acids and Bases', 'chemistry-acids-bases', 'Acid-Base Chemistry'],
        subtopics: [
          subtopic('chemistry-5-1-acids-bases', '5.1', 'Acids and Bases', 'Relate acidity and alkalinity to ions, indicators, pH, strength and characteristic reactions.'),
          subtopic('chemistry-5-2-salts', '5.2', 'Salts', 'Select methods to prepare, separate and purify soluble and insoluble salts.'),
          subtopic('chemistry-5-3-ammonia', '5.3', 'Ammonia', 'Describe ammonia production, properties, reactions and uses of ammonium compounds.'),
        ],
      },
      {
        id: 'chemistry-qualitative-analysis', subjectId: 'chemistry', syllabusCode: '6', name: 'Qualitative Analysis',
        description: 'Use observations and prescribed tests to identify ions and gases.', aliases: ['Qualitative Analysis'], subtopics: [],
        rubricFacets: ['Cation Tests', 'Anion Tests', 'Gas Tests'],
      },
      {
        id: 'chemistry-redox-chemistry', subjectId: 'chemistry', syllabusCode: '7', name: 'Redox Chemistry',
        description: 'Oxidation and reduction in chemical reactions and electrochemical cells.',
        aliases: ['Redox Reactions', 'chemistry-redox-reactions', 'Redox Chemistry'],
        subtopics: [
          subtopic('chemistry-7-1-oxidation-reduction', '7.1', 'Oxidation and Reduction', 'Identify and explain redox using oxygen, hydrogen, electrons and oxidation states.'),
          subtopic('chemistry-7-2-electrochemistry', '7.2', 'Electrochemistry', 'Predict electrode products and explain electrolysis and simple cells.'),
        ],
      },
      {
        id: 'chemistry-periodic-table-patterns', subjectId: 'chemistry', syllabusCode: '8', name: 'Patterns in the Periodic Table',
        description: 'Periodic trends, group behaviour, transition elements and metal reactivity.',
        aliases: ['Periodic Table', 'Patterns in the Periodic Table'],
        subtopics: [
          subtopic('chemistry-8-1-periodic-trends', '8.1', 'Periodic Trends', 'Relate position and electronic structure to trends across the Periodic Table.'),
          subtopic('chemistry-8-2-group-properties', '8.2', 'Group Properties', 'Explain and predict properties and trends within selected groups.'),
          subtopic('chemistry-8-3-transition-elements', '8.3', 'Transition Elements', 'Recognise characteristic physical and chemical properties of transition elements.'),
          subtopic('chemistry-8-4-reactivity-series', '8.4', 'Reactivity Series', 'Use relative reactivity to predict reactions, extraction and displacement.'),
        ],
      },
      {
        id: 'chemistry-chemical-energetics', subjectId: 'chemistry', syllabusCode: '9', name: 'Chemical Energetics',
        description: 'Energy changes in reactions, reaction profiles and bond-energy calculations.', aliases: ['Chemical Energetics'], subtopics: [],
        rubricFacets: ['Enthalpy Changes', 'Energy Profile Diagrams', 'Bond Energy Changes'],
      },
      {
        id: 'chemistry-rate-reactions', subjectId: 'chemistry', syllabusCode: '10', name: 'Rate of Reactions',
        description: 'Measuring and explaining reaction rates using collision theory and activation energy.',
        aliases: ['Rate of Reaction', 'chemistry-rate-of-reaction', 'Rate of Reactions'], subtopics: [],
        rubricFacets: ['Collision Factors', 'Catalysts and Activation Energy', 'Rate Experiments and Data'],
      },
      {
        id: 'chemistry-organic-chemistry', subjectId: 'chemistry', syllabusCode: '11', name: 'Organic Chemistry',
        description: 'Fuels, homologous series, functional groups, reactions and polymers.', aliases: ['Organic Chemistry'],
        subtopics: [
          subtopic('chemistry-11-1-fuels-crude-oil', '11.1', 'Fuels and Crude Oil', 'Relate fossil fuels and fractional distillation to fuel use and environmental impact.'),
          subtopic('chemistry-11-2-hydrocarbons', '11.2', 'Hydrocarbons', 'Describe alkanes and alkenes, their structures, reactions and tests.'),
          subtopic('chemistry-11-3-alcohols-acids-esters', '11.3', 'Alcohols, Carboxylic Acids and Esters', 'Describe functional groups, characteristic reactions and ester formation.'),
          subtopic('chemistry-11-4-polymers', '11.4', 'Polymers', 'Explain addition and condensation polymerisation and issues associated with polymers.'),
        ],
      },
      {
        id: 'chemistry-maintaining-air-quality', subjectId: 'chemistry', syllabusCode: '12', name: 'Maintaining Air Quality',
        description: 'Composition of air, atmospheric pollutants, climate effects and control measures.', aliases: ['Maintaining Air Quality'], subtopics: [],
        rubricFacets: ['Air and Pollutants', 'Pollution Effects and Control', 'Carbon Cycle and Greenhouse Gases'],
      },
    ],
  },
];

export const CURRICULUM_TOPICS = CURRICULUM.flatMap((subject) => subject.topics);
export const CURRICULUM_SUBTOPICS = CURRICULUM_TOPICS.flatMap((topic) => (
  topic.subtopics.map((child) => ({ ...child, topicId: topic.id }))
));

export const CURRICULUM_TOPIC_BY_ID = new Map(CURRICULUM_TOPICS.map((topic) => [topic.id, topic]));
export const CURRICULUM_SUBTOPIC_BY_ID = new Map(CURRICULUM_SUBTOPICS.map((child) => [child.id, child]));

export function resolveCurriculumTopic(value: string): CurriculumTopic | undefined {
  const normalized = value.trim().toLocaleLowerCase();
  return CURRICULUM_TOPICS.find((topic) => (
    topic.id.toLocaleLowerCase() === normalized
    || topic.name.toLocaleLowerCase() === normalized
    || topic.aliases.some((alias) => alias.toLocaleLowerCase() === normalized)
  ));
}
