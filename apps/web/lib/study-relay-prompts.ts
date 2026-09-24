export type StudyRelaySubject = 'chemistry' | 'mathematics';

export type StudyPrompt = {
  id: string;
  concept: string;
  subject: StudyRelaySubject;
  referenceNote?: string;
};

export const CHEMISTRY_STUDY_PROMPTS: StudyPrompt[] = [
  {
    id: 'chem-states-of-matter',
    concept: 'States of matter change (melting/boiling)',
    subject: 'chemistry',
    referenceNote: 'Particles gain energy and move further apart as heat is added',
  },
  {
    id: 'chem-atom-structure',
    concept: 'Atom structure (nucleus, electrons, shells)',
    subject: 'chemistry',
    referenceNote: 'Protons and neutrons in the nucleus, electrons orbiting in shells',
  },
  {
    id: 'chem-balancing-equation',
    concept: 'Balancing a simple chemical equation',
    subject: 'chemistry',
    referenceNote: 'Same number of each atom on both sides of the equation',
  },
  {
    id: 'chem-acid-base-litmus',
    concept: 'Acid vs base (litmus test)',
    subject: 'chemistry',
    referenceNote: 'Acids turn litmus red, bases turn it blue',
  },
  {
    id: 'chem-combustion',
    concept: 'Combustion (fuel + oxygen → products)',
    subject: 'chemistry',
    referenceNote: 'Fuel reacts with oxygen to release energy, usually as heat and light',
  },
  {
    id: 'chem-diffusion',
    concept: 'Diffusion of gas particles',
    subject: 'chemistry',
    referenceNote: 'Particles move from high to low concentration until evenly spread',
  },
];
