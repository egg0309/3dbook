import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { BOOK_ASSETS } from '../config';
import {
  createBookTextures,
  type BookTextures,
  type BookTextureOverrides,
} from './textures';

type AssetKey = keyof typeof BOOK_ASSETS;

const ASSET_TARGET: Record<AssetKey, keyof BookTextures> = {
  coverFront: 'coverBase',
  coverBack: 'backCoverBase',
  cloth: 'clothMap',
  endpaper: 'endpaper',
  paper: 'paper',
  pageEdge: 'pageEdge',
};

export function useBookTextures(): BookTextures {
  const procedural = useMemo(() => createBookTextures(), []);
  const [overrides, setOverrides] = useState<BookTextureOverrides>({});

  useEffect(() => {
    const enabled = (Object.keys(BOOK_ASSETS) as AssetKey[]).filter(
      (key) => BOOK_ASSETS[key],
    );
    if (!enabled.length) return;

    let cancelled = false;
    const loader = new THREE.TextureLoader();

    Promise.all(
      enabled.map(async (key) => {
        const url = BOOK_ASSETS[key];
        if (!url) return null;
        try {
          const texture = await loader.loadAsync(url);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 8;
          texture.needsUpdate = true;
          return [ASSET_TARGET[key], texture] as const;
        } catch {
          console.warn(`[book] 美术资产加载失败，继续使用占位材质: ${url}`);
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: BookTextureOverrides = {};
      results.forEach((entry) => {
        if (!entry) return;
        const [target, texture] = entry;
        next[target] = texture;
        if (target === 'paper') next.firstPage = texture;
      });
      if (Object.keys(next).length) setOverrides(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => ({ ...procedural, ...overrides }), [procedural, overrides]);
}
