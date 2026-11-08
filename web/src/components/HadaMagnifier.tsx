import { useEffect, useRef, useState } from 'react';
import { useJourneyState } from '../journey';

const NEWS_URL = '/book/hada_news.jpg';
const FRAME_URL = '/book/hada_magnifier.png';

/**
 * 放大镜贴图（1672×941）里透镜圆心的位置与半径。
 *
 * 数值来自 PNG 的 alpha 通道：透镜内部是一块完全透明的圆洞，
 * 圆心约在整张图的 (33.0%, 42.5%)，开口半径约 18.2% 图片宽度。
 * 用这组比例把透镜圆心对准鼠标，镜片就和木质镜框严丝合缝。
 */
const LENS_CX = 0.33;
const LENS_CY = 0.425;
const LENS_R = 0.182;
const FRAME_ASPECT = 941 / 1672;

/** 报纸在镜片里的放大倍数 */
const ZOOM = 1.5;

/**
 * 线索热点：屏幕宽高的 60% / 40%。
 * 鼠标（也就是透镜圆心）进入这个半径内就视为“找到陕北”。
 */
const CLUE_X = 0.6;
const CLUE_Y = 0.4;
const CLUE_RADIUS = 64;

const CLUE_DIALOG = {
  title: '陕北的消息',
  content:
    '【陕甘边区，刘志丹匪部盘踞陕北……】“同志！找到了！陕北还有咱们的根据地！”',
} as const;

interface HadaMagnifierProps {
  onOpenDialog: (title: string, content: string) => void;
}

export function HadaMagnifier({ onOpenDialog }: HadaMagnifierProps) {
  const { chapter, phase } = useJourneyState();
  // 与 open.current > 0.99 等价：书本完全展开后 phase 才会变成 open
  const active = chapter === 'hada' && phase === 'open';

  const [found, setFound] = useState(false);
  const [tracking, setTracking] = useState(false);
  const foundRef = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);

  // 离开哈达铺后复位，下次再进来还能再找一次
  useEffect(() => {
    foundRef.current = false;
    setFound(false);
    setTracking(false);
  }, [chapter]);

  useEffect(() => {
    if (!active || found) return;

    let raf = 0;
    let latest = { x: 0, y: 0 };

    /**
     * 每帧只写两个属性：
     * - 整张放大镜的位移：让透镜圆心跟着指针；
     * - 镜片的 background-position：把屏幕坐标换算到 1.5 倍报纸上。
     *
     * background-size 固定为 150vw × 150vh（见 CSS），
     * 所以镜片内任意一点对应的报纸坐标只和指针的屏幕坐标有关：
     *   P = 镜片半径 − 1.5 × 指针坐标
     */
    const layout = () => {
      raf = 0;
      const frame = frameRef.current;
      const glass = glassRef.current;
      if (!frame || !glass) return;

      const frameWidth = frame.offsetWidth;
      const frameHeight = frameWidth * FRAME_ASPECT;
      const radius = LENS_R * frameWidth;

      frame.style.transform = `translate3d(${
        latest.x - LENS_CX * frameWidth
      }px, ${latest.y - LENS_CY * frameHeight}px, 0)`;

      glass.style.backgroundPosition = `${
        radius - ZOOM * latest.x
      }px ${radius - ZOOM * latest.y}px`;
    };

    const onPointerMove = (event: PointerEvent) => {
      // 指针在按钮 / 弹窗 / 推演面板上时不显示放大镜
      if (
        event.target instanceof Element &&
        event.target.closest(
          'button, a, input, textarea, [data-ui], .dialog-backdrop, .bsc-root, .veil',
        )
      ) {
        setTracking(false);
        document.body.style.cursor = '';
        return;
      }

      // 按住鼠标拖拽旋转视角时收起放大镜，避免挡住画面
      if (event.buttons !== 0) {
        setTracking(false);
        document.body.style.cursor = '';
        return;
      }

      latest = { x: event.clientX, y: event.clientY };
      setTracking(true);
      // 放大镜就是光标，原生指针让位
      document.body.style.cursor = 'none';

      if (!raf) raf = requestAnimationFrame(layout);

      const clueX = window.innerWidth * CLUE_X;
      const clueY = window.innerHeight * CLUE_Y;
      if (
        !foundRef.current &&
        Math.hypot(latest.x - clueX, latest.y - clueY) <= CLUE_RADIUS
      ) {
        // 只触发一次：ref 挡住同一帧里的连续 pointermove，
        // 状态切走后整个监听和放大镜一起卸载
        foundRef.current = true;
        setFound(true);
        setTracking(false);
        document.body.style.cursor = '';
        onOpenDialog(CLUE_DIALOG.title, CLUE_DIALOG.content);
      }
    };

    const hide = () => {
      setTracking(false);
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', hide);
      window.removeEventListener('blur', hide);
      if (raf) cancelAnimationFrame(raf);
      document.body.style.cursor = '';
    };
  }, [active, found, onOpenDialog]);

  if (!active) return null;

  return (
    <>
      {!found && (
        <div className="hada-hint" role="status">
          <span className="hada-hint-icon" aria-hidden="true">
            🔍
          </span>
          <span>老赵：“参谋，用放大镜找找，陕北的红军在哪？”</span>
        </div>
      )}

      <div
        ref={frameRef}
        className="hada-magnifier"
        data-visible={tracking ? 'true' : 'false'}
        aria-hidden="true"
      >
        {/* 透镜：报纸放大了 1.5 倍，圆心跟着鼠标 */}
        <div
          ref={glassRef}
          className="hada-magnifier-glass"
          style={{ backgroundImage: `url(${NEWS_URL})` }}
        />
        {/* 木质镜框：PNG 的透镜部分是透明的，正好露出下面的报纸 */}
        <img
          className="hada-magnifier-frame"
          src={FRAME_URL}
          alt=""
          draggable={false}
        />
      </div>
    </>
  );
}
