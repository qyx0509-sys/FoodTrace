import type { DailyJournal } from '../../services/journal-service';
import {
  JOURNAL_POSTER_HEIGHT,
  JOURNAL_POSTER_WIDTH,
  renderJournalPoster,
} from '../../utils/canvas/journal-poster-renderer';

type JournalPosterComponentOption = WechatMiniprogram.Component.MethodOption & {
  generate(journal: DailyJournal): Promise<string>;
  getCanvasNode(): Promise<WechatMiniprogram.Canvas>;
};

interface CanvasQueryResult {
  node?: WechatMiniprogram.Canvas;
}

Component<Record<string, never>, Record<string, never>, JournalPosterComponentOption, []>({
  methods: {
    generate(journal: DailyJournal): Promise<string> {
      return this.getCanvasNode().then(async (canvas) => {
        await renderJournalPoster(canvas, journal);
        return new Promise((resolve, reject) => {
          wx.canvasToTempFilePath(
            {
              canvas,
              destHeight: JOURNAL_POSTER_HEIGHT,
              destWidth: JOURNAL_POSTER_WIDTH,
              fail: (error) => reject(new Error(error.errMsg)),
              fileType: 'png',
              height: JOURNAL_POSTER_HEIGHT,
              quality: 1,
              success: (result) => resolve(result.tempFilePath),
              width: JOURNAL_POSTER_WIDTH,
              x: 0,
              y: 0,
            },
            this,
          );
        });
      });
    },

    getCanvasNode(): Promise<WechatMiniprogram.Canvas> {
      return new Promise((resolve, reject) => {
        this.createSelectorQuery()
          .select('#journal-poster-canvas')
          .fields({ node: true, size: true })
          .exec((results) => {
            const queryResults = results as unknown as unknown[];
            const result = queryResults[0] as CanvasQueryResult | undefined;
            if (result?.node === undefined) {
              reject(new Error('CANVAS_NODE_NOT_FOUND'));
              return;
            }
            resolve(result.node);
          });
      });
    },
  },
});
