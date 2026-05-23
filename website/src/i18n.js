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
      subtitle: 'VP Mirror is designed to run locally, bringing robust computer vision capabilities to your desktop without complex environment setup.',
      items: [
        {
          icon: '🧍',
          title: 'Wholebody Detection',
          desc: 'Automatically detects facial mesh, finger joints, and full body skeletons using the vitpose-s-wholebody model.'
        },
        {
          icon: '⚡',
          title: 'Real-Time Inference',
          desc: 'Powered by YOLOv8 human detection and SORT tracking, optimized for efficient performance across platforms.'
        },
        {
          icon: '💻',
          title: 'Cross-Platform',
          desc: 'Compatible with Windows, macOS, and Linux. Built-in dependency management with FFmpeg integration.'
        }
      ]
    },
    howItWorks: {
      title1: 'System Architecture',
      title2: 'Under the hood',
      subtitle: 'VP Mirror orchestrates a multi-stage neural network pipeline for reliable pose estimation.',
      cards: [
        {
          step: '01',
          title: 'YOLOv8 Detection',
          desc: 'YOLOv8 identifies human bounding boxes in the frame with high accuracy, functioning well in complex scenes.'
        },
        {
          step: '02',
          title: 'SORT Tracking',
          desc: 'Simple Online and Realtime Tracking (SORT) assigns unique IDs to individuals, maintaining temporal consistency.'
        },
        {
          step: '03',
          title: 'ViTPose Analysis',
          desc: 'The ViTPose engine processes cropped bounding boxes to extract 2D keypoints and skeletal structures.'
        }
      ]
    },
    citation: {
      title1: 'Academic References',
      subtitleVomee: 'VP Mirror is derived from our multimodal data collection platform, Vomee. If you use our tool in your research, please consider citing our paper:',
      subtitleVitpose: 'Our core skeleton extraction engine is built upon the incredible ViTPose foundation model. Please also acknowledge their pioneering work:',
      subtitleYolo: 'VP Mirror also integrates Ultralytics YOLO26 for high-performance inference. Please cite their work if you use YOLO models:',
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
      subtitle: 'VP Mirror 提供了开箱即用的体验，无需复杂的环境配置即可在桌面端运行计算机视觉算法。',
      items: [
        {
          icon: '🧍',
          title: '全身联合检测',
          desc: '使用 vitpose-s-wholebody 模型，自动提取面部特征、手指关节及全身骨架。'
        },
        {
          icon: '⚡',
          title: '实时推理',
          desc: '基于 YOLOv8 人体检测和 SORT 目标跟踪，针对不同操作系统平台进行了性能优化。'
        },
        {
          icon: '💻',
          title: '跨平台支持',
          desc: '兼容 Windows、macOS 和 Linux。内置 FFmpeg 环境依赖处理，降低使用门槛。'
        }
      ]
    },
    howItWorks: {
      title1: '系统架构',
      title2: '技术原理',
      subtitle: 'VP Mirror 并行调用多个神经网络模型，实现稳定的姿态估计管线。',
      cards: [
        {
          step: '01',
          title: 'YOLOv8 目标检测',
          desc: '通过 YOLOv8 快速识别画面中的人体边界框，能够较好地适应复杂的环境背景。'
        },
        {
          step: '02',
          title: 'SORT 目标跟踪',
          desc: '使用 SORT 算法为画面中的目标分配独立 ID，保持视频帧之间的人物跟踪一致性。'
        },
        {
          step: '03',
          title: 'ViTPose 姿态分析',
          desc: 'ViTPose 引擎对裁剪出的人体区域进行分析，输出相应的 2D 骨骼关键点结构。'
        }
      ]
    },
    citation: {
      title1: '学术引用',
      subtitleVomee: 'VP Mirror 衍生自我们的多模态数据采集平台 Vomee。如果您在研究中使用了本工具，欢迎引用我们的论文：',
      subtitleVitpose: '本项目的核心骨骼特征提取基于优秀的 ViTPose 基础模型。也请在研究中致谢他们的开创性工作：',
      subtitleYolo: 'VP Mirror 同时集成了极致性能的 Ultralytics YOLO26 推理引擎。如果您使用了 YOLO 模型，也请引用他们的工作：',
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
