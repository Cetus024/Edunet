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

// Optional visual-detail templates for the original three subjects. Names,
// catalog membership, icons, and every displayed score are replaced with the
// authenticated subjectsAtom values below.
const subjectTemplates: Record<string, SubjectEntry> = {
  Biology: {
    icon: '🧬',
    topics: [
      { id: 'cell-biology', name: 'Cell Biology', memoryScore: 78, description: 'Cell structures, specialised cells, diffusion, osmosis, and active transport.', keyConnection: { topic: 'Enzymes', explanation: 'Cell reactions rely on enzymes to control metabolism and release usable energy.' }, subConcepts: [
        { id: 'mitosis', name: 'Mitosis', memoryScore: 64, description: 'Cell division that produces genetically identical daughter cells for growth and repair.', keyConnection: { topic: 'DNA', explanation: 'Mitosis copies and separates chromosomes so each new cell keeps the same genetic instructions.' } },
        { id: 'cell-membrane', name: 'Cell Membrane', memoryScore: 85, description: 'A partially permeable boundary controlling movement in and out of cells.', keyConnection: { topic: 'Osmosis', explanation: 'Osmosis depends on water moving across the partially permeable cell membrane.' } },
        { id: 'organelles', name: 'Organelles', memoryScore: 72, description: 'Nucleus, mitochondria, ribosomes, and chloroplasts each perform specific cell jobs.', keyConnection: { topic: 'Photosynthesis', explanation: 'Chloroplasts are the organelles where photosynthesis happens in plant cells.' } },
      ] },
      { id: 'enzymes', name: 'Enzymes', memoryScore: 46, description: 'Biological catalysts affected by temperature, pH, and substrate concentration.', keyConnection: { topic: 'Digestion', explanation: 'Digestive enzymes break large food molecules into soluble nutrients.' }, subConcepts: [
        { id: 'active-site', name: 'Active Site', memoryScore: 41, description: 'The enzyme region where the substrate fits during a reaction.', keyConnection: { topic: 'Denaturation', explanation: 'Denaturation changes the active site shape so substrates no longer fit.' } },
        { id: 'denaturation', name: 'Denaturation', memoryScore: 31, description: 'Permanent enzyme shape change caused by high temperature or unsuitable pH.', keyConnection: { topic: 'Homeostasis', explanation: 'Homeostasis helps keep internal conditions suitable for enzyme action.' } },
        { id: 'lock-key', name: 'Lock and Key', memoryScore: 58, description: 'A model explaining enzyme specificity by matching substrate shape.', keyConnection: { topic: 'Active Site', explanation: 'The model depends on the active site and substrate having complementary shapes.' } },
      ] },
      { id: 'photosynthesis', name: 'Photosynthesis', memoryScore: 66, description: 'Plants make glucose from carbon dioxide and water using light energy.', keyConnection: { topic: 'Respiration', explanation: 'Glucose made in photosynthesis is later broken down in respiration.' }, subConcepts: [
        { id: 'chlorophyll', name: 'Chlorophyll', memoryScore: 69, description: 'Green pigment that absorbs light energy for photosynthesis.', keyConnection: { topic: 'Chloroplasts', explanation: 'Chlorophyll is found inside chloroplasts in plant cells.' } },
        { id: 'limiting-factors', name: 'Limiting Factors', memoryScore: 52, description: 'Light, carbon dioxide, and temperature can limit photosynthesis rate.', keyConnection: { topic: 'Enzymes', explanation: 'Temperature affects photosynthesis partly because enzyme-controlled reactions are involved.' } },
        { id: 'stomata', name: 'Stomata', memoryScore: 38, description: 'Leaf pores that control gas exchange and water loss.', keyConnection: { topic: 'Transpiration', explanation: 'Stomata opening affects both carbon dioxide uptake and water vapour loss.' } },
      ] },
      { id: 'respiration', name: 'Respiration', memoryScore: 82, description: 'Releasing energy from glucose aerobically or anaerobically.', keyConnection: { topic: 'Photosynthesis', explanation: 'Photosynthesis stores energy in glucose; respiration releases it.' }, subConcepts: [
        { id: 'aerobic', name: 'Aerobic Respiration', memoryScore: 79, description: 'Glucose reacts with oxygen to release energy, carbon dioxide, and water.', keyConnection: { topic: 'Gas Exchange', explanation: 'Aerobic respiration needs oxygen supplied by gas exchange surfaces.' } },
        { id: 'anaerobic', name: 'Anaerobic Respiration', memoryScore: 44, description: 'Energy release without oxygen, producing lactic acid in muscles.', keyConnection: { topic: 'Oxygen Debt', explanation: 'Lactic acid must be broken down later using oxygen.' } },
        { id: 'mitochondria', name: 'Mitochondria', memoryScore: 74, description: 'Organelles where most aerobic respiration occurs.', keyConnection: { topic: 'Organelles', explanation: 'Mitochondria are specialised organelles for energy release.' } },
      ] },
      { id: 'genetics', name: 'Genetics', memoryScore: 57, description: 'Inheritance, chromosomes, DNA, genes, and variation.', keyConnection: { topic: 'Mitosis', explanation: 'Chromosomes copied in mitosis carry inherited genetic information.' }, subConcepts: [
        { id: 'dna', name: 'DNA', memoryScore: 62, description: 'The molecule carrying genetic instructions in a sequence of bases.', keyConnection: { topic: 'Protein Synthesis', explanation: 'DNA base order codes for amino acid sequences in proteins.' } },
        { id: 'alleles', name: 'Alleles', memoryScore: 35, description: 'Different versions of the same gene.', keyConnection: { topic: 'Punnett Squares', explanation: 'Punnett squares predict offspring allele combinations.' } },
        { id: 'punnett', name: 'Punnett Squares', memoryScore: 48, description: 'Diagrams used to predict inheritance probabilities.', keyConnection: { topic: 'Alleles', explanation: 'Punnett squares arrange parent alleles to show possible genotypes.' } },
      ] },
    ],
  },
  Chemistry: {
    icon: '⚗️',
    topics: [
      { id: 'atomic-structure', name: 'Atomic Structure', memoryScore: 75, description: 'Protons, neutrons, electrons, isotopes, and electronic structure.', keyConnection: { topic: 'Periodic Table', explanation: 'Atomic number and electron arrangement explain periodic table patterns.' }, subConcepts: [
        { id: 'protons', name: 'Protons', memoryScore: 81, description: 'Positive particles in the nucleus that define the element.', keyConnection: { topic: 'Atomic Number', explanation: 'Atomic number equals the number of protons.' } },
        { id: 'isotopes', name: 'Isotopes', memoryScore: 43, description: 'Atoms of the same element with different neutron numbers.', keyConnection: { topic: 'Relative Atomic Mass', explanation: 'Isotope abundance affects the relative atomic mass value.' } },
        { id: 'electron-shells', name: 'Electron Shells', memoryScore: 67, description: 'Electrons arranged in energy levels around the nucleus.', keyConnection: { topic: 'Ionic Bonding', explanation: 'Atoms gain or lose outer electrons to form ions.' } },
      ] },
      { id: 'chemical-bonding', name: 'Chemical Bonding', memoryScore: 39, description: 'Ionic, covalent, and metallic bonding and their properties.', keyConnection: { topic: 'Structure and Properties', explanation: 'Bond type determines melting point, conductivity, and hardness.' }, subConcepts: [
        { id: 'ionic-bonding', name: 'Ionic Bonding', memoryScore: 32, description: 'Electrostatic attraction between oppositely charged ions.', keyConnection: { topic: 'Electron Shells', explanation: 'Ionic bonding happens when atoms transfer outer electrons.' } },
        { id: 'covalent-bonding', name: 'Covalent Bonding', memoryScore: 49, description: 'Atoms share pairs of electrons to complete outer shells.', keyConnection: { topic: 'Molecules', explanation: 'Covalent bonds hold atoms together in simple molecules.' } },
        { id: 'metallic-bonding', name: 'Metallic Bonding', memoryScore: 71, description: 'Positive metal ions surrounded by delocalised electrons.', keyConnection: { topic: 'Conductivity', explanation: 'Delocalised electrons allow metals to conduct electricity.' } },
      ] },
      { id: 'moles', name: 'Moles', memoryScore: 51, description: 'Chemical amounts, relative formula mass, concentration, and reacting masses.', keyConnection: { topic: 'Equations', explanation: 'Balanced equations give mole ratios for calculations.' }, subConcepts: [
        { id: 'avogadro', name: 'Avogadro Constant', memoryScore: 28, description: 'The number of particles in one mole of substance.', keyConnection: { topic: 'Moles', explanation: 'It links particle numbers to measurable amounts.' } },
        { id: 'concentration', name: 'Concentration', memoryScore: 54, description: 'Amount of solute per volume of solution.', keyConnection: { topic: 'Titration', explanation: 'Titration uses concentrations and volumes to calculate unknowns.' } },
        { id: 'yield', name: 'Percentage Yield', memoryScore: 61, description: 'Actual yield compared with theoretical yield.', keyConnection: { topic: 'Reacting Masses', explanation: 'Theoretical yield is calculated from reacting masses.' } },
      ] },
      { id: 'acids-alkalis', name: 'Acids and Alkalis', memoryScore: 83, description: 'pH, neutralisation, salts, and ionic equations.', keyConnection: { topic: 'Ions', explanation: 'Hydrogen and hydroxide ions explain acidity and alkalinity.' }, subConcepts: [
        { id: 'ph-scale', name: 'pH Scale', memoryScore: 84, description: 'A scale showing acidity or alkalinity of a solution.', keyConnection: { topic: 'Indicators', explanation: 'Indicators change colour across different pH values.' } },
        { id: 'neutralisation', name: 'Neutralisation', memoryScore: 77, description: 'Acid and alkali react to make salt and water.', keyConnection: { topic: 'Ionic Equations', explanation: 'Neutralisation can be summarised as H+ plus OH- makes water.' } },
        { id: 'salts', name: 'Salt Preparation', memoryScore: 59, description: 'Methods for making soluble and insoluble salts.', keyConnection: { topic: 'Neutralisation', explanation: 'Many salt preparations start with neutralising an acid.' } },
      ] },
      { id: 'electrolysis', name: 'Electrolysis', memoryScore: 42, description: 'Using electricity to decompose ionic substances.', keyConnection: { topic: 'Ionic Bonding', explanation: 'Only mobile ions can carry charge during electrolysis.' }, subConcepts: [
        { id: 'electrodes', name: 'Electrodes', memoryScore: 47, description: 'Conductors where oxidation or reduction occurs.', keyConnection: { topic: 'Redox', explanation: 'Oxidation happens at one electrode and reduction at the other.' } },
        { id: 'molten-electrolysis', name: 'Molten Electrolysis', memoryScore: 34, description: 'Electrolysis of melted ionic compounds.', keyConnection: { topic: 'Ions', explanation: 'Melting frees ions so they can move and carry charge.' } },
        { id: 'aqueous-electrolysis', name: 'Aqueous Electrolysis', memoryScore: 40, description: 'Electrolysis in water, where ions compete for discharge.', keyConnection: { topic: 'Reactivity Series', explanation: 'Metal ion discharge depends on relative reactivity.' } },
      ] },
      { id: 'rates', name: 'Rates of Reaction', memoryScore: 68, description: 'How quickly reactants become products and factors affecting rate.', keyConnection: { topic: 'Collision Theory', explanation: 'Rate depends on successful collisions between particles.' }, subConcepts: [
        { id: 'collision-theory', name: 'Collision Theory', memoryScore: 70, description: 'Particles must collide with enough energy and correct orientation.', keyConnection: { topic: 'Activation Energy', explanation: 'Only collisions above activation energy react successfully.' } },
        { id: 'catalysts', name: 'Catalysts', memoryScore: 65, description: 'Substances that speed reactions without being used up.', keyConnection: { topic: 'Activation Energy', explanation: 'Catalysts provide a lower energy pathway.' } },
        { id: 'surface-area', name: 'Surface Area', memoryScore: 55, description: 'Smaller pieces expose more particles for collisions.', keyConnection: { topic: 'Collision Theory', explanation: 'More exposed particles means more frequent successful collisions.' } },
      ] },
    ],
  },
  Physics: {
    icon: '🛰️',
    topics: [
      { id: 'forces-motion', name: 'Forces and Motion', memoryScore: 73, description: 'Speed, acceleration, resultant force, and Newton’s laws.', keyConnection: { topic: 'Energy', explanation: 'Forces transfer energy when they move objects through a distance.' }, subConcepts: [
        { id: 'acceleration', name: 'Acceleration', memoryScore: 76, description: 'Change in velocity per second.', keyConnection: { topic: 'Velocity-Time Graphs', explanation: 'Acceleration is the gradient of a velocity-time graph.' } },
        { id: 'newtons-second', name: 'Newton’s Second Law', memoryScore: 56, description: 'Resultant force equals mass times acceleration.', keyConnection: { topic: 'Acceleration', explanation: 'The law calculates acceleration from force and mass.' } },
        { id: 'terminal-velocity', name: 'Terminal Velocity', memoryScore: 37, description: 'Constant speed reached when forces balance.', keyConnection: { topic: 'Resultant Force', explanation: 'When resultant force is zero, acceleration stops.' } },
      ] },
      { id: 'energy', name: 'Energy', memoryScore: 80, description: 'Energy stores, transfers, efficiency, and conservation.', keyConnection: { topic: 'Forces and Motion', explanation: 'Mechanical work transfers energy between stores.' }, subConcepts: [
        { id: 'gpe', name: 'Gravitational Potential', memoryScore: 82, description: 'Energy stored by objects raised in a gravitational field.', keyConnection: { topic: 'Kinetic Energy', explanation: 'Falling transfers gravitational potential energy into kinetic energy.' } },
        { id: 'efficiency', name: 'Efficiency', memoryScore: 63, description: 'Useful energy output divided by total energy input.', keyConnection: { topic: 'Power', explanation: 'Power ratings help compare useful energy transfer per second.' } },
        { id: 'conservation', name: 'Conservation of Energy', memoryScore: 74, description: 'Energy cannot be created or destroyed, only transferred.', keyConnection: { topic: 'Energy Stores', explanation: 'Conservation tracks how total energy moves between stores.' } },
      ] },
      { id: 'waves', name: 'Waves', memoryScore: 45, description: 'Wave properties, reflection, refraction, sound, and electromagnetic waves.', keyConnection: { topic: 'Light', explanation: 'Light is an electromagnetic wave that reflects and refracts.' }, subConcepts: [
        { id: 'frequency', name: 'Frequency', memoryScore: 50, description: 'Number of waves passing a point each second.', keyConnection: { topic: 'Wave Speed', explanation: 'Wave speed equals frequency times wavelength.' } },
        { id: 'refraction', name: 'Refraction', memoryScore: 36, description: 'Wave direction changes when speed changes between materials.', keyConnection: { topic: 'Lenses', explanation: 'Lenses use refraction to focus light.' } },
        { id: 'em-spectrum', name: 'EM Spectrum', memoryScore: 42, description: 'The full range of electromagnetic radiation.', keyConnection: { topic: 'Frequency', explanation: 'EM waves differ by frequency and wavelength.' } },
      ] },
      { id: 'electricity', name: 'Electricity', memoryScore: 58, description: 'Charge, current, voltage, resistance, circuits, and power.', keyConnection: { topic: 'Energy', explanation: 'Electrical devices transfer energy from circuits to useful stores.' }, subConcepts: [
        { id: 'current', name: 'Current', memoryScore: 60, description: 'Rate of flow of electric charge.', keyConnection: { topic: 'Charge', explanation: 'Current equals charge flow per second.' } },
        { id: 'resistance', name: 'Resistance', memoryScore: 44, description: 'Opposition to current in a component.', keyConnection: { topic: 'Ohm’s Law', explanation: 'Resistance links voltage and current in Ohm’s law.' } },
        { id: 'series-parallel', name: 'Series and Parallel', memoryScore: 53, description: 'Circuit arrangements that affect current and potential difference.', keyConnection: { topic: 'Voltage', explanation: 'Potential difference is shared differently in series and parallel circuits.' } },
      ] },
      { id: 'radioactivity', name: 'Radioactivity', memoryScore: 24, description: 'Nuclear radiation, half-life, contamination, and irradiation.', keyConnection: { topic: 'Atomic Structure', explanation: 'Radiation comes from unstable atomic nuclei.' }, subConcepts: [
        { id: 'alpha-beta-gamma', name: 'Alpha Beta Gamma', memoryScore: 29, description: 'Three types of nuclear radiation with different penetration and ionisation.', keyConnection: { topic: 'Ionisation', explanation: 'Radiation danger depends on how strongly it ionises cells.' } },
        { id: 'half-life', name: 'Half-life', memoryScore: 22, description: 'Time taken for activity or unstable nuclei count to halve.', keyConnection: { topic: 'Decay Graphs', explanation: 'Half-life is read from radioactive decay graphs.' } },
        { id: 'irradiation', name: 'Irradiation', memoryScore: 33, description: 'Exposure to radiation from a source outside the body.', keyConnection: { topic: 'Contamination', explanation: 'Contamination is different because radioactive material is present on or inside you.' } },
      ] },
    ],
  },
};

