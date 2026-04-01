/**
 * 场景布局配置
 *
 * 这份文件用于描述每个场景里“模型之间的空间关系”。
 * 你后续主要改这里，而不是改 R3F 渲染代码。
 *
 * 约定：
 * - `position`: [x, y, z]
 * - `rotationDeg`: [x, y, z]，单位是角度，渲染层会自动转成弧度
 * - `scale`: 标量；如果某个模型需要单独缩放，直接改这里
 * - `items`: 当前场景桌面上要出现的小物件 key 列表
 * - `device`: 当前场景默认的配套主机设备
 *
 * 说明：
 * - 这里优先描述“位置、朝向、缩放、组合关系”
 * - 几何体本身的尺寸和材质仍在 `PortableMonitorStage.jsx` 里
 * - 如果你只想微调物体之间的关系，通常只需要改本文件
 */

const DEFAULT_LAYOUT = {
  camera: {
    // 相机默认视角。你可以按场景单独调镜头远近感
    fov: 28,
    // 轨道相机允许缩放的最近距离
    orbitMinRadius: 1.5,
    // 轨道相机允许缩放的最远距离
    orbitMaxRadius: 6.5,
    position: [2.35, 0.18, 3.05],
    target: [0.18, -0.05, 0.16],
  },

  monitor: {
    // 显示器最终会根据桌面高度自动落地，所以这里不直接写 y
    position: [0.28, 0, 0.16],
    rotationDeg: [1.5, -10, 0],
    scale: 1,
    floatAmount: 0.006,
    // 桌面上表面高度。改它会整体影响显示器的站立高度
    surfaceY: -0.99,
  },

  companion: {
    // 当前场景默认使用哪种主机设备
    device: 'laptop',

    laptop: {
      cable: {
        from: [-0.44, 0.06, -0.12],
        midOffsetA: [0.18, 0.16, -0.04],
        midOffsetB: [-0.12, 0.1, 0.12],
        to: [1.18, 0.2, -0.52],
      },
      position: [-0.98, -0.69, 0.92],
      rotationDeg: [0, 18, 0],
      scale: 0.92,
    },

    phone: {
      cable: {
        from: [0.04, -0.04, 0.02],
        midOffsetA: [0.12, 0.04, -0.02],
        midOffsetB: [-0.08, 0.08, 0.1],
        to: [1.12, 0.16, -0.42],
      },
      position: [-0.72, -0.73, 0.84],
      rotationDeg: [0, 10, 0],
      scale: 1,
    },

    desktop: {
      cable: {
        color: '#d8dfe4',
        from: [1.32, -0.4, 0.58],
        midOffsetA: [-0.18, 0.22, -0.1],
        midOffsetB: [-0.16, 0.08, 0.08],
        to: [0.88, 0.14, -0.4],
      },
      keyboard: {
        position: [0.92, -0.98, 1.02],
        scale: 0.9,
      },
      mouse: {
        position: [1.52, -0.96, 1.04],
        scale: 0.9,
      },
      tower: {
        position: [1.58, -0.72, 0.88],
        rotationDeg: [0, -10, 0],
        scale: 1,
      },
    },
  },

  accessories: {
    // 当前场景桌面上默认显示哪些小物件
    items: [],

    hub: {
      position: [1.06, -0.98, 0.92],
    },

    lamp: {
      position: [1.18, -0.82, 1.18],
    },

    mug: {
      position: [-0.48, -0.9, 1.08],
    },

    notebook: {
      position: [-0.24, -0.97, 1.02],
      rotationDeg: [0, -12, 0],
    },

    plant: {
      position: [-1.26, -0.9, 1.1],
    },

    speakers: {
      positions: [
        [-1.16, -0.9, 0.58],
        [1.26, -0.9, 0.58],
      ],
    },
  },

  room: {
    chair: {
      backrest: {
        position: [-0.96, -0.64, 1.34],
        rotationDeg: [0, -12, 0],
      },
      seat: {
        position: [-0.96, -0.92, 1.42],
        rotationDeg: [0, -12, 0],
      },
      stoolBase: {
        position: [-0.96, -1.21, 1.56],
        rotationDeg: [-90, 0, 0],
      },
    },

    curtains: {
      left: {
        position: [-0.62, 0.18, -1.92],
        rotationDeg: [0, 0, 14],
      },
      right: {
        position: [1.26, 0.22, -1.92],
        rotationDeg: [0, 0, -10],
      },
    },

    desk: {
      legs: [
        [-1.84, -1.52, 0.02],
        [2.06, -1.52, 0.02],
        [-1.84, -1.52, 1.46],
        [2.06, -1.52, 1.46],
      ],
      mat: {
        position: [0.44, -0.99, 0.66],
      },
      top: {
        position: [0.18, -1.08, 0.74],
      },
    },

    floorPlant: {
      position: [-2.38, -0.82, -1.18],
    },

    rug: {
      position: [-1.34, -1.13, 0.52],
      rotationDeg: [-90, 0, 0],
    },

    shelf: {
      position: [1.74, 0.06, -1.62],
    },

    window: {
      frameCenter: [0.34, 1.08, -2.03],
      glowPlane: [0.34, 1.08, -2.06],
      panelPlane: [0.34, 1.08, -2.04],
    },
  },
};

