'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Lightbulb, Link2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { clamp, normalizeConceptLabel as normalize, roundCoordinate } from '@/features/concept-web/graph-utils';

type KeyConnection = { topic: string; explanation: string };
type Topic = { id: string; name: string; memoryScore: number; belowMastery: number; description: string; keyConnection: KeyConnection; subConcepts: Topic[] };
type SubjectEntry = { icon: string; topics: Topic[] };
type NodeKind = 'subject' | 'topic' | 'subconcept';
type GraphNode = Topic & { kind: NodeKind; subject: string; parentId?: string; x: number; y: number; r: number; index: number };
type GraphLink = { from: GraphNode; to: GraphNode };
type PopupState = { node: GraphNode; x: number; y: number };
type PanState = { x: number; y: number; zoom: number };
type TeacherClass = { id: string; name: string; subjects: string[] };
type TopicMisconception = { topicId: string; description: string; percent: number; studentCount: number; example: string };

const teacherClasses: TeacherClass[] = [
  { id: 'sec4e-4a', name: 'Sec 4 Express - 4A', subjects: ['Mathematics', 'Physics'] },
  { id: 'sec4e-4b', name: 'Sec 4 Express - 4B', subjects: ['Mathematics', 'Chemistry'] },
];

const subjectData: Record<string, SubjectEntry> = {
  Mathematics: {
    icon: '📐',
    topics: [
      { id: 'number-and-algebra', name: 'Number & Algebra', memoryScore: 62, belowMastery: 38, description: 'Number operations, standard form, ratio, percentages, algebraic manipulation, formulae, equations, and inequalities.', keyConnection: { topic: 'Graphs & Functions', explanation: 'Algebraic rules and equations become visible when represented as graphs.' }, subConcepts: [
        { id: 'ratio-percentages', name: 'Ratio & Percentages', memoryScore: 64, belowMastery: 36, description: 'Sharing quantities, percentage change, direct and inverse proportion, rates, and scale.', keyConnection: { topic: 'Number Sense', explanation: 'Both topics compare quantities multiplicatively.' }, subConcepts: [] },
        { id: 'algebraic-skills', name: 'Algebraic Skills', memoryScore: 57, belowMastery: 43, description: 'Simplifying, expanding, factorising, substitution, algebraic fractions, and changing formulae.', keyConnection: { topic: 'Equations', explanation: 'Strong manipulation makes solving equations reliable.' }, subConcepts: [] },
        { id: 'equations-inequalities', name: 'Equations & Inequalities', memoryScore: 63, belowMastery: 37, description: 'Linear equations, simultaneous equations, inequalities, and word problems.', keyConnection: { topic: 'Graphs', explanation: 'Solutions can be represented using intersections, regions, or intervals.' }, subConcepts: [] },
      ] },
      { id: 'quadratics-functions-graphs', name: 'Quadratics, Functions & Graphs', memoryScore: 48, belowMastery: 52, description: 'Quadratic equations, function notation, linear and curved graphs, gradients, intercepts, and graph interpretation.', keyConnection: { topic: 'Algebra', explanation: 'Graphs show the behaviour of algebraic relationships.' }, subConcepts: [
        { id: 'factorisation', name: 'Factorisation', memoryScore: 39, belowMastery: 61, description: 'Finding bracket pairs that multiply and add to the required coefficients.', keyConnection: { topic: 'Quadratics', explanation: 'Factorisation is the fastest solving method when clean factor pairs exist.' }, subConcepts: [] },
        { id: 'quadratic-formula', name: 'Quadratic Formula', memoryScore: 45, belowMastery: 55, description: 'Using the formula accurately after identifying a, b, and c.', keyConnection: { topic: 'Substitution', explanation: 'Formula work depends on substituting each coefficient in the correct place.' }, subConcepts: [] },
        { id: 'functions-graphs', name: 'Functions & Graphs', memoryScore: 55, belowMastery: 45, description: 'Function notation, inverse and composite functions, gradients, intercepts, and curve features.', keyConnection: { topic: 'Coordinate Geometry', explanation: 'Graph features are measured using coordinate methods.' }, subConcepts: [] },
      ] },
      { id: 'geometry-measurement', name: 'Geometry & Measurement', memoryScore: 65, belowMastery: 35, description: 'Angles, polygons, circles, congruence, similarity, coordinate geometry, mensuration, and geometric reasoning.', keyConnection: { topic: 'Trigonometry', explanation: 'Angle facts, scale factors, and shape properties support trigonometry setups.' }, subConcepts: [
        { id: 'circle-theorems', name: 'Circle Theorems', memoryScore: 59, belowMastery: 41, description: 'Angles in circles, tangents, cyclic quadrilaterals, and chord properties.', keyConnection: { topic: 'Angle Rules', explanation: 'Circle theorem proofs depend on accurate angle relationships.' }, subConcepts: [] },
        { id: 'similarity-congruence', name: 'Similarity & Congruence', memoryScore: 66, belowMastery: 34, description: 'Proving shapes are congruent or similar and using scale factors.', keyConnection: { topic: 'Ratio', explanation: 'Similar shapes scale corresponding lengths by a constant ratio.' }, subConcepts: [] },
        { id: 'mensuration', name: 'Mensuration', memoryScore: 50, belowMastery: 50, description: 'Perimeter, area, surface area, volume, arc length, sectors, and compound shapes.', keyConnection: { topic: 'Formulae', explanation: 'Mensuration depends on choosing and applying the correct formula.' }, subConcepts: [] },
      ] },
      { id: 'trigonometry-vectors', name: 'Trigonometry & Vectors', memoryScore: 70, belowMastery: 30, description: 'Sine, cosine, tangent, sine rule, cosine rule, area rule, bearings, 3D problems, and vector geometry.', keyConnection: { topic: 'Coordinate Geometry', explanation: 'Both topics describe direction, length, and position in space.' }, subConcepts: [
        { id: 'sine-cosine', name: 'Sine Cosine', memoryScore: 58, belowMastery: 42, description: 'Choosing the correct trig ratio for the known sides.', keyConnection: { topic: 'SOHCAHTOA', explanation: 'The ratio choice comes from matching opposite, adjacent, and hypotenuse.' }, subConcepts: [] },
        { id: 'bearings', name: 'Bearings', memoryScore: 66, belowMastery: 34, description: 'Measuring angles clockwise from north and solving navigation diagrams.', keyConnection: { topic: 'Angle Rules', explanation: 'Bearing questions often use parallel lines and triangle angle sums.' }, subConcepts: [] },
        { id: 'vector-proofs', name: 'Vector Proofs', memoryScore: 79, belowMastery: 21, description: 'Showing parallel lines, collinearity, and ratios using vector expressions.', keyConnection: { topic: 'Algebra', explanation: 'Vector proofs use algebraic simplification to compare directions.' }, subConcepts: [] },
      ] },
      { id: 'statistics-probability', name: 'Statistics & Probability', memoryScore: 60, belowMastery: 40, description: 'Data collection, averages, cumulative frequency, box plots, histograms, scatter diagrams, probability, tree diagrams, and Venn diagrams.', keyConnection: { topic: 'Fractions', explanation: 'Probability and statistics both describe data and uncertainty using numerical summaries.' }, subConcepts: [
        { id: 'data-representation', name: 'Data Representation', memoryScore: 77, belowMastery: 23, description: 'Reading and drawing charts, histograms, box plots, and cumulative frequency curves.', keyConnection: { topic: 'Averages', explanation: 'Graphs provide visual summaries that support statistical measures.' }, subConcepts: [] },
        { id: 'tree-diagrams', name: 'Tree Diagrams', memoryScore: 43, belowMastery: 57, description: 'Multiplying along branches and adding outcomes for combined events.', keyConnection: { topic: 'Combined Events', explanation: 'Tree diagrams organise multi-stage probability.' }, subConcepts: [] },
        { id: 'venn-diagrams', name: 'Venn Diagrams', memoryScore: 49, belowMastery: 51, description: 'Representing sets, intersections, unions, and complements.', keyConnection: { topic: 'Set Language', explanation: 'Venn diagrams turn set notation into visible regions.' }, subConcepts: [] },
      ] },
    ],
  },
  Physics: {
    icon: '⚛️',
    topics: [
      { id: 'physics-measurement', name: 'Physical Quantities, Units & Measurement', memoryScore: 74, belowMastery: 26, description: 'SI units, prefixes, scalar and vector quantities, and practical measurement accuracy.', keyConnection: { topic: 'Experimental Skills', explanation: 'Reliable measurements and units underpin every O-level physics calculation and practical task.' }, subConcepts: [
        { id: 'physics-si-units', name: 'SI Units & Prefixes', memoryScore: 78, belowMastery: 22, description: 'Using base units, derived units, and prefixes such as milli, kilo, and mega.', keyConnection: { topic: 'Physical Quantities', explanation: 'Correct unit conversion keeps formula substitution and final answers consistent.' }, subConcepts: [] },
        { id: 'physics-scalars-vectors', name: 'Scalars & Vectors', memoryScore: 69, belowMastery: 31, description: 'Distinguishing quantities with magnitude only from those with magnitude and direction.', keyConnection: { topic: 'Forces', explanation: 'Resultant force and displacement depend on vector direction.' }, subConcepts: [] },
      ] },
      { id: 'physics-kinematics', name: 'Kinematics', memoryScore: 58, belowMastery: 42, description: 'Speed, velocity, acceleration, and interpreting distance-time and speed-time graphs.', keyConnection: { topic: 'Forces', explanation: 'Motion graphs describe how forces change an object’s speed or direction.' }, subConcepts: [
        { id: 'physics-motion-graphs', name: 'Motion Graphs', memoryScore: 51, belowMastery: 49, description: 'Finding speed, acceleration, and distance from graph gradients and areas.', keyConnection: { topic: 'Gradient & Area', explanation: 'Graph interpretation links mathematical features to physical meaning.' }, subConcepts: [] },
        { id: 'physics-acceleration', name: 'Acceleration', memoryScore: 55, belowMastery: 45, description: 'Calculating change in velocity per unit time with correct signs and units.', keyConnection: { topic: 'Dynamics', explanation: 'Acceleration is the bridge between motion and resultant force.' }, subConcepts: [] },
      ] },
      { id: 'physics-dynamics', name: 'Dynamics', memoryScore: 36, belowMastery: 64, description: 'Forces, resultant force, Newton’s laws, mass, weight, friction, and free-body diagrams.', keyConnection: { topic: 'Kinematics', explanation: 'A non-zero resultant force changes motion, which appears as acceleration on graphs.' }, subConcepts: [

        { id: 'physics-resultant-force', name: 'Resultant Force', memoryScore: 34, belowMastery: 66, description: 'Combining forces to decide whether an object accelerates, decelerates, or stays at constant velocity.', keyConnection: { topic: 'Newton’s Laws', explanation: 'Newton’s second law links resultant force directly to acceleration.' }, subConcepts: [] },
        { id: 'physics-free-body-diagrams', name: 'Free-body Diagrams', memoryScore: 39, belowMastery: 61, description: 'Representing all forces acting on an object using labelled arrows.', keyConnection: { topic: 'Resultant Force', explanation: 'Accurate force diagrams make it possible to find the net force correctly.' }, subConcepts: [] },
      ] },
      { id: 'physics-moments-pressure', name: 'Moments & Pressure', memoryScore: 43, belowMastery: 57, description: 'Turning effects, principle of moments, centre of gravity, pressure in solids and fluids.', keyConnection: { topic: 'Forces', explanation: 'Moments and pressure both describe how forces act through distance or area.' }, subConcepts: [
        { id: 'physics-principle-moments', name: 'Principle of Moments', memoryScore: 41, belowMastery: 59, description: 'Balancing clockwise and anticlockwise moments about a pivot.', keyConnection: { topic: 'Equilibrium', explanation: 'Balanced moments explain why objects remain rotationally stable.' }, subConcepts: [] },
        { id: 'physics-pressure', name: 'Pressure', memoryScore: 46, belowMastery: 54, description: 'Using pressure = force / area and explaining pressure changes in liquids.', keyConnection: { topic: 'Force Distribution', explanation: 'Pressure depends on how a force is spread across a surface.' }, subConcepts: [] },
      ] },
      { id: 'physics-energy', name: 'Energy, Work & Power', memoryScore: 63, belowMastery: 37, description: 'Energy stores and transfers, work done, power, efficiency, and conservation of energy.', keyConnection: { topic: 'Forces & Motion', explanation: 'Work done links force and distance to energy transfer.' }, subConcepts: [
        { id: 'physics-work-done', name: 'Work Done', memoryScore: 59, belowMastery: 41, description: 'Calculating work done when a force moves an object through a distance.', keyConnection: { topic: 'Energy Transfer', explanation: 'Work done is a measure of energy transferred by a force.' }, subConcepts: [] },
        { id: 'physics-efficiency', name: 'Efficiency', memoryScore: 67, belowMastery: 33, description: 'Comparing useful energy output with total energy input.', keyConnection: { topic: 'Power', explanation: 'Efficiency and power together evaluate how effectively energy is used over time.' }, subConcepts: [] },
      ] },
      { id: 'physics-thermal', name: 'Thermal Physics', memoryScore: 47, belowMastery: 53, description: 'Kinetic particle model, temperature, heat capacity, latent heat, and thermal transfer.', keyConnection: { topic: 'Energy', explanation: 'Heating is an energy transfer that changes particle motion or state.' }, subConcepts: [
        { id: 'physics-heat-capacity', name: 'Heat Capacity', memoryScore: 44, belowMastery: 56, description: 'Using energy, mass, specific heat capacity, and temperature change.', keyConnection: { topic: 'Energy Transfer', explanation: 'Specific heat capacity quantifies energy needed for temperature change.' }, subConcepts: [] },
        { id: 'physics-latent-heat', name: 'Latent Heat', memoryScore: 49, belowMastery: 51, description: 'Energy transfer during changes of state without temperature change.', keyConnection: { topic: 'Kinetic Particle Model', explanation: 'Latent heat changes particle separation rather than average kinetic energy.' }, subConcepts: [] },
      ] },
      { id: 'physics-waves', name: 'Waves', memoryScore: 70, belowMastery: 30, description: 'Wave properties, reflection, refraction, electromagnetic waves, and sound.', keyConnection: { topic: 'Light', explanation: 'Reflection and refraction explain how light transfers energy and information.' }, subConcepts: [
        { id: 'physics-wave-equation', name: 'Wave Equation', memoryScore: 72, belowMastery: 28, description: 'Using wave speed = frequency × wavelength with consistent units.', keyConnection: { topic: 'Frequency & Wavelength', explanation: 'The equation connects wave timing to wave spacing.' }, subConcepts: [] },
        { id: 'physics-refraction', name: 'Refraction', memoryScore: 66, belowMastery: 34, description: 'Explaining bending of waves when speed changes between media.', keyConnection: { topic: 'Wave Speed', explanation: 'Direction changes when wave speed changes at a boundary.' }, subConcepts: [] },
      ] },
      { id: 'physics-electricity', name: 'Electricity & Magnetism', memoryScore: 52, belowMastery: 48, description: 'Current, potential difference, resistance, circuits, electromagnetism, and electromagnetic induction.', keyConnection: { topic: 'Energy Transfer', explanation: 'Electrical circuits transfer energy through moving charges.' }, subConcepts: [
        { id: 'physics-circuit-rules', name: 'Circuit Rules', memoryScore: 50, belowMastery: 50, description: 'Applying current and potential difference rules in series and parallel circuits.', keyConnection: { topic: 'Resistance', explanation: 'Circuit rules explain how components share current and voltage.' }, subConcepts: [] },
        { id: 'physics-electromagnetic-induction', name: 'Electromagnetic Induction', memoryScore: 45, belowMastery: 55, description: 'Inducing e.m.f. with changing magnetic fields and explaining generator action.', keyConnection: { topic: 'Magnetism', explanation: 'Changing magnetic fields convert mechanical energy into electrical energy.' }, subConcepts: [] },
      ] },
    ],
  },
  Chemistry: {
    icon: '⚗️',
    topics: [
      { id: 'chemistry-atomic-structure', name: 'Atomic Structure', memoryScore: 71, belowMastery: 29, description: 'Protons, neutrons, electrons, isotopes, electronic configuration, and periodic trends.', keyConnection: { topic: 'Chemical Bonding', explanation: 'Outer-shell electrons determine how atoms form ions and covalent bonds.' }, subConcepts: [
        { id: 'chemistry-electronic-configuration', name: 'Electronic Configuration', memoryScore: 68, belowMastery: 32, description: 'Arranging electrons in shells and relating the arrangement to group and period.', keyConnection: { topic: 'Periodic Table', explanation: 'Electron shells explain an element’s position and reactivity.' }, subConcepts: [] },
        { id: 'chemistry-isotopes', name: 'Isotopes', memoryScore: 74, belowMastery: 26, description: 'Atoms of one element with the same proton number but different neutron numbers.', keyConnection: { topic: 'Relative Atomic Mass', explanation: 'Relative atomic mass is a weighted average of isotope masses.' }, subConcepts: [] },
      ] },
      { id: 'chemistry-bonding', name: 'Chemical Bonding', memoryScore: 38, belowMastery: 62, description: 'Ionic, covalent, and metallic bonding and how structure determines physical properties.', keyConnection: { topic: 'Atomic Structure', explanation: 'Bond formation depends on valence electrons and stable electron arrangements.' }, subConcepts: [
        { id: 'chemistry-ionic-bonding', name: 'Ionic Bonding', memoryScore: 33, belowMastery: 67, description: 'Electron transfer and electrostatic attraction between oppositely charged ions.', keyConnection: { topic: 'Electrolysis', explanation: 'Mobile ions carry charge when ionic substances are molten or aqueous.' }, subConcepts: [] },
        { id: 'chemistry-covalent-bonding', name: 'Covalent Bonding', memoryScore: 42, belowMastery: 58, description: 'Shared electron pairs in simple molecules and giant covalent structures.', keyConnection: { topic: 'Structure & Properties', explanation: 'Bond arrangement explains melting point, hardness, and conductivity.' }, subConcepts: [] },
      ] },
      { id: 'chemistry-stoichiometry', name: 'Moles & Stoichiometry', memoryScore: 49, belowMastery: 51, description: 'Formula masses, mole ratios, reacting masses, solution concentration, and gas volumes.', keyConnection: { topic: 'Chemical Equations', explanation: 'Balanced equations supply the ratios used in quantitative calculations.' }, subConcepts: [
        { id: 'chemistry-mole-ratios', name: 'Mole Ratios', memoryScore: 44, belowMastery: 56, description: 'Using balanced equations to relate amounts of reactants and products.', keyConnection: { topic: 'Reacting Masses', explanation: 'Mole ratios convert a known quantity into the required product or reactant.' }, subConcepts: [] },
        { id: 'chemistry-concentration', name: 'Concentration', memoryScore: 53, belowMastery: 47, description: 'Calculating amount per unit volume with consistent units.', keyConnection: { topic: 'Titration', explanation: 'Titration combines reacting ratios with measured volumes and concentrations.' }, subConcepts: [] },
      ] },
      { id: 'chemistry-acids', name: 'Acids, Bases & Salts', memoryScore: 64, belowMastery: 36, description: 'Acid and base behaviour, pH, neutralisation, and methods of preparing salts.', keyConnection: { topic: 'Ions', explanation: 'Hydrogen and hydroxide ions explain acidity, alkalinity, and neutralisation.' }, subConcepts: [
        { id: 'chemistry-neutralisation', name: 'Neutralisation', memoryScore: 67, belowMastery: 33, description: 'Reactions in which hydrogen ions and hydroxide ions form water.', keyConnection: { topic: 'Ionic Equations', explanation: 'The net ionic equation exposes the particles that actually react.' }, subConcepts: [] },
        { id: 'chemistry-salt-preparation', name: 'Salt Preparation', memoryScore: 57, belowMastery: 43, description: 'Selecting precipitation, titration, or excess-solid methods for different salts.', keyConnection: { topic: 'Solubility', explanation: 'Solubility determines the suitable preparation and separation method.' }, subConcepts: [] },
      ] },
      { id: 'chemistry-electrolysis', name: 'Electrolysis', memoryScore: 35, belowMastery: 65, description: 'Movement and discharge of ions at electrodes in molten and aqueous electrolytes.', keyConnection: { topic: 'Redox', explanation: 'Oxidation and reduction occur simultaneously at opposite electrodes.' }, subConcepts: [
        { id: 'chemistry-electrode-products', name: 'Electrode Products', memoryScore: 31, belowMastery: 69, description: 'Predicting products using ion charge, reactivity, and electrolyte concentration.', keyConnection: { topic: 'Selective Discharge', explanation: 'Competing ions are discharged according to chemical conditions.' }, subConcepts: [] },
        { id: 'chemistry-half-equations', name: 'Half-equations', memoryScore: 39, belowMastery: 61, description: 'Representing electron loss and gain at each electrode.', keyConnection: { topic: 'Redox', explanation: 'Electrons make oxidation and reduction changes explicit.' }, subConcepts: [] },
      ] },
    ],
  },
};

