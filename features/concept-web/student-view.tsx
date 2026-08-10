'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { motion, useReducedMotion } from 'motion/react';
import { Brain, ChevronRight, Eye, EyeOff, Link2, Minus, Plus, RotateCcw, Users, X } from 'lucide-react';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ConceptNodeFriendMarkers } from '@/features/concept-web/friend-markers';
import { clamp, normalizeConceptLabel as normalize, roundCoordinate } from '@/features/concept-web/graph-utils';
import {
  getStrugglingFriendsForTopic,
  getWeakestTopicForMember,
  squadMembers,
  type StrugglingFriend,
} from '@/lib/squad-data';
import { subjectsAtom, type SubjectData, type TopicData } from '@/lib/study-data';

type KeyConnection = { topic: string; explanation: string };
type SubConcept = { id: string; name: string; memoryScore: number | null; description: string; keyConnection: KeyConnection };
type Topic = SubConcept & { subConcepts: SubConcept[] };
type SubjectEntry = { icon: string; topics: Topic[] };
type NodeKind = 'subject' | 'topic' | 'subconcept';
type GraphNode = SubConcept & { kind: NodeKind; subject: string; parentId?: string; x: number; y: number; r: number; index: number };
type GraphLink = { from: GraphNode; to: GraphNode; dashed?: boolean };
type PopupState = { node: GraphNode; x: number; y: number };
type PanState = { x: number; y: number; zoom: number };

