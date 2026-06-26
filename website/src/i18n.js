export const languages = [
  { code: 'en', label: 'English', flag: 'US' },
  { code: 'cn', label: '简体中文', flag: 'CN' }
]

const translations = {
  en: {
    nav: { features: 'Features', howItWorks: 'How it Works', citation: 'Citation', github: 'GitHub' },
    hero: {
      badge: 'v1.0 Released',
      title1: 'Real-time skeleton',
      title2: 'pose estimation.',
      subtitle1: 'A lightweight desktop build of our multimodal capture platform, Vomee —',
      subtitle2: 'RGB-based motion capture with a streamlined GUI, running locally.',
      btnDownload: 'View on GitHub',
      btnReleases: 'Releases',
    },
    mock: {
      record: 'Start Recording',
      engine: 'Pose Engine',
      provider: 'Provider',
      keypoints: 'Keypoints',
      model: 'Model',
      telemetry: 'Telemetry',
      running: 'Running',
    },
    features: {
      eyebrow: 'Features',
      title1: 'High precision,',
      title2: 'out of the box.',
      subtitle: 'Pose Studio runs locally and brings robust computer vision to your desktop without any complex environment setup.',
      items: [
        { icon: '🧍', title: 'Pose Model Selector', desc: 'Filter by provider and keypoint coverage, then choose among RTMPose, RTMW, ViTPose, and YOLO pose models.' },
        { icon: '⚡', title: 'Isolated Engines', desc: 'Loads MMPose RTMLib, ViTPose, and YOLO in independent worker processes so their dependencies never collide.' },
        { icon: '💻', title: 'Mac-Oriented Defaults', desc: 'Starts from RTMPose-S Body+Feet while keeping heavier whole-body engines selectable.' },
      ],
    },
    howItWorks: {
      eyebrow: 'Architecture',
      title1: 'A multi-engine',
      title2: 'pipeline.',
      subtitle: 'Pose Studio orchestrates independent neural-network workers for reliable, swappable pose estimation.',
      cards: [
        { step: '01', title: 'MMPose RTMLib Worker', desc: 'The default engine runs RTMPose-S Body+Feet on ONNX Runtime CPU for reliable real-time skeletons on Mac.' },
        { step: '02', title: 'ViTPose Worker', desc: 'ViTPose whole-body (133 keypoints) is available as a high-detail PyTorch option on MPS or CPU.' },
        { step: '03', title: 'Optional Engines', desc: 'ViTPose, YOLO pose, and RTMW whole-body all stay selectable from the same desktop UI.' },
      ],
    },
    citation: {
      eyebrow: 'Citation',
      title1: 'Academic references.',
      subtitleVomee: 'Pose Studio is derived from our multimodal data collection platform, Vomee. If you use it in your research, please consider citing our paper:',
      subtitleYolo: 'Pose Studio includes Ultralytics YOLO pose models as selectable lightweight engines. Please cite their work if you use YOLO models:',
      subtitlePose2Sim: 'Pose Studio interoperates with Pose2Sim workflows through RTMLib-compatible keypoint formats. Please cite Pose2Sim when you use the full pipeline:',
    },
    footer: {
      brandDesc: 'A lightweight desktop build of Vomee. Seamless RGB-based visual motion capture.',
      copyright: '© 2026 Xijia Wei. Released under the MIT License.',
      columns: [
        { title: 'Product', links: [
          { label: 'Features', href: '#features' },
          { label: 'How it Works', href: '#howitworks' },
          { label: 'GitHub', href: 'https://github.com/weixijia/ViTPoseStudio' },
          { label: 'Releases', href: 'https://github.com/weixijia/ViTPoseStudio/releases' },
        ] },
        { title: 'Resources', links: [
          { label: 'Paper Citation', href: '#citation' },
          { label: 'Contact (Xijia Wei)', href: 'mailto:xijia.wei.21@ucl.ac.uk' },
          { label: 'Issues', href: 'https://github.com/weixijia/ViTPoseStudio/issues' },
        ] },
      ],
    },
  },
  cn: {
    nav: { features: '功能特点', howItWorks: '工作原理', citation: '学术引用', github: 'GitHub' },
    hero: {
      badge: 'v1.0 现已发布',
      title1: '实时骨骼',
      title2: '姿态估计。',
      subtitle1: '多模态采集平台 Vomee 的轻量桌面版本 ——',
      subtitle2: '基于 RGB 的本地动作捕捉，配简洁的图形界面。',
      btnDownload: '在 GitHub 上查看',
      btnReleases: '发布版本',
    },
    mock: {
      record: '开始录制',
      engine: '姿态引擎',
      provider: '提供商',
      keypoints: '关键点',
      model: '模型',
      telemetry: '遥测',
      running: '运行中',
    },
    features: {
      eyebrow: '功能特点',
      title1: '高精度，',
      title2: '开箱即用。',
      subtitle: 'Pose Studio 在本地运行，无需复杂环境配置，即可在桌面端获得稳定的计算机视觉能力。',
      items: [
        { icon: '🧍', title: '姿态模型选择器', desc: '按提供商和关键点覆盖范围筛选，再选择 RTMPose、RTMW、ViTPose 或 YOLO pose 模型。' },
        { icon: '⚡', title: '独立引擎进程', desc: 'MMPose RTMLib、ViTPose 与 YOLO 分别在独立 worker 进程中加载，依赖互不冲突。' },
        { icon: '💻', title: '面向 Mac 的默认选择', desc: '启动时选中 RTMPose-S Body+Feet，同时保留更重的 whole-body 引擎可选。' },
      ],
    },
    howItWorks: {
      eyebrow: '系统架构',
      title1: '多引擎',
      title2: '推理管线。',
      subtitle: 'Pose Studio 编排多个独立的神经网络 worker，实现稳定且可切换的姿态估计。',
      cards: [
        { step: '01', title: 'MMPose RTMLib Worker', desc: '默认引擎在 Mac 上以 ONNX Runtime CPU 运行 RTMPose-S Body+Feet，保证实时 skeleton 稳定输出。' },
        { step: '02', title: 'ViTPose Worker', desc: 'ViTPose whole-body（133 关键点）作为高细节 PyTorch 选项，运行在 MPS 或 CPU 上。' },
        { step: '03', title: '可选引擎', desc: 'ViTPose、YOLO pose 与 RTMW whole-body 都可在同一个桌面端直接切换。' },
      ],
    },
    citation: {
      eyebrow: '引用文献',
      title1: '学术引用。',
      subtitleVomee: 'Pose Studio 衍生自我们的多模态数据采集平台 Vomee。如果您在研究中使用了本工具，欢迎引用我们的论文：',
      subtitleYolo: 'Pose Studio 包含 Ultralytics YOLO pose 模型作为可选轻量引擎。如果使用 YOLO 模型，请引用他们的工作：',
      subtitlePose2Sim: 'Pose Studio 可通过 RTMLib 兼容关键点格式接入 Pose2Sim 工作流。如果使用完整 pipeline，请引用 Pose2Sim：',
    },
    footer: {
      brandDesc: 'Vomee 的轻量桌面版本，提供流畅的 RGB 视觉动作捕捉。',
      copyright: '© 2026 Xijia Wei. 基于 MIT 协议开源。',
      columns: [
        { title: '产品', links: [
          { label: '功能特点', href: '#features' },
          { label: '工作原理', href: '#howitworks' },
          { label: 'GitHub', href: 'https://github.com/weixijia/ViTPoseStudio' },
          { label: '发布版本', href: 'https://github.com/weixijia/ViTPoseStudio/releases' },
        ] },
        { title: '开发资源', links: [
          { label: '论文引用', href: '#citation' },
          { label: '联系方式 (魏熙佳)', href: 'mailto:xijia.wei.21@ucl.ac.uk' },
          { label: '问题反馈', href: 'https://github.com/weixijia/ViTPoseStudio/issues' },
        ] },
      ],
    },
  },
}

export function getTranslation(langCode) {
  return translations[langCode] || translations['en']
}