/**
 * 每个场景只写“和默认值不同”的部分。
 * 这样配置文件更短，也更适合后续微调。
 */
export const SCENE_LAYOUT_OVERRIDES = {
  'compact-build': {
    accessories: { items: ['hub'] },
    camera: {
      fov: 26,
      position: [2.48, 0.22, 2.68],
      target: [0.5, -0.08, 0.1],
    },
    companion: { device: 'desktop' },
    monitor: {
      position: [0.42, 0, 0.16],
      rotationDeg: [1.5, -18, 0],
    },
  },

  'embedded-control': {
    accessories: { items: ['hub', 'plant'] },
    camera: {
      fov: 27,
      position: [2.28, 0.24, 2.92],
      target: [0.22, -0.08, 0.12],
    },
    companion: { device: 'desktop' },
  },

  'gaming-144hz': {
    accessories: { items: ['speakers'] },
    camera: {
      fov: 29,
      position: [2.42, 0.08, 2.78],
      target: [0.2, -0.16, 0.05],
    },
    companion: { device: 'desktop' },
    monitor: {
      position: [0.24, 0, 0.1],
      rotationDeg: [1.5, -14, 0],
    },
  },

  'gaming-compact': {
    accessories: { items: ['speakers'] },
    camera: {
      fov: 29,
      position: [2.42, 0.08, 2.78],
      target: [0.2, -0.16, 0.05],
    },
    companion: { device: 'desktop' },
    monitor: {
      position: [0.24, 0, 0.1],
      rotationDeg: [1.5, -14, 0],
    },
  },

  'hero-main': {
    accessories: { items: ['lamp'] },
    camera: {
      fov: 27,
      position: [2.1, 0.28, 2.95],
      target: [0.16, -0.05, 0.14],
    },
    companion: { device: 'laptop' },
    monitor: {
      position: [0.18, 0, 0.16],
      rotationDeg: [1.5, -6, 0],
    },
  },

  'material-stand': {
    accessories: { items: ['hub'] },
    camera: {
      fov: 26,
      position: [2.48, 0.22, 2.68],
      target: [0.5, -0.08, 0.1],
    },
    companion: { device: 'desktop' },
    monitor: {
      position: [0.42, 0, 0.16],
      rotationDeg: [1.5, -18, 0],
    },
  },

  'office-productivity': {
    accessories: { items: ['notebook', 'mug'] },
    camera: {
      fov: 28,
      position: [2.28, 0.24, 2.92],
      target: [0.22, -0.08, 0.12],
    },
    companion: { device: 'laptop' },
  },

  'ports-connectivity': {
    accessories: { items: ['hub'] },
    camera: {
      fov: 24,
      orbitMaxRadius: 4.8,
      position: [1.7, -0.08, 1.92],
      target: [0.88, -0.02, 0.08],
    },
    companion: { device: 'laptop' },
    monitor: {
      position: [0.82, 0, 0.08],
      rotationDeg: [6, -80, 0],
    },
  },

  'touch-lamination': {
    accessories: { items: ['notebook'] },
    camera: {
      fov: 25,
      orbitMaxRadius: 4.2,
      position: [1.72, 0.2, 2.18],
      target: [0.44, 0.02, 0.18],
    },
    companion: { device: 'phone' },
    monitor: {
      position: [0.34, 0, 0.16],
      rotationDeg: [1.5, -4, 0],
    },
  },

  'travel-portable': {
    accessories: { items: ['mug'] },
    camera: {
      fov: 30,
      position: [2.56, 0.24, 3.1],
      target: [0.1, -0.06, 0.18],
    },
    companion: { device: 'phone' },
  },

  'vesa-speakers': {
    accessories: { items: ['speakers'] },
    camera: {
      fov: 25,
      position: [1.96, 0.16, 2.44],
      target: [0.18, -0.06, 0.08],
    },
    companion: { device: 'desktop' },
    monitor: {
      position: [0.24, 0, 0.16],
      rotationDeg: [3, 158, 0],
    },
  },
};

function cloneArray(value) {
  return Array.isArray(value) ? [...value] : value;
}

function deepMerge(base, override) {
  if (override === undefined) return base;
  if (Array.isArray(base) || Array.isArray(override)) return cloneArray(override);
  if (!base || typeof base !== 'object' || !override || typeof override !== 'object') return override;

  const result = { ...base };

  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base[key], override[key]);
  }

  return result;
}

export function getSceneLayout(sceneId) {
  return deepMerge(DEFAULT_LAYOUT, SCENE_LAYOUT_OVERRIDES[sceneId] || {});
}
