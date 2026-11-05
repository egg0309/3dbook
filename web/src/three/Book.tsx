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
import { BOOK_OPEN_DURATION } from '../config';
import {
  journeyProgress,
  markInteracted,
  setCinematic,
  setJourneyPhase,
  useJourneyState,
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

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
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
  coverHingeRef: RefObject<THREE.Group | null>;
}

function BookModel({ textures, coverHingeRef }: BookModelProps) {
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

    const firstPage = new THREE.MeshStandardMaterial({
      map: textures.firstPage,
      bumpMap: textures.paper,
      bumpScale: 0.0018,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.3,
    });

    const endpaper = new THREE.MeshStandardMaterial({
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
  }, [textures]);

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
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 立体书机关：书页展开后的折叠场景                                    */
/* ------------------------------------------------------------------ */

type PopUpSceneId = 'outside' | 'inside';
type PopUpLayerId = 'building' | 'bear' | 'meetingRoom' | 'bag' | 'roomBg';

/**
 * 展开后整个跨页的中心 X。
 * 与 Book 里 spreadCenter 的算法保持一致，OrbitControls 以它为环绕中心。
 */
const SPREAD_CENTER_X = -((HALF_W + W - PAGE_W / 2) / 2);

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
 * 世界对齐舞台。
 *
 * 书完全摊平后 spinFrame 绕 X 转了 -90°，书页法线朝上。
 * 在书里再放一个绕 X 转 +90° 的舞台，两级旋转相互抵消，
 * 舞台内部就回到世界坐标：
 *   x = 右页左右（0 = 右页中心）
 *   y = 垂直向上（纸面高度 = BOOK_SURFACE_Y）
 *   z = 朝镜头的前后纵深（越大越靠近镜头）
 * 这样需求里的 z = -1 / 0 / 0.5 就可以直接写进图层配置。
 */
const POPUP_STAGE_ROTATION_X = Math.PI / 2;

/** 纸板最大宽度：等于右页宽度，背景墙按 100% 页宽计算 */
const POPUP_MAX_WIDTH = PAGE_W;

/**
 * 折纸的平铺起始角：+PI/2；完全翻开时折叠组转到 0。
 *
 * 铰链在纸板底边、正好贴着纸面。折叠组从 +PI/2 转到 0，
 * 就是纸板从「平铺在页面上」翻到「垂直立起」的物理动作；
 * 立起后纸板底边仍贴着纸面，mesh 自身 rotation 保持 [0, 0, 0]，
 * 贴图不会左右翻转。
 */
const POPUP_FOLD_FLAT = Math.PI / 2;
const POPUP_CLICK_THRESHOLD = 0.8;

/** 推门运镜：1 秒推到门前，室内画面停留 0.25 秒，然后瞬间弹回原位 */
const DOLLY_DURATION = 1.0;
const DOLLY_HOLD = 0.25;
const DOLLY_CLOSE_Z = 1.0;

interface PopUpSource {
  url: string;
  /** 首选文件不存在时自动回退，避免 404 让整个机关消失 */
  fallbackUrl?: string;
}

const POPUP_SOURCES: Record<PopUpLayerId, PopUpSource> = {
  building: { url: '/book/building.png' },
  bear: { url: '/book/bear.jpg' },
  meetingRoom: { url: '/book/meeting_room.jpg' },
  // 需求里写的是 bag_newspaper.jpg，但 public/book 里现有的文件名是 stove_bag.jpg。
  // 两个都兼容：优先用需求里的名字，缺失时自动回退。
  bag: {
    url: '/book/bag_newspaper.jpg',
    fallbackUrl: '/book/stove_bag.jpg',
  },
  // 室内背景墙。需求里写的是 room_bg.jpg，仓库里实际是 room_bg.png；
  // 优先用现有 png，日后换成 jpg 也能自动回退。
  roomBg: {
    url: '/book/room_bg.png',
    fallbackUrl: '/book/room_bg.jpg',
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
  meetingRoom: {
    title: '遵义会议现场',
    content: '你听，争论声此起彼伏……',
  },
  bag: {
    title: '长征的艰苦',
    content:
      '火炉旁放着战士的背包，底下压着旧报纸，可见当时条件多艰苦。',
  },
};

interface PopUpLayerConfig {
  id: PopUpLayerId;
  scene: PopUpSceneId;
  /**
   * 纸板显示宽度（书页局部坐标，PAGE_W = 1.625）。
   * 高度由贴图真实宽高比自动推导，永远不会被拉伸变形。
   */
  width: number;
  /** 右页上的横向位置：0 = 右页中心 */
  x: number;
  /** 前后层次：-1 最后（背景墙），0 中景，0.5 最前（背包） */
  z: number;
  /** 同一场景内的展开延迟：前层稍晚立起，更像真实机关 */
  delay: number;
}

/**
 * 尺寸比例（以右页宽度 PAGE_W = 1.625 / 深度 PAGE_H = 2.28 为基准）：
 *
 *   roomBg       100% 页宽 = 1.625      → 高 0.897（贴图比例 1.8115）
 *   building      70% 页宽 = 1.1375     → 高 0.556（贴图比例 2.0455）
 *   meetingRoom   80% 页宽 = 1.30       → 高 0.527（贴图比例 2.4668）
 *   bear          18.5% 页宽 = 0.30     → 高 0.401（贴图比例 0.7484）
 *   bag           18.5% 页宽 = 0.30     → 高 0.281（贴图比例 1.0675）
 */
const POPUP_LAYERS: PopUpLayerConfig[] = [
  // 室内：背景墙最后、群像在中景、背包最前，正好是 z = -1 / 0 / 0.5
  {
    id: 'roomBg',
    scene: 'inside',
    width: PAGE_W, // 100% 页宽，正好铺满右页
    x: 0,
    z: -1,
    delay: 0,
  },
  {
    id: 'meetingRoom',
    scene: 'inside',
    width: PAGE_W*0.8, // 80% 页宽，左右各留 10% 纸边
    x: 0,
    z: 0,
    delay: 0,
  },
  {
    id: 'bag',
    scene: 'inside',
    width: 0.3, // 约 18.5% 页宽，右下近景小物件
    x: 0.15,
    z: 0.5,
    delay: 0.18,
  },
  // 门外：建筑在中景，熊在建筑正前方（z 比建筑大 0.1），站在门口
  {
    id: 'building',
    scene: 'outside',
    width: PAGE_W, // 70% 页宽，水平居中
    x: 0,
    z: 0,
    delay: 0,
  },
  {
    id: 'bear',
    scene: 'outside',
    width: 0.2, // 约 18.5% 页宽，比建筑矮，站在门前
    x: -0.2,
    z: 0.1,
    delay: 0.14,
  },
];

interface CutoutTexture {
  texture: THREE.Texture;
  /** 裁掉黑边后的宽高比 */
  aspect: number;
}

/**
 * 根据贴图真实宽高比推导纸板尺寸：
 * 宽度取配置值（上限为整页宽），高度 = 宽度 / 贴图宽高比。
 * 这样只改宽度就能等比缩放，图片永远不会被拉伸；
 * 位置计算与渲染共用这一份尺寸，保证底边永远贴纸面。
 */
function resolvePopUpSize(
  layer: PopUpLayerConfig,
  cutout?: CutoutTexture,
) {
  const aspect = cutout?.aspect ?? 1;
  const width = Math.min(layer.width, POPUP_MAX_WIDTH);
  return { width, height: width / aspect };
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
 * 2. 按非透明内容的包围盒裁切，plane 尺寸与真实画面一致，点击区域也更精准。
 * 3. 输出 CanvasTexture，材质端继续使用 transparent + alphaTest 0.1。
 */
function createCutoutTexture(image: HTMLImageElement): CutoutTexture {
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

  const texture = new THREE.CanvasTexture(croppedCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return { texture, aspect: cropW / cropH };
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
        return [id, createCutoutTexture(image)] as const;
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

/**
 * 一镜到底运镜状态。
 * 镜头位置从当前视角线性插值到门前，朝向用四元数 slerp，
 * 避免直接 lookAt 造成中途朝向跳变。
 */
interface DollyState {
  startedAt: number | null;
  fromPosition: THREE.Vector3;
  fromQuaternion: THREE.Quaternion;
  closePosition: THREE.Vector3;
  closeQuaternion: THREE.Quaternion;
  /** 是否已经推到最大并完成门外 / 室内切换 */
  switched: boolean;
  /** 室内画面展示到此刻后，镜头瞬间弹回 */
  snapAt: number | null;
}

interface PopUpSceneProps {
  /** 书本展开进度 0 → 1，由 Book 的 useFrame 每帧写入 */
  openRef: RefObject<number>;
  resetToken: number;
  /** 把点击机关的内容交给 Canvas 外的 React 弹窗 */
  onOpenDialog: (title: string, content: string) => void;
}

function PopUpScene({
  openRef,
  resetToken,
  onOpenDialog,
}: PopUpSceneProps) {
  const textures = usePopUpTextures();
  const [scene, setScene] = useState<PopUpSceneId>('outside');
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.size);
  const bookScale = viewport.width < viewport.height ? 0.52 : 1;

  const groups = useRef<Partial<Record<PopUpLayerId, THREE.Group>>>({});
  const meshes = useRef<Partial<Record<PopUpLayerId, THREE.Mesh>>>({});
  const progress = useRef<Record<PopUpLayerId, number>>({
    building: 0,
    bear: 0,
    meetingRoom: 0,
    bag: 0,
    roomBg: 0,
  });
  const switchStartedAt = useRef<number | null>(null);
  const dolly = useRef<DollyState | null>(null);

  // 稳定的 ref 回调，避免每次 render 触发 detach / attach
  const groupSetters = useMemo(() => {
    const setters = {} as Record<
      PopUpLayerId,
      (node: THREE.Group | null) => void
    >;
    (Object.keys(POPUP_SOURCES) as PopUpLayerId[]).forEach((id) => {
      setters[id] = (node) => {
        if (node) groups.current[id] = node;
        else delete groups.current[id];
      };
    });
    return setters;
  }, []);

  const meshSetters = useMemo(() => {
    const setters = {} as Record<
      PopUpLayerId,
      (node: THREE.Mesh | null) => void
    >;
    (Object.keys(POPUP_SOURCES) as PopUpLayerId[]).forEach((id) => {
      setters[id] = (node) => {
        if (node) meshes.current[id] = node;
        else delete meshes.current[id];
      };
    });
    return setters;
  }, []);

  // 「重新翻阅」时把机关恢复成门外、全收起的初始状态
  useEffect(() => {
    dolly.current = null;
    setCinematic(false);
    setScene('outside');
    switchStartedAt.current = null;
    (Object.keys(progress.current) as PopUpLayerId[]).forEach((id) => {
      progress.current[id] = 0;
    });
    POPUP_LAYERS.forEach(({ id }) => {
      const group = groups.current[id];
      const mesh = meshes.current[id];
      if (group) group.rotation.x = POPUP_FOLD_FLAT;
      if (mesh) mesh.visible = false;
    });
    document.body.style.cursor = '';
  }, [resetToken]);

  /**
   * 推门：镜头 1 秒内从当前视角推到门前（z = 1），
   * 推到底时切换成室内，停留片刻后瞬间弹回原位。
   */
  const startRoomEntry = () => {
    if (scene === 'inside' || dolly.current) return;
    document.body.style.cursor = '';

    const buildingLayer = POPUP_LAYERS.find(
      (layer) => layer.id === 'building',
    );
    const buildingHeight = buildingLayer
      ? resolvePopUpSize(buildingLayer, textures.building).height
      : 0.8;

    // 对准建筑中心（世界坐标 = 书局部坐标 × bookScale）
    const focusY = (BOOK_SURFACE_Y + buildingHeight / 2) * bookScale;
    const closePosition = new THREE.Vector3(0, focusY, DOLLY_CLOSE_Z);
    const closeTarget = new THREE.Vector3(0, focusY, 0);
    const closeQuaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(closePosition, closeTarget, camera.up),
    );

    dolly.current = {
      startedAt: null,
      fromPosition: camera.position.clone(),
      fromQuaternion: camera.quaternion.clone(),
      closePosition,
      closeQuaternion,
      switched: false,
      snapAt: null,
    };
    // 运镜期间卸载 OrbitControls，避免两边同时写 camera
    setCinematic(true);
  };

  const handlePointerOver = (
    event: ThreeEvent<PointerEvent>,
    layer: PopUpLayerConfig,
  ) => {
    if (openRef.current < 0.995) return;
    if (progress.current[layer.id] < POPUP_CLICK_THRESHOLD) return;
    event.stopPropagation();
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (
    event: ThreeEvent<PointerEvent>,
    layer: PopUpLayerConfig,
  ) => {
    if (openRef.current < 0.995) return;
    if (progress.current[layer.id] < POPUP_CLICK_THRESHOLD) return;
    event.stopPropagation();
    document.body.style.cursor = '';
  };

  const handleClick = (
    event: ThreeEvent<MouseEvent>,
    layer: PopUpLayerConfig,
  ) => {
    // 书没完全展开、机关没完全立起时不响应点击，避免翻开途中误触
    if (openRef.current < 0.995) return;
    if (progress.current[layer.id] < POPUP_CLICK_THRESHOLD) return;
    // 拖拽旋转视角时指针会从机关上划过，位移过大就不算点击
    if ((event.delta ?? 0) > 5) return;
    event.stopPropagation();

    // 建筑就是“门”，保留一镜到底的推门运镜
    if (layer.id === 'building') {
      startRoomEntry();
      return;
    }

    // 熊 / 会议群像 / 背包：交给 React 层的自定义弹窗
    const dialog = POPUP_DIALOGS[layer.id];
    if (dialog) onOpenDialog(dialog.title, dialog.content);
  };

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;

    // 关键：openRef 就是封面翻开进度 0 → 1。
    // 机关不再等书完全打开，而是和翻页同一帧同步起立。
    const pageOpen = THREE.MathUtils.clamp(openRef.current, 0, 1);
    const openingMaster = smoothstep01(pageOpen);

    // 室内切换：先把门外纸板折回去，再从页面上立起室内纸板
    if (scene === 'inside') {
      if (switchStartedAt.current === null) {
        switchStartedAt.current = elapsed;
      }
    } else {
      switchStartedAt.current = null;
    }

    const switchElapsed =
      scene === 'inside' && switchStartedAt.current !== null
        ? elapsed - switchStartedAt.current
        : 0;

    const outsideMaster =
      scene === 'inside'
        ? 1 - smoothstep01(THREE.MathUtils.clamp(switchElapsed / 0.5, 0, 1))
        : openingMaster;

    const insideMaster =
      scene === 'inside'
        ? smoothstep01(
            THREE.MathUtils.clamp((switchElapsed - 0.45) / 0.65, 0, 1),
          )
        : 0;

    POPUP_LAYERS.forEach((layer) => {
      const master =
        layer.scene === 'outside' ? outsideMaster : insideMaster;

      // 同一场景里前层稍晚展开：delay 之前保持 0，之后追上 1
      const span = 1 - layer.delay;
      const local =
        span <= 0
          ? master
          : THREE.MathUtils.clamp((master - layer.delay) / span, 0, 1);

      progress.current[layer.id] = local;

      const group = groups.current[layer.id];
      const mesh = meshes.current[layer.id];
      if (!group || !mesh) return;

      // 纸板翻转完全由几何驱动，不做透明度淡入淡出
      const fold = easeOutCubic(local);
      group.rotation.x = THREE.MathUtils.lerp(POPUP_FOLD_FLAT, 0, fold);
      mesh.visible = local > 0.0008;
    });

    // 一镜到底：镜头推近 → 切换到室内 → 停留 → 瞬间弹回原位
    const shot = dolly.current;
    if (shot) {
      if (shot.startedAt === null) shot.startedAt = elapsed;

      if (!shot.switched) {
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
          // 推到最大：门外纸板立即收起，室内机关直接立起
          shot.switched = true;
          shot.snapAt = elapsed + DOLLY_HOLD;
          switchStartedAt.current = elapsed - 2;
          setScene('inside');
        }
      } else if (shot.snapAt !== null && elapsed >= shot.snapAt) {
        // 室内画面停留结束，镜头瞬移回推门前的原位
        camera.position.copy(shot.fromPosition);
        camera.quaternion.copy(shot.fromQuaternion);
        dolly.current = null;
        setCinematic(false);
      }
    }
  });

  return (
    <group name={`popup-${scene}`}>
      {/*
        世界对齐舞台：抵消书本摊平后的 -90° 倾角。
        舞台内 x = 右页左右，y = 向上，z = 朝镜头前后。
      */}
      <group rotation={[POPUP_STAGE_ROTATION_X, 0, 0]}>
        {POPUP_LAYERS.map((layer) => {
          const cutout = textures[layer.id];
          const { width, height } = resolvePopUpSize(layer, cutout);
          // 背景墙只做背景，不参与悬停 / 点击
          const interactive = layer.id !== 'roomBg';

          return (
            // 铰链组：原点就是纸板底边，y = BOOK_SURFACE_Y 让它正好贴纸面
            <group
              key={layer.id}
              position={[layer.x, BOOK_SURFACE_Y, layer.z]}
            >
              <group
                ref={groupSetters[layer.id]}
                rotation={[POPUP_FOLD_FLAT, 0, 0]}
              >
                <mesh
                  ref={meshSetters[layer.id]}
                  position={[0, height / 2, 0]}
                  rotation={[0, 0, 0]}
                  visible={false}
                  onPointerOver={
                    interactive
                      ? (event) => handlePointerOver(event, layer)
                      : undefined
                  }
                  onPointerOut={
                    interactive
                      ? (event) => handlePointerOut(event, layer)
                      : undefined
                  }
                  onClick={
                    interactive
                      ? (event) => handleClick(event, layer)
                      : undefined
                  }
                >
                  <planeGeometry args={[width, height]} />
                  <meshBasicMaterial
                    map={cutout?.texture ?? null}
                    transparent
                    alphaTest={0.1}
                    side={THREE.DoubleSide}
                    depthWrite
                    toneMapped={false}
                  />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}

/**
 * 书完全展开后接管镜头：鼠标左键拖拽环绕整本书，滚轮拉近拉远。
 * 只在 phase === 'open' 时挂载，避免和翻书过程中的镜头动画互相抢控制权；
 * 重新翻阅时 phase 变回 idle，组件卸载，镜头动画自动恢复。
 */
function OrbitRig() {
  const { phase, cinematic } = useJourneyState();
  const size = useThree((state) => state.size);

  // 推门运镜期间让出镜头控制权，弹回原位后再挂载
  if (phase !== 'open' || cinematic) return null;

  const portrait = size.width < size.height;
  const bookScale = portrait ? 0.52 : 1;

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.65}
      zoomSpeed={0.7}
      minDistance={3}
      maxDistance={10}
      target={[SPREAD_CENTER_X * bookScale, 0.02, 0]}
    />
  );
}

interface BookProps {
  onOpenDialog: (title: string, content: string) => void;
}

export function Book({ onOpenDialog }: BookProps) {
  const textures = useBookTextures();
  const camera = useThree((state) => state.camera);
  const coverHingeRef = useRef<THREE.Group>(null);
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
                coverHingeRef={coverHingeRef}
              />
              <PopUpScene
                openRef={open}
                resetToken={resetToken}
                onOpenDialog={onOpenDialog}
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
  );
}
