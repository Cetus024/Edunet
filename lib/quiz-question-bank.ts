// HUAWEI CLOUD INTEGRATION POINT — ModelArts.
// Every question below (and the "concept-check" set built from it, see
// getQuestionsForQuizMode) is hand-authored and static - "AI-generated" in
// the UI (quiz-review.ts's aiGeneratedExplanation) currently just means
// "not yet teacher-edited", not an actual model call. A real AI layer -
// generating fresh concept-check questions per weak topic, summarising
// captured notes, or ranking weak-topic priority from a student's raw
// attempt history - would call a Huawei ModelArts-hosted inference
// endpoint from here (or from the service layer that calls into this
// module, e.g. services/edunets-api/src/lib/question-bank.ts), with this
// static bank kept as the offline fallback/seed set.
export type QuizQuestionType = 'mcq' | 'fill-blank' | 'structured' | 'diagram';
export type QuizQuestionMode = 'past-paper' | 'concept-check' | 'speed-round';

export interface QuizQuestion {
  id: number;
  type: QuizQuestionType;
  topic: string;
  text: string;
  source?: string;
  resourceNumber?: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
  linkedConcept: string;
  diagramUrl?: string;
  blankWord?: string;
  wordLimit?: number;
}

export const QUIZ_QUESTION_BANK_VERSION = 1;

export function getQuizQuestionKey(topicId: string, questionId: number): string {
  return `${topicId}:v${QUIZ_QUESTION_BANK_VERSION}:q${String(questionId).padStart(2, '0')}`;
}

export function isQuizAnswerCorrect(
  question: QuizQuestion,
  answer: string | number | null,
): boolean {
  if (answer === null) return false;
  if (question.type === 'mcq') return answer === question.correctAnswer;
  return String(answer)
    .trim()
    .toLowerCase()
    .includes(String(question.correctAnswer).trim().toLowerCase());
}

type QuestionDraft = Omit<QuizQuestion, 'id' | 'topic' | 'source' | 'resourceNumber'>;

const mcq = (text: string, options: string[], correctAnswer: number, explanation: string, linkedConcept: string): QuestionDraft => ({
  type: 'mcq', text, options, correctAnswer, explanation, linkedConcept,
});

const fill = (text: string, correctAnswer: string, explanation: string, linkedConcept: string): QuestionDraft => ({
  type: 'fill-blank', text, blankWord: correctAnswer, correctAnswer, explanation, linkedConcept,
});

const structured = (text: string, correctAnswer: string, explanation: string, linkedConcept: string, wordLimit = 80): QuestionDraft => ({
  type: 'structured', text, correctAnswer, explanation, linkedConcept, wordLimit,
});

