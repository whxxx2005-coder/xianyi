# 静态资源存放说明

为了使网页能够自动识别并读取您的资料，请在项目根目录下手动创建 `assets` 文件夹及其子文件夹，并按以下规则存放文件：

## 1. 图片资源 (assets/images/)
- 首页展示图：命名为 `poster.png` (或由代码中的 fallback URL 处理)
- 文物图片：命名为 `{ID}.png`（例如：`rel-1.png`, `rel-2.png` 等，对应 constants.tsx 中的 ID）
- 支持格式：.png, .jpg, .jpeg

## 2. 音频资源 (assets/audio/)
- 讲解词音频：命名格式为 `{文物ID}_{人格英文名}.mp3`
- 人格英文名对应表：
  - 促进型 -> `facilitator`
  - 探索者 -> `explorer`
  - 专业研究者 -> `professional`
  - 灵感寻求者 -> `inspiration`
  - 体验追寻者 -> `experience`
- 示例：`rel-1_explorer.mp3`

> **提示**：当您将文件放入这些文件夹后，网页在本地预览或部署到 GitHub Pages 时，会自动优先读取这些本地资源，无需修改代码。