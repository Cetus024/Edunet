// Real O-Level syllabus content for the concept web, shared between the
// student view (one authenticated learner's own progress) and the teacher
// view (a class-level aggregate over the demo squad - see lib/squad-data.ts)
// so both render the exact same branch structure for a given subject.
//
// Every real catalog topic (keyed by its real id — see database/seed) gets 3
// realistic O-Level subtopic branches. Subjects without an entry here
// (currently: none - all 8 catalog subjects are covered) would still render,
// just as a single ring with no subtopic fan.

export type SubconceptSeed = { id: string; name: string; description: string; keyConnectionTopic: string };

export const topicSubconcepts: Record<string, SubconceptSeed[]> = {
  'biology-cell-division-mitosis': [
    { id: 'chromosomes', name: 'Chromosomes', description: 'Threadlike structures carrying genetic information, copied and separated during cell division.', keyConnectionTopic: 'The Cell Cycle' },
    { id: 'the-cell-cycle', name: 'The Cell Cycle', description: 'Growth phase followed by division, producing two genetically identical daughter cells.', keyConnectionTopic: 'Growth & Repair' },
    { id: 'growth-repair', name: 'Growth & Repair', description: 'Mitosis replaces damaged cells and enables an organism to grow.', keyConnectionTopic: 'Chromosomes' },
  ],
  'biology-nutrition': [
    { id: 'digestive-enzymes', name: 'Digestive Enzymes', description: 'Break down large food molecules into smaller, soluble ones for absorption.', keyConnectionTopic: 'Absorption in the Small Intestine' },
    { id: 'balanced-diet', name: 'Balanced Diet', description: 'The right proportions of carbohydrates, proteins, fats, vitamins, minerals, fibre, and water.', keyConnectionTopic: 'Digestive Enzymes' },
    { id: 'absorption-small-intestine', name: 'Absorption in the Small Intestine', description: 'Villi increase surface area so digested nutrients can be absorbed into the blood.', keyConnectionTopic: 'Balanced Diet' },
  ],
  'biology-respiration': [
    { id: 'aerobic-respiration', name: 'Aerobic Respiration', description: 'Glucose reacts with oxygen to release energy, carbon dioxide, and water.', keyConnectionTopic: 'Mitochondria' },
    { id: 'anaerobic-respiration', name: 'Anaerobic Respiration', description: 'Energy release without oxygen, producing lactic acid in muscles.', keyConnectionTopic: 'Aerobic Respiration' },
    { id: 'mitochondria', name: 'Mitochondria', description: 'Organelles where most aerobic respiration takes place.', keyConnectionTopic: 'Anaerobic Respiration' },
  ],
  'biology-transport': [
    { id: 'circulatory-system', name: 'Circulatory System', description: 'The heart and blood vessels transport oxygen, nutrients, and waste around the body.', keyConnectionTopic: 'Diffusion & Osmosis' },
    { id: 'xylem-phloem', name: 'Xylem & Phloem', description: 'Plant vessels carrying water/minerals upward and dissolved sugars around the plant.', keyConnectionTopic: 'Circulatory System' },
    { id: 'diffusion-osmosis', name: 'Diffusion & Osmosis', description: 'Movement of particles and water down a concentration gradient underlies all transport.', keyConnectionTopic: 'Xylem & Phloem' },
  ],
  'biology-reproduction': [
    { id: 'sexual-reproduction', name: 'Sexual Reproduction', description: 'Fusion of male and female gametes produces genetically varied offspring.', keyConnectionTopic: 'Fertilisation' },
    { id: 'fertilisation', name: 'Fertilisation', description: 'The fusion of a sperm nucleus and an egg nucleus to form a zygote.', keyConnectionTopic: 'The Menstrual Cycle' },
    { id: 'the-menstrual-cycle', name: 'The Menstrual Cycle', description: 'Hormone-controlled monthly cycle that prepares the uterus for a possible pregnancy.', keyConnectionTopic: 'Sexual Reproduction' },
  ],
  'biology-ecology': [
    { id: 'food-chains-webs', name: 'Food Chains & Webs', description: 'Show how energy and nutrients transfer between organisms in an ecosystem.', keyConnectionTopic: 'Nutrient Cycles' },
    { id: 'nutrient-cycles', name: 'Nutrient Cycles', description: 'Decomposers recycle nutrients like carbon and nitrogen back into the ecosystem.', keyConnectionTopic: 'Population & Environment' },
    { id: 'population-environment', name: 'Population & Environment', description: 'Population size is limited by food, space, predators, and other environmental factors.', keyConnectionTopic: 'Food Chains & Webs' },
  ],
  'biology-genetics': [
    { id: 'dna-genes', name: 'DNA & Genes', description: 'DNA carries genetic instructions in genes, sequences of bases coding for traits.', keyConnectionTopic: 'Alleles' },
    { id: 'alleles', name: 'Alleles', description: 'Different versions of the same gene, which can be dominant or recessive.', keyConnectionTopic: 'Punnett Squares' },
    { id: 'punnett-squares', name: 'Punnett Squares', description: 'Diagrams used to predict the probability of offspring genotypes and phenotypes.', keyConnectionTopic: 'DNA & Genes' },
  ],
  'chemistry-atomic-structure': [
    { id: 'protons-neutrons-electrons', name: 'Protons, Neutrons & Electrons', description: 'Subatomic particles whose numbers define an element and its charge.', keyConnectionTopic: 'Isotopes' },
    { id: 'isotopes', name: 'Isotopes', description: 'Atoms of the same element with different numbers of neutrons.', keyConnectionTopic: 'Electronic Structure' },
    { id: 'electronic-structure', name: 'Electronic Structure', description: 'Electrons arranged in shells around the nucleus, determining chemical bonding.', keyConnectionTopic: 'Protons, Neutrons & Electrons' },
  ],
  'chemistry-covalent-bonding': [
    { id: 'simple-molecules', name: 'Simple Molecules', description: 'Small covalent molecules with low melting/boiling points, e.g. water and carbon dioxide.', keyConnectionTopic: 'Shared Electron Pairs' },
    { id: 'giant-covalent-structures', name: 'Giant Covalent Structures', description: 'Huge lattices of covalently bonded atoms, e.g. diamond and graphite, with very high melting points.', keyConnectionTopic: 'Simple Molecules' },
    { id: 'shared-electron-pairs', name: 'Shared Electron Pairs', description: 'Atoms share pairs of electrons to complete their outer shells.', keyConnectionTopic: 'Giant Covalent Structures' },
  ],
  'chemistry-stoichiometry': [
    { id: 'the-mole', name: 'The Mole', description: 'A counting unit for particles, linking a measurable mass to a number of atoms or molecules.', keyConnectionTopic: 'Balanced Equations' },
    { id: 'balanced-equations', name: 'Balanced Equations', description: 'Equal atoms of each element on both sides, giving mole ratios for a reaction.', keyConnectionTopic: 'Reacting Masses' },
    { id: 'reacting-masses', name: 'Reacting Masses', description: 'Using mole ratios from a balanced equation to calculate masses of reactants and products.', keyConnectionTopic: 'The Mole' },
  ],
  'chemistry-acids-bases': [
    { id: 'ph-scale', name: 'pH Scale', description: 'A scale from 0 to 14 showing how acidic or alkaline a solution is.', keyConnectionTopic: 'Neutralisation' },
    { id: 'neutralisation', name: 'Neutralisation', description: 'An acid and a base react to form a salt and water.', keyConnectionTopic: 'Salt Preparation' },
    { id: 'salt-preparation', name: 'Salt Preparation', description: 'Methods for making soluble and insoluble salts, often starting from neutralisation.', keyConnectionTopic: 'pH Scale' },
  ],
  'chemistry-redox-reactions': [
    { id: 'oxidation-reduction', name: 'Oxidation & Reduction', description: 'Oxidation is loss of electrons (or gain of oxygen); reduction is the reverse.', keyConnectionTopic: 'Electron Transfer' },
    { id: 'electron-transfer', name: 'Electron Transfer', description: 'Redox reactions always involve electrons moving from one species to another.', keyConnectionTopic: 'Displacement Reactions' },
    { id: 'displacement-reactions', name: 'Displacement Reactions', description: 'A more reactive metal displaces a less reactive one from its compound — a classic redox example.', keyConnectionTopic: 'Oxidation & Reduction' },
  ],
  'chemistry-organic-chemistry': [
    { id: 'hydrocarbons', name: 'Hydrocarbons', description: 'Compounds of hydrogen and carbon only, the basis of fuels like alkanes and alkenes.', keyConnectionTopic: 'Homologous Series' },
    { id: 'alcohols', name: 'Alcohols', description: 'Organic compounds containing an -OH group, made by fermentation or from hydrocarbons.', keyConnectionTopic: 'Hydrocarbons' },
    { id: 'homologous-series', name: 'Homologous Series', description: 'A family of compounds with the same general formula and similar chemical properties.', keyConnectionTopic: 'Alcohols' },
  ],
  'chemistry-rate-of-reaction': [
    { id: 'collision-theory', name: 'Collision Theory', description: 'Particles must collide with enough energy and the correct orientation to react.', keyConnectionTopic: 'Catalysts' },
    { id: 'catalysts', name: 'Catalysts', description: 'Speed up a reaction by providing a lower energy pathway, without being used up.', keyConnectionTopic: 'Factors Affecting Rate' },
    { id: 'factors-affecting-rate', name: 'Factors Affecting Rate', description: 'Temperature, concentration, surface area, and pressure all change collision frequency.', keyConnectionTopic: 'Collision Theory' },
  ],
  'physics-speed-acceleration': [
    { id: 'distance-time-graphs', name: 'Distance-Time Graphs', description: 'Gradient gives speed; a curved line shows the object is accelerating.', keyConnectionTopic: 'Velocity-Time Graphs' },
    { id: 'velocity-time-graphs', name: 'Velocity-Time Graphs', description: 'Gradient gives acceleration; area under the graph gives distance travelled.', keyConnectionTopic: 'Acceleration Formula' },
    { id: 'acceleration-formula', name: 'Acceleration Formula', description: 'Acceleration equals the change in velocity divided by the time taken.', keyConnectionTopic: 'Distance-Time Graphs' },
  ],
  'physics-dynamics': [
    { id: 'newtons-laws', name: "Newton's Laws", description: "An object's motion only changes when acted on by a resultant force.", keyConnectionTopic: 'Resultant Force' },
    { id: 'resultant-force', name: 'Resultant Force', description: 'The single force equivalent to all the forces acting on an object combined.', keyConnectionTopic: 'Momentum' },
    { id: 'momentum', name: 'Momentum', description: 'Mass times velocity; conserved in collisions when no external force acts.', keyConnectionTopic: "Newton's Laws" },
  ],
  'physics-energy': [
    { id: 'energy-stores-transfers', name: 'Energy Stores & Transfers', description: 'Energy moves between stores such as kinetic, gravitational, and thermal.', keyConnectionTopic: 'Conservation of Energy' },
    { id: 'conservation-of-energy', name: 'Conservation of Energy', description: 'Energy cannot be created or destroyed, only transferred between stores.', keyConnectionTopic: 'Efficiency' },
    { id: 'efficiency', name: 'Efficiency', description: 'Useful energy output divided by total energy input, since some is always wasted.', keyConnectionTopic: 'Energy Stores & Transfers' },
  ],
  'physics-waves': [
    { id: 'wave-properties', name: 'Wave Properties', description: 'Amplitude, wavelength, and frequency describe and distinguish waves.', keyConnectionTopic: 'Reflection & Refraction' },
    { id: 'reflection-refraction', name: 'Reflection & Refraction', description: 'Waves bounce off surfaces or bend when they change speed between materials.', keyConnectionTopic: 'Electromagnetic Spectrum' },
    { id: 'electromagnetic-spectrum', name: 'Electromagnetic Spectrum', description: 'The full range of electromagnetic waves, ordered by frequency and wavelength.', keyConnectionTopic: 'Wave Properties' },
  ],
  'physics-electricity': [
    { id: 'current-voltage', name: 'Current & Voltage', description: 'Current is the rate of flow of charge; voltage is the energy transferred per charge.', keyConnectionTopic: 'Resistance' },
    { id: 'resistance', name: 'Resistance', description: 'Opposition to current flow in a component, linking voltage and current via Ohm’s law.', keyConnectionTopic: 'Series & Parallel Circuits' },
    { id: 'series-parallel-circuits', name: 'Series & Parallel Circuits', description: 'Circuit arrangements that share current and potential difference differently.', keyConnectionTopic: 'Current & Voltage' },
  ],
  'physics-electromagnetism': [
    { id: 'magnetic-fields', name: 'Magnetic Fields', description: 'Regions where a magnetic force acts, mapped with field lines from N to S pole.', keyConnectionTopic: 'The Motor Effect' },
    { id: 'electromagnetic-induction', name: 'Electromagnetic Induction', description: 'A changing magnetic field near a conductor induces a voltage (generator effect).', keyConnectionTopic: 'Magnetic Fields' },
    { id: 'the-motor-effect', name: 'The Motor Effect', description: 'A current-carrying wire in a magnetic field experiences a force, the basis of motors.', keyConnectionTopic: 'Electromagnetic Induction' },
  ],
  'physics-nuclear-physics': [
    { id: 'radioactive-decay', name: 'Radioactive Decay', description: 'Unstable nuclei randomly emit radiation to become more stable.', keyConnectionTopic: 'Nuclear Radiation Types' },
    { id: 'half-life', name: 'Half-life', description: 'The time taken for the activity of a radioactive source to halve.', keyConnectionTopic: 'Radioactive Decay' },
    { id: 'nuclear-radiation-types', name: 'Nuclear Radiation Types', description: 'Alpha, beta, and gamma radiation differ in penetration, range, and ionising power.', keyConnectionTopic: 'Half-life' },
  ],
  'english-comprehension': [
    { id: 'text-comprehension', name: 'Text Comprehension', description: 'Reading closely to identify explicit information stated directly in a passage.', keyConnectionTopic: 'Inference Questions' },
    { id: 'inference-questions', name: 'Inference Questions', description: 'Working out meaning that is implied rather than stated outright.', keyConnectionTopic: 'Vocabulary in Context' },
    { id: 'vocabulary-in-context', name: 'Vocabulary in Context', description: 'Using surrounding sentences to work out what an unfamiliar word means.', keyConnectionTopic: 'Text Comprehension' },
  ],
  'english-summary-writing': [
    { id: 'identifying-key-points', name: 'Identifying Key Points', description: 'Picking out the most important ideas from a passage while leaving out detail.', keyConnectionTopic: 'Paraphrasing' },
    { id: 'paraphrasing', name: 'Paraphrasing', description: 'Rewriting an idea in your own words without changing its meaning.', keyConnectionTopic: 'Word Limit Discipline' },
    { id: 'word-limit-discipline', name: 'Word Limit Discipline', description: 'Fitting all key points into a strict word count without losing marks for excess.', keyConnectionTopic: 'Identifying Key Points' },
  ],
  'english-situational-writing': [
    { id: 'purpose-audience-context', name: 'Purpose, Audience, Context', description: 'Every situational piece is shaped by who it is for, why, and in what setting.', keyConnectionTopic: 'Register & Tone' },
    { id: 'register-tone', name: 'Register & Tone', description: 'Matching formal or informal language to the relationship with the reader.', keyConnectionTopic: 'Format Conventions' },
    { id: 'format-conventions', name: 'Format Conventions', description: 'Letters, emails, and reports each follow their own expected layout.', keyConnectionTopic: 'Purpose, Audience, Context' },
  ],
  'english-continuous-writing': [
    { id: 'narrative-techniques', name: 'Narrative Techniques', description: 'Plot, pacing, and point of view used to tell an engaging story.', keyConnectionTopic: 'Descriptive Language' },
    { id: 'descriptive-language', name: 'Descriptive Language', description: 'Sensory detail and figurative language that bring a scene to life.', keyConnectionTopic: 'Essay Structure' },
    { id: 'essay-structure', name: 'Essay Structure', description: 'A clear introduction, developed body, and satisfying conclusion.', keyConnectionTopic: 'Narrative Techniques' },
  ],
  'english-editing': [
    { id: 'grammar-errors', name: 'Grammar Errors', description: 'Common mistakes in tense, subject-verb agreement, and word form.', keyConnectionTopic: 'Sentence Structure' },
    { id: 'spelling-punctuation', name: 'Spelling & Punctuation', description: 'Correct spelling and punctuation marks that change how a sentence reads.', keyConnectionTopic: 'Grammar Errors' },
    { id: 'sentence-structure', name: 'Sentence Structure', description: 'Spotting run-ons, fragments, and awkward phrasing that need correcting.', keyConnectionTopic: 'Spelling & Punctuation' },
  ],
  'english-visual-text': [
    { id: 'interpreting-images', name: 'Interpreting Images', description: 'Reading what a photo, cartoon, or graphic is showing and implying.', keyConnectionTopic: 'Text-Image Relationships' },
    { id: 'text-image-relationships', name: 'Text-Image Relationships', description: 'How captions and accompanying text change or reinforce an image\'s meaning.', keyConnectionTopic: 'Persuasive Techniques' },
    { id: 'persuasive-techniques', name: 'Persuasive Techniques', description: 'Colour, layout, and symbols used to influence how a viewer reacts.', keyConnectionTopic: 'Interpreting Images' },
  ],
  'history-world-war-i': [
    { id: 'causes-of-wwi', name: 'Causes of WWI', description: 'Alliances, imperialism, militarism, and nationalism that led to war in 1914.', keyConnectionTopic: 'Alliance Systems' },
    { id: 'alliance-systems', name: 'Alliance Systems', description: 'The Triple Alliance and Triple Entente turned a regional crisis into a world war.', keyConnectionTopic: 'The Treaty of Versailles' },
    { id: 'the-treaty-of-versailles', name: 'The Treaty of Versailles', description: 'The 1919 peace settlement and its harsh terms for Germany.', keyConnectionTopic: 'Causes of WWI' },
  ],
  'history-world-war-ii': [
    { id: 'causes-of-wwii', name: 'Causes of WWII', description: 'Failure of appeasement, the Treaty of Versailles\' legacy, and expansionist aggression.', keyConnectionTopic: 'Key Turning Points' },
    { id: 'key-turning-points', name: 'Key Turning Points', description: 'Battles like Stalingrad and Midway that shifted the war\'s momentum.', keyConnectionTopic: 'Impact of the War' },
    { id: 'impact-of-the-war', name: 'Impact of the War', description: 'The human, economic, and political aftermath that reshaped the postwar world.', keyConnectionTopic: 'Causes of WWII' },
  ],
  'history-the-cold-war': [
    { id: 'ideological-conflict', name: 'Ideological Conflict', description: 'Capitalism versus communism as the root of decades of US-Soviet tension.', keyConnectionTopic: 'Superpower Rivalry' },
    { id: 'superpower-rivalry', name: 'Superpower Rivalry', description: 'The arms race, space race, and competing spheres of influence.', keyConnectionTopic: 'Proxy Wars' },
    { id: 'proxy-wars', name: 'Proxy Wars', description: 'Conflicts like Korea and Vietnam fought indirectly between the superpowers.', keyConnectionTopic: 'Ideological Conflict' },
  ],
  'history-singapore-history': [
    { id: 'japanese-occupation', name: 'Japanese Occupation', description: 'Life in Singapore under Japanese rule from 1942 to 1945.', keyConnectionTopic: 'Road to Independence' },
    { id: 'road-to-independence', name: 'Road to Independence', description: 'Self-government, merger with Malaysia, and the path to full independence.', keyConnectionTopic: 'Nation-Building' },
    { id: 'nation-building', name: 'Nation-Building', description: 'Housing, education, and defence policies that built a young nation after 1965.', keyConnectionTopic: 'Japanese Occupation' },
  ],
  'history-decolonisation': [
    { id: 'rise-of-nationalism', name: 'Rise of Nationalism', description: 'Colonised peoples organising to demand self-rule after WWII.', keyConnectionTopic: 'Independence Movements' },
    { id: 'independence-movements', name: 'Independence Movements', description: 'Political and sometimes armed campaigns that ended colonial rule.', keyConnectionTopic: 'Post-Colonial Challenges' },
    { id: 'post-colonial-challenges', name: 'Post-Colonial Challenges', description: 'New nations facing weak institutions, borders, and economic dependency.', keyConnectionTopic: 'Rise of Nationalism' },
  ],
  'history-united-nations': [
    { id: 'formation-aims', name: 'Formation & Aims', description: 'Founded in 1945 to maintain international peace and security.', keyConnectionTopic: 'Peacekeeping Role' },
    { id: 'peacekeeping-role', name: 'Peacekeeping Role', description: 'UN peacekeeping missions sent to reduce conflict around the world.', keyConnectionTopic: 'Successes & Limitations' },
    { id: 'successes-limitations', name: 'Successes & Limitations', description: 'Cases where the UN succeeded, and where veto powers blocked action.', keyConnectionTopic: 'Formation & Aims' },
  ],
  'geography-weather-climate': [
    { id: 'atmospheric-processes', name: 'Atmospheric Processes', description: 'How heating, pressure, and air movement drive day-to-day weather.', keyConnectionTopic: 'Climate Graphs' },
    { id: 'climate-graphs', name: 'Climate Graphs', description: 'Reading temperature and rainfall data to describe a region\'s climate.', keyConnectionTopic: 'Extreme Weather Events' },
    { id: 'extreme-weather-events', name: 'Extreme Weather Events', description: 'Typhoons, droughts, and other hazards linked to atmospheric conditions.', keyConnectionTopic: 'Atmospheric Processes' },
  ],
  'geography-plate-tectonics': [
    { id: 'plate-boundaries', name: 'Plate Boundaries', description: 'Destructive, constructive, and conservative boundaries between tectonic plates.', keyConnectionTopic: 'Earthquakes' },
    { id: 'earthquakes', name: 'Earthquakes', description: 'Sudden ground shaking caused by the release of stress at plate boundaries.', keyConnectionTopic: 'Volcanic Activity' },
    { id: 'volcanic-activity', name: 'Volcanic Activity', description: 'Magma reaching the surface, most often where plates meet.', keyConnectionTopic: 'Plate Boundaries' },
  ],
  'geography-coasts': [
    { id: 'coastal-erosion', name: 'Coastal Erosion', description: 'Hydraulic action, abrasion, and other processes that wear away a coastline.', keyConnectionTopic: 'Depositional Landforms' },
    { id: 'depositional-landforms', name: 'Depositional Landforms', description: 'Beaches and spits formed where the sea deposits eroded material.', keyConnectionTopic: 'Coastal Management' },
    { id: 'coastal-management', name: 'Coastal Management', description: 'Sea walls and other strategies used to protect coastlines from erosion.', keyConnectionTopic: 'Coastal Erosion' },
  ],
  'geography-rivers': [
    { id: 'river-processes', name: 'River Processes', description: 'Erosion, transportation, and deposition that shape a river\'s course.', keyConnectionTopic: 'Fluvial Landforms' },
    { id: 'fluvial-landforms', name: 'Fluvial Landforms', description: 'Meanders, waterfalls, and floodplains produced by river processes.', keyConnectionTopic: 'Flood Management' },
    { id: 'flood-management', name: 'Flood Management', description: 'Dams and other measures used to reduce the risk of river flooding.', keyConnectionTopic: 'River Processes' },
  ],
  'geography-tourism': [
    { id: 'tourism-growth-factors', name: 'Tourism Growth Factors', description: 'Rising incomes, cheaper travel, and marketing driving global tourism growth.', keyConnectionTopic: 'Impacts of Tourism' },
    { id: 'impacts-of-tourism', name: 'Impacts of Tourism', description: 'The economic benefits and environmental/social costs tourism brings.', keyConnectionTopic: 'Sustainable Tourism' },
    { id: 'sustainable-tourism', name: 'Sustainable Tourism', description: 'Managing tourism so destinations aren\'t damaged for future visitors.', keyConnectionTopic: 'Tourism Growth Factors' },
  ],
  'geography-food-resources': [
    { id: 'food-production-systems', name: 'Food Production Systems', description: 'Different farming methods used to produce food at different scales.', keyConnectionTopic: 'Food Security' },
    { id: 'food-security', name: 'Food Security', description: 'Whether a population has reliable access to enough safe, nutritious food.', keyConnectionTopic: 'Sustainable Agriculture' },
    { id: 'sustainable-agriculture', name: 'Sustainable Agriculture', description: 'Farming practices that maintain food output without degrading the land.', keyConnectionTopic: 'Food Production Systems' },
  ],
  'a-math-quadratics': [
    { id: 'quadratic-formula', name: 'Quadratic Formula', description: 'A formula that solves any quadratic equation directly from its coefficients.', keyConnectionTopic: 'Discriminant' },
    { id: 'completing-the-square', name: 'Completing the Square', description: 'Rewriting a quadratic to find its turning point and solve it algebraically.', keyConnectionTopic: 'Quadratic Formula' },
    { id: 'discriminant', name: 'Discriminant', description: 'Tells you how many real roots a quadratic equation has, without solving it.', keyConnectionTopic: 'Completing the Square' },
  ],
  'a-math-polynomials': [
    { id: 'remainder-theorem', name: 'Remainder Theorem', description: 'Finds the remainder when a polynomial is divided, without doing long division.', keyConnectionTopic: 'Factor Theorem' },
    { id: 'factor-theorem', name: 'Factor Theorem', description: 'Tests whether a given value is a root, i.e. a factor, of a polynomial.', keyConnectionTopic: 'Polynomial Division' },
    { id: 'polynomial-division', name: 'Polynomial Division', description: 'Dividing one polynomial by another to simplify or factorise an expression.', keyConnectionTopic: 'Remainder Theorem' },
  ],
  'a-math-trigonometry': [
    { id: 'trigonometric-identities', name: 'Trigonometric Identities', description: 'Relationships like sin²θ + cos²θ = 1 used to simplify trig expressions.', keyConnectionTopic: 'Trigonometric Equations' },
    { id: 'trigonometric-equations', name: 'Trigonometric Equations', description: 'Solving equations involving sine, cosine, and tangent within a given range.', keyConnectionTopic: 'Graphs of Trig Functions' },
    { id: 'graphs-of-trig-functions', name: 'Graphs of Trig Functions', description: 'The repeating wave shapes of sine, cosine, and tangent graphs.', keyConnectionTopic: 'Trigonometric Identities' },
  ],
  'a-math-differentiation': [
    { id: 'chain-rule', name: 'Chain Rule', description: 'Differentiates a function composed of one function nested inside another.', keyConnectionTopic: 'Product & Quotient Rule' },
    { id: 'product-quotient-rule', name: 'Product & Quotient Rule', description: 'Rules for differentiating a product or a fraction of two functions.', keyConnectionTopic: 'Stationary Points' },
    { id: 'stationary-points', name: 'Stationary Points', description: 'Points where the gradient is zero, found by setting the derivative to 0.', keyConnectionTopic: 'Chain Rule' },
  ],
  'a-math-integration': [
    { id: 'indefinite-integrals', name: 'Indefinite Integrals', description: 'The reverse process of differentiation, giving a family of functions plus a constant.', keyConnectionTopic: 'Definite Integrals' },
    { id: 'definite-integrals', name: 'Definite Integrals', description: 'Evaluating an integral between two limits to get a single numerical value.', keyConnectionTopic: 'Area Under a Curve' },
    { id: 'area-under-a-curve', name: 'Area Under a Curve', description: 'Using definite integrals to calculate the area between a curve and the x-axis.', keyConnectionTopic: 'Indefinite Integrals' },
  ],
  'a-math-coordinate-geometry': [
    { id: 'equation-of-a-line', name: 'Equation of a Line', description: 'Writing a straight line in the form y = mx + c from given information.', keyConnectionTopic: 'Distance & Midpoint' },
    { id: 'distance-midpoint', name: 'Distance & Midpoint', description: 'Formulas for the distance between two points and the point exactly between them.', keyConnectionTopic: 'Perpendicular & Parallel Lines' },
    { id: 'perpendicular-parallel-lines', name: 'Perpendicular & Parallel Lines', description: 'Gradient rules for lines that never meet or that cross at a right angle.', keyConnectionTopic: 'Equation of a Line' },
  ],
  'e-math-numbers': [
    { id: 'number-types', name: 'Number Types', description: 'Integers, rationals, and irrationals, and how they relate to each other.', keyConnectionTopic: 'Standard Form' },
    { id: 'standard-form', name: 'Standard Form', description: 'Writing very large or very small numbers as a value times a power of 10.', keyConnectionTopic: 'Estimation & Approximation' },
    { id: 'estimation-approximation', name: 'Estimation & Approximation', description: 'Rounding to a sensible number of figures to check if an answer is reasonable.', keyConnectionTopic: 'Number Types' },
  ],
  'e-math-algebra': [
    { id: 'simplifying-expressions', name: 'Simplifying Expressions', description: 'Collecting like terms and expanding brackets to tidy up an expression.', keyConnectionTopic: 'Solving Equations' },
    { id: 'solving-equations', name: 'Solving Equations', description: 'Finding the value of an unknown that makes an equation true.', keyConnectionTopic: 'Simultaneous Equations' },
    { id: 'simultaneous-equations', name: 'Simultaneous Equations', description: 'Solving two equations together to find values that satisfy both at once.', keyConnectionTopic: 'Simplifying Expressions' },
  ],
  'e-math-geometry': [
    { id: 'angle-properties', name: 'Angle Properties', description: 'Rules for angles on a line, around a point, and in polygons.', keyConnectionTopic: 'Congruence & Similarity' },
    { id: 'congruence-similarity', name: 'Congruence & Similarity', description: 'Shapes that are identical, or the same shape at a different scale.', keyConnectionTopic: 'Circle Theorems' },
    { id: 'circle-theorems', name: 'Circle Theorems', description: 'Angle relationships involving chords, tangents, and arcs of a circle.', keyConnectionTopic: 'Angle Properties' },
  ],
  'e-math-statistics': [
    { id: 'mean-median-mode', name: 'Mean, Median & Mode', description: 'Three different ways to describe the "average" of a data set.', keyConnectionTopic: 'Data Representation' },
    { id: 'data-representation', name: 'Data Representation', description: 'Bar charts, histograms, and pie charts used to display data visually.', keyConnectionTopic: 'Cumulative Frequency' },
    { id: 'cumulative-frequency', name: 'Cumulative Frequency', description: 'Running totals used to find the median and quartiles from grouped data.', keyConnectionTopic: 'Mean, Median & Mode' },
  ],
  'e-math-probability': [
    { id: 'probability-rules', name: 'Probability Rules', description: 'Basic rules for combining probabilities of independent and combined events.', keyConnectionTopic: 'Tree Diagrams' },
    { id: 'tree-diagrams', name: 'Tree Diagrams', description: 'Diagrams that map out possible outcomes across a sequence of events.', keyConnectionTopic: 'Venn Diagrams' },
    { id: 'venn-diagrams', name: 'Venn Diagrams', description: 'Diagrams showing how sets of outcomes overlap, useful for combined events.', keyConnectionTopic: 'Probability Rules' },
  ],
  'e-math-mensuration': [
    { id: 'area-perimeter', name: 'Area & Perimeter', description: 'Formulas for the space inside and the boundary length of 2D shapes.', keyConnectionTopic: 'Volume & Surface Area' },
    { id: 'volume-surface-area', name: 'Volume & Surface Area', description: 'Formulas for the space inside and the outer surface of 3D solids.', keyConnectionTopic: 'Arc Length & Sector Area' },
    { id: 'arc-length-sector-area', name: 'Arc Length & Sector Area', description: 'Measuring a portion of a circle\'s circumference and the area it encloses.', keyConnectionTopic: 'Area & Perimeter' },
  ],
};

