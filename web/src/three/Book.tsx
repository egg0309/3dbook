/* oxlint-disable react/immutability */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  useFrame,
  useThree,
  type ThreeEvent,
} from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BOOK_OPEN_DURATION, type ChapterId } from '../config';
import {
  journeyProgress,
  markInteracted,
  setCinematic,
  setDragging,
  setJourneyPhase,
  useJourneyState,
  useOpenRequest,
  useResetToken,
  type JourneyPhase,
} from '../journey';
import { useBookTextures } from './useBookTextures';
import { createCornerGeometry, createStarGeometry } from './bookGeometry';
import type { BookTextures } from './textures';

const W = 1.7;
const H = 2.35;
const T = 0.34;
const COVER = 0.03;
const HALF_W = W / 2;
const HALF_H = H / 2;
const HALF_T = T / 2;
const FRONT_Z = HALF_T - COVER / 2;
const BACK_Z = -FRONT_Z;
const PAGE_T = T - COVER * 2 - 0.006;
const PAGE_W = W - 0.075;
const PAGE_H = H - 0.07;

const BASE_TILT_X = -0.34;
const BASE_TILT_Z = -0.055;
/**
 * 完全翻开后整本书躺平：书页朝上。
 * 立体纸板再由 PopUpScene 里的世界对齐舞台立起来，
 * 两者配合后纸板才是真正的垂直屏风，底边贴着纸面。
 */
const OPEN_TILT_X = -Math.PI / 2;
const OPEN_TILT_Z = 0.0;

function easeInOutQuart(value: number) {
  return value < 0.5
    ? 8 * value * value * value * value
    : 1 - Math.pow(-2 * value + 2, 4) / 2;
}

function smoothstep01(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function isUiTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest('button, a, input, textarea, [data-ui]')
  );
}

interface FrameProps {
  centerX: number;
  material: THREE.Material;
}

function CoverFrame({ centerX, material }: FrameProps) {
  const inset = 0.085;
  const bar = 0.018;
  const z = COVER / 2 + 0.006;
  const lengthX = W - inset * 2;
  const lengthY = H - inset * 2;
  return (
    <>
      <RoundedBox
        args={[lengthX, bar, 0.012]}
        radius={0.0025}
        smoothness={2}
        position={[centerX, H / 2 - inset, z]}
        material={material}
      />
      <RoundedBox
        args={[lengthX, bar, 0.012]}
        radius={0.0025}
        smoothness={2}
        position={[centerX, -H / 2 + inset, z]}
        material={material}
      />
      <RoundedBox
        args={[bar, lengthY, 0.012]}
        radius={0.0025}
        smoothness={2}
        position={[centerX - W / 2 + inset, 0, z]}
        material={material}
      />
      <RoundedBox
        args={[bar, lengthY, 0.012]}
        radius={0.0025}
        smoothness={2}
        position={[centerX + W / 2 - inset, 0, z]}
        material={material}
      />
    </>
  );
}

interface CornerProps {
  centerX: number;
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
}

function CornerProtectors({ centerX, material, geometry }: CornerProps) {
  const corners = [
    { x: centerX - HALF_W + 0.018, y: HALF_H - 0.018, rotation: 0 },
    { x: centerX + HALF_W - 0.018, y: HALF_H - 0.018, rotation: -Math.PI / 2 },
    { x: centerX + HALF_W - 0.018, y: -HALF_H + 0.018, rotation: Math.PI },
    { x: centerX - HALF_W + 0.018, y: -HALF_H + 0.018, rotation: Math.PI / 2 },
  ];
  return (
    <>
      {corners.map((corner) => (
        <mesh
          key={`${corner.x}-${corner.y}`}
          geometry={geometry}
          material={material}
          position={[corner.x, corner.y, COVER / 2 + 0.002]}
          rotation={[0, 0, corner.rotation]}
        />
      ))}
    </>
  );
}

interface EmblemProps {
  centerX: number;
  gold: THREE.Material;
  red: THREE.Material;
  starGeometry: THREE.BufferGeometry;
  back?: boolean;
}

function Emblem({ centerX, gold, red, starGeometry, back = false }: EmblemProps) {
  return (
    <group position={[centerX, back ? 0.1 : 0.78, 0]}>
      <mesh position={[0, 0, COVER / 2 + 0.0075]} material={gold}>
        <torusGeometry args={[back ? 0.335 : 0.315, 0.006, 8, 64]} />
      </mesh>
      <mesh
        position={[0, 0, COVER / 2 + 0.0045]}
        scale={[back ? 0.315 : 0.3, back ? 0.315 : 0.3, 0.32]}
        geometry={starGeometry}
        material={gold}
      />
      {!back && (
        <mesh
          position={[0, 0, COVER / 2 + 0.0095]}
          scale={[0.265, 0.265, 0.3]}
          geometry={starGeometry}
          material={red}
        />
      )}
    </group>
  );
}

interface BookModelProps {
  textures: BookTextures;
  /** 当前章节：雪山草地使用冷色内页，其余章节沿用纸纹 */
  chapter: ChapterId;
  coverHingeRef: RefObject<THREE.Group | null>;
  /** 左页页帧：挂在封面铰链上，供立体机关读取 matrixWorld */
  leftPageRef: RefObject<THREE.Object3D | null>;
  /** 右页页帧：固定在页块书脊上，供立体机关读取 matrixWorld */
  rightPageRef: RefObject<THREE.Object3D | null>;
  /** 书本翻开进度：平铺底图的点击只在完全展开后生效 */
  openRef: RefObject<number>;
  /** 平铺底图（湘江血水）也能点开弹窗 */
  onOpenDialog: (title: string, content: string) => void;
}

/**
 * 雪山章节的内页纯色：冷白偏蓝，和雪山的阴影面呼应。
 * 用 MeshBasicMaterial（不受暖色内灯影响），否则 #dbe5f0 会被
 * 室内暖光染成米黄色，看不出换过背景。
 */
const SNOW_PAGE_COLOR = '#c8d8e8';
const SNOW_ENDPAPER_COLOR = '#b9cddf';

/**
 * 章节专属的「平铺内页」底图。
 *
 * 这些图不参与立体机关（不立起来），而是直接铺在展开后的书页表面：
 *   · hada       哈达铺 —— 旧报纸
 *   · luding     飞夺泸定桥 —— 咆哮的大渡河
 *   · xiangjiang 湘江血战 —— 被鲜血染红的江水
 *   · tongdao    通道会议 —— 做旧地图
 *   · chishui    四渡赤水 —— 赤水河与两岸山野
 */
const CHAPTER_PAPER_URLS: Partial<Record<ChapterId, string>> = {
  hada: '/book/hada_news.jpg',
  luding: '/book/ld_river.png',
  xiangjiang: '/book/xj_river.jpg',
  tongdao: '/book/td_map.png',
  chishui: '/book/cs_map.jpg',
};

/**
 * 需要「跨页拼图」而不是「单页裁切」的底图。
 *
 * 通道会议的地图是一整张横图，中间本来就有折痕：
 * 左右两页各取一半，沿书脊拼回完整的一张地图，
 * 折痕正好落在书缝上。
 * 四渡赤水的赤水河同样是一整幅蜿蜒的横图，拼回去才是一条完整的河。
 * 其余章节的底图仍然左右各铺一张。
 */
const SPREAD_PAPER_URLS = new Set<string>([
  '/book/td_map.png',
  '/book/cs_map.jpg',
]);

interface ChapterPaper {
  url: string;
  /** 左页（封面内衬）使用的贴图 */
  left: THREE.Texture;
  /** 右页（页块第一张纸）使用的贴图 */
  right: THREE.Texture;
}

/**
 * 加载当前章节的内页底图。
 *
 * 底图是 1672×941 的横图，书页是竖版；直接铺满会把画面压扁。
 * 默认按 CSS `cover` 的思路只取中间一条竖幅（约 40% 宽度），
 * 让底图以正常比例铺满左右两页；跨页地图（SPREAD_PAPER_URLS）
 * 则左右各取一半，沿书脊拼回完整的一张。
 */
function useChapterPaperTexture(chapter: ChapterId) {
  const url = CHAPTER_PAPER_URLS[chapter] ?? null;
  const [paper, setPaper] = useState<ChapterPaper | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    const loaded: THREE.Texture[] = [];

    new THREE.TextureLoader().load(
      url,
      (next) => {
        loaded.push(next);
        if (cancelled) return;

        next.colorSpace = THREE.SRGBColorSpace;
        next.anisotropy = 8;
        next.wrapS = THREE.ClampToEdgeWrapping;
        next.wrapT = THREE.ClampToEdgeWrapping;

        if (SPREAD_PAPER_URLS.has(url)) {
          // 跨页地图：右页从书脊向外采样原图右半，左页采样左半。
          // 左页纸面的 u 轴从外缘指向书脊，所以直接用 0 → 0.5。
          next.repeat.set(0.5, 1);
          next.offset.set(0.5, 0);
          next.needsUpdate = true;

          const left = next.clone();
          left.repeat.set(0.5, 1);
          left.offset.set(0, 0);
          left.needsUpdate = true;
          loaded.push(left);

          setPaper({ url, left, right: next });
          return;
        }

        const image = next.image as { width?: number; height?: number } | null;
        const imageAspect =
          image?.width && image?.height ? image.width / image.height : 1.776;
        const pageAspect = (W - 0.004) / (H - 0.004);
        const visible = Math.min(1, pageAspect / imageAspect);
        next.repeat.set(visible, 1);
        next.offset.set((1 - visible) / 2, 0);
        next.needsUpdate = true;

        setPaper({ url, left: next, right: next });
      },
      undefined,
      () => {
        console.warn(`[book] 章节内页底图加载失败: ${url}`);
      },
    );

    return () => {
      cancelled = true;
      loaded.forEach((texture) => texture.dispose());
    };
  }, [url]);

  // 用 url 比对，避免切换到另一个有底图的章节时，
  // 在新图加载完成前闪一帧上一章的底图。
  return paper && paper.url === url ? paper : null;
}

