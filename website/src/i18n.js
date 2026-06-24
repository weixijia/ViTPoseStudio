export const languages = [
  { code: 'en', label: 'English', flag: 'US' },
  { code: 'cn', label: '简体中文', flag: 'CN' }
]

const translations = {
  en: {
    nav: {
      features: 'Features',
      howItWorks: 'How it Works',
      citation: 'Citation',
      github: 'GitHub'
    },
    hero: {
      badge: 'v1.0 Released',
      title1: 'Real-Time Skeleton',
      title2: 'Pose Estimation',
      subtitle1: 'A lightweight version of our multimodal data collection platform, Vomee.',
      subtitle2: 'Providing RGB-based visual motion capture with a streamlined GUI.',
      btnDownload: 'View on GitHub',
    },
    features: {
      title1: 'High Precision',
      title2: 'Out-of-the-Box',
      subtitle: 'Pose Studio is designed to run locally, bringing robust computer vision capabilities to your desktop without complex environment setup.',
      items: [
        {
          icon: '🧍',
          title: 'Pose Model Selector',
          desc: 'Filter by provider and keypoint coverage, then choose among RTMPose, RTMW, Sapiens2, ViTPose, and YOLO pose models.'
        },
        {
          icon: '⚡',
          title: 'Isolated Engines',
          desc: 'Loads Sapiens2, MMPose RTMLib models, ViTPose, and YOLO in independent worker processes.'
        },
        {
          icon: '💻',
          title: 'Mac-Oriented Defaults',
          desc: 'Starts from RTMPose-S Body+Feet while keeping heavier whole-body and offline options selectable.'
        }
      ]
    },
    howItWorks: {
      title1: 'System Architecture',
      title2: 'Under the hood',
      subtitle: 'Pose Studio orchestrates a multi-stage neural network pipeline for reliable pose estimation.',
      cards: [
        {
          step: '01',
          title: 'MMPose RTMLib Worker',
          desc: 'The first model runs RTMPose-S Body+Feet with ONNX Runtime CPU on Mac for reliable skeleton output.'
        },
        {
          step: '02',
          title: 'Sapiens2 Worker',
          desc: 'Sapiens2 remains available as a heavyweight high-detail option in a separate Python environment.'
        },
        {
          step: '03',
          title: 'Optional Engines',
          desc: 'ViTPose, YOLO pose, RTMW whole-body, and Sapiens2 remain available from the same desktop UI.'
        }
      ]
    },
    citation: {
      title1: 'Academic References',
      subtitleVomee: 'Pose Studio is derived from our multimodal data collection platform, Vomee. If you use our tool in your research, please consider citing our paper:',
      subtitleSapiens: 'Pose Studio includes Sapiens2 as an offline frontier pose framework. Please cite Sapiens2 when you use that engine:',
      subtitleYolo: 'Pose Studio includes Ultralytics YOLO pose models as selectable lightweight pose engines. Please cite their work if you use YOLO models:',
      subtitlePose2Sim: 'Pose Studio can interoperate with Pose2Sim workflows through RTMLib-compatible keypoint formats. Please cite Pose2Sim when you use the full Pose2Sim pipeline:',
    },
    footer: {
      brandDesc: 'A lightweight version of Vomee. Providing seamless RGB-based visual motion capture.',
      copyright: '© 2026 Xijia Wei. Released under the MIT License.',
      columns: [
        {
          title: 'Product',
          links: [
            { label: 'Features', href: '#features' },
            { label: 'How it Works', href: '#howitworks' },
            { label: 'GitHub', href: 'https://github.com/weixijia/ViTPoseStudio' },
            { label: 'Releases', href: 'https://github.com/weixijia/ViTPoseStudio/releases' }
          ]
        },
        {
          title: 'Resources',
          links: [
            { label: 'Paper Citation', href: '#citation' },
            { label: 'Contact (Xijia Wei)', href: 'mailto:xijia.wei.21@ucl.ac.uk' },
            { label: 'Issues', href: 'https://github.com/weixijia/ViTPoseStudio/issues' }
          ]
        }
      ]
    }
  },
  cn: {
    nav: {
      features: '功能特点',
      howItWorks: '工作原理',
      citation: '学术引用',
      github: 'GitHub'
    },
    hero: {
      badge: 'v1.0 现已发布',
      title1: '实时骨骼',
      title2: '姿态估计',
      subtitle1: '基于我们的多模态数据采集平台 Vomee 打造的轻量级版本。',
      subtitle2: '通过直观的图形界面，提供流畅的 RGB 视觉动作捕捉体验。',
      btnDownload: '在 GitHub 上查看',
    },
    features: {
      title1: '高精度检测',
      title2: '开箱即用',
      subtitle: 'Pose Studio 提供了开箱即用的体验，无需复杂的环境配置即可在桌面端运行计算机视觉算法。',
      items: [
        {
          icon: '🧍',
          title: '姿态模型选择器',
          desc: '按提供商和关键点覆盖范围筛选，再选择 RTMPose、RTMW、Sapiens2、ViTPose 或 YOLO pose 模型。'
        },
        {
          icon: '⚡',
          title: '独立引擎进程',
          desc: 'Sapiens2、MMPose RTMLib 模型、ViTPose 与 YOLO 分别在独立 worker 进程中加载。'
        },
        {
          icon: '💻',
          title: '面向 Mac 的默认选择',
          desc: '启动时选中 RTMPose-S Body+Feet，同时保留更重的 whole-body 与离线选项。'
        }
      ]
    },
    howItWorks: {
      title1: '系统架构',
      title2: '技术原理',
      subtitle: 'Pose Studio 并行调用多个神经网络模型，实现稳定的姿态估计管线。',
      cards: [
        {
          step: '01',
          title: 'MMPose RTMLib Worker',
          desc: '首个模型在 Mac 上使用 ONNX Runtime CPU 跑 RTMPose-S Body+Feet，以保证 skeleton 稳定输出。'
        },
        {
          step: '02',
          title: 'Sapiens2 Worker',
          desc: 'Sapiens2 作为高细节但更重的选项保留在独立 Python 环境中。'
        },
        {
          step: '03',
          title: '可选引擎',
          desc: 'ViTPose、YOLO pose、RTMW whole-body 与 Sapiens2 都可在同一个桌面端直接选择。'
        }
      ]
    },
    citation: {
      title1: '学术引用',
      subtitleVomee: 'Pose Studio 衍生自我们的多模态数据采集平台 Vomee。如果您在研究中使用了本工具，欢迎引用我们的论文：',
      subtitleSapiens: 'Pose Studio 包含 Sapiens2 作为离线 frontier 姿态框架。如果使用该引擎，请引用 Sapiens2：',
      subtitleYolo: 'Pose Studio 包含 Ultralytics YOLO pose 模型作为可选轻量姿态引擎。如果使用 YOLO 模型，请引用他们的工作：',
      subtitlePose2Sim: 'Pose Studio 可通过 RTMLib 兼容关键点格式接入 Pose2Sim 工作流。如果使用完整 Pose2Sim pipeline，请引用 Pose2Sim：',
    },
    footer: {
      brandDesc: '基于 Vomee 打造的轻量级版本，提供流畅的 RGB 视觉动作捕捉体验。',
      copyright: '© 2026 Xijia Wei. 基于 MIT 协议开源。',
      columns: [
        {
          title: '产品',
          links: [
            { label: '功能特点', href: '#features' },
            { label: '工作原理', href: '#howitworks' },
            { label: 'GitHub', href: 'https://github.com/weixijia/ViTPoseStudio' },
            { label: '发布版本', href: 'https://github.com/weixijia/ViTPoseStudio/releases' }
          ]
        },
        {
          title: '开发资源',
          links: [
            { label: '论文引用', href: '#citation' },
            { label: '联系方式 (魏熙佳)', href: 'mailto:xijia.wei.21@ucl.ac.uk' },
            { label: '问题反馈', href: 'https://github.com/weixijia/ViTPoseStudio/issues' }
          ]
        }
      ]
    }
  }
}

export function getTranslation(langCode) {
  return translations[langCode] || translations['en']
}