// Real syllabus relationships between real catalog topic ids (not the old
// hardcoded template's ids), used for the dashed cross-topic links. Subjects
// without a curated list here fall back to connecting neighbouring topics on
// the ring, so every subject still shows some cross-topic links.
export const realisticTopicConnections: Record<string, { from: string; to: string }[]> = {
  Biology: [
    { from: 'biology-cell-division-mitosis', to: 'biology-genetics' }, // mitosis copies the genetic material genetics studies
    { from: 'biology-genetics', to: 'biology-reproduction' }, // inheritance happens through reproduction
    { from: 'biology-respiration', to: 'biology-nutrition' }, // respiration releases energy from digested nutrients
    { from: 'biology-respiration', to: 'biology-transport' }, // blood transports oxygen and glucose for respiration
    { from: 'biology-transport', to: 'biology-nutrition' }, // transport carries absorbed nutrients around the body
    { from: 'biology-ecology', to: 'biology-nutrition' }, // food chains and nutrient cycling
  ],
  Chemistry: [
    { from: 'chemistry-atomic-structure', to: 'chemistry-covalent-bonding' }, // electron arrangement determines bonding
    { from: 'chemistry-covalent-bonding', to: 'chemistry-organic-chemistry' }, // organic molecules are covalently bonded
    { from: 'chemistry-stoichiometry', to: 'chemistry-acids-bases' }, // titration calculations use mole ratios
    { from: 'chemistry-redox-reactions', to: 'chemistry-atomic-structure' }, // electron transfer relates to electron shells
    { from: 'chemistry-rate-of-reaction', to: 'chemistry-redox-reactions' }, // rate experiments are often redox reactions
  ],
  Physics: [
    { from: 'physics-speed-acceleration', to: 'physics-dynamics' }, // kinematics underpins Newton's laws
    { from: 'physics-dynamics', to: 'physics-energy' }, // work done by a force transfers energy
    { from: 'physics-energy', to: 'physics-electricity' }, // electrical energy and power
    { from: 'physics-electricity', to: 'physics-electromagnetism' }, // current creates magnetic effects
    { from: 'physics-waves', to: 'physics-electromagnetism' }, // EM waves are part of the wave family
    { from: 'physics-nuclear-physics', to: 'physics-energy' }, // radioactive decay releases energy
  ],
  English: [
    { from: 'english-comprehension', to: 'english-summary-writing' }, // summary skills build directly on comprehension
    { from: 'english-situational-writing', to: 'english-continuous-writing' }, // both are the writing paper's two components
    { from: 'english-editing', to: 'english-continuous-writing' }, // editing skills sharpen your own writing
    { from: 'english-visual-text', to: 'english-comprehension' }, // visual text also tests comprehension skills
  ],
  History: [
    { from: 'history-world-war-i', to: 'history-world-war-ii' }, // WWI's unresolved tensions fed into WWII
    { from: 'history-world-war-ii', to: 'history-the-cold-war' }, // WWII's ending set up Cold War rivalry
    { from: 'history-the-cold-war', to: 'history-decolonisation' }, // superpower rivalry shaped decolonisation
    { from: 'history-singapore-history', to: 'history-decolonisation' }, // Singapore's independence is part of decolonisation
    { from: 'history-the-cold-war', to: 'history-united-nations' }, // the UN formed in response to WWII and Cold War tension
  ],
  Geography: [
    { from: 'geography-rivers', to: 'geography-coasts' }, // rivers deposit sediment that shapes coastlines
    { from: 'geography-weather-climate', to: 'geography-food-resources' }, // climate directly affects what can be farmed
    { from: 'geography-tourism', to: 'geography-coasts' }, // many tourist destinations are coastal
    { from: 'geography-plate-tectonics', to: 'geography-weather-climate' }, // volcanic activity can affect regional climate
  ],
  'A-Math': [
    { from: 'a-math-polynomials', to: 'a-math-quadratics' }, // a quadratic is a specific type of polynomial
    { from: 'a-math-quadratics', to: 'a-math-coordinate-geometry' }, // quadratic curves are studied via coordinate geometry
    { from: 'a-math-trigonometry', to: 'a-math-differentiation' }, // differentiating trigonometric functions
    { from: 'a-math-differentiation', to: 'a-math-integration' }, // integration reverses differentiation
  ],
  Mathematics: [
    { from: 'e-math-algebra', to: 'e-math-numbers' }, // algebra builds directly on number properties
    { from: 'e-math-geometry', to: 'e-math-mensuration' }, // mensuration applies geometric shape properties
    { from: 'e-math-statistics', to: 'e-math-probability' }, // both are data and chance topics, often taught together
  ],
};