const topicMisconceptions: TopicMisconception[] = [
  { topicId: 'quadratic-equations', description: 'Sign error moving terms across the equals sign', percent: 34, studentCount: 17, example: 'x² + 5x + 6 = 0 should be x² - 5x + 6 = 0' },
  { topicId: 'quadratic-equations', description: 'Incorrect factorisation pairs', percent: 27, studentCount: 13, example: '(x + 1)(x + 6) = 0 for x² + 5x + 6' },
  { topicId: 'quadratic-equations', description: 'Wrong substitution into quadratic formula', percent: 21, studentCount: 10, example: 'Swapped b and c.' },
  { topicId: 'factorisation', description: 'Incorrect factorisation pairs', percent: 27, studentCount: 13, example: '(x + 1)(x + 6) = 0 for x² + 5x + 6' },
  { topicId: 'quadratic-formula', description: 'Wrong substitution into quadratic formula', percent: 21, studentCount: 10, example: 'Swapped b and c.' },
  { topicId: 'sign-changes', description: 'Sign error moving terms across the equals sign', percent: 34, studentCount: 17, example: 'Term sign changed in the wrong direction.' },
  { topicId: 'physics-dynamics', description: 'Treating motion direction as the same as resultant force direction', percent: 38, studentCount: 19, example: 'Object moving right must have a force to the right, even at constant speed.' },
  { topicId: 'physics-resultant-force', description: 'Adding opposing forces instead of subtracting them', percent: 33, studentCount: 16, example: '10 N right and 6 N left recorded as 16 N resultant.' },
  { topicId: 'physics-motion-graphs', description: 'Confusing gradient with area under the graph', percent: 31, studentCount: 15, example: 'Used area under a distance-time graph to find distance.' },
  { topicId: 'physics-principle-moments', description: 'Forgetting perpendicular distance from pivot', percent: 29, studentCount: 14, example: 'Used full object length instead of distance from pivot to force.' },
  { topicId: 'physics-electromagnetic-induction', description: 'Missing that a changing magnetic field is required', percent: 26, studentCount: 12, example: 'Expected induced e.m.f. with a stationary magnet and stationary coil.' },
  { topicId: 'chemistry-bonding', description: 'Using intermolecular forces to explain ionic melting points', percent: 36, studentCount: 18, example: 'Described weak forces between sodium chloride molecules.' },
  { topicId: 'chemistry-ionic-bonding', description: 'Showing shared electrons instead of electron transfer', percent: 32, studentCount: 16, example: 'Drew a shared pair between sodium and chlorine.' },
  { topicId: 'chemistry-electrolysis', description: 'Reversing the ions attracted to each electrode', percent: 35, studentCount: 17, example: 'Moved positive ions towards the positive electrode.' },
  { topicId: 'chemistry-electrode-products', description: 'Ignoring competing hydrogen and hydroxide ions in aqueous solutions', percent: 29, studentCount: 14, example: 'Predicted sodium metal from aqueous sodium chloride.' },
  { topicId: 'chemistry-half-equations', description: 'Balancing atoms but not electrical charge', percent: 24, studentCount: 12, example: 'Wrote Cu²⁺ → Cu without adding electrons.' },
];

