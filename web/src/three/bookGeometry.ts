import * as THREE from 'three';

export function createStarGeometry(
  outerRadius = 1,
  innerRadius = 0.42,
  depth = 0.06,
) {
  const shape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 4,
  });
}

/**
 * 书角金属包角：原点在角上，两臂分别沿 +X 与 -Y 展开，
 * 通过 Z 轴旋转复用到四个角。
 */
export function createCornerGeometry(
  arm = 0.165,
  width = 0.038,
  depth = 0.012,
) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(arm, 0);
  shape.lineTo(arm, -width);
  shape.lineTo(width, -width);
  shape.lineTo(width, -arm);
  shape.lineTo(0, -arm);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.0025,
    bevelSegments: 2,
    curveSegments: 2,
  });
}