const topicQuestionDrafts: Record<string, Record<string, QuestionDraft[]>> = {
  Biology: {
    'Cell Division (Mitosis)': [
      mcq('What is the main outcome of mitosis?', ['Four genetically different cells', 'Two genetically identical cells', 'Two haploid gametes', 'One cell with half the chromosomes'], 1, 'Mitosis produces two genetically identical daughter cells with the same chromosome number as the parent cell.', 'Purpose of Mitosis'),
      mcq('During which stage of mitosis do chromosomes line up at the equator of the cell?', ['Prophase', 'Metaphase', 'Anaphase', 'Telophase'], 1, 'Chromosomes align along the cell equator during metaphase.', 'Stages of Mitosis'),
      mcq('What happens during anaphase?', ['DNA replicates', 'Nuclear membranes reform', 'Sister chromatids move to opposite poles', 'Chromosomes become invisible'], 2, 'During anaphase, sister chromatids separate and are pulled to opposite poles by spindle fibres.', 'Chromosome Separation'),
      fill('Mitosis is important for growth, repair and _____ reproduction.', 'asexual', 'Mitosis produces genetically identical cells and is used in asexual reproduction.', 'Functions of Mitosis'),
      structured('Explain why daughter cells produced by mitosis have the same chromosome number as the parent cell.', 'chromosome number', 'DNA is replicated before mitosis, and one copy of every chromosome is separated into each daughter cell, maintaining the chromosome number.', 'Chromosome Maintenance', 50),
    ],
    Nutrition: [
      mcq('Which enzyme digests starch into maltose?', ['Amylase', 'Protease', 'Lipase', 'Pepsin'], 0, 'Amylase catalyses the breakdown of starch into maltose.', 'Chemical Digestion'),
      mcq('Where does most absorption of digested food occur?', ['Stomach', 'Small intestine', 'Large intestine', 'Oesophagus'], 1, 'The small intestine has villi and microvilli that provide a large surface area for absorption.', 'Absorption'),
      mcq('What is the function of bile in digestion?', ['Digest protein', 'Emulsify fats', 'Convert starch to glucose', 'Absorb water'], 1, 'Bile emulsifies large fat droplets into smaller droplets, increasing surface area for lipase.', 'Fat Digestion'),
      fill('Finger-like projections called _____ increase the absorptive surface area of the small intestine.', 'villi', 'Villi greatly increase the surface area available for absorption.', 'Small Intestine'),
      structured('A student has bleeding gums and wounds that heal slowly. Name the deficient vitamin and explain your answer.', 'vitamin C', 'Vitamin C is required for healthy connective tissue; deficiency causes scurvy, including bleeding gums and poor wound healing.', 'Balanced Diet', 50),
    ],
    Respiration: [
      mcq('Which word equation represents aerobic respiration?', ['glucose → lactic acid', 'glucose + oxygen → carbon dioxide + water', 'carbon dioxide + water → glucose + oxygen', 'glucose → ethanol + carbon dioxide'], 1, 'Aerobic respiration releases energy by reacting glucose with oxygen to form carbon dioxide and water.', 'Aerobic Respiration'),
      mcq('In which organelle does most aerobic respiration occur?', ['Nucleus', 'Ribosome', 'Mitochondrion', 'Chloroplast'], 2, 'Most aerobic respiration takes place in mitochondria.', 'Mitochondria'),
      mcq('Which substance accumulates in muscles during vigorous anaerobic respiration?', ['Ethanol', 'Lactic acid', 'Urea', 'Glycogen'], 1, 'Human muscle cells produce lactic acid during anaerobic respiration.', 'Anaerobic Respiration'),
      fill('Extra oxygen needed after exercise to remove lactic acid is called the oxygen _____.', 'debt', 'The oxygen debt is repaid after exercise through continued rapid breathing and heart rate.', 'Oxygen Debt'),
      structured('Explain why breathing rate increases during exercise.', 'oxygen', 'Working muscles respire faster and require more oxygen while producing more carbon dioxide, so ventilation increases.', 'Gas Exchange During Exercise', 60),
    ],
    Transport: [
      mcq('Which substance in red blood cells binds reversibly with oxygen?', ['Fibrin', 'Haemoglobin', 'Plasma', 'Glycogen'], 1, 'Haemoglobin combines reversibly with oxygen to transport it around the body.', 'Blood'),
      mcq('Which blood vessel carries blood away from the heart?', ['Artery', 'Vein', 'Capillary', 'Venule'], 0, 'Arteries carry blood away from the heart under relatively high pressure.', 'Blood Vessels'),
      mcq('Which plant tissue transports water and mineral ions from roots to leaves?', ['Phloem', 'Xylem', 'Epidermis', 'Mesophyll'], 1, 'Xylem vessels transport water and dissolved mineral ions upwards through a plant.', 'Plant Transport'),
      fill('The liquid component of blood that transports dissolved substances is called _____.', 'plasma', 'Plasma transports blood cells, nutrients, hormones, carbon dioxide and urea.', 'Blood Components'),
      structured('Explain why the human circulatory system is described as a double circulation.', 'twice', 'Blood passes through the heart twice in one complete circuit: once through the pulmonary circuit and once through the systemic circuit.', 'Double Circulation', 50),
    ],
    Reproduction: [
      mcq('Where does fertilisation normally occur in the human female reproductive system?', ['Uterus', 'Oviduct', 'Ovary', 'Cervix'], 1, 'Fertilisation normally occurs in the oviduct when a sperm nucleus fuses with an egg nucleus.', 'Human Reproduction'),
      mcq('What is a main function of the placenta?', ['Produce sperm', 'Exchange substances between mother and fetus', 'Release the egg', 'Store urine'], 1, 'The placenta allows exchange of oxygen, nutrients and wastes without direct mixing of maternal and fetal blood.', 'Pregnancy'),
      mcq('Which feature is characteristic of asexual reproduction?', ['Fusion of gametes', 'Two parents are always required', 'Genetically identical offspring', 'Meiosis produces variation'], 2, 'Asexual reproduction involves one parent and usually produces genetically identical offspring.', 'Asexual Reproduction'),
      fill('The release of a mature egg from an ovary is called _____.', 'ovulation', 'Ovulation is the release of a mature ovum from an ovary.', 'Menstrual Cycle'),
      structured('Describe one adaptation of a sperm cell for reaching and fertilising an egg.', 'flagellum', 'A sperm has a flagellum for swimming, many mitochondria for energy and an acrosome containing enzymes to penetrate the egg.', 'Gamete Adaptations', 50),
    ],
    Ecology: [
      mcq('Which organisms form the first trophic level in a food chain?', ['Producers', 'Primary consumers', 'Secondary consumers', 'Decomposers'], 0, 'Producers capture energy, usually by photosynthesis, and form the first trophic level.', 'Food Chains'),
      mcq('What is the role of decomposers in an ecosystem?', ['Make sunlight', 'Recycle mineral nutrients', 'Consume only living plants', 'Prevent respiration'], 1, 'Decomposers break down dead matter and release mineral nutrients back into the environment.', 'Nutrient Cycling'),
      mcq('Why is less energy available at each higher trophic level?', ['Energy is created by consumers', 'Energy is lost through respiration and waste', 'Producers use no energy', 'All biomass is eaten'], 1, 'Energy is lost as heat through respiration and in uneaten or undigested material.', 'Energy Transfer'),
      fill('A network of interconnected food chains is called a food _____.', 'web', 'A food web shows the feeding relationships among multiple organisms in an ecosystem.', 'Food Webs'),
      structured('Explain how deforestation can reduce biodiversity.', 'habitat loss', 'Deforestation causes habitat loss, removes food sources and breeding sites, and can lead to population decline or extinction.', 'Human Impact', 60),
    ],
    Genetics: [
      mcq('What is an allele?', ['A form of a gene', 'A whole chromosome', 'A type of protein', 'A cell organelle'], 0, 'An allele is an alternative form of a gene found at the same locus on homologous chromosomes.', 'Alleles'),
      mcq('Which term describes the genetic constitution of an organism?', ['Phenotype', 'Genotype', 'Variation', 'Mutation rate'], 1, 'Genotype refers to the alleles an organism possesses.', 'Genotype and Phenotype'),
      mcq('Which genotype is heterozygous?', ['TT', 'tt', 'Tt', 'T'], 2, 'A heterozygous genotype contains two different alleles, such as Tt.', 'Inheritance'),
      fill('The molecule that carries genetic information is _____.', 'DNA', 'DNA stores genetic information in the sequence of its bases.', 'DNA'),
      structured('A heterozygous tall plant, Tt, is crossed with a short plant, tt. State the probability of a short offspring.', '50%', 'The cross Tt × tt gives Tt, tt, Tt and tt, so 2 out of 4 offspring are expected to be short: 50%.', 'Monohybrid Crosses', 50),
    ],
  },
  Chemistry: {
    'Atomic Structure': [
      mcq('An atom has 11 protons and 12 neutrons. What is its nucleon number?', ['11', '12', '23', '24'], 2, 'Nucleon number equals protons plus neutrons: 11 + 12 = 23.', 'Subatomic Particles'),
      mcq('Which statement about isotopes is correct?', ['They have different proton numbers', 'They have the same neutron number', 'They have the same proton number but different neutron numbers', 'They are different elements'], 2, 'Isotopes are atoms of the same element with the same proton number but different neutron numbers.', 'Isotopes'),
      mcq('What is the electronic configuration of a sodium atom with proton number 11?', ['2,8', '2,8,1', '2,7,2', '2,8,8'], 1, 'A neutral sodium atom has 11 electrons arranged 2,8,1.', 'Electronic Structure'),
      fill('The number of _____ in an atom determines which element it is.', 'protons', 'Every element has a unique proton number.', 'Proton Number'),
      structured('A chlorine atom has 17 electrons. Explain how it forms a chloride ion and state the ion\'s number of electrons.', '18', 'A chlorine atom gains one electron to form Cl⁻, giving the ion 18 electrons and a full outer shell.', 'Ion Formation', 50),
    ],
    'Covalent Bonding': [
      mcq('How is a covalent bond formed?', ['By transferring protons', 'By sharing a pair of electrons', 'By attraction between ions', 'By sharing neutrons'], 1, 'A covalent bond is the electrostatic attraction between a shared pair of electrons and two nuclei.', 'Covalent Bonds'),
      mcq('How many covalent bonds are present in one carbon dioxide molecule, O=C=O?', ['One', 'Two', 'Three', 'Four'], 1, 'Carbon dioxide contains two double covalent bonds between carbon and the oxygen atoms.', 'Molecular Structure'),
      mcq('Why do simple molecular substances usually have low melting points?', ['Their covalent bonds are weak', 'Weak intermolecular forces need little energy to overcome', 'They contain free ions', 'They have giant lattices'], 1, 'Only weak intermolecular forces are overcome during melting; the covalent bonds remain intact.', 'Properties of Molecules'),
      fill('Diamond is an example of a _____ covalent structure.', 'giant', 'Diamond has a giant three-dimensional covalent network.', 'Giant Covalent Structures'),
      structured('Explain why each oxygen atom forms two covalent bonds in a water molecule.', 'two electrons', 'An oxygen atom has six outer-shell electrons and shares two electrons, one with each hydrogen, to achieve a full outer shell.', 'Dot-and-Cross Diagrams', 60),
    ],
    Stoichiometry: [
      mcq('What is the relative molecular mass of H₂O? (H = 1, O = 16)', ['16', '17', '18', '20'], 2, 'Mr(H₂O) = 2(1) + 16 = 18.', 'Relative Mass'),
      mcq('How many moles are present in 44 g of CO₂? (Mr = 44)', ['0.5 mol', '1 mol', '2 mol', '44 mol'], 1, 'Number of moles = mass ÷ molar mass = 44 ÷ 44 = 1 mol.', 'Mole Calculations'),
      mcq('For 2H₂ + O₂ → 2H₂O, how many moles of O₂ react completely with 2 moles of H₂?', ['0.5', '1', '2', '4'], 1, 'The equation shows a 2:1 mole ratio of H₂ to O₂.', 'Mole Ratio'),
      fill('One _____ contains 6.02 × 10²³ particles.', 'mole', 'A mole is the amount of substance containing the Avogadro constant of particles.', 'Avogadro Constant'),
      structured('Magnesium burns in oxygen to form magnesium oxide. Calculate the mass of MgO formed from 2.4 g of Mg. (Ar: Mg = 24, O = 16)', '4.0', '2.4 g Mg is 0.10 mol. The Mg:MgO ratio is 1:1, so 0.10 mol MgO forms; mass = 0.10 × 40 = 4.0 g.', 'Mass Calculations', 60),
    ],
    'Acids & Bases': [
      mcq('Which pH value represents a strongly acidic solution?', ['2', '7', '9', '13'], 0, 'A strongly acidic solution has a low pH, such as pH 2.', 'pH Scale'),
      mcq('What are the products when an acid reacts completely with an alkali?', ['Salt and hydrogen', 'Salt and water', 'Water and oxygen', 'Acid and salt'], 1, 'Neutralisation between an acid and an alkali produces a salt and water.', 'Neutralisation'),
      mcq('Which substance is a base?', ['Hydrochloric acid', 'Sulfuric acid', 'Ammonia', 'Carbon dioxide'], 2, 'Ammonia acts as a base by accepting hydrogen ions in water.', 'Bases'),
      fill('Acids produce _____ ions when dissolved in water.', 'hydrogen', 'Acids dissociate in water to produce hydrogen ions, H⁺.', 'Acid Properties'),
      structured('Write the word equation for the reaction between hydrochloric acid and sodium hydroxide.', 'sodium chloride', 'Hydrochloric acid + sodium hydroxide → sodium chloride + water.', 'Salt Preparation', 40),
    ],
    'Redox Reactions': [
      mcq('Which statement defines oxidation in terms of electrons?', ['Gain of electrons', 'Loss of electrons', 'Sharing electrons', 'No electron transfer'], 1, 'Oxidation is the loss of electrons.', 'Electron Transfer'),
      mcq('What happens to an oxidising agent during a redox reaction?', ['It is reduced', 'It is oxidised', 'It loses all protons', 'It remains unchanged'], 0, 'An oxidising agent causes another substance to be oxidised and is itself reduced.', 'Oxidising Agents'),
      mcq('In Fe²⁺ → Fe³⁺ + e⁻, the iron(II) ion is:', ['reduced', 'neutralised', 'oxidised', 'precipitated'], 2, 'Fe²⁺ loses an electron, so it is oxidised to Fe³⁺.', 'Oxidation States'),
      fill('The gain of electrons is called _____.', 'reduction', 'Reduction is the gain of electrons.', 'Reduction'),
      structured('Hydrogen reacts with copper(II) oxide to form copper and water. Explain what happens to copper(II) oxide.', 'reduced', 'Copper(II) oxide loses oxygen and is reduced to copper; hydrogen gains oxygen and is oxidised.', 'Redox by Oxygen Transfer', 50),
    ],
    'Organic Chemistry': [
      mcq('Members of the same homologous series have the same:', ['molecular formula', 'functional group', 'number of carbon atoms', 'boiling point'], 1, 'Members share the same functional group and general formula, giving similar chemical properties.', 'Homologous Series'),
      mcq('Which test distinguishes an alkene from an alkane?', ['Add limewater', 'Add bromine water', 'Test with litmus', 'Add sodium chloride'], 1, 'An alkene decolourises bromine water because it contains a carbon-carbon double bond.', 'Unsaturation'),
      mcq('Which process produces ethanol from glucose using yeast?', ['Cracking', 'Fermentation', 'Polymerisation', 'Neutralisation'], 1, 'Yeast enzymes ferment glucose anaerobically to ethanol and carbon dioxide.', 'Alcohols'),
      fill('Oxidation of ethanol can produce _____ acid.', 'ethanoic', 'Ethanol is oxidised to ethanoic acid.', 'Carboxylic Acids'),
      structured('State the products of the complete combustion of a hydrocarbon.', 'carbon dioxide', 'Complete combustion of a hydrocarbon in excess oxygen produces carbon dioxide and water.', 'Combustion', 40),
    ],
    'Rate of Reaction': [
      mcq('Why does increasing temperature usually increase reaction rate?', ['Particles become larger', 'More particles have energy above activation energy', 'The concentration becomes zero', 'Collisions stop'], 1, 'At higher temperature, particles move faster and a larger proportion of collisions have sufficient energy.', 'Collision Theory'),
      mcq('How does a catalyst increase reaction rate?', ['Raises activation energy', 'Lowers activation energy', 'Increases product mass', 'Changes the equilibrium yield permanently'], 1, 'A catalyst provides an alternative reaction pathway with lower activation energy.', 'Catalysts'),
      mcq('Why does powdered calcium carbonate react faster than equal-mass marble chips?', ['It has a larger surface area', 'It has a smaller mass', 'It is a different compound', 'It lowers the temperature'], 0, 'Powder has a larger surface area, causing more frequent collisions with acid particles.', 'Surface Area'),
      fill('Reaction rates are explained using _____ theory.', 'collision', 'Collision theory explains how collision frequency and energy affect reaction rate.', 'Collision Theory'),
      structured('Explain why increasing reactant concentration increases reaction rate.', 'collisions', 'More particles occupy each unit volume, so collisions occur more frequently and there are more successful collisions per second.', 'Concentration and Rate', 60),
    ],
  },
  Physics: {
    'Speed & Acceleration': [
      mcq('A runner travels 100 m in 20 s. What is the runner\'s average speed?', ['2 m/s', '5 m/s', '20 m/s', '80 m/s'], 1, 'Average speed = total distance ÷ total time = 100 ÷ 20 = 5 m/s.', 'Speed'),
      mcq('A car accelerates uniformly from 0 m/s to 20 m/s in 5 s. What is its acceleration?', ['2 m/s²', '4 m/s²', '5 m/s²', '100 m/s²'], 1, 'Acceleration = change in velocity ÷ time = (20 − 0) ÷ 5 = 4 m/s².', 'Acceleration'),
      mcq('What does the area under a velocity-time graph represent?', ['Acceleration', 'Displacement', 'Force', 'Power'], 1, 'The area under a velocity-time graph gives displacement.', 'Motion Graphs'),
      fill('Speed is a _____ quantity because it has magnitude but no direction.', 'scalar', 'A scalar has magnitude only; velocity is the corresponding vector quantity.', 'Scalars and Vectors'),
      structured('A car increases its velocity from 10 m/s to 25 m/s in 3.0 s. Calculate its acceleration.', '5', 'Acceleration = (25 − 10) ÷ 3.0 = 5.0 m/s².', 'Acceleration Calculations', 40),
    ],
    Dynamics: [
      mcq('Which statement describes Newton\'s first law?', ['An object remains at rest or constant velocity unless acted on by a resultant force', 'Force equals mass divided by acceleration', 'Every force produces energy', 'Momentum is never conserved'], 0, 'With no resultant force, an object remains at rest or moves with constant velocity.', 'Newton\'s Laws'),
      mcq('What resultant force gives a 2 kg object an acceleration of 3 m/s²?', ['0.67 N', '1.5 N', '5 N', '6 N'], 3, 'Using F = ma, F = 2 × 3 = 6 N.', 'Force and Acceleration'),
      mcq('What is the weight of a 5 kg mass where gravitational field strength is 10 N/kg?', ['0.5 N', '5 N', '50 N', '500 N'], 2, 'Weight = mass × gravitational field strength = 5 × 10 = 50 N.', 'Weight'),
      fill('A change in motion occurs when a non-zero _____ force acts on an object.', 'resultant', 'Only a non-zero resultant force produces acceleration.', 'Resultant Force'),
      structured('Calculate the momentum of a 3.0 kg trolley moving at 4.0 m/s.', '12', 'Momentum = mass × velocity = 3.0 × 4.0 = 12 kg m/s.', 'Momentum', 40),
    ],
    Energy: [
      mcq('A 2 kg object is raised by 5 m. Taking g = 10 N/kg, what is its gain in gravitational potential energy?', ['10 J', '25 J', '50 J', '100 J'], 3, 'GPE = mgh = 2 × 10 × 5 = 100 J.', 'Gravitational Potential Energy'),
      mcq('What is the kinetic energy of a 4 kg object moving at 3 m/s?', ['6 J', '12 J', '18 J', '36 J'], 2, 'KE = ½mv² = ½ × 4 × 3² = 18 J.', 'Kinetic Energy'),
      mcq('A machine transfers 600 J in 20 s. What is its power?', ['12 W', '30 W', '120 W', '12 000 W'], 1, 'Power = energy transferred ÷ time = 600 ÷ 20 = 30 W.', 'Power'),
      fill('The principle of energy _____ states that energy cannot be created or destroyed.', 'conservation', 'Energy can be transferred between stores but the total amount is conserved.', 'Conservation of Energy'),
      structured('A motor receives 200 J of energy and transfers 150 J usefully. Calculate its efficiency as a percentage.', '75%', 'Efficiency = useful output ÷ total input × 100% = 150 ÷ 200 × 100% = 75%.', 'Efficiency', 50),
    ],
    Waves: [
      mcq('A wave has frequency 5 Hz and wavelength 2 m. What is its speed?', ['2.5 m/s', '7 m/s', '10 m/s', '25 m/s'], 2, 'Wave speed = frequency × wavelength = 5 × 2 = 10 m/s.', 'Wave Equation'),
      mcq('In a transverse wave, particles vibrate:', ['parallel to the direction of travel', 'perpendicular to the direction of travel', 'in circles only', 'without transferring energy'], 1, 'Particles in a transverse wave vibrate perpendicular to the direction the wave travels.', 'Wave Types'),
      mcq('Which waves can travel through a vacuum?', ['Sound waves only', 'Water waves only', 'Electromagnetic waves', 'All mechanical waves'], 2, 'Electromagnetic waves do not require a material medium and can travel through a vacuum.', 'Electromagnetic Spectrum'),
      fill('The maximum displacement of a point on a wave from its rest position is its _____.', 'amplitude', 'Amplitude is the maximum displacement from equilibrium.', 'Wave Properties'),
      structured('An echo returns 0.40 s after a sound is produced. If sound travels at 340 m/s, calculate the distance to the reflecting wall.', '68', 'The sound travels to the wall and back, so distance = 340 × 0.40 ÷ 2 = 68 m.', 'Reflection of Sound', 50),
    ],
    Electricity: [
      mcq('A charge of 10 C passes a point in 2 s. What is the current?', ['0.2 A', '5 A', '12 A', '20 A'], 1, 'Current = charge ÷ time = 10 ÷ 2 = 5 A.', 'Electric Current'),
      mcq('A 12 V potential difference produces a current of 3 A. What is the resistance?', ['0.25 Ω', '4 Ω', '9 Ω', '36 Ω'], 1, 'Using R = V ÷ I, R = 12 ÷ 3 = 4 Ω.', 'Ohm\'s Law'),
      mcq('Two resistors of 4 Ω and 6 Ω are connected in series. What is their total resistance?', ['2 Ω', '5 Ω', '10 Ω', '24 Ω'], 2, 'Resistances in series add: 4 + 6 = 10 Ω.', 'Series Circuits'),
      fill('Components connected in _____ have the same potential difference across them.', 'parallel', 'Every branch in a parallel circuit has the same potential difference.', 'Parallel Circuits'),
      structured('An appliance operates at 230 V and draws a current of 2.0 A. Calculate its power.', '460', 'Power = potential difference × current = 230 × 2.0 = 460 W.', 'Electrical Power', 40),
    ],
    Electromagnetism: [
      mcq('What is produced around a current-carrying wire?', ['An electric charge only', 'A magnetic field', 'A gravitational field', 'Nuclear radiation'], 1, 'An electric current produces a magnetic field around the conductor.', 'Magnetic Effect of Current'),
      mcq('How can the magnetic field inside a solenoid be made stronger?', ['Decrease the current', 'Remove turns from the coil', 'Increase the current', 'Use a plastic core instead of air'], 2, 'Increasing current increases the strength of the solenoid\'s magnetic field.', 'Solenoids'),
      mcq('Which rule gives the direction of force on a current-carrying conductor in a magnetic field?', ['Fleming\'s left-hand rule', 'Fleming\'s right-hand rule', 'Lenz\'s law only', 'The wave equation'], 0, 'Fleming\'s left-hand rule relates magnetic field, current and force directions for the motor effect.', 'Motor Effect'),
      fill('A device that converts electrical energy into rotational kinetic energy is an electric _____.', 'motor', 'An electric motor uses the force on a current-carrying coil in a magnetic field.', 'D.C. Motor'),
      structured('Explain how moving a magnet into a coil can produce a current in the coil.', 'electromagnetic induction', 'The changing magnetic flux through the coil induces an e.m.f.; if the circuit is complete, an induced current flows. This is electromagnetic induction.', 'Electromagnetic Induction', 70),
    ],
    'Nuclear Physics': [
      mcq('What is an alpha particle?', ['An electron', 'A helium nucleus', 'An electromagnetic wave', 'A neutron only'], 1, 'An alpha particle contains two protons and two neutrons, the same as a helium nucleus.', 'Nuclear Radiation'),
      mcq('Which radiation is the most penetrating?', ['Alpha', 'Beta', 'Gamma', 'All are equal'], 2, 'Gamma radiation is highly penetrating and requires thick lead or concrete for substantial absorption.', 'Penetrating Power'),
      mcq('A sample has a count rate of 80 counts/min and a half-life of 2 hours. What is its count rate after 4 hours, ignoring background?', ['10 counts/min', '20 counts/min', '40 counts/min', '60 counts/min'], 1, 'Four hours is two half-lives: 80 → 40 → 20 counts/min.', 'Half-Life'),
      fill('Radiation detected when no known source is present is called _____ radiation.', 'background', 'Background radiation comes from natural and artificial sources in the environment.', 'Background Radiation'),
      structured('Explain how a chain reaction is maintained during nuclear fission.', 'neutrons', 'Fission releases neutrons, which can be absorbed by other fissile nuclei and cause further fission events.', 'Nuclear Fission', 60),
    ],
  },
  History: {
    'World War I': [
      mcq('Which event immediately triggered World War I in 1914?', ['The invasion of Poland', 'The assassination of Archduke Franz Ferdinand', 'The Russian Revolution', 'The Wall Street Crash'], 1, 'The assassination at Sarajevo triggered the July Crisis and the outbreak of war.', 'Outbreak of World War I'),
      mcq('How did the alliance system contribute to the outbreak of World War I?', ['It kept every country neutral', 'It turned a regional conflict into a wider war', 'It ended militarism', 'It removed tension in the Balkans'], 1, 'Alliance obligations drew multiple European powers into the conflict.', 'Alliance System'),
      mcq('Which feature was most associated with fighting on the Western Front?', ['Island hopping', 'Trench warfare', 'Nuclear weapons', 'Guerrilla warfare only'], 1, 'A long system of trenches developed after the failure of early mobile offensives.', 'Western Front'),
      fill('The agreement that stopped fighting on 11 November 1918 was the _____.', 'Armistice', 'The Armistice ended the fighting, while the peace settlement followed later.', 'End of World War I'),
      structured('Explain one reason why the Treaty of Versailles caused resentment in Germany.', 'reparations', 'Germany resented heavy reparations, territorial losses, military restrictions and the war guilt clause.', 'Treaty of Versailles', 70),
    ],
    'World War II': [
      mcq('Which event began World War II in Europe in September 1939?', ['Germany invaded Poland', 'Japan attacked Pearl Harbor', 'Italy invaded Ethiopia', 'The Berlin Wall was built'], 0, 'Britain and France declared war after Germany invaded Poland.', 'Outbreak of World War II'),
      mcq('What was appeasement?', ['A policy of making concessions to avoid war', 'A plan to invade the USSR', 'The creation of the United Nations', 'A strategy of total surrender'], 0, 'Britain and France made concessions to Hitler in an attempt to preserve peace.', 'Appeasement'),
      mcq('Which event led directly to the United States entering World War II?', ['The fall of France', 'The attack on Pearl Harbor', 'The Munich Agreement', 'The Yalta Conference'], 1, 'Japan\'s attack on Pearl Harbor in December 1941 brought the United States into the war.', 'War in the Asia-Pacific'),
      fill('Germany, Italy and Japan formed the _____ Powers.', 'Axis', 'The Axis Powers were the main coalition opposing the Allies.', 'Wartime Alliances'),
      structured('Explain one military reason for the rapid Japanese conquest of Singapore in 1942.', 'air superiority', 'Japan had air superiority, battle-experienced troops, effective intelligence and rapid bicycle infantry, while Allied defences were poorly prepared.', 'Fall of Singapore', 70),
    ],
    'The Cold War': [
      mcq('What was the central ideological rivalry of the Cold War?', ['Democracy against monarchy', 'Capitalism against communism', 'Fascism against nationalism', 'Colonialism against feudalism'], 1, 'The USA supported capitalist democracy while the USSR promoted communism and a command economy.', 'Cold War Rivalry'),
      mcq('What was the aim of the Truman Doctrine?', ['To contain the spread of communism', 'To divide Germany permanently', 'To create the Warsaw Pact', 'To end the United Nations'], 0, 'The Truman Doctrine promised support to states resisting communist pressure.', 'Containment'),
      mcq('How did the Western Allies respond to the Berlin Blockade?', ['They abandoned West Berlin', 'They organised the Berlin Airlift', 'They invaded the USSR', 'They dissolved NATO'], 1, 'The Berlin Airlift supplied West Berlin by air until the blockade was lifted.', 'Berlin Blockade'),
      fill('The Western military alliance formed in 1949 was _____.', 'NATO', 'NATO was established as a collective defence alliance led by the United States.', 'Cold War Alliances'),
      structured('Explain why the Korean War can be described as a Cold War proxy war.', 'superpowers', 'The Korean conflict involved local forces but was supported by rival superpowers: the USA and UN backed South Korea while China and the USSR supported North Korea.', 'Proxy Wars', 80),
    ],
    'Singapore History': [
      mcq('Who established a British trading post in Singapore in 1819?', ['Stamford Raffles', 'Lee Kuan Yew', 'David Marshall', 'Yusof Ishak'], 0, 'Stamford Raffles negotiated agreements that established a British trading post in 1819.', 'Colonial Singapore'),
      mcq('In which year did the Japanese occupation of Singapore begin?', ['1819', '1942', '1959', '1965'], 1, 'Singapore fell to Japanese forces in February 1942.', 'Japanese Occupation'),
      mcq('When did Singapore become an independent sovereign state?', ['1955', '1959', '1963', '1965'], 3, 'Singapore separated from Malaysia and became independent on 9 August 1965.', 'Independence'),
      fill('Singapore joined Malaysia through _____ in 1963.', 'merger', 'Singapore merged with Malaya, Sabah and Sarawak to form Malaysia in 1963.', 'Merger and Separation'),
      structured('Explain one reason Singapore promoted rapid industrialisation after independence.', 'jobs', 'Industrialisation attracted investment, created jobs, reduced unemployment and supported the survival of a resource-scarce economy.', 'Economic Development', 70),
    ],
    Decolonisation: [
      mcq('Which force most directly encouraged people in colonies to demand self-rule?', ['Nationalism', 'Feudalism', 'Isolationism', 'Appeasement'], 0, 'Nationalism encouraged people to identify as a nation and demand political independence.', 'Nationalism'),
      mcq('How did World War II accelerate decolonisation?', ['It made European empires much stronger', 'It weakened colonial powers economically and militarily', 'It ended nationalist movements', 'It restored all pre-war authority'], 1, 'European colonial powers emerged weakened, while Asian nationalist movements gained confidence and support.', 'Impact of World War II'),
      mcq('Which territory gained independence from Britain in 1957?', ['Malaya', 'Vietnam', 'Indonesia', 'Cambodia'], 0, 'The Federation of Malaya achieved independence from Britain in 1957.', 'Independence in Southeast Asia'),
      fill('Government by a country\'s own people is called self-_____.', 'government', 'Self-government transfers domestic political authority to local representatives.', 'Self-Government'),
      structured('Explain one factor that contributed to the decolonisation of Malaya.', 'nationalism', 'Growing nationalism, British post-war policy, political negotiation and the need to counter communist influence all contributed to independence.', 'Malayan Independence', 70),
    ],
    'United Nations': [
      mcq('In which year was the United Nations founded?', ['1919', '1939', '1945', '1963'], 2, 'The United Nations was founded in 1945 after World War II.', 'Origins of the UN'),
      mcq('Which UN organ has primary responsibility for international peace and security?', ['General Assembly', 'Security Council', 'International Labour Organization', 'Secretariat only'], 1, 'The Security Council can pass binding resolutions concerning international peace and security.', 'Security Council'),
      mcq('Which UN agency leads international public health work?', ['UNESCO', 'WHO', 'IMF', 'ILO'], 1, 'The World Health Organization coordinates international public health efforts.', 'UN Agencies'),
      fill('Each permanent member of the Security Council can block a substantive resolution using a _____.', 'veto', 'The five permanent members possess veto power.', 'Veto Power'),
      structured('Explain one limitation faced by United Nations peacekeeping missions.', 'consent', 'Peacekeepers often depend on member-state support, adequate resources and the consent and cooperation of parties to a conflict.', 'UN Peacekeeping', 70),
    ],
  },
  Geography: {
    'Weather & Climate': [
      mcq('Which statement correctly distinguishes weather from climate?', ['Weather is the long-term average while climate changes hourly', 'Weather describes short-term atmospheric conditions while climate describes long-term patterns', 'Weather and climate mean exactly the same thing', 'Climate only refers to rainfall'], 1, 'Weather is the atmospheric condition at a particular time and place; climate is the long-term pattern of weather.', 'Weather and Climate'),
      mcq('Which instrument measures rainfall?', ['Anemometer', 'Rain gauge', 'Barometer', 'Wind vane'], 1, 'A rain gauge collects and measures precipitation.', 'Weather Instruments'),
      mcq('Why is convectional rainfall common in equatorial regions?', ['Cold ground prevents evaporation', 'Strong heating causes warm moist air to rise and cool', 'Air always descends at the equator', 'There is no water vapour'], 1, 'Intense heating causes evaporation and uplift; rising moist air cools, condenses and produces heavy rainfall.', 'Convectional Rainfall'),
      fill('The amount of water vapour in the air compared with the maximum possible is called relative _____.', 'humidity', 'Relative humidity expresses how close the air is to saturation.', 'Humidity'),
      structured('Explain one reason cities are often warmer than surrounding rural areas at night.', 'concrete', 'Concrete and asphalt absorb heat during the day and release it slowly at night; buildings also reduce ventilation and human activities release waste heat.', 'Urban Heat Island', 70),
    ],
    'Plate Tectonics': [
      mcq('What drives the movement of tectonic plates?', ['Ocean tides only', 'Convection currents in the mantle', 'Daily changes in air pressure', 'Earth\'s magnetic poles'], 1, 'Heat-driven movement in the mantle contributes to plate motion.', 'Plate Movement'),
      mcq('Which feature commonly forms at a divergent plate boundary?', ['Deep-sea trench', 'Mid-ocean ridge', 'Fold mountain from collision', 'Island arc above subduction'], 1, 'Plates separate at divergent boundaries, allowing magma to rise and form new crust at mid-ocean ridges.', 'Plate Boundaries'),
      mcq('What is the point inside Earth where an earthquake begins called?', ['Epicentre', 'Focus', 'Crater', 'Fault scarp'], 1, 'The focus is the origin of seismic energy within Earth; the epicentre lies directly above it.', 'Earthquakes'),
      fill('The semi-molten layer beneath the crust is part of the Earth\'s _____.', 'mantle', 'The mantle lies below the crust and contains material that moves slowly over geological time.', 'Earth Structure'),
      structured('Explain why explosive volcanoes commonly occur at destructive plate boundaries.', 'subduction', 'At a destructive boundary, subduction introduces water and lowers the melting point; viscous, gas-rich magma forms and pressure can build, producing explosive eruptions.', 'Volcanic Hazards', 90),
    ],
    Coasts: [
      mcq('Which coastal erosion process occurs when waves force air into cracks in a cliff?', ['Attrition', 'Hydraulic action', 'Longshore drift', 'Deposition'], 1, 'Hydraulic action compresses air in cracks and weakens the rock.', 'Coastal Erosion'),
      mcq('What transports sediment along a beach when waves approach at an angle?', ['Convection', 'Longshore drift', 'Subduction', 'Mass tourism'], 1, 'Angled swash and perpendicular backwash move sediment along the coast in a zigzag pattern.', 'Sediment Transport'),
      mcq('Which landform may develop when longshore drift deposits material across part of a bay?', ['Spit', 'Wave-cut platform', 'Cliff', 'Cave'], 0, 'A spit is a ridge of deposited sediment attached to land at one end.', 'Coastal Deposition'),
      fill('When waves lose energy and drop their sediment, coastal _____ occurs.', 'deposition', 'Deposition occurs when wave energy becomes too low to carry the sediment load.', 'Deposition'),
      structured('Explain one disadvantage of using a sea wall to protect a coastline.', 'erosion', 'Sea walls are expensive and reflected wave energy can increase erosion at the base or further along the coast.', 'Coastal Management', 70),
    ],
    Rivers: [
      mcq('What is the starting point of a river called?', ['Mouth', 'Source', 'Confluence', 'Delta'], 1, 'A river begins at its source and flows towards its mouth.', 'River System'),
      mcq('Which river transport process rolls large rocks along the river bed?', ['Solution', 'Suspension', 'Saltation', 'Traction'], 3, 'Traction rolls large particles along the bed.', 'River Transport'),
      mcq('Where is erosion usually greatest in a meander?', ['Inside bend', 'Outside bend', 'At the source only', 'Across the floodplain equally'], 1, 'Faster flow on the outside bend causes erosion, while slower flow on the inside promotes deposition.', 'Meanders'),
      fill('The area of land drained by a river and its tributaries is a drainage _____.', 'basin', 'A drainage basin is bounded by a watershed.', 'Drainage Basin'),
      structured('Explain why urbanisation can increase flood risk in a drainage basin.', 'impermeable', 'Impermeable surfaces and drains reduce infiltration and move surface runoff rapidly into rivers, increasing peak discharge.', 'Flooding', 80),
    ],
    Tourism: [
      mcq('Which factor is most likely to increase international tourist arrivals to a destination?', ['Improved transport accessibility', 'Closure of all attractions', 'Higher travel barriers', 'Removal of accommodation'], 0, 'Improved accessibility lowers the time or cost needed to reach a destination.', 'Tourism Trends'),
      mcq('What is the tourism multiplier effect?', ['Tourism income circulates and creates further income and jobs', 'Every tourist visits twice', 'Prices always double', 'All tourism revenue leaves the country'], 0, 'Tourism spending supports businesses and workers, whose further spending creates additional economic activity.', 'Economic Impacts'),
      mcq('What is economic leakage in tourism?', ['Money retained entirely by local firms', 'Tourism revenue leaving the destination economy', 'A rise in local employment', 'Protection of local culture'], 1, 'Leakage occurs when revenue goes to foreign-owned firms, imports or overseas workers instead of remaining locally.', 'Tourism Leakage'),
      fill('Responsible travel that supports conservation and local communities is called _____.', 'ecotourism', 'Ecotourism aims to minimise environmental impact while supporting conservation and local people.', 'Sustainable Tourism'),
      structured('Explain one way community-based tourism can support sustainable development.', 'local communities', 'When local communities manage tourism, more income and decision-making remain local, supporting livelihoods and encouraging protection of culture and environments.', 'Community-Based Tourism', 90),
    ],
    'Food Resources': [
      mcq('What does food security mean?', ['Having reliable access to sufficient safe and nutritious food', 'Producing only one crop', 'Importing every food item', 'Eating more than needed'], 0, 'Food security exists when people consistently have physical and economic access to adequate nutritious food.', 'Food Security'),
      mcq('Which is a characteristic of intensive farming?', ['Low inputs per unit of land', 'High inputs and high output per unit of land', 'No use of labour', 'Farming only for household consumption'], 1, 'Intensive farming uses relatively high inputs of labour, capital or technology per unit of land.', 'Agricultural Systems'),
      mcq('Which development was associated with the Green Revolution?', ['High-yield crop varieties', 'Ending irrigation', 'Removing fertilisers', 'Reducing agricultural research'], 0, 'High-yield varieties, irrigation, fertilisers and pesticides increased production in many regions.', 'Increasing Food Supply'),
      fill('The artificial supply of water to crops is called _____.', 'irrigation', 'Irrigation supplies water when rainfall is insufficient or unreliable.', 'Farming Technology'),
      structured('Explain one way climate change can threaten food production.', 'drought', 'More frequent drought, heat stress, floods or changing pests can reduce yields and disrupt food supply.', 'Food Supply Challenges', 70),
    ],
  },
  English: {
    Comprehension: [
      mcq('A writer describes a market as “a hive of activity”. What does this suggest?', ['It is empty and silent', 'It is busy and energetic', 'It contains only insects', 'It is dangerous to enter'], 1, 'The metaphor compares the market to a busy hive, suggesting constant movement and activity.', 'Language for Effect'),
      mcq('Which answer best states an inference?', ['A fact copied word for word', 'A conclusion supported by clues in the text', 'A personal opinion unrelated to the text', 'A definition from a dictionary only'], 1, 'An inference combines textual clues with reasoning to reach a supported conclusion.', 'Inference'),
      mcq('Why might a writer use a rhetorical question?', ['To require the reader to send an answer', 'To engage the reader and emphasise a point', 'To remove all emotion', 'To list events chronologically'], 1, 'A rhetorical question encourages readers to consider the writer\'s point without expecting a direct answer.', 'Writer\'s Purpose'),
      fill('Evidence quoted from a passage should be used to _____ an answer.', 'support', 'Relevant textual evidence supports and justifies a comprehension response.', 'Using Evidence'),
      structured('The narrator says, “I checked the lock for the third time before walking away.” What does this reveal about the narrator?', 'anxious', 'Repeatedly checking the lock suggests the narrator is anxious, worried or uncertain.', 'Character Inference', 50),
    ],
    'Summary Writing': [
      mcq('What should a summary include?', ['Every example and quotation', 'Only the relevant main points', 'New opinions from the writer', 'Repeated explanations'], 1, 'A summary selects relevant main ideas and omits repetition and unnecessary detail.', 'Selecting Content'),
      mcq('Why should a student use their own words in a summary?', ['To change the original meaning', 'To show understanding and write concisely', 'To increase the word count', 'To add unrelated information'], 1, 'Paraphrasing accurately demonstrates understanding and can express ideas more concisely.', 'Paraphrasing'),
      mcq('What is the approximate word limit for the O-Level English summary task?', ['20 words', '50 words', '80 words', '250 words'], 2, 'The current comprehension paper requires a summary of about 80 words.', 'Summary Requirements'),
      fill('A good summary combines related _____ instead of listing every detail separately.', 'points', 'Synthesising related points helps produce a concise and coherent summary.', 'Synthesis'),
      structured('Rewrite this idea more concisely: “Because the bus arrived late, Maya was not able to reach school at the expected time.”', 'late', 'A concise version is: “The late bus made Maya late for school.” It preserves the cause and result without unnecessary wording.', 'Concise Expression', 30),
    ],
    'Situational Writing': [
      mcq('Which three factors should determine the style of a situational writing response?', ['Purpose, audience and context', 'Length, handwriting and colour', 'Title, rhyme and rhythm', 'Plot, climax and resolution only'], 0, 'Purpose, audience and context determine the appropriate format, tone and content.', 'Task Fulfilment'),
      mcq('Which opening is most appropriate for a formal email to a school principal whose name is unknown?', ['Hey there!', 'Dear Sir/Madam,', 'Hi buddy,', 'To my best friend,'], 1, '“Dear Sir/Madam” is an appropriate formal salutation when the recipient\'s name is unknown.', 'Formal Register'),
      mcq('What is most important when using information from a visual stimulus?', ['Copy every word without selection', 'Select and develop points relevant to the task', 'Ignore the audience', 'Invent contradictory details'], 1, 'Relevant stimulus points should be selected, explained and adapted to the purpose and audience.', 'Using Stimulus Material'),
      fill('The intended reader or listener of a text is its _____.', 'audience', 'Awareness of audience guides tone, vocabulary and level of formality.', 'Audience Awareness'),
      structured('Write a suitable formal salutation for a letter to the school principal, Ms Tan.', 'Dear Ms Tan', '“Dear Ms Tan,” directly and formally addresses the named recipient.', 'Letter Format', 20),
    ],
    'Continuous Writing': [
      mcq('Which technique is most useful for making a narrative setting vivid?', ['Specific sensory details', 'A list of unrelated facts', 'Repeating the prompt', 'Avoiding all description'], 0, 'Sensory details help readers imagine the sights, sounds, smells, textures and atmosphere.', 'Descriptive Writing'),
      mcq('What should an argumentative essay thesis do?', ['State a clear position', 'Introduce an unrelated character', 'List every dictionary definition', 'Avoid the question'], 0, 'A thesis gives the writer\'s clear position and guides the argument.', 'Argumentative Writing'),
      mcq('Which sentence shows rather than simply tells that Amir was nervous?', ['Amir was nervous.', 'Amir tapped his foot and wiped his damp palms on his trousers.', 'Amir entered the room.', 'Nervous means worried.'], 1, 'Physical details allow the reader to infer nervousness.', 'Narrative Technique'),
      fill('A new main idea should usually begin in a new _____.', 'paragraph', 'Paragraphing organises ideas and helps the reader follow the development of a text.', 'Organisation'),
      structured('Write a clear thesis statement supporting the view that technology improves education.', 'technology', 'Example: “Technology improves education by widening access to information, supporting personalised practice and enabling collaboration.”', 'Thesis Statements', 40),
    ],
    Editing: [
      mcq('Choose the correct verb: “Each of the players _____ a water bottle.”', ['have', 'has', 'are having', 'were'], 1, '“Each” is singular, so it takes the singular verb “has”.', 'Subject-Verb Agreement'),
      mcq('Choose the correct form: “Yesterday, she _____ to the library.”', ['go', 'goes', 'went', 'going'], 2, 'The time marker “Yesterday” requires the simple past form “went”.', 'Verb Tense'),
      mcq('Which sentence uses the pronoun correctly?', ['Me and Ali completed the task.', 'Ali and I completed the task.', 'Ali and me completes the task.', 'I and Ali has completed the task.'], 1, '“Ali and I” is the compound subject, and “completed” agrees correctly.', 'Pronouns'),
      fill('Complete the sentence correctly: “Neither the teacher nor the student _____ late.”', 'was', 'With two singular subjects joined by “neither…nor”, the singular verb “was” is appropriate.', 'Agreement'),
      structured('Correct the grammatical error: “The group of students have completed the experiment.”', 'has', 'The head noun “group” is singular, so the corrected sentence is: “The group of students has completed the experiment.”', 'Grammar Correction', 25),
    ],
    'Visual Text': [
      mcq('A poster uses a large image of a reusable bottle beside the words “Refill, not landfill”. What is its main purpose?', ['To discourage drinking water', 'To persuade readers to reduce plastic waste', 'To explain how landfills are built', 'To advertise disposable cups'], 1, 'The slogan and image encourage the audience to reuse bottles and reduce waste.', 'Purpose'),
      mcq('Which feature most directly helps establish the intended audience of a visual text?', ['Choice of images and language', 'The paper size only', 'The number of commas', 'The printing date alone'], 0, 'Images, vocabulary, tone and design are selected to appeal to a target audience.', 'Audience'),
      mcq('What is the effect of a short, memorable slogan?', ['It hides the message completely', 'It reinforces the key message and is easy to recall', 'It provides detailed evidence only', 'It removes the call to action'], 1, 'A concise slogan makes the main message memorable and persuasive.', 'Visual Language'),
      fill('Words placed beneath an image to explain it form a _____.', 'caption', 'A caption provides context or explanation for an accompanying visual.', 'Text Features'),
      structured('A school event poster ends with “Register by Friday at go.example.sg”. Identify the call to action.', 'Register', '“Register by Friday” tells the audience exactly what action to take and gives a deadline.', 'Call to Action', 30),
    ],
  },
  'A-Math': {
    Quadratics: [
      mcq('What are the roots of x² − 5x + 6 = 0?', ['−2 and −3', '2 and 3', '1 and 6', '−1 and −6'], 1, 'Factorising gives (x − 2)(x − 3) = 0, so x = 2 or x = 3.', 'Solving Quadratics'),
      mcq('Which condition shows that ax² + bx + c = 0 has two distinct real roots?', ['b² − 4ac < 0', 'b² − 4ac = 0', 'b² − 4ac > 0', 'a = 0'], 2, 'A positive discriminant gives two distinct real roots.', 'Discriminant'),
      mcq('What is the minimum point of y = x² − 4x + 3?', ['(−2, 15)', '(2, −1)', '(4, 3)', '(0, −1)'], 1, 'Completing the square gives y = (x − 2)² − 1, so the minimum point is (2, −1).', 'Completing the Square'),
      fill('The expression b² − 4ac is called the _____.', 'discriminant', 'The discriminant determines the number and nature of roots of a quadratic equation.', 'Nature of Roots'),
      structured('For 2x² − 7x + 3 = 0, find the larger root.', '3', 'Factorising gives (2x − 1)(x − 3) = 0, so the roots are 1/2 and 3; the larger root is 3.', 'Quadratic Equations', 50),
    ],
    Polynomials: [
      mcq('If P(2) = 0, which expression must be a factor of P(x)?', ['x + 2', 'x − 2', '2x − 1', 'x² + 2'], 1, 'By the factor theorem, P(a) = 0 means x − a is a factor.', 'Factor Theorem'),
      mcq('What is the remainder when P(x) = x² + 3x + 1 is divided by x − 2?', ['3', '7', '11', '15'], 2, 'By the remainder theorem, the remainder is P(2) = 4 + 6 + 1 = 11.', 'Remainder Theorem'),
      mcq('Expand (x + 2)(x − 3).', ['x² − x − 6', 'x² + 5x − 6', 'x² − 5x + 6', 'x² − 6'], 0, 'Multiplying gives x² − 3x + 2x − 6 = x² − x − 6.', 'Polynomial Expansion'),
      fill('The highest power of x in a polynomial is its _____.', 'degree', 'The degree is the greatest exponent with a non-zero coefficient.', 'Polynomial Vocabulary'),
      structured('Given P(x) = x³ − 4x, calculate P(2) and state what this tells you about x − 2.', '0', 'P(2) = 8 − 8 = 0, so the factor theorem shows that x − 2 is a factor.', 'Factor Theorem', 50),
    ],
    Trigonometry: [
      mcq('In a right-angled triangle, the side opposite angle θ is 6 cm and the hypotenuse is 10 cm. What is sin θ?', ['0.4', '0.6', '0.8', '1.67'], 1, 'Using sin θ = opposite ÷ hypotenuse, sin θ = 6 ÷ 10 = 0.6.', 'Trigonometric Ratios'),
      fill('Complete the trigonometric ratio: tan θ = opposite ÷ _____.', 'adjacent', 'The tangent ratio is tan θ = opposite ÷ adjacent.', 'Trigonometric Ratios'),
      mcq('Given that x is an acute angle and sin x = 1/2, find x.', ['30°', '45°', '60°', '90°'], 0, 'Since sin 30° = 1/2 and x is acute, x = 30°.', 'Trigonometric Equations'),
      structured('A point is 20 m from the base of a vertical tower. The angle of elevation to the top is 35°. Find the height of the tower, correct to 3 significant figures.', '14.0', 'Let h be the height of the tower. tan 35° = h ÷ 20, so h = 20 tan 35° = 14.0 m to 3 significant figures.', 'Angles of Elevation', 30),
      mcq('What is the exact value of cos 60°?', ['0', '1/2', '√2/2', '√3/2'], 1, 'From the exact trigonometric values, cos 60° = 1/2.', 'Exact Trigonometric Values'),
    ],
    Differentiation: [
      mcq('What is the derivative of x³?', ['x²', '2x²', '3x²', '3x'], 2, 'Using the power rule, d(x³)/dx = 3x².', 'Power Rule'),
      mcq('What does dy/dx represent geometrically?', ['Area under a curve', 'Gradient of the tangent', 'Length of the curve', 'y-intercept only'], 1, 'The derivative gives the gradient of the tangent to a curve at a point.', 'Gradient Function'),
      mcq('What condition holds at a stationary point of a differentiable curve?', ['dy/dx = 0', 'y = 0 always', 'd²y/dx² = 0 always', 'x = 0 always'], 0, 'A stationary point has a horizontal tangent, so its first derivative is zero.', 'Stationary Points'),
      fill('The derivative of a constant is _____.', 'zero', 'A constant does not change as x changes, so its rate of change is zero.', 'Basic Differentiation'),
      structured('Find the x-coordinate of the stationary point of y = x² − 4x + 1.', '2', 'dy/dx = 2x − 4. Setting dy/dx = 0 gives 2x − 4 = 0, so x = 2.', 'Stationary Points', 50),
    ],
    Integration: [
      mcq('What is ∫3x² dx?', ['x³ + C', '3x³ + C', '6x + C', 'x² + C'], 0, 'Since d(x³)/dx = 3x², the integral is x³ + C.', 'Indefinite Integration'),
      mcq('Integration is the reverse process of:', ['factorisation', 'differentiation', 'substitution', 'translation'], 1, 'Indefinite integration reverses differentiation.', 'Integration and Differentiation'),
      mcq('What does a definite integral represent when a graph lies above the x-axis?', ['Gradient at one point', 'Area under the curve between the limits', 'x-intercept', 'Period of the graph'], 1, 'A definite integral gives the signed area between the curve and the x-axis over the stated interval.', 'Definite Integrals'),
      fill('The arbitrary _____ of integration is written as C.', 'constant', 'Indefinite integrals include an arbitrary constant because differentiation removes constants.', 'Constant of Integration'),
      structured('Evaluate ∫ from 0 to 2 of 2x dx.', '4', 'An antiderivative is x². Evaluating gives 2² − 0² = 4.', 'Definite Integration', 40),
    ],
    'Coordinate Geometry': [
      mcq('What is the gradient of the line through (1, 2) and (5, 10)?', ['1/2', '2', '4', '8'], 1, 'Gradient = (10 − 2) ÷ (5 − 1) = 8 ÷ 4 = 2.', 'Gradient'),
      mcq('What is the distance between (0, 0) and (3, 4)?', ['3', '4', '5', '7'], 2, 'Distance = √(3² + 4²) = 5.', 'Distance Formula'),
      mcq('What is the midpoint of the segment joining (2, 5) and (6, 1)?', ['(4, 3)', '(8, 6)', '(2, 2)', '(3, 4)'], 0, 'Midpoint = ((2 + 6)/2, (5 + 1)/2) = (4, 3).', 'Midpoint'),
      fill('Two non-vertical lines with equal gradients are _____.', 'parallel', 'Parallel lines have the same gradient.', 'Parallel Lines'),
      structured('Find the equation of the line with gradient 3 passing through (1, 2).', 'y = 3x - 1', 'Using y − 2 = 3(x − 1), expand to obtain y = 3x − 1.', 'Equation of a Line', 50),
    ],
  },
  'E-Math': {
    Numbers: [
      mcq('Which number is prime?', ['21', '29', '39', '51'], 1, '29 has exactly two positive factors: 1 and 29.', 'Prime Numbers'),
      mcq('Write 0.00056 in standard form.', ['5.6 × 10⁻⁴', '5.6 × 10⁴', '56 × 10⁻⁴', '0.56 × 10⁻³'], 0, 'Moving the decimal four places right gives 5.6, so the power is −4.', 'Standard Form'),
      mcq('A price of $80 is increased by 15%. What is the new price?', ['$88', '$92', '$95', '$120'], 1, '15% of 80 is 12, so the new price is $92.', 'Percentages'),
      fill('The greatest number that divides two integers exactly is their highest common _____.', 'factor', 'The highest common factor is the largest shared factor.', 'Factors and Multiples'),
      structured('Calculate the value of $1000 invested for 2 years at 5% compound interest per year.', '1102.50', 'Amount = 1000(1.05)² = $1102.50.', 'Compound Interest', 50),
    ],
    Algebra: [
      mcq('Simplify 3x + 5x − 2.', ['8x − 2', '8x + 2', '15x − 2', '3x + 3'], 0, 'Combining like terms gives 8x − 2.', 'Algebraic Simplification'),
      mcq('Solve 3x − 5 = 16.', ['x = 3', 'x = 7', 'x = 11', 'x = 21'], 1, 'Add 5 to get 3x = 21, then divide by 3 to get x = 7.', 'Linear Equations'),
      mcq('Expand (x + 4)(x − 2).', ['x² + 2x − 8', 'x² − 6x − 8', 'x² + 6x + 8', 'x² + 2'], 0, 'Expansion gives x² − 2x + 4x − 8 = x² + 2x − 8.', 'Expansion'),
      fill('Complete the factorisation: x² − 9 = (x − 3)(x + _____).', '3', 'This is a difference of two squares: x² − 3² = (x − 3)(x + 3).', 'Factorisation'),
      structured('Solve simultaneously: x + y = 7 and x − y = 1. Find x.', '4', 'Adding the equations gives 2x = 8, so x = 4; then y = 3.', 'Simultaneous Equations', 50),
    ],
    Geometry: [
      mcq('Two angles in a triangle are 50° and 60°. What is the third angle?', ['60°', '70°', '80°', '110°'], 1, 'Angles in a triangle sum to 180°, so the third angle is 180° − 50° − 60° = 70°.', 'Angle Properties'),
      mcq('What is each exterior angle of a regular hexagon?', ['30°', '45°', '60°', '120°'], 2, 'Exterior angles of a polygon sum to 360°, so each is 360° ÷ 6 = 60°.', 'Polygons'),
      mcq('A right-angled triangle has shorter sides 6 cm and 8 cm. What is the hypotenuse?', ['7 cm', '10 cm', '12 cm', '14 cm'], 1, 'By Pythagoras, c = √(6² + 8²) = √100 = 10 cm.', 'Pythagoras\' Theorem'),
      fill('Shapes with the same size and shape are _____.', 'congruent', 'Congruent figures match exactly under a rigid transformation.', 'Congruence'),
      structured('Calculate the circumference of a circle of radius 7 cm using π = 22/7.', '44', 'Circumference = 2πr = 2 × 22/7 × 7 = 44 cm.', 'Circles', 40),
    ],
    Statistics: [
      mcq('Find the mean of 4, 6, 8 and 10.', ['6', '7', '8', '28'], 1, 'Mean = (4 + 6 + 8 + 10) ÷ 4 = 28 ÷ 4 = 7.', 'Mean'),
      mcq('Find the median of 3, 5, 7, 9 and 12.', ['5', '7', '7.2', '9'], 1, 'The middle value in the ordered list is 7.', 'Median'),
      mcq('What is the mode of 2, 3, 3, 4, 5, 5, 5?', ['2', '3', '4', '5'], 3, 'The value 5 occurs most frequently.', 'Mode'),
      fill('The difference between the largest and smallest values is the _____.', 'range', 'Range = maximum value − minimum value.', 'Spread of Data'),
      structured('Values 1, 2 and 3 have frequencies 2, 3 and 1 respectively. Calculate the mean, correct to 3 significant figures.', '1.83', 'Mean = (1×2 + 2×3 + 3×1) ÷ (2 + 3 + 1) = 11/6 = 1.83 to 3 significant figures.', 'Frequency Tables', 60),
    ],
    Probability: [
      mcq('What is the probability of an impossible event?', ['0', '1/4', '1/2', '1'], 0, 'An impossible event has probability 0.', 'Probability Scale'),
      mcq('If P(A) = 0.35, what is P(not A)?', ['0.35', '0.65', '1.00', '1.35'], 1, 'Complementary probabilities sum to 1, so P(not A) = 1 − 0.35 = 0.65.', 'Complementary Events'),
      mcq('Two fair coins are tossed. What is the probability of two heads?', ['1/4', '1/3', '1/2', '3/4'], 0, 'The equally likely outcomes are HH, HT, TH and TT, so P(HH) = 1/4.', 'Combined Events'),
      fill('The set of all possible outcomes is called the sample _____.', 'space', 'A sample space lists every possible outcome of an experiment.', 'Sample Space'),
      structured('A bag contains 3 red and 2 blue counters. Two counters are drawn without replacement. Find the probability that both are red.', '3/10', 'P(both red) = 3/5 × 2/4 = 6/20 = 3/10.', 'Probability Without Replacement', 50),
    ],
    Mensuration: [
      mcq('What is the area of a rectangle 8 cm long and 5 cm wide?', ['13 cm²', '26 cm²', '40 cm²', '80 cm²'], 2, 'Area = length × width = 8 × 5 = 40 cm².', 'Area'),
      mcq('What is the volume of a cylinder of radius r and height h?', ['πr²h', '2πrh', 'πrh²', '2πr²'], 0, 'Cylinder volume = area of circular base × height = πr²h.', 'Volume of a Cylinder'),
      mcq('What is the area of a circle of radius 3 cm?', ['3π cm²', '6π cm²', '9π cm²', '18π cm²'], 2, 'Area = πr² = π(3²) = 9π cm².', 'Area of a Circle'),
      fill('The total distance around a two-dimensional shape is its _____.', 'perimeter', 'Perimeter is the length of a shape\'s boundary.', 'Perimeter'),
      structured('A prism has a constant cross-sectional area of 12 cm² and length 5 cm. Calculate its volume.', '60', 'Volume of a prism = cross-sectional area × length = 12 × 5 = 60 cm³.', 'Volume of a Prism', 40),
    ],
  },
};

