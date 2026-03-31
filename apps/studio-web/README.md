# studio-web

基于 Three.js 的 16 寸和 7 寸便携显示器亚马逊宣传场景预览应用。

## 启动方式

1. 进入目录：`cd apps/studio-web`
2. 安装依赖：`npm install`
3. 启动预览：`npm run dev`
4. 浏览器访问：`http://localhost:4173`
5. 在页面顶部切换 `16 inch` 或 `7 inch` 场景包

## 当前能力

- 使用 Three.js 构建 WebGL 3D 场景
- 自动读取 `scenarios/portable-monitor/products/16-inch/product.json`
- 自动读取 `scenarios/portable-monitor/products/07-inch/product.json`
- 自动合并两个尺寸目录下的 `overrides/*.json`
- 生成 `public/generated/portable-monitor-16-inch.json`
- 生成 `public/generated/portable-monitor-07-inch.json`
- 生成 `public/generated/manifest.json`
- 自动复制 `three.module.js` 和 `three.core.js` 到 `public/vendor/`
- 在页面中切换不同尺寸并预览对应的 7 张亚马逊主图/副图场景
- 支持拖拽旋转、滚轮缩放、重置视角与 PNG 导出
- 支持 30 秒视频预览播放、进度条拖动和时间轴跳转
- 支持灯光、材质、屏幕亮度、FOV 与道具显隐调参
- 查看每个场景的 prompt、override 数据和视频分镜

## 相关文件

- `server.js`: 本地静态服务器
- `scripts/generate-scene-data.js`: 16 寸场景数据生成脚本
- `scripts/generate-scene-data-07.js`: 7 寸场景数据生成脚本
- `scripts/build-manifest.js`: 多尺寸 manifest 生成脚本
- `scripts/prepare-vendor.js`: Three.js 浏览器模块复制脚本
- `public/index.html`: 页面入口
- `public/app.mjs`: 前端交互与场景切换入口
- `public/three-scene.mjs`: Three.js 场景与模型构建器
- `public/styles.css`: 页面与场景样式
- `public/vendor/three.module.js`: 本地 Three.js ESM 模块




## 清晰度说明

- 当前导出视频的清晰度主要受 Three.js 画布尺寸、屏幕纹理分辨率和导出码率影响。
- 进入全屏通常会让视频更清晰一些，因为舞台变大后，当前画布会以更高像素尺寸录制。
- 但如果想稳定提升参数可读性，仍然建议后续继续提高屏幕纹理分辨率和相机取景比例。