function BookModel({
  textures,
  chapter,
  coverHingeRef,
  leftPageRef,
  rightPageRef,
  openRef,
  onOpenDialog,
}: BookModelProps) {
  /** 章节专属的平铺内页（报纸 / 江水 / 地图）；其余章节为 null */
  const pagePaper = useChapterPaperTexture(chapter);
  const starGeometry = useMemo(() => createStarGeometry(1, 0.42, 0.06), []);
  const cornerGeometry = useMemo(
    () => createCornerGeometry(0.165, 0.038, 0.012),
    [],
  );
  const ribbonCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.5, -HALF_H + 0.02, 0.03),
        new THREE.Vector3(-0.55, -HALF_H - 0.14, 0.06),
        new THREE.Vector3(-0.63, -HALF_H - 0.32, 0.11),
        new THREE.Vector3(-0.8, -HALF_H - 0.28, 0.16),
      ]),
    [],
  );

  const materials = useMemo(() => {
    const cloth = new THREE.MeshPhysicalMaterial({
      map: textures.clothMap,
      bumpMap: textures.clothBump,
      bumpScale: 0.014,
      roughness: 0.84,
      metalness: 0.03,
      sheen: 0.26,
      sheenColor: new THREE.Color('#8d3b2e'),
      sheenRoughness: 0.78,
      envMapIntensity: 0.38,
      side: THREE.DoubleSide,
    });

    const pageEdge = new THREE.MeshStandardMaterial({
      map: textures.pageEdge,
      bumpMap: textures.pageEdge,
      bumpScale: 0.004,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.3,
    });

    const paper = new THREE.MeshStandardMaterial({
      map: textures.paper,
      bumpMap: textures.paper,
      bumpScale: 0.002,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.32,
    });

    // 雪山章节没有专门的内页图，按需求改用冷色纯色纸面；
    // 其余章节继续使用生成好的纸纹贴图。
    const snowChapter = chapter === 'snow';

    // 章节平铺底图（报纸 / 江水 / 地图）：左右两页各用一张贴图，
    // 跨页地图的两半在书脊处拼回整张。
    // 用 MeshBasicMaterial 避免室内暖光把画面染成米黄色。
    const firstPage = snowChapter
      ? new THREE.MeshBasicMaterial({
          color: new THREE.Color(SNOW_PAGE_COLOR),
          toneMapped: false,
        })
      : pagePaper
        ? new THREE.MeshBasicMaterial({
            map: pagePaper.right,
            toneMapped: false,
          })
        : new THREE.MeshStandardMaterial({
            map: textures.firstPage,
            bumpMap: textures.paper,
            bumpScale: 0.0018,
            roughness: 0.94,
            metalness: 0,
            envMapIntensity: 0.3,
          });

    const endpaper = snowChapter
      ? new THREE.MeshBasicMaterial({
          color: new THREE.Color(SNOW_ENDPAPER_COLOR),
          toneMapped: false,
        })
      : pagePaper
        ? new THREE.MeshBasicMaterial({
            map: pagePaper.left,
            toneMapped: false,
          })
        : new THREE.MeshStandardMaterial({
            map: textures.endpaper,
            bumpMap: textures.endpaper,
            bumpScale: 0.0025,
            roughness: 0.9,
            metalness: 0,
            envMapIntensity: 0.35,
          });

    const coverArt = new THREE.MeshStandardMaterial({
      map: textures.coverArt,
      bumpMap: textures.coverArt,
      bumpScale: 0.004,
      roughness: 0.52,
      metalness: 0.28,
      envMapIntensity: 0.9,
      transparent: true,
      alphaTest: 0.015,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const backArt = new THREE.MeshStandardMaterial({
      map: textures.backCoverArt,
      bumpMap: textures.backCoverArt,
      bumpScale: 0.003,
      roughness: 0.58,
      metalness: 0.2,
      envMapIntensity: 0.8,
      transparent: true,
      alphaTest: 0.015,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const coverBase = textures.coverBase
      ? new THREE.MeshStandardMaterial({
          map: textures.coverBase,
          roughness: 0.72,
          metalness: 0.06,
          envMapIntensity: 0.5,
        })
      : null;

    const backCoverBase = textures.backCoverBase
      ? new THREE.MeshStandardMaterial({
          map: textures.backCoverBase,
          roughness: 0.74,
          metalness: 0.05,
          envMapIntensity: 0.45,
        })
      : null;

    const gold = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#c9a25a'),
      metalness: 0.94,
      roughness: 0.3,
      clearcoat: 0.35,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.25,
    });

    const red = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#4c0a06'),
      metalness: 0.01,
      roughness: 0.64,
      clearcoat: 0.04,
      clearcoatRoughness: 0.45,
      emissive: new THREE.Color('#0b0201'),
      emissiveIntensity: 0.18,
      envMapIntensity: 0.16,
    });

    const ribbon = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7a1c16'),
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    const pageMaterials: THREE.Material[] = [
      pageEdge,
      cloth,
      pageEdge,
      pageEdge,
      paper,
      paper,
    ];

    return {
      cloth,
      pageEdge,
      paper,
      firstPage,
      endpaper,
      coverArt,
      backArt,
      coverBase,
      backCoverBase,
      gold,
      red,
      ribbon,
      pageMaterials,
    };
  }, [textures, chapter, pagePaper]);

  // 湘江血水 / 通道地图铺满左右两页，点击任何一处页纸都算点击底图。
  // 其余章节不挂这些处理，保持原来的纯展示行为。
  const paperDialog = PAPER_CLICK_DIALOGS[chapter];
  const paperInteractive = Boolean(paperDialog);

  const handlePaperClick = (event: ThreeEvent<MouseEvent>) => {
    if (!paperDialog) return;
    // 书没完全展开 / 正在拖拽旋转视角时不响应
    if (openRef.current < 0.995) return;
    if ((event.delta ?? 0) > 5) return;
    event.stopPropagation();
    onOpenDialog(paperDialog.title, paperDialog.content);
  };

  const handlePaperOver = (event: ThreeEvent<PointerEvent>) => {
    if (!paperInteractive || openRef.current < 0.995) return;
    event.stopPropagation();
    document.body.style.cursor = 'pointer';
  };

  const handlePaperOut = (event: ThreeEvent<PointerEvent>) => {
    if (!paperInteractive) return;
    event.stopPropagation();
    document.body.style.cursor = '';
  };

  return (
    <group>
      <RoundedBox
        args={[W, H, COVER]}
        radius={0.012}
        smoothness={4}
        position={[0, 0, BACK_Z]}
        material={materials.cloth}
      />

      <mesh position={[-HALF_W, 0, 0]} material={materials.cloth}>
        <cylinderGeometry
          args={[HALF_T, HALF_T, H, 48, 1, true, Math.PI, Math.PI]}
        />
      </mesh>
      <mesh
        position={[-HALF_W, HALF_H - 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.cloth}
      >
        <circleGeometry args={[HALF_T, 48, Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh
        position={[-HALF_W, -HALF_H + 0.002, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.cloth}
      >
        <circleGeometry args={[HALF_T, 48, Math.PI / 2, Math.PI]} />
      </mesh>

      {[-0.68, 0, 0.68].map((y) => (
        <mesh
          key={y}
          position={[-HALF_W, y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.cloth}
        >
          <torusGeometry args={[HALF_T + 0.003, 0.007, 8, 40]} />
        </mesh>
      ))}

      <mesh material={materials.pageMaterials}>
        <boxGeometry args={[PAGE_W, PAGE_H, PAGE_T]} />
      </mesh>
      <mesh
        position={[0, 0, PAGE_T / 2 + 0.0012]}
        material={materials.firstPage}
        onClick={paperInteractive ? handlePaperClick : undefined}
        onPointerOver={paperInteractive ? handlePaperOver : undefined}
        onPointerOut={paperInteractive ? handlePaperOut : undefined}
      >
        <planeGeometry args={[PAGE_W - 0.004, PAGE_H - 0.004]} />
      </mesh>

      <mesh scale={[1, 1, 0.32]} material={materials.ribbon}>
        <tubeGeometry args={[ribbonCurve, 48, 0.019, 6, false]} />
      </mesh>

      <group position={[0, 0, BACK_Z]} rotation={[0, Math.PI, 0]}>
        {textures.backCoverBase && materials.backCoverBase && (
          <mesh
            position={[0, 0, COVER / 2 + 0.0008]}
            material={materials.backCoverBase}
          >
            <planeGeometry args={[W - 0.004, H - 0.004]} />
          </mesh>
        )}
        <mesh
          position={[0, 0, COVER / 2 + 0.0015]}
          material={materials.backArt}
        >
          <planeGeometry args={[W - 0.02, H - 0.02]} />
        </mesh>
        <CoverFrame centerX={0} material={materials.gold} />
        <CornerProtectors
          centerX={0}
          material={materials.gold}
          geometry={cornerGeometry}
        />
        <Emblem
          centerX={0}
          gold={materials.gold}
          red={materials.red}
          starGeometry={starGeometry}
          back
        />
      </group>

      <group
        ref={coverHingeRef}
        position={[-HALF_W, 0, FRONT_Z]}
      >
        <RoundedBox
          args={[W, H, COVER]}
          radius={0.012}
          smoothness={4}
          position={[HALF_W, 0, 0]}
          material={materials.cloth}
        />
        {textures.coverBase && materials.coverBase && (
          <mesh
            position={[HALF_W, 0, COVER / 2 + 0.0008]}
            material={materials.coverBase}
          >
            <planeGeometry args={[W - 0.004, H - 0.004]} />
          </mesh>
        )}
        <mesh
          position={[HALF_W, 0, COVER / 2 + 0.0015]}
          material={materials.coverArt}
        >
          <planeGeometry args={[W - 0.02, H - 0.02]} />
        </mesh>
        <mesh
          position={[HALF_W, 0, -COVER / 2 - 0.0015]}
          rotation={[0, Math.PI, 0]}
          material={materials.endpaper}
          onClick={paperInteractive ? handlePaperClick : undefined}
          onPointerOver={paperInteractive ? handlePaperOver : undefined}
          onPointerOut={paperInteractive ? handlePaperOut : undefined}
        >
          <planeGeometry args={[W - 0.05, H - 0.05]} />
        </mesh>
        <CoverFrame centerX={HALF_W} material={materials.gold} />
        <CornerProtectors
          centerX={HALF_W}
          material={materials.gold}
          geometry={cornerGeometry}
        />
        <Emblem
          centerX={HALF_W}
          gold={materials.gold}
          red={materials.red}
          starGeometry={starGeometry}
        />

        {/*
         * 左页页帧：封面内衬的书脊边。
         * 封面翻开 180° 后，它正好落在书脊上，轴向和右页页帧重合；
         * 封面合上时随铰链翻转，机关被夹回书页之间。
         */}
        <object3D
          ref={leftPageRef}
          position={[0, 0, FRONT_Z - BOOK_SURFACE_Y]}
          quaternion={LEFT_PAGE_QUATERNION}
        />
      </group>

      {/*
       * 右页页帧：原点在书脊、页块表面。
       * 局部 X = 横跨书页，Y = 页面法线（书局部 +Z），Z = 朝读者（书局部 -Y）。
       */}
      <object3D
        ref={rightPageRef}
        position={[SPINE_X, 0, BOOK_SURFACE_Y]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 立体书机关：书页展开后的折叠场景                                    */
/* ------------------------------------------------------------------ */

type PopUpSceneId =
  | 'outside'
  | 'inside'
  | 'xiangjiang'
  | 'tongdao'
  | 'chishui'
  | 'luding'
  | 'snow'
  | 'hada'
  | 'huishi';
type PopUpLayerId =
  | 'building'
  | 'bear'
  | 'roomBg'
  | 'zunyi_people'
  | 'zunyi_crates'
  | 'zunyi_stove'
  | 'zunyi_bag'
  | 'xj_rearguard'
  | 'xj_shore'
  | 'xj_bear'
  | 'td_people_left'
  | 'td_people_right'
  | 'td_bear'
  | 'cs_mountain_left'
  | 'cs_mountain_right'
  | 'cs_telegram'
  | 'ld_bridge'
  | 'ld_anchor_left'
  | 'ld_anchor_right'
  | 'ld_splash'
  | 'ld_boat'
  | 'snow_bg'
  | 'snow_pile'
  | 'snow_flag'
  | 'snow_rifle'
  | 'snow_grass'
  | 'snow_bear'
  | 'item_hook'
  | 'item_matches'
  | 'hada_news'
  | 'hada_bear'
  | 'hs_gate'
  | 'hs_hug'
  | 'hs_bear';
type PopUpHalfSide = 'left' | 'right';
type PopUpFold = 'in' | 'out';

/**
 * 展开后整个跨页的中心 X。
 * 与 Book 里 spreadCenter 的算法保持一致，OrbitControls 以它为环绕中心。
 */
const SPREAD_CENTER_X = -((HALF_W + W - PAGE_W / 2) / 2);

/**
 * 书脊 X：书本摊平后，左页（翻开的封面内衬）与右页（页块）
 * 在这里相接。跨页机关以它为共同折缝：
 * 左半张纸在左页，右半张纸在右页。
 */
const SPINE_X = -HALF_W;

/**
 * 书摊平后，右页纸面的高度（书局部坐标）。
 *
 * 页块 box 的正面在 z = PAGE_T / 2，第一张纸的 plane 又高出 0.0012。
 * 机关底边就贴在这个高度上，所以任一 mesh 的最终 y =
 *   height / 2 + BOOK_SURFACE_Y
 * 也就是「高度 / 2 + 书本表面高度」，底边正好落在纸面上，不再悬空。
 */
const BOOK_SURFACE_Y = PAGE_T / 2 + 0.0018;

/**
 * 左页页帧在封面铰链组里的局部朝向。
 *
 * 左页就是封面内衬。封面翻开 180° 后，这个朝向必须和右页页帧完全一致：
 *   X 轴 = 横跨书页（朝读者右侧）
 *   Y 轴 = 页面法线（垂直纸面向上）
 *   Z 轴 = 页面深度方向（朝读者）
 * 封面合上时它跟着封面一起翻转（法线朝下、页面被夹住），
 * 所以机关会随书本合上而被“夹”进书页之间，而不是悬浮在空气里。
 *
 * 推导：L = Ry(π) · Rx(π/2)，等价的轴角是绕 (0, √½, −√½) 转 180°。
 */
const LEFT_PAGE_QUATERNION = new THREE.Quaternion(
  0,
  Math.SQRT1_2,
  -Math.SQRT1_2,
  0,
);

/**
 * 纸板厚度与叠层数（源码 cardStack 的轻量版）。
 * 每张纸板 = 正面贴图 + 若干层向后退的纸芯 + 背面，
 * 从侧面看有真实的“纸板边”，而不是一张零厚度的贴纸。
 */
const CARD_THICKNESS = 0.008;
const CARD_LAYERS = 3;
const CARD_EDGE_COLOR = '#c7b28c';

/**
 * 机关淡入区间（书本展开进度 open：0 → 1）。
 *
 * open 与封面角度成正比：封面翻开角度 = π × open。
 * V 折纸板在封面还没完全摊平时就会从书页里立起来，
 * 只要封面还翘着几度，纸板就会和封面相交。
 * 所以一直藏到封面剩余角度约 3.6°（open = 0.98）才开始淡入，
 * open = 0.999（剩余 0.18°）时完全显示；
 * open 低于起点时 visible = false 且 opacity = 0，
 * 合上的书绝对不可能渲染出任何一张纸板。
 */
const POPUP_REVEAL_START = 0.5;
const POPUP_REVEAL_END = 0.5;
/** 低于这个透明度直接整组隐藏，连纸板边角都不提交渲染 */
const POPUP_VISIBLE_EPSILON = 0.001;

/**
 * 推门运镜：
 * 0.8s 推到建筑前 → 瞬间切换室内 → 停留 0.25s → 0.8s 平滑退回原位。
 */
const DOLLY_DURATION = 0.8;
const DOLLY_BACK_DURATION = 0.8;
const DOLLY_HOLD = 0.25;
const DOLLY_CLOSE_Z = 1.0;

/** 相机视差幅度：鼠标归一化坐标 → 世界单位的偏移 */
const PARALLAX_X = 0.16;
const PARALLAX_Y = 0.08;

/** 视差阻尼：60fps 下等价于源码里的 0.1 */
const PARALLAX_DAMPING = 0.1;

interface PopUpSource {
  url: string;
  /** 首选文件不存在时自动回退，避免 404 让整个机关消失 */
  fallbackUrl?: string;
  /**
   * 保留完整画框，不按非透明内容裁切。
   *
   * 遵义会议的四层素材是同一台相机渲染的整幅分层场景图：
   * 人群、木箱、火炉、书包在各自画布里的位置本身就是构图的一部分。
   * 如果逐张裁到内容包围盒再各自缩放，每一层都会被重新居中、放大，
   * 叠在一起时位置和比例就全乱了。开启后四层共用同一个
   * 1671×941 画框，只靠 z 轴拉开景深。
   */
  preserveFrame?: boolean;
}

const POPUP_SOURCES: Record<PopUpLayerId, PopUpSource> = {
  building: { url: '/book/building.png' },
  bear: { url: '/book/bear.jpg' },
  // 室内背景墙。需求里写的是 room_bg.jpg，仓库里实际是 room_bg.png；
  // 优先用现有 png，日后换成 jpg 也能自动回退。
  roomBg: {
    url: '/book/room_bg.png',
    fallbackUrl: '/book/room_bg.jpg',
  },
  // 遵义会议室内四层：同一画框，从远到近叠放
  zunyi_people: {
    url: '/book/zunyi_people.jpg',
    preserveFrame: true,
  },
  zunyi_crates: {
    url: '/book/zunyi_crates.jpg',
    preserveFrame: true,
  },
  zunyi_stove: {
    url: '/book/zunyi_stove.jpg',
    preserveFrame: true,
  },
  zunyi_bag: {
    url: '/book/zunyi_bag.jpg',
    preserveFrame: true,
  },
  // 湘江血战：血水底图同样平铺在书页上（见 CHAPTER_PAPER_URLS）；
  // 对岸阻击阵地 / 近岸土坎 / 老陈都是黑底单物件，按非透明内容裁切。
  xj_rearguard: {
    url: '/book/xj_rearguard.jpg',
  },
  xj_shore: {
    url: '/book/xj_shore.jpg',
  },
  xj_bear: {
    url: '/book/xj_bear.jpg',
  },
  // 通道会议：地图已经改为平铺在书页上的底图（见 CHAPTER_PAPER_URLS），
  // 两侧指路 / 争论的人物和拿纸条的熊都是黑底单物件，按内容裁切。
  td_people_left: {
    url: '/book/td_people_left.jpg',
  },
  td_people_right: {
    url: '/book/td_people_right.jpg',
  },
  td_bear: {
    url: '/book/td_bear.jpg',
  },
  // 四渡赤水：赤水河已经改为平铺在书页上的底图（见 CHAPTER_PAPER_URLS），
  // 左右两座山和急电都是黑底单物件，按非透明内容裁切，
  // 分别立在两页外侧和两山之间的前景。
  cs_mountain_left: {
    url: '/book/cs_mountain_left.jpg',
  },
  cs_mountain_right: {
    url: '/book/cs_mountain_right.jpg',
  },
  cs_telegram: {
    url: '/book/cs_telegram.jpg',
  },
  // 飞夺泸定桥：江水已经改为平铺在书页上的底图（见 CHAPTER_PAPER_URLS），
  // 不再作为立体图层；铁链和战士保留整幅画框。
  // 左右桥台 / 小船 / 水花都是黑底单物件，按非透明内容裁切，
  // 让各自以合适的尺寸立在页面上。
  ld_bridge: {
    url: '/book/ld_bridge.jpg',
    preserveFrame: true,
  },
  ld_anchor_left: {
    url: '/book/ld_anchor_left.jpg',
  },
  ld_anchor_right: {
    url: '/book/ld_anchor_right.jpg',
  },
  ld_splash: {
    url: '/book/ld_splash.jpg',
  },
  ld_boat: {
    url: '/book/ld_boat.jpg',
  },
  // 雪山草地八层：同一台相机渲染的 1672×941 整幅分层场景图。
  // 每一层在山脊 / 草地上的位置就是最终构图，必须保留完整画框，
  // 只靠 z 轴拉开前后景深。
  snow_bg: {
    url: '/book/snow_bg.jpg',
    preserveFrame: true,
  },
  snow_pile: {
    url: '/book/snow_pile.jpg',
    preserveFrame: true,
  },
  snow_flag: {
    url: '/book/snow_flag.jpg',
    preserveFrame: true,
  },
  snow_rifle: {
    url: '/book/snow_rifle.jpg',
    preserveFrame: true,
  },
  snow_grass: {
    url: '/book/snow_grass.jpg',
    preserveFrame: true,
  },
  snow_bear: {
    url: '/book/snow_bear.jpg',
    preserveFrame: true,
  },
  item_hook: {
    url: '/book/item_hook.jpg',
    preserveFrame: true,
  },
  item_matches: {
    url: '/book/item_matches.jpg',
    preserveFrame: true,
  },
  // 哈达铺：报纸是整幅背景，必须保留完整画框；
  // 老赵是抠图角色，按非透明内容裁切后贴在前景。
  hada_news: {
    url: '/book/hada_news.jpg',
    preserveFrame: true,
  },
  hada_bear: {
    url: '/book/hada_bear.jpg',
  },
  // 三军会师：城楼 / 拥抱群像 / 老陈都是黑底单物件，
  // 按非透明内容裁切后立在不同深度上。
  hs_gate: {
    url: '/book/hs_gate.jpg',
  },
  hs_hug: {
    url: '/book/hs_hug.jpg',
  },
  hs_bear: {
    url: '/book/hs_bear.jpg',
  },
};

interface PopUpDialog {
  title: string;
  content: string;
}

/** 点击机关后交给 React 层的自定义弹窗，不再使用 window.alert */
const POPUP_DIALOGS: Partial<Record<PopUpLayerId, PopUpDialog>> = {
  bear: {
    title: '历史向导老陈',
    content: '同志，里面正在开会，快推门进去看看吧！',
  },
  zunyi_people: {
    title: '激烈的交锋',
    content:
      '争论声在狭小的屋子里回荡。面对几十万大军的围堵，红军究竟该往哪走？每一个决定，都压着三万人的生死。',
  },
  zunyi_crates: {
    title: '将就的座位',
    content:
      '屋子里缺少板凳，木箱也成为座椅。在这连坐处都极其简陋的地方，却完成了中国革命史上最伟大的一次转折。',
  },
  zunyi_stove: {
    title: '严寒的考验',
    content:
      '炭火微弱，根本驱不散深冬的严寒。当时的红军，不仅缺衣少食，连生火取暖都成了一种奢侈。就是在这样的苦寒中，他们硬是蹚出了一条生路。',
  },
  zunyi_bag: {
    title: '随时待命的行囊',
    content:
      '行囊还没来得及放下，里面塞满了文件和电报。会议一旦结束，他们随时准备背起行囊，再次冲入风雪之中。',
  },
  xj_rearguard: {
    title: '断后的兄弟',
    content:
      '为了掩护主力过江，红三十四师的兄弟们死死钉在阵地上。这一别，就是永别。',
  },
  xj_shore: {
    title: '满目疮痍',
    content:
      '渡口边散落着残破的辎重和草鞋。大搬家式的转移，让队伍付出了极其惨痛的代价。',
  },
  xj_bear: {
    title: '老陈的眼泪',
    content:
      '老陈捂着脸，泣不成声：“八万六千人啊……过了江，就只剩三万了……”',
  },
  td_people_left: {
    title: '改变既定方针',
    content:
      '“不能去湘西！那是往敌人的火坑里跳！我们应该改向敌人力量薄弱的贵州进军！”',
  },
  td_people_right: {
    title: '激烈的争论',
    content: '“可是这是中央定下的计划，说改就改，哪有那么容易？”',
  },
  td_bear: {
    title: '老陈的担忧',
    content: '老陈凑过来低声说：“同志，大家意见不一，咱们到底听谁的？”',
  },
  cs_mountain_left: {
    title: '运动战的巅峰',
    content:
      '娄山关大捷，长征以来的最大胜利！红军在崇山峻岭间如神兵天降，硬是在绝境中杀出了一条血路。',
  },
  cs_mountain_right: {
    title: '运动战的巅峰',
    content:
      '娄山关大捷，长征以来的最大胜利！红军在崇山峻岭间如神兵天降，硬是在绝境中杀出了一条血路。',
  },
  cs_telegram: {
    title: '敌情万变',
    content:
      '侦察参谋递来急电：“敌军又追来了！”但这一次，他们连我们的尾灯都看不见！',
  },
  ld_bridge: {
    title: '血肉铸就的通道',
    content:
      '桥板被敌人抽走，只剩下十三根冰冷的铁索。二十二名勇士一手攀着铁索，一手拿着枪，在枪林弹雨中硬是蹚出了一条生路。',
  },
  ld_anchor_left: {
    title: '大渡河天险',
    content:
      '对岸的桥板被抽空，只剩下光秃秃的铁索连着两岸的桥台。红军无路可退。',
  },
  ld_anchor_right: {
    title: '大渡河天险',
    content:
      '对岸的桥板被抽空，只剩下光秃秃的铁索连着两岸的桥台。红军无路可退。',
  },
  ld_boat: {
    title: '金沙江的奇迹',
    content:
      '在这之前，红军仅靠着几条这样的小木船，在金沙江上日夜摆渡了七天七夜，跳出了几十万敌军的包围圈。',
  },
  snow_bg: {
    title: '翻越夹金山',
    content:
      '夹金山海拔四千多米，终年积雪，当地人叫它“神山”。红军战士穿着单衣，踩着没膝的积雪，向云端里的山口一步步挪去。',
  },
  snow_pile: {
    title: '没膝的雪窝',
    content:
      '雪面下是看不见的冰缝。前面的战士用木棍探路，后面的人沿着脚印走；一个人倒下，旁边的人立刻把他拉起来。',
  },
  snow_flag: {
    title: '风雪中的红旗',
    content:
      '旗面被风撕成布条，旗杆却始终没有倒。战士们说，看见红旗，就知道队伍还在，路还在。',
  },
  snow_rifle: {
    title: '肩上的钢枪',
    content:
      '枪托冻得粘手，枪栓几乎拉不开。可没有人把枪放下——翻过雪山，还有更长的路要打。',
  },
  snow_grass: {
    title: '茫茫草地',
    content:
      '松潘草地一望无际，脚下是沼泽，水是黑的，不能喝。战士们把皮带、草根、树皮煮了充饥。',
  },
  snow_bear: {
    title: '向导的叮嘱',
    content:
      '易班熊把最后一把炒面分给身边的同志：“跟着红旗走，别停下。停下，就再也起不来了。”',
  },
  item_hook: {
    title: '一枚鱼钩',
    content:
      '缝衣针弯成的鱼钩，在沼泽的水塘里钓起过小鱼。几条小鱼，就是几个战士活下去的希望。',
  },
  item_matches: {
    title: '几根火柴',
    content:
      '火柴受潮了，划了好几根才点着。一小簇火，烤干了衣服，也烤热了冻僵的手。',
  },
  hada_bear: {
    title: '老赵的困惑',
    content:
      '老赵把几张皱巴巴的报纸拍在桌上：“参谋，满墙都是敌人的假消息，用放大镜找找，陕北的红军在哪？”',
  },
  hada_news: {
    title: '敌人的“捷报”',
    content:
      '报纸上印着：“朱毛残部流窜川康，已溃不成军。”但这上面，藏着决定红军命运的情报。',
  },
  hs_gate: {
    title: '会师楼',
    content:
      '1936年10月，甘肃会宁。这座明代古城门，见证了红军三大主力的历史性会合。',
  },
  hs_hug: {
    title: '胜利的拥抱',
    content:
      '两万五千里跋涉，无数战友牺牲。此刻，他们终于紧紧拥抱在一起，宣告长征胜利结束！',
  },
  hs_bear: {
    title: '跨越时空的迎接',
    content:
      '老陈站在城门前，张开双臂迎接你：“同志，我们走完了！这盛世，如你们所愿！”',
  },
};

/**
 * 平铺底图的弹窗。
 *
 * 湘江血水、通道地图都直接铺在书页上（见 CHAPTER_PAPER_URLS），
 * 没有立体纸板可以挂点击，所以让左右两页纸面本身承担这一条交互。
 */
const PAPER_CLICK_DIALOGS: Partial<Record<ChapterId, PopUpDialog>> = {
  xiangjiang: {
    title: '血染湘江',
    content:
      '冰冷的江水被鲜血染成了红色。数万红军将士的英魂，永远留在了这里。',
  },
  tongdao: {
    title: '生死抉择',
    content:
      '原计划是去湘江与红二、六军团会合，但敌人的口袋阵已经张开了。现在，必须找出一条生路。',
  },
  chishui: {
    title: '生死交织的赤水河',
    content:
      '一渡、二渡、三渡、四渡！红军在湍急的赤水河上反复穿插，将蒋介石的几十万大军彻底绕晕！',
  },
};

interface PopUpLayerConfig {
  id: PopUpLayerId;
  scene: PopUpSceneId;
  /**
   * 折缝（胶线在内侧的端点）在页面深度轴上的位置。
   * +z = 靠近读者，-z = 靠近书口（页面后端）。
   */
  z: number;
  /**
   * 半张纸的宽度：从书脊量到纸板外缘。
   * 一张跨页图的总宽 = 2 × halfWidth，UV 在 0.5 处切开。
   */
  halfWidth: number;
  /**
   * 胶线（纸板贴在书页上的那条底边）与页面深度轴的夹角，弧度制。
   * 角度越大，立起来后的 V 型越尖。
   */
  angle: number;
  /**
   * out = 屋脊：两条胶线向后收，书脊处的折缝朝读者凸起（帐篷/建筑正面）；
   * in  = 山谷：两条胶线向前张，折缝凹进书页深处（背景幕布/室内墙）。
   *
   * 和源码 VFold 的 fold 参数完全一致。
   */
  fold: PopUpFold;
  /**
   * 整组纸板沿书本 X 轴的横向偏移（单位：书页坐标）。
   * 负数 = 向画面左侧移动，正数 = 向右侧移动。
   * 最终会叠加到 makeBasis 矩阵的 position.x 上，左右两半同步平移。
   */
  offsetX?: number;
}

/**
 * 跨页放大倍数。
 *
 * 1 = 源码原始尺寸：每个图层总宽约一页，左右各只占半页；
 * 2 = 每侧铺满各自那一页，整组机关横向撑满左右两页。
 * 高度按贴图比例同步放大，不会拉伸。
 */
const POPUP_SPREAD_SCALE = 2;

/**
 * 分层场景共用同一个画框宽度。
 *
 * 遵义会议四层、雪山草地八层都是同一台相机渲染的 1672×941 整幅场景图
 * （preserveFrame）：人群、木箱、火炉、雪山、草地、步枪在各自画布里的
 * 位置就是最终构图。如果逐张裁到内容包围盒再各自缩放，每一层都会被
 * 重新居中、放大，叠在一起时位置和比例就全乱了。
 *
 * 因此统一 halfWidth = 半页宽：总宽 3.25 正好铺满左右两页，
 * 高度 ≈1.83，仍在页高 2.28 内，只靠 z 轴拉开景深。
 */
const SCENE_LAYER_HALF_WIDTH = (PAGE_W / 2) * POPUP_SPREAD_SCALE;

/**
 * 图层配置（放大后的尺寸以左右两页总宽 ≈3.25 为基准）：
 *
 *   roomBg       总宽 3.250 → 高 ≈1.79（贴图比例 1.8115）
 *   zunyi_*      总宽 3.250 → 高 ≈1.83（四层同为 1671×941，比例 1.776）
 *   building     总宽 3.250 → 高 ≈1.59（贴图比例 2.0455）
 *   bear         总宽 0.400 → 高 ≈0.53（贴图比例 0.7484）
 *
 * z 是折缝在页面上的前后位置：
 *   室内按「人群 → 木箱 → 火炉 → 书包」从 -0.4 递增到 0.4，
 *   四层画框完全对齐，只靠 z 轴产生景深和遮挡；
 *   室外建筑在 z=0，熊在 z=0.3，避免和建筑正面穿模。
 *
 * offsetX 是整组纸板沿书本 X 轴的横向偏移，负数 = 向画面左侧移动。
 */
const POPUP_LAYERS: PopUpLayerConfig[] = [
  // 室内：背景墙最后，四层场景由远及近依次叠放
  {
    id: 'roomBg',
    scene: 'inside',
    z: -0.6,
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.3,
    fold: 'in', // 背景幕布：向外张开，包住整个跨页
  },
  {
    id: 'zunyi_people',
    scene: 'inside',
    z: -0.3, // 最靠后：开会的人群
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.32,
    fold: 'in',
  },
  {
    id: 'zunyi_crates',
    scene: 'inside',
    z: 0.1, // 中景：木箱
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.3,
    fold: 'in',
  },
  {
    id: 'zunyi_stove',
    scene: 'inside',
    z: 0.4, // 前景：火炉
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.05,
    fold: 'out',
  },
  {
    id: 'zunyi_bag',
    scene: 'inside',
    z: 0.2, // 最靠前：书包压着箱子
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.26,
    fold: 'out',
  },
  // 湘江血战：血水已经平铺在书页上（见 CHAPTER_PAPER_URLS），
  // 对岸阻击阵地用山谷折立在远处，近岸土坎和老陈依次压到前景。
  {
    id: 'xj_rearguard',
    scene: 'xiangjiang',
    z: -0.8,
    halfWidth: PAGE_W * 0.5,
    angle: 0.25,
    fold: 'in',
  },
  {
    id: 'xj_shore',
    scene: 'xiangjiang',
    z: 0.1,
    halfWidth: 0.6,
    offsetX: 1.0,
    angle: 0.2,
    fold: 'out',
  },
  {
    id: 'xj_bear',
    scene: 'xiangjiang',
    z: 0.5,
    halfWidth: 0.5,
    offsetX: -0.9,
    angle: 0.2,
    fold: 'out',
  },
  // 通道会议：地图已经平铺在书页上（见 CHAPTER_PAPER_URLS），
  // 左侧指路人物与右侧争论人物分列两页，拿纸条的熊站在正中前方。
  {
    id: 'td_people_left',
    scene: 'tongdao',
    z: 0,
    halfWidth: 0.5,
    offsetX: -0.7,
    angle: 0.25,
    fold: 'out',
  },
  {
    id: 'td_people_right',
    scene: 'tongdao',
    z: 0,
    halfWidth: 0.38,
    offsetX: 0.8,
    angle: 0.25,
    fold: 'out',
  },
  {
    id: 'td_bear',
    scene: 'tongdao',
    z: 0.3,
    halfWidth: 0.2,
    offsetX: 0,
    angle: 0.2,
    fold: 'out',
  },
  // 四渡赤水：赤水河已经平铺在书页上（见 CHAPTER_PAPER_URLS），
  // 两座山分立左右夹出峡谷纵深，急电压在两山之间的前景。
  {
    id: 'cs_mountain_left',
    scene: 'chishui',
    z: -0.35,
    halfWidth: 0.8,
    offsetX: -0.7,
    angle: 0.25,
    fold: 'out',
  },
  {
    id: 'cs_mountain_right',
    scene: 'chishui',
    z: 0.6,
    halfWidth: 0.5,
    offsetX: 0.85,
    angle: 0.25,
    fold: 'out',
  },
  {
    id: 'cs_telegram',
    scene: 'chishui',
    z: 0.3,
    halfWidth: 0.3,
    offsetX: 0,
    angle: 0.2,
    fold: 'out',
  },
  // 飞夺泸定桥：江水已经平铺在书页上（见 CHAPTER_PAPER_URLS），
  // 不再立起来；铁链与战士横跨跨页，
  // 左右桥台立在两页外侧，水花压在最前面，小船放在右下角。
  {
    id: 'ld_bridge',
    scene: 'luding',
    z: 0.1,
    halfWidth: PAGE_W * 0.8,
    offsetX: 0,
    angle: 0.2,
    fold: 'out',
  },
  {
    id: 'ld_anchor_left',
    scene: 'luding',
    z: 0.1,
    halfWidth: 0.5,
    offsetX: -1.2,
    angle: 0.2,
    fold: 'out',
  },
  {
    id: 'ld_anchor_right',
    scene: 'luding',
    z: 0.1,
    halfWidth: 0.5,
    offsetX: 1.2,
    angle: 0.2,
    fold: 'out',
  },
  {
    id: 'ld_splash',
    scene: 'luding',
    z: -0.1,
    halfWidth: 1.5,
    offsetX: 0,
    angle: 0.3,
    fold: 'out',
  },
  {
    id: 'ld_boat',
    scene: 'luding',
    z: 0.7,
    halfWidth: 0.5,
    offsetX: 0.6,
    angle: 0.3,
    fold: 'out',
  },
  // 雪山草地：八层从远景山脊一路叠到最前面的小物件。
  // z 严格按照「背景幕布 → 雪堆 → 红旗 → 步枪 → 草地 → 易班熊
  // → 鱼钩 / 火柴」从后往前递增；八层共用同一个画框，只靠 z 拉开景深。
  {
    id: 'snow_bg',
    scene: 'snow',
    z: -0.6, // 背景幕布：整排雪山
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    // 山谷折的外缘会向读者探出约 halfWidth·sin(angle)：
    // 角度太大时，外缘会越过 z=0 的步枪，把枪身整片挡住。
    // 0.1 仍然保留 V 型展开，但整张雪山幕布始终落在步枪之后。
    angle: 0.1,
    fold: 'in',
  },
  {
    id: 'snow_pile',
    scene: 'snow',
    z: -0.2, // 左下角的雪堆
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.12,
    fold: 'in',
  },
  {
    id: 'snow_flag',
    scene: 'snow',
    z: -0.21, // 雪坡上的红旗
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.12,
    fold: 'in',
  },
  {
    id: 'snow_rifle',
    scene: 'snow',
    z: -0.21, // 画面左下角的步枪（可拖动）
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.12,
    fold: 'in',
  },
  {
    id: 'snow_grass',
    scene: 'snow',
    z: 0.2, // 横贯画面底部的草地
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.17,
    fold: 'in',
  },
  {
    id: 'snow_bear',
    scene: 'snow',
    z: 0.4, // 右侧负重前行的易班熊
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.18,
    fold: 'in',
  },
  {
    id: 'item_hook',
    scene: 'snow',
    z: 0.5, // 最前景：鱼钩
    offsetX: -0.3,
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.18,
    fold: 'in',
  },
  {
    id: 'item_matches',
    scene: 'snow',
    z: 0.5, // 最前景：火柴
    offsetX: 0.3,
    halfWidth: SCENE_LAYER_HALF_WIDTH,
    angle: 0.18,
    fold: 'in',
  },
  // 哈达铺：整张报纸作为背景幕布，老赵站在报纸前。
  // 报纸用山谷折（in）向外张开，包住整个跨页；
  // 老赵用屋脊折（out）立在左前方，避免和报纸正面穿模。
  {
    id: 'hada_news',
    scene: 'hada',
    z: -0.4,
    halfWidth: PAGE_W,
    angle: 0.3,
    fold: 'in',
  },
  {
    id: 'hada_bear',
    scene: 'hada',
    z: 0.2,
    halfWidth: 0.2,
    offsetX: -0.4,
    angle: 0.2,
    fold: 'out',
  },
  // 三军会师：城楼用山谷折横跨整幅跨页作为最宏大的背景，
  // 拥抱群像在左前，老陈在右前张开双臂。
  {
    id: 'hs_gate',
    scene: 'huishi',
    z: -0.4,
    halfWidth: PAGE_W * 1.0,
    offsetX: 0,
    angle: 0.3,
    fold: 'in',
  },
  {
    id: 'hs_hug',
    scene: 'huishi',
    z: 0.2,
    halfWidth: 0.6,
    offsetX: -0.4,
    angle: 0.25,
    fold: 'out',
  },
  {
    id: 'hs_bear',
    scene: 'huishi',
    z: 0.5,
    halfWidth: 0.5,
    offsetX: 0.5,
    angle: 0.2,
    fold: 'out',
  },
  // 门外：建筑是屋脊折，熊站在建筑正前方
  {
    id: 'building',
    scene: 'outside',
    z: 0,
    halfWidth: (PAGE_W / 2) * POPUP_SPREAD_SCALE,
    angle: 0.34,
    fold: 'out',
  },
  {
    id: 'bear',
    scene: 'outside',
    // 比建筑更靠近读者，避免和建筑正面穿模
    z: 0.3,
    // 负值 = 向画面左侧移动，让熊站在左侧书页前
    offsetX: -0.5,
    halfWidth: 0.1 * POPUP_SPREAD_SCALE,
    angle: 0.22,
    fold: 'out',
  },
];

const POPUP_LAYER_BY_ID = new Map(POPUP_LAYERS.map((layer) => [layer.id, layer]));

interface CutoutBounds {
  /** 可见内容在贴图中的归一化包围盒（0~1，x 向右，y 向上） */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface CutoutTexture {
  texture: THREE.Texture;
  /** 贴图画面的宽高比（裁切后或完整画框） */
  aspect: number;
  /**
   * 可见内容的归一化范围。
   * 点击拾取只覆盖这一块，避免整张透明画框挡住前后的其他图层。
   */
  content: CutoutBounds;
}

/**
 * 纸板高度：总宽 = 2 × halfWidth，按贴图真实宽高比推导，
 * 和源码 VFold 里的 h = 2·w·image.height/image.width 完全一致。
 * 永远不拉伸图片。
 */
function popUpHeight(layer: PopUpLayerConfig, cutout?: CutoutTexture) {
  const aspect = cutout?.aspect ?? 1;
  return (layer.halfWidth * 2) / aspect;
}

/**
 * 面板几何（对应源码的 panelGeometry）：
 *
 * 原点在纸板底边：左半 x ∈ [−w, 0]，右半 x ∈ [0, w]，
 * 内边缘（x = 0）就是书脊折缝，y ∈ [0, h] 沿折缝向上。
 * UV 的 u 轴同步切开：
 *   left  → u 0.0 ~ 0.5（外缘在 u=0，书脊在 u=0.5）
 *   right → u 0.5 ~ 1.0（书脊在 u=0.5，外缘在 u=1）
 * 两张纸板共用同一张贴图，拼起来才是完整的一张图。
 */
function createPanelGeometry(
  x0: number,
  x1: number,
  height: number,
  u0: number,
  u1: number,
) {
  const geometry = new THREE.PlaneGeometry(x1 - x0, height, 1, 1);
  geometry.translate((x0 + x1) / 2, height / 2, 0);

  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setX(i, uv.getX(i) < 0.5 ? u0 : u1);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * 点击拾取几何：只覆盖可见内容的包围盒，而不是整张透明画框。
 *
 * 室内四层共用同尺寸的整幅画框，并且几乎完全重叠；
 * 如果直接拿画框做 raycast，最前面的图层会把所有点击都吃掉，
 * 点人群也会弹出「随时待命的行囊」。
 * 用内容包围盒后，木箱 / 火炉 / 书包各自只在自己的可见范围内响应，
 * 透明区域会穿过前面的层，继续命中后面的人群。
 *
 * 该几何挂在一块 visible = false 的材质上：WebGL 不渲染它，
 * 但 Raycaster 只检查几何体，点击仍然正常命中。
 */
function createHitGeometry(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4) return null;
  const geometry = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 1, 1);
  geometry.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  return geometry;
}

interface CardMaterials {
  /** 正面：印刷画面，alpha 抠图 */
  front: THREE.MeshBasicMaterial;
  /** 纸芯：同一张图的剪影，染成硬纸板色 */
  edge: THREE.MeshBasicMaterial;
  /**
   * 背面：同一张图的镜像印刷。
   *
   * 只用 FrontSide 时，从侧面看 V 型折页，背对镜头的那一半会被整片剔除，
   * 只留下和书页同色的纸芯，看起来就像“整张图都跑到另一边去了”。
   * 这里再铺一层 BackSide 的印刷面，UV 预先水平镜像，
   * 保证从任何一侧看，左右两半都同时可见、并且在书脊处拼成完整画面。
   */
  back: THREE.MeshBasicMaterial;
  /** 背面镜像贴图，单独释放 */
  backMap: THREE.Texture;
}

/** 纸芯层不参与拾取，只负责从侧面看时露出纸板边 */
const NO_RAYCAST = () => {};

/**
 * 只负责点击拾取的材质：visible = false 时 WebGL 不提交渲染，
 * 但 Raycaster 仍然会对几何体求交。
 *
 * side 必须是 DoubleSide：Mesh.raycast 会按材质 side 剔除背面三角形，
 * 而 V 折纸板左右两半的朝向由书页矩阵实时决定，
 * 左侧纸板在部分取景角度下会背对镜头——单面材质会直接漏掉点击。
 */
const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  visible: false,
  side: THREE.DoubleSide,
});

/** 按贴图坐标快速查询像素是否可见，用于点击穿透透明区域 */
const textureContexts = new WeakMap<
  THREE.Texture,
  CanvasRenderingContext2D | null
>();

function isTextureOpaque(texture: THREE.Texture, u: number, v: number) {
  const canvas = texture.image as HTMLCanvasElement | undefined;
  if (!canvas || typeof canvas.getContext !== 'function') return true;

  let ctx = textureContexts.get(texture);
  if (ctx === undefined) {
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    textureContexts.set(texture, ctx);
  }
  if (!ctx) return true;

  // Canvas 的 y 轴向下，纹理 v 轴向上
  const x = THREE.MathUtils.clamp(
    Math.floor(u * canvas.width),
    0,
    canvas.width - 1,
  );
  const y = THREE.MathUtils.clamp(
    Math.floor((1 - v) * canvas.height),
    0,
    canvas.height - 1,
  );
  // 与材质的 alphaTest 0.1 对齐：几乎透明的边缘不拦截点击
  return ctx.getImageData(x, y, 1, 1).data[3] > 24;
}

interface CardHalfProps {
  geometry: THREE.BufferGeometry;
  /** 拾取层所属图层，点击时用来查贴图与弹窗文案 */
  hitLayerId: PopUpLayerId;
  /** 可见内容的包围盒，透明区域不拦截点击；null 表示这一半没有内容 */
  hitGeometry: THREE.BufferGeometry | null;
  materials: CardMaterials;
  /** 由父级 useFrame 每帧写入 matrix */
  groupRef: (node: THREE.Group | null) => void;
  interactive: boolean;
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void;
  onClick: (event: ThreeEvent<MouseEvent>) => void;
  /** 只有可拖动图层（雪山步枪）才挂载这三个指针事件 */
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerCancel?: (event: ThreeEvent<PointerEvent>) => void;
}

/**
 * 一张纸板的左半 / 右半：正面画面 + 若干层纸芯 + 背面。
 *
 * 这个 Group 的矩阵由 useFrame 用书页帧矩阵直接写入
 * （matrixAutoUpdate = false），所以纸板是“焊”在书页上的，
 * 而不是用 position / rotation 拼出来的。
 */
function CardHalf({
  geometry,
  hitLayerId,
  hitGeometry,
  materials,
  groupRef,
  interactive,
  onPointerOver,
  onPointerOut,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CardHalfProps) {
  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      <mesh
        geometry={geometry}
        material={materials.front}
        raycast={NO_RAYCAST}
      />
      {/* 拾取层：不可见，但只在非透明内容的包围盒内响应 */}
      {interactive && hitGeometry && (
        <mesh
          geometry={hitGeometry}
          material={HIT_MATERIAL}
          userData={{ layerId: hitLayerId }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      )}
      {Array.from({ length: CARD_LAYERS }, (_, index) => (
        <mesh
          key={index}
          geometry={geometry}
          material={
            index === CARD_LAYERS - 1 ? materials.back : materials.edge
          }
          // 正面在 z = 0，纸芯一层层向纸板内部退
          position={[
            0,
            0,
            -(CARD_THICKNESS * (index + 1)) / CARD_LAYERS,
          ]}
          raycast={NO_RAYCAST}
        />
      ))}
    </group>
  );
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`[popup] 图片加载失败: ${url}`));
    image.src = url;
  });
}

/**
 * 生成「抠图贴图」：
 * 1. 从四边向内做泛洪填充，把和画布边缘连通的近黑像素设为透明。
 *    （JPG 没有 alpha，alphaTest 对纯黑底无效，这一步才是真正去掉黑底；
 *     泛洪而不是全局阈值，是为了保留熊的黑框眼镜、画里的黑色阴影等内部黑色。）
 * 2. preserveFrame 为 false 时，按非透明内容的包围盒裁切，
 *    plane 尺寸与真实画面一致，点击区域也更精准；
 *    preserveFrame 为 true 时保留完整画框，供分层场景图对齐叠放。
 * 3. 输出 CanvasTexture，材质端继续使用 transparent + alphaTest 0.1。
 */
function createCutoutTexture(
  image: HTMLImageElement,
  preserveFrame = false,
): CutoutTexture {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('[popup] Canvas 2D context unavailable');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const total = width * height;

  // 0 = 保留，1 = 背景候选，2 = 已判定为背景
  const state = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const offset = i * 4;
    const alpha = pixels[offset + 3];
    const luma = Math.max(
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2],
    );
    if (alpha < 16 || luma < 24) state[i] = 1;
  }

  const stack = new Uint32Array(total);
  let top = 0;
  const push = (index: number) => {
    if (state[index] === 1) {
      state[index] = 2;
      stack[top++] = index;
    }
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (top > 0) {
    const index = stack[--top];
    pixels[index * 4 + 3] = 0;
    const x = index % width;
    const y = (index / width) | 0;
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (y > 0) push(index - width);
    if (y < height - 1) push(index + width);
  }

  ctx.putImageData(imageData, 0, 0);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const hasContent = maxX >= 0 && maxY >= 0;

  let textureCanvas: HTMLCanvasElement = canvas;
  let aspect = width / height;
  // 默认认为内容铺满画布；只有 preserveFrame 才需要记录真实内容范围。
  // 裁切模式下画布本身就是内容的包围盒，所以 0~1 仍然成立。
  let content: CutoutBounds = { x0: 0, y0: 0, x1: 1, y1: 1 };

  if (preserveFrame) {
    if (hasContent) {
      // 画布 y 轴向下，纹理 v 轴向上，所以 y 要翻转
      content = {
        x0: minX / width,
        y0: 1 - (maxY + 1) / height,
        x1: (maxX + 1) / width,
        y1: 1 - minY / height,
      };
    }
  } else {
    const cropX = hasContent ? minX : 0;
    const cropY = hasContent ? minY : 0;
    const cropW = hasContent ? maxX - minX + 1 : width;
    const cropH = hasContent ? maxY - minY + 1 : height;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropW;
    croppedCanvas.height = cropH;
    const croppedCtx = croppedCanvas.getContext('2d');
    if (!croppedCtx) throw new Error('[popup] Canvas 2D context unavailable');
    croppedCtx.drawImage(
      canvas,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH,
    );

    textureCanvas = croppedCanvas;
    aspect = cropW / cropH;
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return { texture, aspect, content };
}

function usePopUpTextures() {
  const [textures, setTextures] = useState<
    Partial<Record<PopUpLayerId, CutoutTexture>>
  >({});

  useEffect(() => {
    let cancelled = false;

    const loadOne = async (id: PopUpLayerId) => {
      const source = POPUP_SOURCES[id];
      let image: HTMLImageElement | null = null;

      try {
        image = await loadImageElement(source.url);
      } catch {
        if (source.fallbackUrl) {
          try {
            image = await loadImageElement(source.fallbackUrl);
          } catch {
            image = null;
          }
        }
      }

      if (!image) {
        console.warn(
          `[popup] 贴图加载失败，对应机关将保持隐藏: ${source.url}`,
        );
        return null;
      }

      try {
        return [
          id,
          createCutoutTexture(image, source.preserveFrame),
        ] as const;
      } catch (error) {
        console.warn('[popup] 抠图处理失败，对应机关将保持隐藏', error);
        return null;
      }
    };

    Promise.all(
      (Object.keys(POPUP_SOURCES) as PopUpLayerId[]).map(loadOne),
    ).then((results) => {
      if (cancelled) return;
      const next: Partial<Record<PopUpLayerId, CutoutTexture>> = {};
      results.forEach((entry) => {
        if (entry) next[entry[0]] = entry[1];
      });
      if (Object.keys(next).length) setTextures(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return textures;
}

type PopUpHalfKey = `${PopUpLayerId}:${PopUpHalfSide}`;

/**
 * 模块级临时对象：useFrame 每帧都要算 5 层 × 2 半的矩阵，
 * 复用这些向量 / 矩阵可以避免每帧向 GC 交垃圾。
 * 整个页面只会挂载一个 PopUpScene，所以共享是安全的。
 */
const _frameL = new THREE.Matrix4();
const _frameR = new THREE.Matrix4();
const _invRoot = new THREE.Matrix4();
const _leftMatrix = new THREE.Matrix4();
const _rightMatrix = new THREE.Matrix4();
const _spineL = new THREE.Vector3();
const _spineR = new THREE.Vector3();
const _creasePoint = new THREE.Vector3();
const _glueL = new THREE.Vector3();
const _glueR = new THREE.Vector3();
const _creaseDir = new THREE.Vector3();
const _axisX = new THREE.Vector3();
const _axisZ = new THREE.Vector3();

/**
 * 把算好的纸板矩阵写进 Group。
 * matrixAutoUpdate 已在 JSX 里关掉，所以这里写的是最终矩阵；
 * matrixWorldNeedsUpdate 让渲染器在下一帧重新计算 matrixWorld。
 */
function applyCardMatrix(group: THREE.Group, matrix: THREE.Matrix4) {
  group.matrix.copy(matrix);
  group.matrixWorldNeedsUpdate = true;
}

type DollyPhase = 'approach' | 'hold' | 'return';

/**
 * 一镜到底运镜状态。
 *
 * approach：0.8s 从当前视角推到建筑前，位置 lerp、朝向 slerp；
 * hold：镜头贴在建筑前，室内已经接手，稍作停留；
 * return：0.8s 从门前平滑退回推门前的视角。
 */
interface DollyState {
  phase: DollyPhase;
  startedAt: number | null;
  fromPosition: THREE.Vector3;
  fromQuaternion: THREE.Quaternion;
  closePosition: THREE.Vector3;
  closeQuaternion: THREE.Quaternion;
  /** 推到门前、完成门外 / 室内切换的时刻 */
  arrivedAt: number | null;
  /** 回程开始时刻 */
  returnStartedAt: number | null;
}

/* ---------------- 雪山粒子 ---------------- */

const SNOW_COUNT = 420;
/** 雪花在书页平面上的铺开半宽 / 半高（书中坐标单位） */
const SNOW_SPAN_X = 2.6;
const SNOW_SPAN_Y = 1.7;
/** 围绕 position.z = 1.5 上下各 0.7，让雪花有前后景深 */
const SNOW_SPAN_Z = 0.7;
const SNOW_FALL_MIN = 0.32;
const SNOW_FALL_MAX = 0.72;

interface Snowflake {
  /** 书页平面内的基准位置 */
  x: number;
  y: number;
  /** 距离书面的高度，每帧递减 */
  z: number;
  /** 下落速度（单位 / 秒） */
  speed: number;
  /** 水平摇摆幅度 */
  sway: number;
  /** 摇摆相位，避免所有雪花同步摆动 */
  phase: number;
}

/** PointsMaterial 默认画方点；用一张径向渐变贴图把它变成软边圆点 */
function createSnowflakeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.72, 'rgba(255,255,255,0.32)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * 漫天飞雪。只在雪山章节挂载。
 *
 * 整团雪挂在书本坐标系里（书摊平后 z 轴朝上），
 * 所以 position.z = 1.5 就是悬浮在书本上方的高处；
 * 每片雪花沿 -z 下落，穿过 0.8 ~ 2.2 的高度带后从顶部循环。
 * x / y 用 Math.sin / Math.cos 叠加各自相位做水平摇摆。
 */
function Snowfall() {
  const flakes = useMemo<Snowflake[]>(
    () =>
      Array.from({ length: SNOW_COUNT }, () => ({
        x: (Math.random() * 2 - 1) * SNOW_SPAN_X,
        y: (Math.random() * 2 - 1) * SNOW_SPAN_Y,
        z: (Math.random() * 2 - 1) * SNOW_SPAN_Z,
        speed: SNOW_FALL_MIN + Math.random() * (SNOW_FALL_MAX - SNOW_FALL_MIN),
        sway: 0.05 + Math.random() * 0.13,
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  );

  // 先把初始坐标写进 position，避免第一帧全部堆在原点闪一下
  const positions = useMemo(() => {
    const array = new Float32Array(SNOW_COUNT * 3);
    flakes.forEach((flake, index) => {
      array[index * 3] = flake.x;
      array[index * 3 + 1] = flake.y;
      array[index * 3 + 2] = flake.z;
    });
    return array;
  }, [flakes]);

  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    next.setAttribute('position', attribute);
    return next;
  }, [positions]);

  const texture = useMemo(createSnowflakeTexture, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      texture?.dispose();
    };
  }, [geometry, texture]);

  useFrame((state, delta) => {
    // 切到后台再回来 delta 会很大，钳一下避免雪花整体瞬移
    const step = Math.min(delta, 0.06);
    const time = state.clock.elapsedTime;

    for (let i = 0; i < SNOW_COUNT; i += 1) {
      const flake = flakes[i];
      flake.z -= flake.speed * step;
      if (flake.z < -SNOW_SPAN_Z) {
        // 落到底部后回到顶部，顺便换一个水平位置，避免循环痕迹
        flake.z = SNOW_SPAN_Z;
        flake.x = (Math.random() * 2 - 1) * SNOW_SPAN_X;
        flake.y = (Math.random() * 2 - 1) * SNOW_SPAN_Y;
      }

      const index = i * 3;
      positions[index] =
        flake.x + Math.sin(time * 0.9 + flake.phase) * flake.sway;
      positions[index + 1] =
        flake.y + Math.cos(time * 0.7 + flake.phase * 1.7) * flake.sway * 0.6;
      positions[index + 2] = flake.z;
    }

    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points
      geometry={geometry}
      position={[0, 0, 1.5]}
      frustumCulled={false}
    >
      <pointsMaterial
        map={texture}
        color="#ffffff"
        size={0.042}
        sizeAttenuation
        transparent
        opacity={0.88}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

interface PopUpSceneProps {
  /** 书本展开进度 0 → 1，由 Book 的 useFrame 每帧写入 */
  openRef: RefObject<number>;
  resetToken: number;
  /** 把点击机关的内容交给 Canvas 外的 React 弹窗，id 为热点图层标识，用于探索进度统计 */
  onOpenDialog: (id: string, title: string, content: string) => void;
  /** 右页页帧：原点在书脊，X 横向、Y 页面法线、Z 指向读者 */
  rightPageRef: RefObject<THREE.Object3D | null>;
  /** 左页页帧：挂在封面铰链上，随封面一起翻转 */
  leftPageRef: RefObject<THREE.Object3D | null>;
}

function PopUpScene({
  openRef,
  resetToken,
  onOpenDialog,
  rightPageRef,
  leftPageRef,
}: PopUpSceneProps) {
  const textures = usePopUpTextures();
  const { chapter } = useJourneyState();
  /**
   * 遵义章节内部的「门外 / 室内」两幕。
   * 雪山 / 哈达铺不参与推门运镜，各自直接使用专属 scene。
   */
  const [roomStage, setRoomStage] = useState<'outside' | 'inside'>('outside');
  const activeScene: PopUpSceneId =
    chapter === 'snow'
      ? 'snow'
      : chapter === 'hada'
        ? 'hada'
        : chapter === 'luding'
          ? 'luding'
          : chapter === 'xiangjiang'
            ? 'xiangjiang'
            : chapter === 'tongdao'
              ? 'tongdao'
              : chapter === 'chishui'
                ? 'chishui'
                : chapter === 'huishi'
                  ? 'huishi'
                  : roomStage;
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.size);
  const bookScale = viewport.width < viewport.height ? 0.52 : 1;

  const rootRef = useRef<THREE.Group>(null);
  const dolly = useRef<DollyState | null>(null);
  /** 当前机关显隐进度：0 = 完全隐藏，1 = 完全显示 */
  const revealRef = useRef(0);

  /**
   * 步枪在书页平面上的拖拽位移（书本局部坐标）。
   * x 叠加到 layer.offsetX，z 叠加到 layer.z，绘制时再钳制范围。
   */
  const rifleDrag = useRef({ x: 0, z: 0 });
  const rifleDragSession = useRef<{
    pointerId: number;
    startX: number;
    /** 书本局部 Y：摊平后就是页面深度方向（图层配置里的 z） */
    startY: number;
    offsetX: number;
    offsetZ: number;
    /** 有实际位移才算拖拽；没位移的按下 / 抬起要当成点击 */
    moved: boolean;
    /** 按下时命中的图层；没位移就按这个图层开弹窗 */
    picked: PopUpLayerId;
  } | null>(null);
  const dragPlane = useMemo(() => new THREE.Plane(), []);
  const dragPoint = useMemo(() => new THREE.Vector3(), []);

  // 每一层的左右两张纸板各有一个 Group，矩阵由 useFrame 直接写入
  const cardGroups = useRef<Partial<Record<PopUpHalfKey, THREE.Group>>>({});
  const cardSetters = useMemo(() => {
    const setters = {} as Record<
      PopUpHalfKey,
      (node: THREE.Group | null) => void
    >;
    POPUP_LAYERS.forEach(({ id }) => {
      (['left', 'right'] as const).forEach((side) => {
        const key: PopUpHalfKey = `${id}:${side}`;
        setters[key] = (node) => {
          if (node) {
            // 挂载瞬间先藏起来：即使第一帧 useFrame 还没跑，
            // 也不会在合上的封面上闪出一角纸板
            node.visible = false;
            cardGroups.current[key] = node;
          } else {
            delete cardGroups.current[key];
          }
        };
      });
    });
    return setters;
  }, []);

  // 几何体：每层拆成左右各半张，UV 在 u = 0.5 处切开
  const panels = useMemo(() => {
    const map: Partial<
      Record<
        PopUpLayerId,
        {
          left: THREE.BufferGeometry;
          right: THREE.BufferGeometry;
          hitLeft: THREE.BufferGeometry | null;
          hitRight: THREE.BufferGeometry | null;
        }
      >
    > = {};
    POPUP_LAYERS.forEach((layer) => {
      const cutout = textures[layer.id];
      if (!cutout) return;
      const height = popUpHeight(layer, cutout);
      const fullWidth = layer.halfWidth * 2;

      // 内容包围盒从「整幅画框的归一化坐标」换算到纸板局部坐标：
      // x ∈ [-halfWidth, +halfWidth]，y ∈ [0, height]。
      const contentX0 = -layer.halfWidth + cutout.content.x0 * fullWidth;
      const contentX1 = -layer.halfWidth + cutout.content.x1 * fullWidth;
      const contentY0 = cutout.content.y0 * height;
      const contentY1 = cutout.content.y1 * height;

      map[layer.id] = {
        // 左半：外缘 x=-w → u=0，书脊 x=0 → u=0.5
        left: createPanelGeometry(-layer.halfWidth, 0, height, 0, 0.5),
        // 右半：书脊 x=0 → u=0.5，外缘 x=+w → u=1
        right: createPanelGeometry(0, layer.halfWidth, height, 0.5, 1),
        // 拾取几何按内容包围盒裁到左右两半，透明部分不挡点击
        hitLeft: createHitGeometry(
          Math.max(-layer.halfWidth, contentX0),
          Math.min(0, contentX1),
          contentY0,
          contentY1,
        ),
        hitRight: createHitGeometry(
          Math.max(0, contentX0),
          Math.min(layer.halfWidth, contentX1),
          contentY0,
          contentY1,
        ),
      };
    });
    return map;
  }, [textures]);

  useEffect(
    () => () => {
      Object.values(panels).forEach((panel) => {
        panel?.left.dispose();
        panel?.right.dispose();
        panel?.hitLeft?.dispose();
        panel?.hitRight?.dispose();
      });
    },
    [panels],
  );

  // 材质：正面画面 / 纸芯剪影 / 背面，左右两半、所有纸芯共用
  const materials = useMemo(() => {
    const map: Partial<Record<PopUpLayerId, CardMaterials>> = {};
    // 材质可能在书本已经打开后才加载完成，用当前进度初始化，
    // 避免正常显示的画面上闪一帧透明
    const initialOpacity = revealRef.current;
    POPUP_LAYERS.forEach((layer) => {
      const cutout = textures[layer.id];
      if (!cutout) return;
      const source = cutout.texture;
      // 背面印刷用的镜像贴图：共用同一张画布，只翻转 U 轴
      const backMap = source.clone();
      backMap.repeat.x = -1;
      backMap.offset.x = 1;
      backMap.needsUpdate = true;
      map[layer.id] = {
        front: new THREE.MeshBasicMaterial({
          map: source,
          transparent: true,
          opacity: initialOpacity,
          alphaTest: 0.1,
          side: THREE.FrontSide,
          depthWrite: true,
          toneMapped: false,
        }),
        edge: new THREE.MeshBasicMaterial({
          map: source,
          color: new THREE.Color(CARD_EDGE_COLOR),
          transparent: true,
          opacity: initialOpacity,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
        back: new THREE.MeshBasicMaterial({
          map: backMap,
          transparent: true,
          opacity: initialOpacity,
          alphaTest: 0.1,
          side: THREE.BackSide,
          toneMapped: false,
        }),
        backMap,
      };
    });
    return map;
  }, [textures]);

  useEffect(
    () => () => {
      Object.values(materials).forEach((set) => {
        set?.front.dispose();
        set?.edge.dispose();
        set?.back.dispose();
        set?.backMap.dispose();
      });
    },
    [materials],
  );

  // 「重新翻阅」时机关回到门外；纸板位置每帧由书页矩阵决定，无需手动复位
  useEffect(() => {
    dolly.current = null;
    setCinematic(false);
    setDragging(false);
    setRoomStage('outside');
    rifleDrag.current = { x: 0, z: 0 };
    rifleDragSession.current = null;
    document.body.style.cursor = '';
    // 重新翻阅时封面会瞬间合上：机关要同步消失，
    // 不能等下一帧 useFrame，否则会有一帧纸板夹在合上的书页里
    revealRef.current = 0;
    Object.values(materials).forEach((set) => {
      if (!set) return;
      set.front.opacity = 0;
      set.edge.opacity = 0;
      set.back.opacity = 0;
    });
    Object.values(cardGroups.current).forEach((group) => {
      if (group) group.visible = false;
    });
  }, [resetToken]);

  /**
   * 切换章节：
   * - 取消还没跑完的推门运镜，把镜头放回原位；
   * - 遵义章节回到门外第一幕；
   * - 步枪拖拽位移清零，避免雪山里的位置带到下一章。
   */
  useEffect(() => {
    const shot = dolly.current;
    if (shot) {
      camera.position.copy(shot.fromPosition);
      camera.quaternion.copy(shot.fromQuaternion);
    }
    dolly.current = null;
    setCinematic(false);
    setDragging(false);
    setRoomStage('outside');
    rifleDrag.current = { x: 0, z: 0 };
    rifleDragSession.current = null;
    document.body.style.cursor = '';
  }, [chapter, camera]);

  /**
   * 推门：镜头 1 秒内从当前视角推到门前（z = 1），
   * 推到底时切换成室内，停留片刻后瞬间弹回原位。
   */
  const startRoomEntry = () => {
    if (chapter !== 'zunyi' || roomStage === 'inside' || dolly.current) return;
    document.body.style.cursor = '';

    const buildingLayer = POPUP_LAYERS.find(
      (layer) => layer.id === 'building',
    );
    const buildingHeight = buildingLayer
      ? popUpHeight(buildingLayer, textures.building)
      : 0.8;

    // 对准建筑中心（世界坐标 = 书局部坐标 × bookScale）。
    // 中心折页后建筑以书脊为中心展开，所以推门目标也从右页中心
    // 换成书脊 X，否则镜头会推到建筑右半边。
    const focusX = SPINE_X * bookScale;
    const focusY = (BOOK_SURFACE_Y + buildingHeight / 2) * bookScale;
    const closePosition = new THREE.Vector3(focusX, focusY, DOLLY_CLOSE_Z);
    const closeTarget = new THREE.Vector3(focusX, focusY, 0);
    const closeQuaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(closePosition, closeTarget, camera.up),
    );

    dolly.current = {
      phase: 'approach',
      startedAt: null,
      fromPosition: camera.position.clone(),
      fromQuaternion: camera.quaternion.clone(),
      closePosition,
      closeQuaternion,
      arrivedAt: null,
      returnStartedAt: null,
    };
    // 运镜期间卸载 OrbitControls，避免两边同时写 camera
    setCinematic(true);
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    if (openRef.current < 0.995) return;
    event.stopPropagation();
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    if (openRef.current < 0.995) return;
    event.stopPropagation();
    // 拖动步枪时指针可能暂时离开纸板，不能把 grabbing 光标清掉
    if (!rifleDragSession.current) document.body.style.cursor = '';
  };

  /**
   * 把当前指针射线投到右页纸面，再换算到机关根节点（书本局部）坐标。
   * 得到的是页面平面上的 (x, z)，正好对应图层配置里的 offsetX / z。
   */
  const pagePointFromEvent = (event: ThreeEvent<PointerEvent>) => {
    const root = rootRef.current;
    const anchor = rightPageRef.current;
    if (!root || !anchor) return null;

    root.updateWorldMatrix(true, false);
    anchor.updateWorldMatrix(true, false);

    const normal = new THREE.Vector3(0, 1, 0).transformDirection(
      anchor.matrixWorld,
    );
    const origin = new THREE.Vector3().setFromMatrixPosition(
      anchor.matrixWorld,
    );
    dragPlane.setFromNormalAndCoplanarPoint(normal, origin);
    if (!event.ray.intersectPlane(dragPlane, dragPoint)) return null;

    // 机关根节点的 matrixWorld 可能带视差 / 书本倾斜，
    // 必须换回根节点局部空间，位移才能直接叠加到图层配置上。
    root.worldToLocal(dragPoint);
    return dragPoint.clone();
  };

  const handleRiflePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (chapter !== 'snow' || openRef.current < 0.995) return;
    // 只抓住画面里真正有步枪像素的位置；透明包围盒区域继续穿透
    const picked = pickTopOpaqueLayer(event.intersections);
    if (picked !== 'snow_rifle') return;
    const point = pagePointFromEvent(event);
    if (!point) return;

    event.stopPropagation();
    const target = event.target as unknown as {
      setPointerCapture?: (pointerId: number) => void;
    };
    target.setPointerCapture?.(event.pointerId);
    rifleDragSession.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      offsetX: rifleDrag.current.x,
      offsetZ: rifleDrag.current.z,
      moved: false,
      picked,
    };
    document.body.style.cursor = 'grabbing';
    // 拖动期间卸载 OrbitControls，避免镜头和步枪一起被拖走。
    // 用 dragging 而不是 cinematic：后者会改变相机视差，
    // 按下瞬间整个画面会跳一下，点击拾取也会错位。
    setDragging(true);
  };

  const handleRiflePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const session = rifleDragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const point = pagePointFromEvent(event);
    if (!point) return;

    event.stopPropagation();
    // 超过 1cm 的书页位移才算拖拽，轻微抖动仍然按点击处理
    if (
      Math.abs(point.x - session.startX) + Math.abs(point.y - session.startY) >
      0.01
    ) {
      session.moved = true;
    }
    rifleDrag.current = {
      // x：左右横移。限制在左半页到书脊附近，
      // 再往右会把枪推到易班熊背后，看起来像凭空消失。
      x: THREE.MathUtils.clamp(
        session.offsetX + (point.x - session.startX),
        -0.7,
        0.7,
      ),
      // 页面深度：摊平后机关根节点的 −Y 就是图层配置里的 z。
      // 限制幅度，避免拖到草地 / 熊的背后被完全挡住。
      z: THREE.MathUtils.clamp(
        session.offsetZ - (point.y - session.startY),
        -0.3,
        0.3,
      ),
    };
    document.body.style.cursor = 'grabbing';
  };

  const endRifleDrag = (event: ThreeEvent<PointerEvent>) => {
    const session = rifleDragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    rifleDragSession.current = null;
    const target = event.target as unknown as {
      releasePointerCapture?: (pointerId: number) => void;
    };
    target.releasePointerCapture?.(event.pointerId);
    document.body.style.cursor = '';
    setDragging(false);

    // 按下没移动 = 点击。拖拽图层挂上了指针事件，
    // R3F 不会再补发 click，所以在这里补开按下时命中的弹窗。
    if (!session.moved) {
      const dialog = POPUP_DIALOGS[session.picked];
      if (dialog) onOpenDialog(session.picked, dialog.title, dialog.content);
    }
  };

  /**
   * 沿射线从前往后找第一块「真正画了东西」的图层。
   *
   * 拾取几何只能是矩形包围盒，而雪山是七八层叠在一起的剪影：
   * 旗面、草地、步枪的包围盒会盖住后面雪堆的可见部分。
   * 这里按贴图 alpha 再筛一次，透明区域直接穿透，
   * 保证每一层都能点到自己画面内非透明的部分。
   */
  const pickTopOpaqueLayer = (
    intersections: THREE.Intersection[],
  ): PopUpLayerId | null => {
    const visited = new Set<PopUpLayerId>();
    for (const hit of intersections) {
      const object = hit.object as THREE.Mesh & {
        userData: { layerId?: PopUpLayerId };
      };
      const id = object.userData.layerId;
      if (!id || visited.has(id)) continue;
      visited.add(id);

      const layer = POPUP_LAYER_BY_ID.get(id);
      const cutout = textures[id];
      const group = object.parent;
      if (!layer || !cutout || !group) continue;

      // 纸板局部坐标 → 整张贴图的归一化 uv
      const local = group.worldToLocal(hit.point.clone());
      const u = (local.x + layer.halfWidth) / (layer.halfWidth * 2);
      const v = local.y / popUpHeight(layer, cutout);
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      if (isTextureOpaque(cutout.texture, u, v)) return id;
    }
    return null;
  };

  const handleClick = (
    event: ThreeEvent<MouseEvent>,
    layer: PopUpLayerConfig,
  ) => {
    // 书没完全展开时不响应点击，避免翻开途中误触
    if (openRef.current < 0.995) return;
    // 拖拽旋转视角时指针会从机关上划过，位移过大就不算点击
    if ((event.delta ?? 0) > 5) return;
    event.stopPropagation();

    // 以实际画面为准：包围盒里透明的部分让给后面的图层
    const picked = pickTopOpaqueLayer(event.intersections) ?? layer.id;

    // 建筑就是“门”，保留一镜到底的推门运镜
    if (picked === 'building') {
      startRoomEntry();
      return;
    }

    // 熊 / 会议群像 / 背包 / 雪山八层：交给 React 层的自定义弹窗
    const dialog = POPUP_DIALOGS[picked];
    if (dialog) onOpenDialog(picked, dialog.title, dialog.content);
  };

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;

    /* ---------------- 机关显隐：合上时彻底不渲染 ---------------- */
    //
    // openRef 是封面打开进度（封面角度 = π × open）。
    // 封面还翘着时，立起来的 V 型纸板一定会和封面相交，
    // 所以直到封面剩余角度约 3.6°（open = 0.98）才开始淡入，
    // open = 0（完全合上）时 reveal = 0：
    //   · 每个纸板 Group 的 visible = false；
    //   · 正面 / 纸芯 / 背面材质的 opacity = 0。
    // 两者叠加，合上的书连一个像素的纸板都不会提交渲染。
    const reveal = THREE.MathUtils.smoothstep(
      openRef.current,
      POPUP_REVEAL_START,
      POPUP_REVEAL_END,
    );
    if (reveal !== revealRef.current) {
      revealRef.current = reveal;
      Object.values(materials).forEach((set) => {
        if (!set) return;
        set.front.opacity = reveal;
        set.edge.opacity = reveal;
        set.back.opacity = reveal;
      });
    }
    const popupVisible = reveal > POPUP_VISIBLE_EPSILON;

    /* ---------------- 书页帧 → V 型纸板矩阵 ---------------- */
    //
    // 这一段是源码 VFold.update() 的 R3F 翻译：
    //   1. 取左右书页的 matrixWorld，换算到机关根节点空间；
    //   2. 用书页帧把「胶线方向」和「折缝位置」带到世界空间；
    //   3. 两条胶线的叉积就是折缝方向 d；
    //   4. 用 makeBasis(X, d, X×d) 写出两半纸板的正交基。
    //
    // 纸板不是靠 rotation.x 立起来的：它被两张书页的矩阵同时拽着，
    // 书翻开多少，V 型就张开多少；书合上时它被夹回书页之间。
    const root = rootRef.current;
    const leftAnchor = leftPageRef.current;
    const rightAnchor = rightPageRef.current;

    if (root && leftAnchor && rightAnchor) {
      // 机关根节点挂在书本组里，先把世界矩阵换回它的局部空间
      root.updateWorldMatrix(true, false);
      _invRoot.copy(root.matrixWorld).invert();

      // 左页锚点挂在封面铰链上，这一句会把封面的当前角度带进来
      leftAnchor.updateWorldMatrix(true, false);
      rightAnchor.updateWorldMatrix(true, false);
      _frameL.multiplyMatrices(_invRoot, leftAnchor.matrixWorld);
      _frameR.multiplyMatrices(_invRoot, rightAnchor.matrixWorld);

      POPUP_LAYERS.forEach((layer) => {
        const leftGroup = cardGroups.current[`${layer.id}:left`];
        const rightGroup = cardGroups.current[`${layer.id}:right`];
        if (!leftGroup || !rightGroup) return;

        // 书还没翻开（或正在合上）：整组不渲染。
        // 同时跳过后面的矩阵计算，闭合状态下的退化 V 折
        // 不会再把纸板摆到封面外面去。
        leftGroup.visible = popupVisible;
        rightGroup.visible = popupVisible;
        if (!popupVisible) return;

        // 步枪拖拽：在图层自身的 z 上叠加页面平面位移。
        // 用 ref 读取，拖动时不需要触发 React 重渲染。
        const drag =
          layer.id === 'snow_rifle' ? rifleDrag.current : null;

        // 折缝上的公共点：两张书页在同一深度处贴纸点的中点。
        // 书完全摊平时它就是书脊上的点；翻开过程中两根书页一起定义它。
        const layerZ = layer.z + (drag?.z ?? 0);
        _spineL.set(0, 0, layerZ).applyMatrix4(_frameL);
        _spineR.set(0, 0, layerZ).applyMatrix4(_frameR);
        _creasePoint.copy(_spineL).add(_spineR).multiplyScalar(0.5);

        // 胶线：从书脊向外贴在书页上的底边，方向随左右书页各自旋转
        const sign = layer.fold === 'in' ? 1 : -1;
        const c = Math.cos(layer.angle);
        const s = Math.sin(layer.angle) * sign;
        _glueL.set(-c, 0, s).transformDirection(_frameL);
        _glueR.set(c, 0, s).transformDirection(_frameR);

        // 折缝方向：两条胶线的叉积（fold 决定朝上还是朝下）
        if (layer.fold === 'in') {
          _creaseDir.crossVectors(_glueL, _glueR);
        } else {
          _creaseDir.crossVectors(_glueR, _glueL);
        }
        if (_creaseDir.lengthSq() < 1e-8) {
          // 书完全合上时两条胶线重合，给一个稳定的退化方向，
          // 纸板平贴在书页上（此时被封面挡住，看不见）
          _creaseDir.set(0, 1, 0);
        } else {
          _creaseDir.normalize();
        }

        // 横向微调：直接叠加到最终矩阵的 position.x 上，
        // 左右两半用同一个偏移量，折缝仍然严丝合缝，整组一起平移。
        const offsetX = (layer.offsetX ?? 0) + (drag?.x ?? 0);
        const cardX = _creasePoint.x + offsetX;

        // 右半：X 沿胶线向外，Y 沿折缝向上，Z = X × Y 是纸板正面
        _axisX.copy(_glueR);
        _axisZ.crossVectors(_axisX, _creaseDir);
        _rightMatrix
          .makeBasis(_axisX, _creaseDir, _axisZ)
          .setPosition(cardX, _creasePoint.y, _creasePoint.z);
        applyCardMatrix(rightGroup, _rightMatrix);

        // 左半：局部 X 从外缘指向书脊，贴图方向才和右半拼得上
        _axisX.copy(_glueL).negate();
        _axisZ.crossVectors(_axisX, _creaseDir);
        _leftMatrix
          .makeBasis(_axisX, _creaseDir, _axisZ)
          .setPosition(cardX, _creasePoint.y, _creasePoint.z);
        applyCardMatrix(leftGroup, _leftMatrix);
      });
    }

    // 一镜到底：推近 → 切换室内 → 停留 → 平滑退回
    const shot = dolly.current;
    if (shot) {
      if (shot.startedAt === null) shot.startedAt = elapsed;

      if (shot.phase === 'approach') {
        // 0.8s 推到建筑前，朝向同步 slerp，避免中途朝向跳变
        const t = THREE.MathUtils.clamp(
          (elapsed - shot.startedAt) / DOLLY_DURATION,
          0,
          1,
        );
        const eased = easeInOutQuart(t);
        camera.position.lerpVectors(
          shot.fromPosition,
          shot.closePosition,
          eased,
        );
        camera.quaternion.slerpQuaternions(
          shot.fromQuaternion,
          shot.closeQuaternion,
          eased,
        );

        if (t >= 1) {
          // 镜头贴到建筑：这一刻才切换场景，
          // 门外纸板立刻隐藏、室内机关直接以书页矩阵立起。
          camera.position.copy(shot.closePosition);
          camera.quaternion.copy(shot.closeQuaternion);
          shot.phase = 'hold';
          shot.arrivedAt = elapsed;
          setRoomStage('inside');
        }
      } else if (shot.phase === 'hold') {
        if (
          shot.arrivedAt !== null &&
          elapsed - shot.arrivedAt >= DOLLY_HOLD
        ) {
          shot.phase = 'return';
          shot.returnStartedAt = elapsed;
        }
      } else {
        // 0.8s 从门前平滑退回推门前的视角，保留一镜到底的完整闭环
        if (shot.returnStartedAt === null) shot.returnStartedAt = elapsed;
        const t = THREE.MathUtils.clamp(
          (elapsed - shot.returnStartedAt) / DOLLY_BACK_DURATION,
          0,
          1,
        );
        const eased = easeInOutQuart(t);
        camera.position.lerpVectors(
          shot.closePosition,
          shot.fromPosition,
          eased,
        );
        camera.quaternion.slerpQuaternions(
          shot.closeQuaternion,
          shot.fromQuaternion,
          eased,
        );

        if (t >= 1) {
          camera.position.copy(shot.fromPosition);
          camera.quaternion.copy(shot.fromQuaternion);
          dolly.current = null;
          setCinematic(false);
        }
      }
    }

  });

  return (
    /*
     * 机关根节点：所有纸板的矩阵都由 useFrame 以这里为原点写入。
     * 它自己不带任何变换，所以子节点的 matrix 就是书中坐标系下的矩阵。
     */
    <group ref={rootRef} name={`popup-${activeScene}`}>
      {POPUP_LAYERS.map((layer) => {
        const panel = panels[layer.id];
        const card = materials[layer.id];
        if (!panel || !card) return null;

        const active = activeScene === layer.scene;
        // 有弹窗文案的图层才参与悬停 / 点击；
        // building 是「门」，没有普通弹窗但要走推门运镜，单独保留；
        // 室内背景墙、泸定桥水花这类纯装饰层不响应指针。
        const interactive =
          active &&
          (layer.id === 'building' || Boolean(POPUP_DIALOGS[layer.id]));
        const draggable = layer.id === 'snow_rifle';
        const leftKey: PopUpHalfKey = `${layer.id}:left`;
        const rightKey: PopUpHalfKey = `${layer.id}:right`;

        return (
          <group
            key={layer.id}
            name={`popup-layer-${layer.id}`}
            visible={active}
          >
            <CardHalf
              geometry={panel.left}
              hitLayerId={layer.id}
              hitGeometry={panel.hitLeft}
              materials={card}
              groupRef={cardSetters[leftKey]}
              interactive={interactive}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              onClick={(event) => handleClick(event, layer)}
              onPointerDown={draggable ? handleRiflePointerDown : undefined}
              onPointerMove={draggable ? handleRiflePointerMove : undefined}
              onPointerUp={draggable ? endRifleDrag : undefined}
              onPointerCancel={draggable ? endRifleDrag : undefined}
            />
            <CardHalf
              geometry={panel.right}
              hitLayerId={layer.id}
              hitGeometry={panel.hitRight}
              materials={card}
              groupRef={cardSetters[rightKey]}
              interactive={interactive}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              onClick={(event) => handleClick(event, layer)}
              onPointerDown={draggable ? handleRiflePointerDown : undefined}
              onPointerMove={draggable ? handleRiflePointerMove : undefined}
              onPointerUp={draggable ? endRifleDrag : undefined}
              onPointerCancel={draggable ? endRifleDrag : undefined}
            />
          </group>
        );
      })}
      {/* 漫天飞雪：只在雪山场景挂载，不参与任何点击拾取 */}
      {activeScene === 'snow' && <Snowfall />}
    </group>
  );
}

/**
 * 书完全展开后接管镜头：鼠标左键拖拽环绕整本书，滚轮拉近拉远。
 * 只在 phase === 'open' 时挂载，避免和翻书过程中的镜头动画互相抢控制权；
 * 重新翻阅时 phase 变回 idle，组件卸载，镜头动画自动恢复。
 */
function OrbitRig() {
  const { phase, cinematic, dragging } = useJourneyState();
  const size = useThree((state) => state.size);

  // 推门运镜期间让出镜头控制权，弹回原位后再挂载。
  // 步枪拖拽只临时禁用控制器，不能卸载：
  // 重新挂载时 OrbitControls 会按 target 重算朝向，整个画面会跳一下，
  // 点击拾取也会和按下时错位。
  if (phase !== 'open' || cinematic) return null;

  const portrait = size.width < size.height;
  const bookScale = portrait ? 0.52 : 1;

  return (
    <OrbitControls
      makeDefault
      enabled={!dragging}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.65}
      zoomSpeed={0.7}
      minDistance={3}
      maxDistance={10}
      maxPolarAngle={Math.PI / 2.1} // 👈 极其重要：这行代码禁止了镜头从正上方俯视，强制把视角压平！
      target={[SPREAD_CENTER_X * bookScale, 0.3, 0]} // 👈 把 Y 轴（中间那个 0.02）改成 -0.5，把书拉回画面中央！
    />
  );
}

/**
 * 相机视差跟随。
 *
 * 相机每一帧都会被三种逻辑写入：翻书时的镜头动画、OrbitControls 的
 * damping、以及推门运镜。如果直接往 camera.position 上叠加偏移，
 * 下一帧就会被它们覆盖，甚至让 OrbitControls 把偏移当成新的环绕半径。
 *
 * 这里把相机挂到一个只做微小位移的 rig 上：
 * - camera.position 仍然是原逻辑里的局部坐标，互不干扰；
 * - rig.position 只负责 pointer.x * 0.16 / pointer.y * 0.08 的视差；
 * - 相机世界矩阵会自动带上 rig 的偏移，看到的画面就有呼吸感。
 *
 * 与源码逐行等价：
 *   camera.position.x += (pointer.x * 0.16 - camera.position.x) * 0.1;
 *   camera.position.y += (pointer.y * 0.08 - camera.position.y) * 0.1;
 * 只是偏移量落在 rig 上，而不是直接改写 camera.position。
 * 相机朝向仍由原来的 lookAt / OrbitControls / 推门运镜负责，
 * 因此鼠标移动时画面会轻微反向移动，又不会锁死拖拽和运镜。
 */
function CameraParallax() {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const { cinematic } = useJourneyState();

  const rig = useMemo(() => new THREE.Group(), []);
  const cinematicRef = useRef(cinematic);

  useEffect(() => {
    cinematicRef.current = cinematic;
  }, [cinematic]);

  useEffect(() => {
    scene.add(rig);
    rig.add(camera);

    return () => {
      scene.add(camera);
      scene.remove(rig);
      rig.position.set(0, 0, 0);
    };
  }, [camera, scene, rig]);

  useFrame((state, delta) => {
    // 与源码的 * 0.1 等价；换算到帧率无关，掉帧时不会突然变慢
    const damping =
      1 - Math.pow(1 - PARALLAX_DAMPING, Math.min(delta, 0.05) * 60);

    // 推门运镜时压低视差，避免和运镜方向打架
    const factor = cinematicRef.current ? 0.25 : 1;
    const targetX = state.pointer.x * PARALLAX_X * factor;
    const targetY = state.pointer.y * PARALLAX_Y * factor;

    rig.position.x += (targetX - rig.position.x) * damping;
    rig.position.y += (targetY - rig.position.y) * damping;
  });

  return null;
}

interface BookProps {
  onOpenDialog: (id: string, title: string, content: string) => void;
}

export function Book({ onOpenDialog }: BookProps) {
  const textures = useBookTextures();
  const { chapter } = useJourneyState();
  const openRequest = useOpenRequest();
  const camera = useThree((state) => state.camera);
  const coverHingeRef = useRef<THREE.Group>(null);
  const leftPageRef = useRef<THREE.Object3D>(null);
  const rightPageRef = useRef<THREE.Object3D>(null);
  const parallaxRef = useRef<THREE.Group>(null);
  const floatRef = useRef<THREE.Group>(null);
  const scaleRef = useRef<THREE.Group>(null);
  const spinFrameRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const innerLightRef = useRef<THREE.PointLight>(null);

  const phaseRef = useRef<JourneyPhase>('idle');
  const targetSpin = useRef(0);
  const spin = useRef(0);
  const open = useRef(0);
  const openStartTime = useRef<number | null>(null);
  const lastCss = useRef(-1);
  const resetToken = useResetToken();

  const setPhase = useCallback((next: JourneyPhase) => {
    if (phaseRef.current === next) return;
    phaseRef.current = next;
    setJourneyPhase(next);
  }, []);

  const advance = useCallback(
    (amount: number) => {
      if (phaseRef.current === 'opening' || phaseRef.current === 'open') return;
      const next = THREE.MathUtils.clamp(targetSpin.current + amount, 0, 1);
      if (next === targetSpin.current) return;
      targetSpin.current = next;
      markInteracted();
      setPhase('spinning');
    },
    [setPhase],
  );

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (phaseRef.current === 'opening' || phaseRef.current === 'open') return;
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? window.innerHeight
            : 1;
      const delta = event.deltaY * unit;
      advance(THREE.MathUtils.clamp(delta * 0.00085, -0.18, 0.18));
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [advance]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isUiTarget(event.target)) return;
      let amount = 0;
      if (
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === ' '
      ) {
        amount = 0.075;
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        amount = -0.075;
      } else {
        return;
      }
      event.preventDefault();
      advance(amount);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance]);

  useEffect(() => {
    let dragging = false;
    let lastY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || isUiTarget(event.target)) return;
      if (phaseRef.current === 'opening' || phaseRef.current === 'open') return;
      dragging = true;
      lastY = event.clientY;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const delta = lastY - event.clientY;
      lastY = event.clientY;
      if (Math.abs(delta) < 0.5) return;
      advance(THREE.MathUtils.clamp(delta * 0.0032, -0.14, 0.14));
    };

    const onPointerUp = () => {
      dragging = false;
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [advance]);

  useEffect(() => {
    targetSpin.current = 0;
    spin.current = 0;
    open.current = 0;
    openStartTime.current = null;
    phaseRef.current = 'idle';
    lastCss.current = -1;
    journeyProgress.spin = 0;
    journeyProgress.open = 0;
    journeyProgress.total = 0;
    coverHingeRef.current?.rotation.set(0, 0, 0);
    if (innerLightRef.current) innerLightRef.current.intensity = 0;
    floatRef.current?.position.set(0, 0, 0);
    spinFrameRef.current?.rotation.set(BASE_TILT_X, 0, BASE_TILT_Z);
    scaleRef.current?.scale.setScalar(1);
    camera.position.set(0, 0.32, 5.4);
    camera.lookAt(0, 0.02, 0);
    document.documentElement.style.setProperty('--journey', '0');
    document.documentElement.style.setProperty('--book-open', '0');
  }, [resetToken, camera]);

  /**
   * 章节导航联动：
   * 点击右侧「05 雪山草地」后，即使书还合着，也自动开卷。
   * 直接把 spin 置满，跳过“转书一周”，让雪山八层尽快出现。
   */
  useEffect(() => {
    if (openRequest <= 0) return;
    if (phaseRef.current === 'opening' || phaseRef.current === 'open') return;
    targetSpin.current = 1;
    spin.current = 1;
    markInteracted();
    setPhase('spinning');
  }, [openRequest, setPhase]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;

    spin.current +=
      (targetSpin.current - spin.current) * (1 - Math.exp(-dt * 6.5));
    if (spin.current > 0.998) spin.current = 1;

    if (
      targetSpin.current >= 1 &&
      spin.current >= 0.985 &&
      openStartTime.current === null &&
      phaseRef.current !== 'open'
    ) {
      openStartTime.current = elapsed;
      setPhase('opening');
    }

    if (openStartTime.current !== null) {
      const progress = THREE.MathUtils.clamp(
        (elapsed - openStartTime.current) / BOOK_OPEN_DURATION,
        0,
        1,
      );
      open.current = progress >= 0.999 ? 1 : easeInOutQuart(progress);
      if (progress >= 0.999 && phaseRef.current !== 'open') setPhase('open');
    }

    const openEase = open.current;
    const portrait = state.size.width < state.size.height;
    const baseScale = portrait ? 0.8 : 1;
    const openScale = portrait ? 0.52 : 1;
    const bookScale = THREE.MathUtils.lerp(baseScale, openScale, openEase);

    if (spinRef.current) {
      spinRef.current.rotation.y = smoothstep01(spin.current) * Math.PI * 2;
    }
    if (spinFrameRef.current) {
      spinFrameRef.current.rotation.x = THREE.MathUtils.lerp(
        BASE_TILT_X,
        OPEN_TILT_X,
        openEase,
      );
      spinFrameRef.current.rotation.z = THREE.MathUtils.lerp(
        BASE_TILT_Z,
        OPEN_TILT_Z,
        openEase,
      );
    }
    if (scaleRef.current) {
      scaleRef.current.scale.setScalar(bookScale);
    }
    if (floatRef.current) {
      floatRef.current.position.y =
        Math.sin(elapsed * 0.8) * 0.03 * (1 - openEase);
    }
    if (coverHingeRef.current) {
      coverHingeRef.current.rotation.y = -Math.PI * openEase;
    }
    if (innerLightRef.current) {
      innerLightRef.current.intensity = openEase * 0.85;
    }
    if (parallaxRef.current) {
      const damping = 1 - Math.exp(-dt * 3);
      const pointer = state.pointer;
      parallaxRef.current.rotation.x +=
        (pointer.y * 0.045 * (1 - openEase * 0.65) -
          parallaxRef.current.rotation.x) *
        damping;
      parallaxRef.current.rotation.z +=
        (-pointer.x * 0.03 * (1 - openEase * 0.65) -
          parallaxRef.current.rotation.z) *
        damping;
    }

    // 全书打开后从左侧封面外缘（-HALF_W - W）延伸到右侧页块外缘（PAGE_W / 2）
    // 镜头动画只在翻书过程中接管；完全打开后交给 OrbitControls，
    // 否则两边每帧都写 camera，拖拽会被立刻拽回去。
    if (open.current < 0.999) {
      const spreadCenter = ((HALF_W + W - PAGE_W / 2) / 2) * bookScale;
      const baseZ = portrait ? 5.8 : 5.0;
      const openZ = portrait ? 7.2 : 5.25;
      const targetZ = THREE.MathUtils.lerp(baseZ, openZ, openEase);
      // 完全打开后给一个右上方 3/4 视角：书已躺平，从斜上方俯看，
      // 垂直立起的纸板能看出正面的画和侧面的厚度。
      const focusX = -spreadCenter * openEase;
      const targetX = focusX + (portrait ? 0.35 : 1.15) * openEase;
      const targetY = THREE.MathUtils.lerp(0.32, 3.6, openEase);
      const damp = 1 - Math.exp(-dt * 2.6);

      camera.position.x += (targetX - camera.position.x) * damp;
      camera.position.y += (targetY - camera.position.y) * damp;
      camera.position.z += (targetZ - camera.position.z) * damp;
      camera.lookAt(focusX, 0.02, 0);
    }

    journeyProgress.spin = spin.current;
    journeyProgress.open = open.current;
    const total = spin.current * 0.62 + open.current * 0.38;
    journeyProgress.total = total;

    if (Math.abs(total - lastCss.current) > 0.0006) {
      lastCss.current = total;
      document.documentElement.style.setProperty(
        '--journey',
        total.toFixed(4),
      );
      document.documentElement.style.setProperty(
        '--book-open',
        open.current.toFixed(4),
      );
    }
  });

  return (
    <>
      <CameraParallax />
      <group ref={parallaxRef}>
        <group ref={floatRef}>
          <group ref={scaleRef}>
            <group
              ref={spinFrameRef}
              rotation={[BASE_TILT_X, 0, BASE_TILT_Z]}
            >
              <group ref={spinRef}>
                <BookModel
                  textures={textures}
                  chapter={chapter}
                  coverHingeRef={coverHingeRef}
                  leftPageRef={leftPageRef}
                  rightPageRef={rightPageRef}
                  openRef={open}
                  onOpenDialog={onOpenDialog}
                />
                <PopUpScene
                  openRef={open}
                  resetToken={resetToken}
                  onOpenDialog={onOpenDialog}
                  leftPageRef={leftPageRef}
                  rightPageRef={rightPageRef}
                />
                <pointLight
                  ref={innerLightRef}
                  position={[0, 0.4, 1.05]}
                  color="#ffc98f"
                  intensity={0}
                  distance={4.5}
                  decay={2}
                />
              </group>
            </group>
          </group>
        </group>
        <OrbitRig />
      </group>
    </>
  );
}
