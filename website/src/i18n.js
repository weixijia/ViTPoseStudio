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
      badge: 'v1.0 is now live ✨',
      title1: 'Real-Time Skeleton',
      title2: 'Pose Estimation.',
      subtitle1: 'A distilled, lightweight version of our comprehensive multimodal data collection platform, Vomee.',
      subtitle2: 'Experience seamless RGB-based visual motion capture with a beautiful GUI.',
      btnDownload: 'View on GitHub',
    },
    features: {
      title1: 'Incredible precision.',
      title2: 'Zero configuration.',
      subtitle: 'VP Mirror is designed to run out of the box, bringing cutting-edge computer vision to your desktop without the headache of environment setup.',
      items: [
        {
          icon: '🧍',
          title: 'Wholebody Detection',
          desc: 'Automatically detects full facial mesh, detailed finger joints, and full body skeletons using the state-of-the-art vitpose-s-wholebody model.'
        },
        {
          icon: '⚡',
          title: 'Real-Time Inference',
          desc: 'Powered by YOLOv8 human detection and SORT tracking, optimized for lightning-fast performance across all modern devices.'
        },
        {
          icon: '💻',
          title: 'Cross-Platform',
          desc: 'Fully compatible with Windows, macOS, and Linux. We handle the heavy lifting and FFmpeg dependency management.'
        }
      ]
    },
    howItWorks: {
      title1: 'Advanced Architecture.',
      title2: 'Under the hood.',
      subtitle: 'VP Mirror orchestrates multiple neural networks in parallel to deliver a smooth, reliable pose estimation pipeline.',
      cards: [
        {
          step: '01',
          title: 'YOLOv8 Detection',
          desc: 'First, ultra-fast YOLOv8 identifies human bounding boxes in the frame with exceptional accuracy, even in crowded scenes.'
        },
        {
          step: '02',
          title: 'SORT Tracking',
          desc: 'Simple Online and Realtime Tracking (SORT) assigns unique IDs to each person, ensuring temporal consistency across frames.'
        },
        {
          step: '03',
          title: 'ViTPose Analysis',
          desc: 'Finally, the ViTPose engine processes cropped bounding boxes to extract highly precise 2D keypoints and skeletal structures.'
        }
      ]
    },
    citation: {
      title1: 'Backed by Academic Research.',
      subtitle: 'VP Mirror is distilled from our multimodal data collection platform, Vomee. If you use our tool in your research, please cite our paper:',
    },
    footer: {
      copyright: '© 2026 Xijia Wei. Released under the MIT License.',
      links: ['GitHub', 'Releases', 'Issues']
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
      badge: 'v1.0 现已发布 ✨',
      title1: '实时骨骼',
      title2: '姿态估计。',
      subtitle1: '从我们全面的多模态数据采集平台 Vomee 中精炼而出的轻量级版本。',
      subtitle2: '借助精美的图形界面，体验无缝的基于 RGB 的视觉动作捕捉。',
      btnDownload: '在 GitHub 上查看',
    },
    features: {
      title1: '令人惊叹的精度。',
      title2: '零配置开箱即用。',
      subtitle: 'VP Mirror 旨在开箱即用，将前沿的计算机视觉技术带到您的桌面，免去繁杂的环境配置烦恼。',
      items: [
        {
          icon: '🧍',
          title: '全身联合检测',
          desc: '使用先进的 vitpose-s-wholebody 模型，自动检测完整的面部网格、详细的手指关节和全身骨架。'
        },
        {
          icon: '⚡',
          title: '实时推理',
          desc: '由 YOLOv8 人体检测和 SORT 目标跟踪技术驱动，专为所有现代设备上的极速性能而优化。'
        },
        {
          icon: '💻',
          title: '跨平台支持',
          desc: '完全兼容 Windows、macOS 和 Linux。我们为您处理了复杂的 FFmpeg 依赖管理。'
        }
      ]
    },
    howItWorks: {
      title1: '先进的架构。',
      title2: '深入底层。',
      subtitle: 'VP Mirror 并行调度多个神经网络，以提供流畅、可靠的姿态估计流水线。',
      cards: [
        {
          step: '01',
          title: 'YOLOv8 检测',
          desc: '首先，极速的 YOLOv8 模型会在画面中准确识别出人体的边界框，即使在拥挤的场景中也能保持高精度。'
        },
        {
          step: '02',
          title: 'SORT 目标跟踪',
          desc: '简单的在线实时跟踪算法 (SORT) 为每个人分配唯一的 ID，确保连续帧之间的人物一致性。'
        },
        {
          step: '03',
          title: 'ViTPose 姿态分析',
          desc: '最后，ViTPose 引擎对裁剪后的人体区域进行深度分析，提取极其精确的 2D 关键点和骨骼结构。'
        }
      ]
    },
    citation: {
      title1: '由学术研究支持。',
      subtitle: 'VP Mirror 提炼自我们的多模态数据采集平台 Vomee。如果您在研究中使用了我们的工具，请引用我们的论文：',
    },
    footer: {
      copyright: '© 2026 Xijia Wei. 基于 MIT 协议开源。',
      links: ['GitHub', '发布版本', '问题反馈']
    }
  }
}

export function getTranslation(langCode) {
  return translations[langCode] || translations['en']
}