const topicTemplateIds: Record<string, string> = {
  'bio-cell': 'cell-biology',
  'chem-bonding': 'chemical-bonding',
  'chem-stoich': 'moles',
  'chem-acids': 'acids-alkalis',
  'chem-rate': 'rates',
  'phys-kinematics': 'forces-motion',
  'phys-nuclear': 'radioactivity',
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
      const template = subjectTemplates[subjectData.name];
      const topics = subjectData.topics.map((topicData: TopicData, topicIndex: number): Topic => {
        const templateTopic = template?.topics.find((candidate: Topic) => (
          candidate.id === topicTemplateIds[topicData.id]
          || normalize(candidate.name) === normalize(topicData.name)
        ));
        const nextTopic = subjectData.topics[(topicIndex + 1) % subjectData.topics.length] ?? topicData;

        return {
          id: topicData.id,
          name: topicData.name,
          memoryScore: topicData.memoryScore,
          description: templateTopic?.description
            ?? `${topicData.name} is part of your ${subjectData.name} O-Level learning map.`,
          keyConnection: {
            topic: nextTopic.name,
            explanation: `${topicData.name} and ${nextTopic.name} are neighbouring branches in your ${subjectData.name} revision map.`,
          },
          subConcepts: (templateTopic?.subConcepts ?? []).map((concept: SubConcept) => ({
            ...concept,
            // Detail nodes inherit the authenticated parent topic score. The
            // legacy template score is never displayed or used for risk state.
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
    // Every real topic sits on a single even ring around the subject — no
    // second "subconcept" ring. The old template data had a two-tier layout,
    // but it only ever expanded for topics whose name happened to collide
    // with a legacy template name (e.g. real catalog topics called "Genetics"
    // or "Respiration"), so most subjects rendered as an inconsistent mix of
    // bare topic bubbles and a few with an extra fan of children. A single
    // ring is the layout that's actually true for every subject.
    const nodes: GraphNode[] = [{ id: normalize(subject), name: subject, memoryScore: average, description: `${subject} concept map built from your authenticated O-Level learning progress.`, keyConnection: { topic: firstTopic.name, explanation: `${firstTopic.name} is the first branch in this subject map.` }, kind: 'subject', subject, x: 500, y: 400, r: 60, index: 0 }];
    const links: GraphLink[] = [];
    entry.topics.forEach((topic: Topic, topicIndex: number) => {
      const angle = -Math.PI / 2 + topicIndex * ((Math.PI * 2) / entry.topics.length);
      const topicNode: GraphNode = { ...topic, kind: 'topic', subject, x: roundCoordinate(500 + Math.cos(angle) * 230), y: roundCoordinate(400 + Math.sin(angle) * 230), r: 46, index: nodes.length };
      nodes.push(topicNode);
      links.push({ from: nodes[0], to: topicNode });
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
    <div className="flex h-full flex-col overflow-hidden text-foreground" style={{ background: 'radial-gradient(circle at 15% 10%, rgba(234,169,60,.15), transparent 30%), radial-gradient(circle at 85% 85%, rgba(24,102,54,.12), transparent 34%), linear-gradient(135deg,#F6ECDC,#EDE4D4)' }}>
      <div className="z-20 flex items-center gap-4 border-b border-border bg-card px-5 py-3 text-card-foreground shadow-sm">
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

      <div ref={canvasRef} className="relative flex-1 cursor-grab overflow-hidden active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)} onWheel={handleWheel} onClick={(event: React.MouseEvent<HTMLDivElement>) => { if (!(event.target as Element).closest('[data-node="true"], [data-popup="true"]')) setPopup(null); }}>
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
              return (
                <motion.g key={node.id} data-node="true" role="button" tabIndex={0} aria-label={`${node.name}, ${scoreLabel}`} onClick={(event: React.MouseEvent<SVGGElement>) => handleNodeClick(event, node)} onKeyDown={(event: React.KeyboardEvent<SVGGElement>) => handleNodeKeyDown(event, node)} initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: greyed ? 0.35 : 1, scale: highlighted ? 1.15 : 1, y: prefersReducedMotion ? 0 : [0, -4, 0, 4, 0] }} transition={{ opacity: { duration: 0.25, delay: node.index * 0.04 }, scale: { duration: 0.25 }, y: prefersReducedMotion ? { duration: 0 } : { duration: 5 + (node.index % 3), repeat: Infinity, ease: 'easeInOut' as const, delay: node.index * 0.12 } }} style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
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