const tierForScore = (score: number) => {
  if (score >= 70) return { fill: '#186636', stroke: '#0F4A24', text: '#FFFFFF', label: 'Majority strong' };
  if (score >= 40) return { fill: '#EAA93C', stroke: '#D99A2F', text: '#17233A', label: 'Mixed mastery' };
  if (score > 0) return { fill: '#D9534F', stroke: '#C0392B', text: '#FFFFFF', label: 'Majority weak' };
  return { fill: '#9CA3AF', stroke: '#6B7280', text: '#FFFFFF', label: 'Greyed' };
};

const wrapText = (label: string, radius = 34): string[] => {
  const maxChars = radius >= 58 ? 12 : radius >= 44 ? 10 : 8;
  const words = label.replace(' and ', ' & ').split(' ');
  const lines: string[] = [];
  let currentLine = '';
  words.forEach((word: string) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3);
};

export default function TeacherConceptWebView() {
  const [classId, setClassId] = useState(teacherClasses[0].id);
  const selectedClass = teacherClasses.find((teacherClass: TeacherClass) => teacherClass.id === classId) ?? teacherClasses[0];
  const [subject, setSubject] = useState(selectedClass.subjects[0]);
  const [weakOnly, setWeakOnly] = useState(false);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  const graph = useMemo(() => {
    const entry = subjectData[subject] ?? subjectData.Mathematics;
    const average = Math.round(entry.topics.reduce((sum: number, topic: Topic) => sum + topic.memoryScore, 0) / entry.topics.length);
    const center = { x: 600, y: 500 };
    const topicDistance = 245;
    const subDistance = 445;
    const nodes: GraphNode[] = [{ id: normalize(subject), name: subject, memoryScore: average, belowMastery: 100 - average, description: `${selectedClass.name} class concept map for ${subject}.`, keyConnection: { topic: entry.topics[0].name, explanation: `${entry.topics[0].name} is the first branch to review for this class.` }, kind: 'subject', subject, x: center.x, y: center.y, r: 62, index: 0, subConcepts: [] }];
    const links: GraphLink[] = [];
    entry.topics.forEach((topic: Topic, topicIndex: number) => {
      const angle = -Math.PI / 2 + topicIndex * ((Math.PI * 2) / entry.topics.length);
      const topicNode: GraphNode = { ...topic, kind: 'topic', subject, x: roundCoordinate(center.x + Math.cos(angle) * topicDistance), y: roundCoordinate(center.y + Math.sin(angle) * topicDistance), r: 48, index: nodes.length };
      nodes.push(topicNode);
      links.push({ from: nodes[0], to: topicNode });
      topic.subConcepts.forEach((concept: Topic, conceptIndex: number) => {
        const spread = Math.PI / 7;
        const subAngle = angle - spread / 2 + (spread / Math.max(1, topic.subConcepts.length - 1)) * conceptIndex;
        const subNode: GraphNode = { ...concept, kind: 'subconcept', subject, parentId: topic.id, x: roundCoordinate(center.x + Math.cos(subAngle) * subDistance), y: roundCoordinate(center.y + Math.sin(subAngle) * subDistance), r: 34, index: nodes.length };
        nodes.push(subNode);
        links.push({ from: topicNode, to: subNode });
      });
    });
    return { nodes, links };
  }, [selectedClass.name, subject]);

  const clampPopup = (x: number, y: number) => ({
    x: clamp(x, 16, Math.max(16, window.innerWidth - 390)),
    y: clamp(y, 88, Math.max(88, window.innerHeight - 430)),
  });
  const handleNodeClick = (event: React.MouseEvent<SVGGElement>, node: GraphNode) => {
    event.stopPropagation();
    setHighlightedId(node.id);
    setPopup({ node, ...clampPopup(event.clientX + 18, event.clientY - 40) });
  };
  const handleNodeKeyDown = (event: React.KeyboardEvent<SVGGElement>, node: GraphNode) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    setHighlightedId(node.id);
    setPopup({ node, ...clampPopup(window.innerWidth / 2 - 185, 120) });
  };
  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-popup="true"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  };
  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPan((current: PanState) => ({ ...current, x: dragging.panX + event.clientX - dragging.x, y: dragging.panY + event.clientY - dragging.y }));
  };
  const selectedPopupTier = popup ? tierForScore(popup.node.memoryScore) : null;
  const misconceptions = popup ? topicMisconceptions.filter((item: TopicMisconception) => item.topicId === popup.node.id).sort((first: TopicMisconception, second: TopicMisconception) => second.percent - first.percent) : [];
  const isRedTopic = popup ? popup.node.memoryScore < 40 && popup.node.kind !== 'subject' : false;
  const rankedInsightTopics = graph.nodes
    .filter((node: GraphNode) => node.kind !== 'subject' && topicMisconceptions.some((mistake: TopicMisconception) => mistake.topicId === node.id))
    .map((node: GraphNode) => {
      const mistakes = topicMisconceptions.filter((mistake: TopicMisconception) => mistake.topicId === node.id).sort((first: TopicMisconception, second: TopicMisconception) => second.percent - first.percent);
      const totalAffected = mistakes.reduce((sum: number, mistake: TopicMisconception) => sum + mistake.studentCount, 0);
      return { node, mistakes, topMistake: mistakes[0], totalAffected };
    })
    .filter((insight: { node: GraphNode; mistakes: TopicMisconception[]; topMistake: TopicMisconception | undefined; totalAffected: number }) => insight.topMistake)
    .sort((first: { node: GraphNode; mistakes: TopicMisconception[]; topMistake: TopicMisconception | undefined; totalAffected: number }, second: { node: GraphNode; mistakes: TopicMisconception[]; topMistake: TopicMisconception | undefined; totalAffected: number }) => second.totalAffected - first.totalAffected)
    .slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="z-20 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-5 text-card-foreground">
        <div>
          <h1 className="text-2xl font-black text-primary">Class Concept Web</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Explore class mastery, weak topics, and common misconceptions.
          </p>
        </div>
        <Badge className="border border-primary/35 bg-primary/15 text-primary">
          Demonstration data
        </Badge>
      </div>
      <div className="z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 text-card-foreground shadow-sm sm:gap-4 sm:px-5">
        <Select value={classId} onValueChange={(value: string) => { const nextClass = teacherClasses.find((teacherClass: TeacherClass) => teacherClass.id === value) ?? teacherClasses[0]; setClassId(nextClass.id); setSubject(nextClass.subjects[0]); setPopup(null); setPan({ x: 0, y: 0, zoom: 1 }); }}>
          <SelectTrigger className="w-full rounded-full bg-card sm:w-[230px]"><SelectValue /></SelectTrigger>
          <SelectContent className="border-[#31445e] bg-[#1b2a40] text-[#fffaf0]">{teacherClasses.filter((teacherClass: TeacherClass) => teacherClass.id).map((teacherClass: TeacherClass) => <SelectItem key={teacherClass.id} value={teacherClass.id}>{teacherClass.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subject} onValueChange={(value: string) => { setSubject(value); setPopup(null); setPan({ x: 0, y: 0, zoom: 1 }); }}>
          <SelectTrigger className="w-full rounded-full bg-card sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent className="border-[#31445e] bg-[#1b2a40] text-[#fffaf0]">{selectedClass.subjects.filter((subjectName: string) => subjectName).map((subjectName: string) => <SelectItem key={subjectName} value={subjectName}>{subjectData[subjectName]?.icon ?? '📘'} {subjectName}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex-1" />
        <div className="flex w-full items-center justify-between gap-3 rounded-full bg-card px-4 py-2 shadow-sm sm:w-auto sm:justify-start">
          {weakOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <Label htmlFor="weak-toggle" className="font-semibold">Show weak topics only</Label>
          <Switch id="weak-toggle" checked={weakOnly} onCheckedChange={setWeakOnly} />
        </div>
      </div>
      <div className="relative min-h-[640px] flex-1 touch-none cursor-grab overflow-hidden active:cursor-grabbing lg:min-h-0" onPointerDown={handleCanvasPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)} onWheel={(event: React.WheelEvent<HTMLDivElement>) => { event.preventDefault(); setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.4, 2.5) })); }} onClick={(event: React.MouseEvent<HTMLDivElement>) => { if (!(event.target as Element).closest('[data-node="true"], [data-popup="true"]')) setPopup(null); }}>
        <svg viewBox="0 0 1200 1000" className="h-full w-full select-none">
          <defs><filter id="teacher-student-node-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#1D3A62" floodOpacity="0.18" /></filter></defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.zoom})`}>
            {graph.links.map((link: GraphLink, index: number) => <motion.line key={`${link.from.id}-${link.to.id}-${index}`} x1={link.from.x} y1={link.from.y} x2={link.to.x} y2={link.to.y} stroke="#C4B9A8" strokeWidth={link.from.kind === 'subject' ? 3 : 2.25} strokeOpacity={link.from.kind === 'subject' ? 0.62 : 0.42} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: index * 0.018, ease: 'easeOut' as const }} />)}
            {graph.nodes.map((node: GraphNode) => {
              const tier = tierForScore(weakOnly && node.memoryScore >= 70 ? 0 : node.memoryScore);
              const greyed = weakOnly && node.memoryScore >= 70;
              const highlighted = highlightedId === node.id;
              const lines = wrapText(node.name, node.r);
              return (
                <motion.g key={node.id} data-node="true" role="button" tabIndex={0} aria-label={`${node.name}, ${node.memoryScore}% class mastery`} onClick={(event: React.MouseEvent<SVGGElement>) => handleNodeClick(event, node)} onKeyDown={(event: React.KeyboardEvent<SVGGElement>) => handleNodeKeyDown(event, node)} initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: greyed ? 0.35 : 1, scale: highlighted ? 1.1 : 1 }} transition={{ opacity: { duration: 0.2, delay: node.index * 0.025 }, scale: { duration: 0.2 } }} style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                  {node.kind === 'subject' && <circle cx={node.x} cy={node.y} r={node.r + 14} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.45" />}
                  {highlighted && <><circle cx={node.x} cy={node.y} r={node.r + 14} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.9" /><circle cx={node.x} cy={node.y} r={node.r + 7} fill="none" stroke="#186636" strokeWidth="3" opacity="0.9" /></>}
                  <circle cx={node.x} cy={node.y} r={node.r} fill={tier.fill} stroke={highlighted ? '#186636' : node.kind === 'subject' ? '#EAA93C' : tier.stroke} strokeWidth={highlighted ? 4 : node.kind === 'subject' ? 5 : 2.5} filter="url(#teacher-student-node-shadow)" />
                  <ellipse cx={node.x - node.r * 0.25} cy={node.y - node.r * 0.28} rx={node.r * 0.38} ry={node.r * 0.16} fill="#FFFFFF" opacity="0.15" />
                  {node.kind === 'subject' && <text x={node.x} y={node.y - 18} textAnchor="middle" fontSize="30">{subjectData[subject]?.icon ?? '📘'}</text>}
                  {lines.map((line: string, lineIndex: number) => <text key={`${node.id}-${line}-${lineIndex}`} x={node.x} y={node.y + (node.kind === 'subject' ? 12 : 0) + (lineIndex - (lines.length - 1) / 2) * (node.r >= 44 ? 14 : 11)} textAnchor="middle" dominantBaseline="middle" fill={tier.text} fontWeight="800" fontSize={node.r >= 58 ? 16 : node.r >= 44 ? 11.5 : 9}>{line}</text>)}
                </motion.g>
              );
            })}
          </g>
        </svg>
        <div className="absolute right-5 top-5 z-20" data-popup="true">
          <Button aria-expanded={showInsights} className="rounded-full bg-primary text-primary-foreground shadow-xl" onClick={() => setShowInsights((current: boolean) => !current)}>
            <Lightbulb className="mr-2 h-4 w-4" /> Key insights
          </Button>
        </div>
        {showInsights && (
          <motion.div data-popup="true" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, ease: 'easeOut' as const }} className="absolute right-4 top-20 z-20 max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] max-w-[360px] overflow-y-auto rounded-3xl bg-card p-5 text-card-foreground shadow-2xl sm:right-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-muted-foreground">Teacher summary</p>
                <h2 className="text-xl font-black">Top 3 misconception topics</h2>
              </div>
              <Button aria-label="Close key insights" size="icon-sm" variant="ghost" className="rounded-full" onClick={() => setShowInsights(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3">
              {rankedInsightTopics.map((insight: { node: GraphNode; mistakes: TopicMisconception[]; topMistake: TopicMisconception | undefined; totalAffected: number }, index: number) => insight.topMistake && (
                <div key={insight.node.id} className="rounded-2xl bg-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{index + 1}. {insight.node.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{insight.totalAffected} student misconception reports · {insight.mistakes.length} patterns</p>
                    </div>
                    <Badge variant="secondary">{insight.topMistake.percent}%</Badge>
                  </div>
                  <p className="mt-3 text-sm font-bold">Most common misconception: {insight.topMistake.description}.</p>
                  <p className="mt-2 rounded-xl bg-card p-3 text-sm text-card-foreground">Example: {insight.topMistake.example}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Review back: model the error, compare it with the correct step, then give one short retrieval question before practice.</p>
                </div>
              ))}
              {rankedInsightTopics.length === 0 && <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No misconception hotspots for this class and subject yet.</p>}
            </div>
          </motion.div>
        )}
        <div className="absolute bottom-5 right-5 z-10 flex flex-col gap-2" data-popup="true">
          <Button aria-label="Zoom in" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom + 0.2, 0.4, 2.5) }))}><Plus className="h-4 w-4" /></Button>
          <Button aria-label="Zoom out" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom - 0.2, 0.4, 2.5) }))}><Minus className="h-4 w-4" /></Button>
          <Button aria-label="Reset class concept map" size="icon" variant="secondary" className="rounded-full" onClick={() => setPan({ x: 0, y: 0, zoom: 1 })}><RotateCcw className="h-4 w-4" /></Button>
        </div>
        {popup && selectedPopupTier && (
          <motion.div data-popup="true" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' as const }} className="absolute max-h-[calc(100vh-6.5rem)] w-[calc(100vw-2rem)] max-w-[370px] overflow-y-auto rounded-3xl bg-card text-card-foreground shadow-2xl" style={{ left: popup.x, top: popup.y }}>
            <div className="bg-gradient-to-r from-[#186636] to-[#1a7a3d] p-5 text-white"><div className="flex items-start justify-between gap-3"><div><Badge className={`mb-3 border-0 ${popup.node.kind === 'subject' ? 'bg-secondary text-secondary-foreground' : 'bg-white/20 text-white'}`}>{popup.node.kind === 'subject' ? 'Subject' : popup.node.kind === 'topic' ? 'Main Topic' : 'Sub-concept'}</Badge><h2 className="text-2xl font-black">{popup.node.name}</h2></div><Button aria-label="Close class concept details" size="icon-sm" variant="ghost" className="rounded-full text-white hover:bg-white/20" onClick={() => setPopup(null)}><X className="h-4 w-4" /></Button></div></div>
            <div className="space-y-4 p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">{popup.node.description}</p>
              <div className="rounded-2xl bg-muted p-4"><div className="flex items-center justify-between"><span className="font-bold">Class mastery</span><span className="rounded-full px-3 py-1 text-sm font-black" style={{ backgroundColor: selectedPopupTier.fill, color: selectedPopupTier.text }}>{popup.node.belowMastery}% below</span></div><p className="mt-2 text-sm font-semibold text-muted-foreground">Risk label: {selectedPopupTier.label}</p></div>
              {isRedTopic ? <div className="space-y-3">{misconceptions.map((mistake: TopicMisconception) => <div key={`${mistake.topicId}-${mistake.description}`} className="rounded-2xl bg-muted p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-black">{mistake.description}</p><span className="rounded-full bg-secondary px-2 py-1 text-xs font-black text-secondary-foreground">{mistake.percent}%</span></div><p className="mt-2 text-sm text-muted-foreground">{mistake.studentCount} students · Example: {mistake.example}</p></div>)}{misconceptions.length === 0 && <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No misconception records for this topic yet.</p>}</div> : <div className="rounded-2xl border border-[#EAA93C] bg-gradient-to-br from-[#FFF3C4] to-white p-4 text-[#17233A]"><div className="mb-2 flex items-center gap-2 font-black"><Link2 className="h-4 w-4" /> Key Connection</div><p className="text-sm">Links to <strong>{popup.node.keyConnection.topic}</strong>: {popup.node.keyConnection.explanation}</p></div>}
              {!isRedTopic && <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground shadow-lg" onClick={() => setPopup(null)}>Close details <X className="ml-2 h-4 w-4" /></Button>}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
