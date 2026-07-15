import type { DailyJournal, DailyJournalRecord } from '../../services/journal-service';
import { journalTheme } from '../../theme/tokens';

export const JOURNAL_POSTER_WIDTH = 1080;
export const JOURNAL_POSTER_HEIGHT = 1440;

type CanvasContext = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;
type CanvasImage = WechatMiniprogram.Image;

export interface PosterCardLayout {
  height: number;
  width: number;
  x: number;
  y: number;
}

const pageMargin = 68;
const listTop = 350;
const listBottom = 1110;
const cardGap = 18;

export function getPosterCardLayouts(recordCount: number): PosterCardLayout[] {
  const safeCount = Math.max(0, Math.min(4, Math.floor(recordCount)));
  if (safeCount === 0) {
    return [];
  }
  const availableHeight = listBottom - listTop - cardGap * (safeCount - 1);
  const cardHeight = Math.min(320, Math.floor(availableHeight / safeCount));
  return Array.from({ length: safeCount }, (_, index) => ({
    height: cardHeight,
    width: JOURNAL_POSTER_WIDTH - pageMargin * 2,
    x: pageMargin,
    y: listTop + index * (cardHeight + cardGap),
  }));
}

function roundedRectPath(
  context: CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function fillRoundedRect(
  context: CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
): void {
  context.save();
  roundedRectPath(context, x, y, width, height, radius);
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function fitText(context: CanvasContext, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }
  let result = '';
  for (const character of value) {
    const candidate = `${result}${character}…`;
    if (context.measureText(candidate).width > maxWidth) {
      break;
    }
    result += character;
  }
  return result.length > 0 ? `${result}…` : '…';
}

export function wrapPosterText(
  context: CanvasContext,
  value: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let currentLine = '';
  for (const character of value) {
    const candidate = `${currentLine}${character}`;
    if (currentLine.length > 0 && context.measureText(candidate).width > maxWidth) {
      lines.push(currentLine);
      currentLine = character;
      if (lines.length === maxLines) {
        return lines;
      }
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine.length > 0 && lines.length < maxLines) {
    lines.push(currentLine);
  }
  if (lines.length === maxLines && context.measureText(value).width > maxWidth * maxLines) {
    lines[maxLines - 1] = fitText(context, lines[maxLines - 1] ?? '', maxWidth);
  }
  return lines;
}

function loadCanvasImage(
  canvas: WechatMiniprogram.Canvas,
  source: string,
): Promise<CanvasImage | null> {
  if (source.length === 0) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const image = canvas.createImage();
    let settled = false;
    const finish = (result: CanvasImage | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), 8_000);
    image.onload = (): void => {
      clearTimeout(timeout);
      finish(image);
    };
    image.onerror = (): void => {
      clearTimeout(timeout);
      finish(null);
    };
    image.src = source;
  });
}

function resolveCanvasImageSource(source: string): Promise<string> {
  if (!/^https?:\/\//i.test(source)) {
    return Promise.resolve(source);
  }
  return new Promise((resolve) => {
    wx.downloadFile({
      fail: () => resolve(''),
      success: (result) => {
        resolve(result.statusCode >= 200 && result.statusCode < 300 ? result.tempFilePath : '');
      },
      url: source,
    });
  });
}

