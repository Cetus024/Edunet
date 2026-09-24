type Rgb = { r: number; g: number; b: number };

export const KNOWLEDGE_SCORE_COLORS = {
  grey: '#9CA3AF',
  red: '#EF4444',
  yellow: '#FACC15',
  brightGreen: '#22C55E',
} as const;

export type KnowledgeScoreColor = {
  fill: string;
  stroke: string;
  text: string;
  background: string;
  label: 'Not Started' | 'At Risk' | 'Review Needed' | 'Building' | 'Mastered';
};

const hexToRgb = (hex: string): Rgb => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16),
});

const rgbToHex = ({ r, g, b }: Rgb) => `#${[r, g, b]
  .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
  .join('')}`.toUpperCase();

const mix = (from: string, to: string, amount: number) => {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const ratio = Math.min(1, Math.max(0, amount));
  return rgbToHex({
    r: start.r + (end.r - start.r) * ratio,
    g: start.g + (end.g - start.g) * ratio,
    b: start.b + (end.b - start.b) * ratio,
  });
};

const readableText = (fill: string) => {
  const { r, g, b } = hexToRgb(fill);
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.055;
  return whiteContrast >= darkContrast ? '#FFFFFF' : '#17233A';
};

/**
 * Shared 0–100 Knowledge Model colour scale.
 *
 * 0–29: grey → red
 * 30–49: red → yellow
 * 50–79: yellow → green
 * 80–100: fixed bright green
 */
export function getKnowledgeScoreColor(score: number | null): KnowledgeScoreColor {
  if (score === null || !Number.isFinite(score)) {
    return {
      fill: KNOWLEDGE_SCORE_COLORS.grey,
      stroke: mix(KNOWLEDGE_SCORE_COLORS.grey, '#000000', 0.22),
      text: readableText(KNOWLEDGE_SCORE_COLORS.grey),
      background: 'rgba(156, 163, 175, 0.14)',
      label: 'Not Started',
    };
  }

  const normalized = Math.min(100, Math.max(0, score));
  let fill: string;
  let label: KnowledgeScoreColor['label'];

  if (normalized >= 80) {
    fill = KNOWLEDGE_SCORE_COLORS.brightGreen;
    label = 'Mastered';
  } else if (normalized >= 50) {
    fill = mix(KNOWLEDGE_SCORE_COLORS.yellow, KNOWLEDGE_SCORE_COLORS.brightGreen, (normalized - 50) / 30);
    label = 'Building';
  } else if (normalized >= 30) {
    fill = mix(KNOWLEDGE_SCORE_COLORS.red, KNOWLEDGE_SCORE_COLORS.yellow, (normalized - 30) / 20);
    label = 'Review Needed';
  } else {
    fill = mix(KNOWLEDGE_SCORE_COLORS.grey, KNOWLEDGE_SCORE_COLORS.red, normalized / 30);
    label = 'At Risk';
  }

  const { r, g, b } = hexToRgb(fill);
  return {
    fill,
    stroke: mix(fill, '#000000', 0.22),
    text: readableText(fill),
    background: `rgba(${r}, ${g}, ${b}, 0.14)`,
    label,
  };
}

