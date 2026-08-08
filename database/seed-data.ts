export const schoolSeed = Array.from({ length: 151 }, (_, index) => ({
  id: `school-${index + 1}`,
  name: `School ${index + 1}`,
}));

export const subjectSeed = Array.from({ length: 8 }, (_, index) => ({
  id: `subject-${index + 1}`,
  name: `Subject ${index + 1}`,
}));

export const topicSeed = Array.from({ length: 51 }, (_, index) => ({
  id: `topic-${index + 1}`,
  subjectId: subjectSeed[Math.floor(index / 7)]?.id ?? subjectSeed[0].id,
  name: `Topic ${index + 1}`,
}));