const sourceMetadata = [
  { source: 'EduNets practice bank' },
  { source: 'EduNets practice bank' },
  { source: 'EduNets practice bank' },
  { source: 'EduNets practice bank' },
  { source: 'EduNets practice bank' },
] as const;

function isValidQuestionSet(drafts: QuestionDraft[]): boolean {
  return drafts.length === sourceMetadata.length && drafts.every((question) => {
    if (question.type !== 'mcq') return true;
    return Array.isArray(question.options)
      && question.options.length === 4
      && typeof question.correctAnswer === 'number'
      && question.correctAnswer >= 0
      && question.correctAnswer < question.options.length;
  });
}

export function getQuestionsForSelection(subject: string, topic: string): QuizQuestion[] | null {
  const drafts = topicQuestionDrafts[subject]?.[topic];
  if (!drafts || !isValidQuestionSet(drafts)) return null;

  return drafts.map((draft, index) => ({
    id: index + 1,
    topic,
    ...sourceMetadata[index],
    ...draft,
  }));
}

function reindexQuestions(questions: readonly QuizQuestion[]): QuizQuestion[] {
  return questions.map((question, index) => ({ ...question, id: index + 1 }));
}

function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let state = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16_777_619);
  }

  const random = () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

/**
 * Practice papers are original content styled after the real O-Level paper
 * format (an all-MCQ paper and an all-structured/fill-blank paper), not a
 * reproduction of any real exam sitting - see PAST_PAPER_DEFINITIONS labels.
 */
