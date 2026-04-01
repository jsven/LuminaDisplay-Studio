# studio-web

基于 React、Vite 和 React Three Fiber 的便携显示器亚马逊场景预览应用，当前舞台采用 cozy room 风格的室内桌面场景。

## 启动方式

1. 在仓库根目录安装依赖：`npm install`
2. 在仓库根目录启动开发环境：`npm run dev`
3. 浏览器访问：`http://localhost:4173`
4. 在页面顶部切换 `16 inch` 或 `7 inch` 场景包
5. 当前开发服务以前台进程运行，按 `Ctrl+C` 或直接关闭当前控制台窗口会一起停止服务

## 常用命令

- `npm run dev`: 同步场景数据并以前台方式启动 Vite 开发服务
- `npm run build`: 生成场景数据并构建 React 应用到 `apps/studio-web/dist`
- `npm run start`: 构建后使用 `server.js` 提供 `dist` 静态服务
- `npm run export:preview`: 构建后通过浏览器自动化导出预览视频
- `npm run sync:scenes`: 仅重新生成 `public/generated/*.json`

## 当前能力

- 使用 React + React Three Fiber 构建 WebGL 3D 场景
- 自动读取 `scenarios/portable-monitor/products/16-inch/product.json`
- 自动读取 `scenarios/portable-monitor/products/07-inch/product.json`
- 自动合并两个尺寸目录下的 `overrides/*.json`
- 生成 `public/generated/portable-monitor-16-inch.json`
- 生成 `public/generated/portable-monitor-07-inch.json`
- 生成 `public/generated/manifest.json`
- 在页面中切换不同尺寸并预览对应的 7 张亚马逊主图/副图场景
- 支持在 cozy room 房间场景中切换配套主机设备：笔记本、手机、台式机或自动匹配
- 支持拖拽旋转、滚轮缩放、重置视角与 PNG 导出
- 支持 30 秒视频预览播放、进度条拖动和时间轴跳转
- 支持灯光、材质、屏幕亮度、FOV 与道具显隐调参
- 查看每个场景的 prompt、override 数据和视频分镜

## 相关文件

- `src/App.jsx`: React 应用状态、面板布局、导出交互
- `src/stage/PortableMonitorStage.jsx`: R3F 3D 场景、相机控制、监视器和道具组件
- `src/stage/screenTextures.js`: 屏幕 HUD 和动态纹理绘制
- `scripts/run-preview.js`: 前台 Vite 开发服务启动器
- `scripts/generate-scene-data.js`: 16 寸场景数据生成脚本
- `scripts/generate-scene-data-07.js`: 7 寸场景数据生成脚本
- `scripts/build-manifest.js`: 多尺寸 manifest 生成脚本
- `server.js`: 构建产物静态服务

## 清晰度说明

- 当前导出视频的清晰度主要受 Three.js 画布尺寸、屏幕纹理分辨率和导出码率影响。
- 进入全屏通常会让视频更清晰一些，因为舞台变大后，当前画布会以更高像素尺寸录制。
- 如果想稳定提升参数可读性，仍然建议后续继续提高屏幕纹理分辨率和相机取景比例。