// Every real catalog topic (keyed by its real id — see database/seed) gets 3
// realistic O-Level subtopic branches, restoring the two-tier branch layout
// for Biology/Chemistry/Physics. This replaces an earlier approach that
// matched subtopics from an old hardcoded template by NAME, which only ever
// lined up for the handful of real topics that happened to share a name with
// the template (e.g. "Genetics", "Respiration") — every other topic showed
// no branches at all. Subjects without an entry here (English, History,
// Geography, A-Math, E-Math) still render, just as a single ring with no
// subtopic fan, until their own syllabus branches are written.
type SubconceptSeed = { id: string; name: string; description: string; keyConnectionTopic: string };
const topicSubconcepts: Record<string, SubconceptSeed[]> = {
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
const realisticTopicConnections: Record<string, { from: string; to: string }[]> = {
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
  'E-Math': [
    { from: 'e-math-algebra', to: 'e-math-numbers' }, // algebra builds directly on number properties
    { from: 'e-math-geometry', to: 'e-math-mensuration' }, // mensuration applies geometric shape properties
    { from: 'e-math-statistics', to: 'e-math-probability' }, // both are data and chance topics, often taught together
  ],
};

const tierForScore = (score: number | null) => {
  if (score === null) return { fill: '#9CA3AF', stroke: '#6B7280', text: '#FFFFFF', label: 'Not Started' };
  if (score >= 70) return { fill: '#186636', stroke: '#0F4A24', text: '#FFFFFF', label: 'Strong' };
  if (score >= 40) return { fill: '#EAA93C', stroke: '#D99A2F', text: '#17233A', label: 'Review needed' };
  return { fill: '#D9534F', stroke: '#C0392B', text: '#FFFFFF', label: 'Weak' };
};

const wrapText = (label: string): string[] => {
  const words = label.split(' ');
  if (label.length <= 12) return [label];
  const first: string[] = [];
  const second: string[] = [];
  words.forEach((word: string, index: number) => (index < Math.ceil(words.length / 2) ? first : second).push(word));
  return [first.join(' '), second.join(' ')].filter(Boolean).slice(0, 2);
};

export default function StudentConceptWebView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authenticatedSubjects = useAtomValue(subjectsAtom);
  const subjectsData = useMemo<Record<string, SubjectEntry>>(() => {
    return Object.fromEntries(authenticatedSubjects.map((subjectData: SubjectData) => {
      const topics = subjectData.topics.map((topicData: TopicData, topicIndex: number): Topic => {
        const subconceptSeeds = topicSubconcepts[topicData.id] ?? [];
        const nextTopic = subjectData.topics[(topicIndex + 1) % subjectData.topics.length] ?? topicData;

        return {
          id: topicData.id,
          name: topicData.name,
          memoryScore: topicData.memoryScore,
          description: subconceptSeeds.length > 0
            ? `${topicData.name} covers ${subconceptSeeds.map((seed) => seed.name).join(', ')}.`
            : `${topicData.name} is part of your ${subjectData.name} O-Level learning map.`,
          keyConnection: {
            topic: nextTopic.name,
            explanation: `${topicData.name} and ${nextTopic.name} are neighbouring branches in your ${subjectData.name} revision map.`,
          },
          subConcepts: subconceptSeeds.map((seed: SubconceptSeed) => ({
            id: `${topicData.id}-${seed.id}`,
            name: seed.name,
            description: seed.description,
            keyConnection: { topic: seed.keyConnectionTopic, explanation: `${seed.name} connects closely to ${seed.keyConnectionTopic} within ${topicData.name}.` },
            // Detail nodes inherit the authenticated parent topic score — there
            // is no separate real per-subtopic score to track.
            memoryScore: topicData.memoryScore,
          })),
        };
      });

      return [subjectData.name, { icon: subjectData.icon, topics }];
    })) as Record<string, SubjectEntry>;
  }, [authenticatedSubjects]);
  const requestedInitialSubject = searchParams.get('subject');
  const [subject, setSubject] = useState(
    authenticatedSubjects.find((candidate: SubjectData) => (
      requestedInitialSubject
      && (normalize(candidate.name) === normalize(requestedInitialSubject)
        || normalize(candidate.id) === normalize(requestedInitialSubject))
    ))?.name ?? authenticatedSubjects[0]?.name ?? ''
  );
  const prefersReducedMotion = useReducedMotion();
  const [weakOnly, setWeakOnly] = useState(false);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Hovering a bubble "activates" a bouncier version of the idle float on it
  // and, for a subject or topic bubble, on its children too — hovering the
  // subject bounces every topic, hovering a topic bounces its own subtopics.
  // Makes it easy to tell which subtopics belong to which topic even where
  // neighbouring fans sit close together.
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const graph = useMemo(() => {
    const entry = subjectsData[subject];
    if (!entry || entry.topics.length === 0) return { nodes: [], links: [] };

    const startedScores = entry.topics
      .map((topic: Topic) => topic.memoryScore)
      .filter((score: number | null): score is number => score !== null);
    const average = startedScores.length > 0
      ? Math.round(startedScores.reduce((sum: number, score: number) => sum + score, 0) / startedScores.length)
      : null;
    const firstTopic = entry.topics[0];
    // Every real topic sits on an even ring around the subject, and topics
    // with real curated subtopics (see topicSubconcepts above) fan out a
    // second ring of 3 branch nodes — every topic that has subtopic data
    // gets the same treatment, not just whichever ones happened to share a
    // name with an old template.
    const nodes: GraphNode[] = [{ id: normalize(subject), name: subject, memoryScore: average, description: `${subject} concept map built from your authenticated O-Level learning progress.`, keyConnection: { topic: firstTopic.name, explanation: `${firstTopic.name} is the first branch in this subject map.` }, kind: 'subject', subject, x: 500, y: 400, r: 60, index: 0 }];
    const links: GraphLink[] = [];
    entry.topics.forEach((topic: Topic, topicIndex: number) => {
      const angle = -Math.PI / 2 + topicIndex * ((Math.PI * 2) / entry.topics.length);
      const topicNode: GraphNode = { ...topic, kind: 'topic', subject, x: roundCoordinate(500 + Math.cos(angle) * 170), y: roundCoordinate(400 + Math.sin(angle) * 170), r: 42, index: nodes.length };
      nodes.push(topicNode);
      links.push({ from: nodes[0], to: topicNode });
      // The subtopic fan's angular width used to be a fixed constant, tuned
      // for the old 5-topics-per-subject template. Real subjects now have
      // 6-7 topics each, shrinking the angular slice available per topic —
      // a fixed-width fan then spills into the neighbouring topic's fan and
      // the bubbles visibly overlap. Scaling the spread to the actual
      // per-topic slice (with margin to spare) keeps every subject's fans
      // clear of each other regardless of topic count.
      const perTopicSlice = (Math.PI * 2) / entry.topics.length;
      const spread = Math.min(perTopicSlice * 0.62, Math.PI / 3.2);
      topic.subConcepts.forEach((concept: SubConcept, conceptIndex: number) => {
        const subAngle = angle - spread / 2 + (spread / Math.max(1, topic.subConcepts.length - 1)) * conceptIndex;
        const subNode: GraphNode = { ...concept, kind: 'subconcept', subject, parentId: topic.id, x: roundCoordinate(500 + Math.cos(subAngle) * 330), y: roundCoordinate(400 + Math.sin(subAngle) * 330), r: 28, index: nodes.length };
        nodes.push(subNode);
        links.push({ from: topicNode, to: subNode });
      });
    });
    const byId = nodes.reduce<Record<string, GraphNode>>((accumulator: Record<string, GraphNode>, node: GraphNode) => ({ ...accumulator, [node.id]: node }), {});
    const curatedConnections = realisticTopicConnections[subject];
    if (curatedConnections?.length) {
      curatedConnections.forEach((connection: { from: string; to: string }) => {
        if (byId[connection.from] && byId[connection.to]) {
          links.push({ from: byId[connection.from], to: byId[connection.to], dashed: true });
        }
      });
    } else {
      // No curated syllabus links for this subject yet — fall back to
      // connecting neighbouring topics on the ring so it still reads as a
      // connected map rather than isolated spokes.
      entry.topics.forEach((topic: Topic, topicIndex: number) => {
        const nextTopic = entry.topics[(topicIndex + 1) % entry.topics.length];
        if (entry.topics.length > 2 && nextTopic && byId[topic.id] && byId[nextTopic.id]) {
          links.push({ from: byId[topic.id], to: byId[nextTopic.id], dashed: true });
        }
      });
    }
    return { nodes, links };
  }, [subject, subjectsData]);

  const handleFriendMarkerPress = useCallback((memberId: string, markerSubject: string, markerTopic: string) => {
    const params = new URLSearchParams({
      friendId: memberId,
      subject: markerSubject,
      topic: markerTopic,
    });
    navigate(`/study-squad?${params.toString()}`);
  }, [navigate]);

  // Jumps the map straight to a squad friend's single weakest topic,
  // switching subject first if it's not the one currently open. Reuses the
  // exact same ?subject=&topic= deep-link handling the quiz page already
  // drives (see the effect below), just triggered from a friend pick
  // instead of an external link.
  const handleFindFriend = useCallback((memberId: string) => {
    const weakest = getWeakestTopicForMember(memberId);
    if (!weakest) return;
    setSearchParams(new URLSearchParams({ subject: weakest.subject, topic: weakest.topic }));
  }, [setSearchParams]);

  const friendMarkersByNodeId = useMemo<Record<string, StrugglingFriend[]>>(() => {
    return graph.nodes.reduce<Record<string, StrugglingFriend[]>>((accumulator: Record<string, StrugglingFriend[]>, node: GraphNode) => {
      accumulator[node.id] = getStrugglingFriendsForTopic(node.subject, node.name);
      return accumulator;
    }, {});
  }, [graph.nodes]);

  const clampPopup = useCallback((x: number, y: number) => ({
    x: clamp(x, 16, Math.max(16, window.innerWidth - 390)),
    y: clamp(y, 88, Math.max(88, window.innerHeight - 430)),
  }), []);

  useEffect(() => {
    if (subjectsData[subject]) return;
    setSubject(authenticatedSubjects[0]?.name ?? '');
    setPopup(null);
    setHighlightedId(null);
  }, [authenticatedSubjects, subject, subjectsData]);

  useEffect(() => {
    const requestedSubject = searchParams.get('subject');
    const requestedTopic = searchParams.get('topic');
    const matchingSubject = authenticatedSubjects.find((candidate: SubjectData) => (
      requestedSubject
      && (normalize(candidate.name) === normalize(requestedSubject)
        || normalize(candidate.id) === normalize(requestedSubject))
    ));
    if (matchingSubject) setSubject(matchingSubject.name);
    if (!requestedTopic) return;
    const timer = window.setTimeout(() => {
      const target = graph.nodes.find((node: GraphNode) => normalize(node.name) === normalize(requestedTopic) || normalize(node.id) === normalize(requestedTopic));
      if (!target) return;
      setHighlightedId(target.id);
      setPan({ x: 500 - target.x * 1.3, y: 400 - target.y * 1.3, zoom: 1.3 });
      setPopup({ node: target, ...clampPopup(window.innerWidth - 430, 150) });
      setSearchParams(new URLSearchParams(), { replace: true });
      window.setTimeout(() => setHighlightedId(null), 3000);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [authenticatedSubjects, clampPopup, graph.nodes, searchParams, setSearchParams]);

  const handleNodeClick = (event: React.MouseEvent<SVGGElement>, node: GraphNode) => {
    event.stopPropagation();
    setHighlightedId(node.id);
    const point = clampPopup(event.clientX + 18, event.clientY - 40);
    setPopup({ node, ...point });
  };

  const handleNodeKeyDown = (event: React.KeyboardEvent<SVGGElement>, node: GraphNode) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    setHighlightedId(node.id);
    setPopup({ node, ...clampPopup(window.innerWidth / 2 - 185, 120) });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-popup="true"]')) return;
    setDragging({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPan((current: PanState) => ({ ...current, x: dragging.panX + event.clientX - dragging.x, y: dragging.panY + event.clientY - dragging.y }));
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    setPan((current: PanState) => {
      const nextZoom = clamp(current.zoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.4, 2.5);
      if (!canvas || nextZoom === current.zoom) return { ...current, zoom: nextZoom };
      // Keep the point under the cursor fixed on screen while zooming, in the
      // SVG's 1000x800 viewBox space, instead of always zooming toward the
      // fixed top-left origin — that made scrolling feel like it jumped to
      // the wrong spot the further the cursor was from the corner.
      const rect = canvas.getBoundingClientRect();
      const svgX = ((event.clientX - rect.left) / rect.width) * 1000;
      const svgY = ((event.clientY - rect.top) / rect.height) * 800;
      const contentX = (svgX - current.x) / current.zoom;
      const contentY = (svgY - current.y) / current.zoom;
      return { x: svgX - contentX * nextZoom, y: svgY - contentY * nextZoom, zoom: nextZoom };
    });
  };

  const selectedPopupTier = popup ? tierForScore(popup.node.memoryScore) : null;

  return (
    <div className="flex h-dvh max-h-full flex-col overflow-hidden text-foreground" style={{ background: 'radial-gradient(circle at 15% 10%, rgba(234,169,60,.15), transparent 30%), radial-gradient(circle at 85% 85%, rgba(24,102,54,.12), transparent 34%), linear-gradient(135deg,#F6ECDC,#EDE4D4)' }}>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-border bg-card px-5 py-3 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3 rounded-full bg-secondary px-4 py-2 text-secondary-foreground">
          <span className="text-xl">{subjectsData[subject]?.icon ?? '🧠'}</span>
          <Label className="font-bold">Concept Web</Label>
        </div>
        <Select value={subject} onValueChange={(value: string) => { setSubject(value); setPopup(null); setHighlightedId(null); setPan({ x: 0, y: 0, zoom: 1 }); }}>
          <SelectTrigger className="w-[220px] rounded-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(subjectsData).filter(([name]: [string, SubjectEntry]) => Boolean(name)).map(([name, entry]: [string, SubjectEntry]) => (
              <SelectItem key={name} value={name}>{entry.icon} {name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Select value="" onValueChange={handleFindFriend}>
          <SelectTrigger className="w-[190px] rounded-full bg-card" aria-label="Find your friend">
            <Users className="h-4 w-4 shrink-0" />
            <SelectValue placeholder="Find your friend" />
          </SelectTrigger>
          <SelectContent>
            {squadMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>{member.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-sm">
          {weakOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <Label htmlFor="weak-toggle" className="font-semibold">Show weak topics only</Label>
          <Switch id="weak-toggle" checked={weakOnly} onCheckedChange={setWeakOnly} />
        </div>
      </div>

      <div ref={canvasRef} className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)} onWheel={handleWheel} onClick={(event: React.MouseEvent<HTMLDivElement>) => { if (!(event.target as Element).closest('[data-node="true"], [data-popup="true"]')) setPopup(null); }}>
        <svg viewBox="0 0 1000 800" className="h-full w-full select-none">
          <defs>
            <filter id="node-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#1D3A62" floodOpacity="0.18" /></filter>
          </defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.zoom})`}>
            {graph.links.map((link: GraphLink, index: number) => (
              <motion.line key={`${link.from.id}-${link.to.id}-${index}`} x1={link.from.x} y1={link.from.y} x2={link.to.x} y2={link.to.y} stroke={link.dashed ? '#EAA93C' : '#C4B9A8'} strokeWidth={link.dashed ? 3 : 2.5} strokeOpacity={link.dashed ? 0.8 : 0.45} strokeDasharray={link.dashed ? '8 5' : undefined} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: index * 0.02, ease: 'easeOut' as const }} />
            ))}
            {graph.nodes.map((node: GraphNode) => {
              const greyed = weakOnly && node.memoryScore !== null && node.memoryScore >= 70;
              const tier = tierForScore(node.memoryScore);
              const scoreLabel = node.memoryScore === null ? 'Not Started' : `memory score ${node.memoryScore}%`;
              const highlighted = highlightedId === node.id;
              const lines = wrapText(node.name);
              const friendMarkers = friendMarkersByNodeId[node.id] ?? [];
              const inViewport = node.x * pan.zoom + pan.x > -120 && node.x * pan.zoom + pan.x < 1120 && node.y * pan.zoom + pan.y > -120 && node.y * pan.zoom + pan.y < 920;
              const activated = !prefersReducedMotion && (
                hoveredNodeId === node.id
                || (node.kind === 'topic' && hoveredNodeId === normalize(subject))
                || (node.kind === 'subconcept' && hoveredNodeId === node.parentId)
              );
              return (
                <motion.g key={node.id} data-node="true" role="button" tabIndex={0} aria-label={`${node.name}, ${scoreLabel}`} onClick={(event: React.MouseEvent<SVGGElement>) => handleNodeClick(event, node)} onKeyDown={(event: React.KeyboardEvent<SVGGElement>) => handleNodeKeyDown(event, node)} onMouseEnter={() => setHoveredNodeId(node.id)} onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))} initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: greyed ? 0.35 : 1, scale: highlighted ? 1.15 : activated ? 1.22 : 1, y: prefersReducedMotion ? 0 : [0, -4, 0, 4, 0] }} transition={{ opacity: { duration: 0.25, delay: node.index * 0.04 }, scale: activated ? { type: 'spring' as const, stiffness: 380, damping: 10 } : { duration: 0.25 }, y: prefersReducedMotion ? { duration: 0 } : { duration: 5 + (node.index % 3), repeat: Infinity, ease: 'easeInOut' as const, delay: node.index * 0.12 } }} style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                  {node.kind === 'subject' && <circle cx={node.x} cy={node.y} r={node.r + 14} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.45" />}
                  {highlighted && <><circle cx={node.x} cy={node.y} r={node.r + 16} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.9" /><circle cx={node.x} cy={node.y} r={node.r + 9} fill="none" stroke="#186636" strokeWidth="3" opacity="0.9" /></>}
                  <circle cx={node.x} cy={node.y} r={node.r} fill={tier.fill} stroke={highlighted ? '#186636' : node.kind === 'subject' ? '#EAA93C' : tier.stroke} strokeWidth={highlighted ? 4 : node.kind === 'subject' ? 5 : 2.5} filter="url(#node-shadow)" />
                  <ellipse cx={node.x - node.r * 0.25} cy={node.y - node.r * 0.28} rx={node.r * 0.38} ry={node.r * 0.16} fill="#FFFFFF" opacity="0.15" />
                  {node.kind === 'subject' && <text x={node.x} y={node.y - 18} textAnchor="middle" fontSize="30">{subjectsData[subject]?.icon ?? '🧠'}</text>}
                  {lines.map((line: string, lineIndex: number) => <text key={line} x={node.x} y={node.y + (node.kind === 'subject' ? 12 : 0) + (lineIndex - (lines.length - 1) / 2) * (node.r > 35 ? 16 : 12)} textAnchor="middle" dominantBaseline="middle" fill={tier.text} fontWeight="800" fontSize={node.r > 50 ? 18 : node.r > 35 ? 13 : 10}>{line}</text>)}
                  {node.memoryScore === null && <text x={node.x} y={node.y + node.r + 16} textAnchor="middle" fill="#6B7280" fontWeight="800" fontSize="11">Not Started</text>}
                  {node.kind !== 'subject' && friendMarkers.length > 0 && inViewport && (
                    <ConceptNodeFriendMarkers
                      nodeId={node.id}
                      nodeCenter={{ x: node.x, y: node.y }}
                      nodeRadius={node.r}
                      subject={node.subject}
                      topic={node.name}
                      friends={friendMarkers}
                      zoom={pan.zoom}
                      onIconPress={(memberId: string) => handleFriendMarkerPress(memberId, node.subject, node.name)}
                    />
                  )}
                </motion.g>
              );
            })}
          </g>
        </svg>

        <div className="absolute bottom-5 left-5 w-[300px] rounded-3xl bg-card p-4 text-card-foreground shadow-xl">
          <p className="mb-3 font-bold">Legend</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[{ c: '#186636', t: '70%+ Strong' }, { c: '#EAA93C', t: '40–69 Review' }, { c: '#D9534F', t: '0–39 Weak' }, { c: '#9CA3AF', t: 'Not Started' }].map((item: { c: string; t: string }) => <div key={item.t} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.c }} />{item.t}</div>)}
          </div>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground"><p>— solid: branch link</p><p>- - dashed: cross-topic link</p><p>Click any bubble. Drag to pan, scroll to zoom.</p></div>
        </div>

        <div className="absolute bottom-5 right-5 flex flex-col gap-2">
          <Button aria-label="Zoom in" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom + 0.2, 0.4, 2.5) }))}><Plus className="h-4 w-4" /></Button>
          <Button aria-label="Zoom out" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom - 0.2, 0.4, 2.5) }))}><Minus className="h-4 w-4" /></Button>
          <Button aria-label="Reset concept map" size="icon" variant="secondary" className="rounded-full" onClick={() => setPan({ x: 0, y: 0, zoom: 1 })}><RotateCcw className="h-4 w-4" /></Button>
        </div>

        {popup && selectedPopupTier && (
          <motion.div data-popup="true" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' as const }} className="absolute max-h-[calc(100vh-6.5rem)] w-[calc(100vw-2rem)] max-w-[370px] overflow-y-auto rounded-3xl bg-card text-card-foreground shadow-2xl" style={{ left: popup.x, top: popup.y }}>
            <div className="bg-gradient-to-r from-[#186636] to-[#1a7a3d] p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div><Badge className={`mb-3 border-0 ${popup.node.kind === 'subject' ? 'bg-secondary text-secondary-foreground' : 'bg-white/20 text-white'}`}>{popup.node.kind === 'subject' ? 'Subject' : popup.node.kind === 'topic' ? 'Main Topic' : 'Sub-concept'}</Badge><h2 className="text-2xl font-black">{popup.node.name}</h2></div>
                <Button aria-label="Close concept details" size="icon-sm" variant="ghost" className="rounded-full text-white hover:bg-white/20" onClick={() => setPopup(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">{popup.node.description}</p>
              <div className="rounded-2xl bg-muted p-4">
                <div className="flex items-center justify-between"><span className="font-bold">Memory score</span><span className="rounded-full px-3 py-1 text-sm font-black" style={{ backgroundColor: selectedPopupTier.fill, color: selectedPopupTier.text }}>{popup.node.memoryScore === null ? 'Not Started' : `${popup.node.memoryScore}%`}</span></div>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">Risk label: {selectedPopupTier.label}</p>
              </div>
              <div className="rounded-2xl border border-[#EAA93C] bg-gradient-to-br from-[#FFF3C4] to-white p-4 text-[#17233A]">
                <div className="mb-2 flex items-center gap-2 font-black"><Link2 className="h-4 w-4" /> Key Connection</div>
                <p className="text-sm">Links to <strong>{popup.node.keyConnection.topic}</strong>: {popup.node.keyConnection.explanation}</p>
              </div>
              <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground shadow-lg" onClick={() => navigate(`/quiz?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(popup.node.parentId ?? popup.node.id)}&concept=${encodeURIComponent(popup.node.id)}`)}><Brain className="mr-2 h-4 w-4" /> Quiz me on this <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