const PAST_PAPER_DEFINITIONS = [
  { id: 'paper-1', paperNumber: 1 as const, label: 'Practice Paper 1 (MCQ)', matches: (q: QuestionDraft) => q.type === 'mcq' },
  { id: 'paper-2', paperNumber: 2 as const, label: 'Practice Paper 2 (Structured)', matches: (q: QuestionDraft) => q.type !== 'mcq' },
] as const;

function getSubjectQuestionPool(subject: string): QuizQuestion[] {
  const subjectTopicNames = Object.keys(topicQuestionDrafts[subject] ?? {});
  return subjectTopicNames.flatMap((topicName) => getQuestionsForSelection(subject, topicName) ?? []);
}

export function getAvailablePastPapers(subject: string): Array<{ id: string; label: string; paperNumber: 1 | 2; questionCount: number }> {
  const pool = getSubjectQuestionPool(subject);
  return PAST_PAPER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    paperNumber: definition.paperNumber,
    questionCount: pool.filter((question) => definition.matches(question)).length,
  }));
}

/**
 * Builds the exact question set for a quiz mode. This function is shared by
 * the browser and API so a seeded speed round can be reconstructed for
 * server-side grading without trusting answers supplied by the client.
 */
export function getQuestionsForQuizMode(
  subject: string,
  topic: string,
  mode: QuizQuestionMode,
  seed: string,
  paperId = 'paper-1',
): QuizQuestion[] | null {
  const selectedTopicQuestions = getQuestionsForSelection(subject, topic);
  if (!selectedTopicQuestions) return null;

  if (mode === 'concept-check') {
    return reindexQuestions(selectedTopicQuestions.map((question) => {
      const conceptQuestion: QuizQuestion = { ...question, source: 'AI-generated concept check' };
      delete conceptQuestion.resourceNumber;
      return conceptQuestion;
    }));
  }

  const subjectTopicNames = Object.keys(topicQuestionDrafts[subject] ?? {});
  if (mode === 'past-paper') {
    const definition = PAST_PAPER_DEFINITIONS.find((paper) => paper.id === paperId) ?? PAST_PAPER_DEFINITIONS[0];
    const paperQuestions = getSubjectQuestionPool(subject).filter((question) => definition.matches(question));
    if (paperQuestions.length === 0) return null;
    return reindexQuestions(paperQuestions.map((question) => {
      const paperQuestion: QuizQuestion = { ...question, source: definition.label };
      delete paperQuestion.resourceNumber;
      return paperQuestion;
    }));
  }

  const selectedTopicIndex = subjectTopicNames.indexOf(topic);
  if (selectedTopicIndex < 0) return null;

  const relatedTopicNames = [topic];
  for (let distance = 1; relatedTopicNames.length < subjectTopicNames.length; distance += 1) {
    const previousTopic = subjectTopicNames[selectedTopicIndex - distance];
    const nextTopic = subjectTopicNames[selectedTopicIndex + distance];
    if (previousTopic) relatedTopicNames.push(previousTopic);
    if (nextTopic) relatedTopicNames.push(nextTopic);
    if (!previousTopic && !nextTopic) break;
  }

  const speedPool: QuizQuestion[] = [];
  for (const [relatedIndex, relatedTopic] of relatedTopicNames.entries()) {
    const relatedQuestions = (getQuestionsForSelection(subject, relatedTopic) ?? [])
      .filter((question) => question.type === 'mcq');
    speedPool.push(...relatedQuestions);
    if (speedPool.length >= 5 && relatedIndex >= Math.min(2, relatedTopicNames.length - 1)) break;
  }

  if (speedPool.length < 5) return null;
  const speedQuestions = seededShuffle(speedPool, `${seed}:${subject}:${topic}`).slice(0, 5);
  return reindexQuestions(speedQuestions.map((question) => {
    const speedQuestion: QuizQuestion = { ...question, source: `Speed mix · ${question.topic}` };
    delete speedQuestion.resourceNumber;
    return speedQuestion;
  }));
}

/**
 * The full catalog structure (subject name -> ordered topic names) backing the
 * static question bank above. This is the single source of truth other parts
 * of the app (the database catalog seed) derive their subject/topic list from,
 * so a topic can never be seeded without a matching question set.
 */
export const CATALOG_SUBJECT_TOPIC_NAMES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(topicQuestionDrafts).map(([subject, topics]) => [subject, Object.keys(topics)]),
);