function drawCoverImage(
  context: CanvasContext,
  image: CanvasImage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const imageWidth = Math.max(1, image.width);
  const imageHeight = Math.max(1, image.height);
  const targetRatio = width / height;
  const imageRatio = imageWidth / imageHeight;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = imageWidth;
  let sourceHeight = imageHeight;
  if (imageRatio > targetRatio) {
    sourceWidth = imageHeight * targetRatio;
    sourceX = (imageWidth - sourceWidth) / 2;
  } else {
    sourceHeight = imageWidth / targetRatio;
    sourceY = (imageHeight - sourceHeight) / 2;
  }

  context.save();
  roundedRectPath(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  context.restore();
}

function drawImagePlaceholder(
  context: CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  fillRoundedRect(context, x, y, width, height, 24, journalTheme.primarySoft);
  context.save();
  context.strokeStyle = '#E9AC94';
  context.lineWidth = 5;
  const plateRadius = Math.min(width, height) * 0.27;
  const plateCenterX = x + width / 2;
  const plateCenterY = y + height / 2 + 4;
  context.beginPath();
  context.arc(plateCenterX, plateCenterY, plateRadius, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(plateCenterX, plateCenterY, plateRadius * 0.48, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = journalTheme.orange;
  context.font = '700 28px sans-serif';
  context.textAlign = 'center';
  context.fillText('食', x + width / 2, y + height / 2 + 14);
  context.restore();
}

function formatRecordMeta(record: DailyJournalRecord): string {
  const details: string[] = [];
  if (record.regionLabel.length > 0) {
    details.push(record.regionLabel);
  }
  if (record.overallRating !== null) {
    details.push(`★ ${record.overallRating.toFixed(1)}`);
  }
  if (record.perCapitaPrice !== null) {
    details.push(`人均 ¥${Math.round(record.perCapitaPrice)}`);
  }
  return details.join('  ·  ');
}

function drawRecordCard(
  context: CanvasContext,
  record: DailyJournalRecord,
  layout: PosterCardLayout,
  image: CanvasImage | null,
): void {
  context.save();
  context.shadowColor = 'rgba(94, 59, 44, 0.09)';
  context.shadowBlur = 22;
  context.shadowOffsetY = 9;
  fillRoundedRect(
    context,
    layout.x,
    layout.y,
    layout.width,
    layout.height,
    32,
    journalTheme.surface,
  );
  context.restore();

  const contentPadding = 24;
  const imageSize = Math.min(164, layout.height - contentPadding * 2);
  const imageX = layout.x + contentPadding;
  const imageY = layout.y + (layout.height - imageSize) / 2;
  if (image === null) {
    drawImagePlaceholder(context, imageX, imageY, imageSize, imageSize);
  } else {
    drawCoverImage(context, image, imageX, imageY, imageSize, imageSize, 24);
  }

  const contentX = imageX + imageSize + 28;
  const contentWidth = layout.x + layout.width - contentPadding - contentX;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = journalTheme.text;
  context.font = '700 37px sans-serif';
  context.fillText(fitText(context, record.storeName, contentWidth), contentX, layout.y + 58);

  const meta = formatRecordMeta(record);
  context.fillStyle = journalTheme.textSecondary;
  context.font = '400 25px sans-serif';
  context.fillText(
    fitText(context, meta.length > 0 ? meta : '今天已打卡', contentWidth),
    contentX,
    layout.y + 102,
  );

  const tagText = record.tags
    .slice(0, layout.height >= 230 ? 2 : 1)
    .map((tag) => `#${tag}`)
    .join('  ');
  const dishText = record.recommendedDishes[0] ? `推荐：${record.recommendedDishes[0]}` : '';
  const detailLines = [tagText, dishText].filter((line) => line.length > 0);
  if (detailLines.length > 0 && layout.height >= 168) {
    context.fillStyle = journalTheme.primary;
    context.font = '600 24px sans-serif';
    if (layout.height >= 230) {
      detailLines.slice(0, 2).forEach((line, index) => {
        context.fillText(
          fitText(context, line, contentWidth),
          contentX,
          layout.y + 145 + index * 38,
        );
      });
    } else {
      context.fillText(
        fitText(context, detailLines.join(' · '), contentWidth),
        contentX,
        layout.y + 145,
      );
    }
  }
}

function drawHeader(context: CanvasContext, journal: DailyJournal): void {
  context.fillStyle = journalTheme.text;
  context.font = '700 58px sans-serif';
  context.textAlign = 'left';
  context.fillText('今日美食手账', pageMargin, 112);

  context.fillStyle = journalTheme.textSecondary;
  context.font = '400 27px sans-serif';
  context.fillText(`${journal.dateLabel}  ${journal.weekdayLabel}`, pageMargin, 158);

  fillRoundedRect(context, 760, 62, 250, 92, 24, journalTheme.primary);
  context.fillStyle = '#FFFFFF';
  context.font = '700 38px sans-serif';
  context.textAlign = 'center';
  context.fillText(`${journal.totalCount} 家`, 885, 117);

  fillRoundedRect(
    context,
    pageMargin,
    196,
    JOURNAL_POSTER_WIDTH - pageMargin * 2,
    112,
    28,
    '#FFF0E8',
  );
  context.textAlign = 'left';
  context.fillStyle = journalTheme.primary;
  context.font = '700 30px sans-serif';
  context.fillText('TODAY', pageMargin + 30, 244);
  context.fillStyle = journalTheme.text;
  context.font = '600 28px sans-serif';
  const spendLabel =
    journal.totalSpent !== null
      ? `今日总消费 ¥${Math.round(journal.totalSpent)}`
      : journal.averagePerCapita !== null
        ? `有价格记录的店，人均约 ¥${journal.averagePerCapita}`
        : '把今天喜欢的味道认真收好';
  context.fillText(fitText(context, spendLabel, 660), pageMargin + 176, 244);
  context.fillStyle = journalTheme.textSecondary;
  context.font = '400 23px sans-serif';
  context.fillText('只记录真实吃过的每一家', pageMargin + 30, 282);
}

function drawFooter(context: CanvasContext, journal: DailyJournal): void {
  if (journal.overflowCount > 0) {
    context.fillStyle = journalTheme.primary;
    context.font = '600 24px sans-serif';
    context.textAlign = 'center';
    context.fillText(
      `还有 ${journal.overflowCount} 家美味被收进了今天的足迹。`,
      JOURNAL_POSTER_WIDTH / 2,
      1152,
    );
  }

  fillRoundedRect(
    context,
    pageMargin,
    1184,
    JOURNAL_POSTER_WIDTH - pageMargin * 2,
    134,
    28,
    '#EEF6EB',
  );
  context.fillStyle = journalTheme.text;
  context.font = '600 28px sans-serif';
  context.textAlign = 'left';
  const summaryLines = wrapPosterText(
    context,
    journal.summary,
    JOURNAL_POSTER_WIDTH - pageMargin * 2 - 56,
    2,
  );
  summaryLines.forEach((line, index) => {
    context.fillText(line, pageMargin + 28, 1232 + index * 40);
  });

  context.fillStyle = journalTheme.primary;
  context.font = '700 27px sans-serif';
  context.fillText('食迹 FOODTRACE', pageMargin, 1380);
  context.fillStyle = journalTheme.textSecondary;
  context.font = '400 21px sans-serif';
  context.textAlign = 'right';
  context.fillText('我的私人美食足迹', JOURNAL_POSTER_WIDTH - pageMargin, 1380);
}

function drawDecorations(context: CanvasContext): void {
  context.save();
  context.fillStyle = 'rgba(255, 154, 98, 0.35)';
  context.translate(620, 16);
  context.rotate(0.08);
  context.fillRect(0, 0, 126, 32);
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(240, 90, 71, 0.28)';
  context.lineWidth = 3;
  context.setLineDash([10, 10]);
  context.beginPath();
  context.arc(1000, 270, 62, 0, Math.PI * 1.6);
  context.stroke();
  context.restore();
}

export async function renderJournalPoster(
  canvas: WechatMiniprogram.Canvas,
  journal: DailyJournal,
): Promise<void> {
  if (journal.totalCount === 0 || journal.records.length === 0) {
    throw new Error('EMPTY_JOURNAL');
  }

  canvas.width = JOURNAL_POSTER_WIDTH;
  canvas.height = JOURNAL_POSTER_HEIGHT;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, JOURNAL_POSTER_WIDTH, JOURNAL_POSTER_HEIGHT);
  context.fillStyle = journalTheme.background;
  context.fillRect(0, 0, JOURNAL_POSTER_WIDTH, JOURNAL_POSTER_HEIGHT);
  drawDecorations(context);
  drawHeader(context, journal);

  const imageSources = await Promise.all(
    journal.records.map((record) => resolveCanvasImageSource(record.imagePath)),
  );
  const images = await Promise.all(imageSources.map((source) => loadCanvasImage(canvas, source)));
  const layouts = getPosterCardLayouts(journal.records.length);
  journal.records.forEach((record, index) => {
    const layout = layouts[index];
    if (layout !== undefined) {
      drawRecordCard(context, record, layout, images[index] ?? null);
    }
  });
  drawFooter(context, journal);
}
