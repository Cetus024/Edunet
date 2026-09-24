'use client';

// Renders the Memory Score Recap as a real 1080x1920 Instagram Story image.
//
// The card is drawn from scratch rather than rasterised from the DOM: the
// theme in globals.css is built on oklch() tokens, which the DOM-to-canvas
// libraries cannot parse, and the on-screen card is only ~330px wide, far
// below Story resolution. Drawing it here keeps the export deterministic and
// dependency-free, at the cost of this file having to mirror the card's
// layout when that card changes.

export type RecapStorySubject = { subject: string; score: number };

export type RecapStoryData = {
  squadAverage: number;
  topSubjects: RecapStorySubject[];
  topLearner: string;
};

const WIDTH = 1080;
const HEIGHT = 1920;
const PAD = 76;

// Hex mirrors of the oklch theme tokens. Canvas fillStyle cannot read CSS
// custom properties, so the palette is duplicated here deliberately.
const COLOR = {
  primary: '#1D3A62',
  accent: '#6486B5',
  secondary: '#FFE38F',
  card: '#FFFFFF',
  ink: '#17233A',
  track: '#E7DDBB',
};

const BODY_FONT = "'Canva Sans', 'DM Sans', system-ui, sans-serif";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  // roundRect is the fast path; the manual arcs keep older WebViews working.
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

export async function renderRecapStoryImage(data: RecapStoryData): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // The page already loads these webfonts for the on-screen card. Waiting on
  // them keeps the exported image in the same typeface as the preview instead
  // of silently falling back to a system font partway through the draw.
  try {
    await document.fonts?.ready;
  } catch {
    // A font failure is not worth losing the whole image over.
  }

  ctx.fillStyle = COLOR.primary;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // The two blurred-looking blobs behind the content, matching the card's
  // absolutely-positioned circles that bleed past its rounded corners.
  ctx.fillStyle = COLOR.accent;
  ctx.beginPath();
  ctx.arc(WIDTH - 40, 150, 300, 0, Math.PI * 2);
  ctx.fill();
  // Tucked below the top-learner block so it fills the empty bottom corner
  // instead of poking out between the subject cards.
  ctx.fillStyle = COLOR.secondary;
  ctx.beginPath();
  ctx.arc(55, HEIGHT + 90, 190, 0, Math.PI * 2);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';

  // --- Header: wordmark pill + bolt badge -------------------------------
  const badgeText = 'EduNets Wrapped';
  ctx.font = `700 34px ${BODY_FONT}`;
  const badgeWidth = ctx.measureText(badgeText).width + 72;
  ctx.fillStyle = COLOR.secondary;
  roundedRect(ctx, PAD, 120, badgeWidth, 84, 42);
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'left';
  ctx.fillText(badgeText, PAD + 36, 174);

  ctx.fillStyle = COLOR.card;
  ctx.beginPath();
  ctx.arc(WIDTH - PAD - 42, 162, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  ctx.font = '38px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡', WIDTH - PAD - 42, 176);

  // --- Headline ---------------------------------------------------------
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.card;
  ctx.font = `700 40px ${BODY_FONT}`;
  ctx.fillText('This week, your squad remembered', PAD, 470);

  ctx.font = `700 250px ${BODY_FONT}`;
  ctx.fillText(`${data.squadAverage}%`, PAD - 12, 690);

  ctx.font = `700 58px ${BODY_FONT}`;
  const taglineLines = wrapText(ctx, 'of your strongest topics before they faded.', 620);
  taglineLines.forEach((line, index) => {
    ctx.fillText(line, PAD, 780 + index * 70);
  });

  // --- Subject cards ----------------------------------------------------
  const cardHeight = 150;
  const cardGap = 30;
  const cardWidth = WIDTH - PAD * 2;
  const subjects = data.topSubjects.slice(0, 3);
  // The learner block is pinned to the bottom of the frame, so a squad with
  // only one scored subject would otherwise leave a large hole above it. The
  // stack is centred in whatever space is left instead.
  const learnerHeight = 190;
  const learnerTop = HEIGHT - 130 - learnerHeight;
  const stackHeight = subjects.length * cardHeight + Math.max(0, subjects.length - 1) * cardGap;
  const regionTop = 1010;
  const subjectsTop = regionTop + Math.max(0, (learnerTop - 80 - regionTop - stackHeight) / 2);

  subjects.forEach((subject, index) => {
    const top = subjectsTop + index * (cardHeight + cardGap);
    ctx.fillStyle = COLOR.card;
    roundedRect(ctx, PAD, top, cardWidth, cardHeight, 34);
    ctx.fill();

    ctx.fillStyle = COLOR.ink;
    ctx.font = `700 40px ${BODY_FONT}`;
    ctx.textAlign = 'right';
    const scoreLabel = `${subject.score}%`;
    ctx.fillText(scoreLabel, PAD + cardWidth - 40, top + 62);

    ctx.textAlign = 'left';
    const scoreWidth = ctx.measureText(scoreLabel).width;
    const nameLabel = truncate(ctx, `${index + 1}. ${subject.subject}`, cardWidth - scoreWidth - 120);
    ctx.fillText(nameLabel, PAD + 40, top + 62);

    // Progress track and fill, mirroring the <Progress /> bar on the card.
    const barTop = top + 92;
    const barWidth = cardWidth - 80;
    ctx.fillStyle = COLOR.track;
    roundedRect(ctx, PAD + 40, barTop, barWidth, 22, 11);
    ctx.fill();
    const filled = Math.max(0, Math.min(100, subject.score)) / 100;
    if (filled > 0) {
      ctx.fillStyle = COLOR.primary;
      roundedRect(ctx, PAD + 40, barTop, Math.max(22, barWidth * filled), 22, 11);
      ctx.fill();
    }
  });

  // --- Top learner ------------------------------------------------------
  // Anchored to the bottom of the frame (see learnerTop above) rather than
  // stacked after the cards: a stacked offset pushed this block past 1920 and
  // cropped the name off the image.
  ctx.fillStyle = COLOR.secondary;
  roundedRect(ctx, PAD, learnerTop, cardWidth, learnerHeight, 48);
  ctx.fill();

  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'left';
  ctx.font = `700 32px ${BODY_FONT}`;
  ctx.fillText('TOP LEARNER', PAD + 56, learnerTop + 82);
  ctx.font = `700 76px ${BODY_FONT}`;
  ctx.fillText(truncate(ctx, data.topLearner, cardWidth - 130), PAD + 56, learnerTop + 158);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
