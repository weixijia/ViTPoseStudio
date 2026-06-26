import sys
import os
import cv2
import numpy as np
import time
import threading
import subprocess
import csv
import platform
import logging

# Setup debug mode logging (Default to WARNING)
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("pose_studio_debug.log", mode='w', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                               QHBoxLayout, QLabel, QPushButton, QComboBox, 
                               QFrame, QSizePolicy, QCheckBox)
from PySide6.QtCore import Qt, QThread, Signal, Slot, QTimer
from PySide6.QtGui import QImage, QPixmap, QFont, QColor

# pose frameworks are loaded in isolated worker processes.
from pose_studio_engine.framework_process import IsolatedFrameworkModel


MODEL_CATALOG = [
    {
        "label": "MMPose RTMPose-S Body+Feet 26",
        "provider": "MMPose RTMLib",
        "coverage": "Body+Feet",
        "scale": "S",
        "keypoints": 26,
        "runtime": "ONNX Runtime CPU",
        "spec": {"framework": "mmpose_rtmlib", "size": "lightweight", "pose_model": "body_with_feet", "tracking": False, "det_frequency": 1},
    },
    {
        "label": "MMPose RTMPose-M Body+Feet 26",
        "provider": "MMPose RTMLib",
        "coverage": "Body+Feet",
        "scale": "M",
        "keypoints": 26,
        "runtime": "ONNX Runtime CPU",
        "spec": {"framework": "mmpose_rtmlib", "size": "balanced", "pose_model": "body_with_feet", "tracking": False, "det_frequency": 1},
    },
    {
        "label": "MMPose RTMPose-X Body+Feet 26",
        "provider": "MMPose RTMLib",
        "coverage": "Body+Feet",
        "scale": "X",
        "keypoints": 26,
        "runtime": "ONNX Runtime CPU",
        "spec": {"framework": "mmpose_rtmlib", "size": "performance", "pose_model": "body_with_feet", "tracking": False, "det_frequency": 1},
    },
    {
        "label": "MMPose RTMPose-S Body 17",
        "provider": "MMPose RTMLib",
        "coverage": "Body",
        "scale": "S",
        "keypoints": 17,
        "runtime": "ONNX Runtime CPU",
        "spec": {"framework": "mmpose_rtmlib", "size": "lightweight", "pose_model": "body", "tracking": False, "det_frequency": 1},
    },
    {
        "label": "MMPose RTMPose-M Body 17",
        "provider": "MMPose RTMLib",
        "coverage": "Body",
        "scale": "M",
        "keypoints": 17,
        "runtime": "ONNX Runtime CPU",
        "spec": {"framework": "mmpose_rtmlib", "size": "balanced", "pose_model": "body", "tracking": False, "det_frequency": 1},
    },
    {
        "label": "MMPose RTMPose-X Body 17",
        "provider": "MMPose RTMLib",
        "coverage": "Body",
        "scale": "X",
        "keypoints": 17,
        "runtime": "ONNX Runtime CPU",
        "spec": {"framework": "mmpose_rtmlib", "size": "performance", "pose_model": "body", "tracking": False, "det_frequency": 1},
    },
    {
        "label": "MMPose RTMW-L/M Wholebody 133",
        "provider": "MMPose RTMLib",
        "coverage": "Body+Face+Hands",
        "scale": "L/M",
        "keypoints": 133,
        "runtime": "ONNX Runtime CPU",
        "spec": {"framework": "mmpose_rtmlib", "size": "lightweight", "pose_model": "whole_body", "tracking": False, "det_frequency": 1},
    },
    {
        "label": "MMPose RTMW-X/L Wholebody 133",
        "provider": "MMPose RTMLib",
        "coverage": "Body+Face+Hands",
        "scale": "X/L",
        "keypoints": 133,
        "runtime": "ONNX Runtime CPU",
        "spec": {"framework": "mmpose_rtmlib", "size": "balanced", "pose_model": "whole_body", "tracking": False, "det_frequency": 1},
    },
    {
        "label": "MMPose RTMW-X 384 Wholebody 133",
        "provider": "MMPose RTMLib",
        "coverage": "Body+Face+Hands",
        "scale": "X 384",
        "keypoints": 133,
        "runtime": "ONNX Runtime CPU",
        "spec": {"framework": "mmpose_rtmlib", "size": "performance", "pose_model": "whole_body", "tracking": False, "det_frequency": 1},
    },
    {
        "label": "ViTPose-S Wholebody 133",
        "provider": "ViTPose",
        "coverage": "Body+Face+Hands",
        "scale": "S",
        "keypoints": 133,
        "runtime": "PyTorch MPS/CPU",
        "spec": {"framework": "vitpose", "size": "s"},
    },
    {
        "label": "ViTPose-B Wholebody 133",
        "provider": "ViTPose",
        "coverage": "Body+Face+Hands",
        "scale": "B",
        "keypoints": 133,
        "runtime": "PyTorch MPS/CPU",
        "spec": {"framework": "vitpose", "size": "b"},
    },
    {
        "label": "ViTPose-L Wholebody 133",
        "provider": "ViTPose",
        "coverage": "Body+Face+Hands",
        "scale": "L",
        "keypoints": 133,
        "runtime": "PyTorch MPS/CPU",
        "spec": {"framework": "vitpose", "size": "l"},
    },
    {
        "label": "ViTPose-H Wholebody 133",
        "provider": "ViTPose",
        "coverage": "Body+Face+Hands",
        "scale": "H",
        "keypoints": 133,
        "runtime": "PyTorch MPS/CPU",
        "spec": {"framework": "vitpose", "size": "h"},
    },
    {
        "label": "YOLOv8n Pose 17",
        "provider": "YOLO",
        "coverage": "Body",
        "scale": "N",
        "keypoints": 17,
        "runtime": "PyTorch MPS/CPU",
        "spec": {"framework": "yolo", "size": "n"},
    },
    {
        "label": "YOLOv8s Pose 17",
        "provider": "YOLO",
        "coverage": "Body",
        "scale": "S",
        "keypoints": 17,
        "runtime": "PyTorch MPS/CPU",
        "spec": {"framework": "yolo", "size": "s"},
    },
    {
        "label": "YOLOv8m Pose 17",
        "provider": "YOLO",
        "coverage": "Body",
        "scale": "M",
        "keypoints": 17,
        "runtime": "PyTorch MPS/CPU",
        "spec": {"framework": "yolo", "size": "m"},
    },
    {
        "label": "YOLOv8l Pose 17",
        "provider": "YOLO",
        "coverage": "Body",
        "scale": "L",
        "keypoints": 17,
        "runtime": "PyTorch MPS/CPU",
        "spec": {"framework": "yolo", "size": "l"},
    },
    {
        "label": "YOLOv8x Pose 17",
        "provider": "YOLO",
        "coverage": "Body",
        "scale": "X",
        "keypoints": 17,
        "runtime": "PyTorch MPS/CPU",
        "spec": {"framework": "yolo", "size": "x"},
    },
]

PROVIDER_FILTERS = ["All providers"] + sorted({item["provider"] for item in MODEL_CATALOG})
COVERAGE_FILTERS = ["Any keypoints", "Body", "Body+Feet", "Body+Face+Hands"]

class CameraThread(QThread):
    change_pixmap_signal = Signal(QImage, float)
    
    def __init__(self, app_instance, cap):
        super().__init__()
        self.app = app_instance
        self.cap = cap
        self.running = True

    def run(self):
        logging.info("CameraThread started")
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                # Camera failed to read. Create a blank frame instead of dying.
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, "Camera Offline", (200, 240), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                time.sleep(0.1)
                
            frame = cv2.flip(frame, 1)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            start_time = time.time()
            
            # Inference
            with self.app.lock:
                current_model = self.app.model
                
            if current_model:
                try:
                    keypoints_dict = current_model.inference(frame_rgb)
                    output_rgb = current_model.draw(
                        show_yolo=False,
                        confidence_threshold=0.3,
                        skeleton_thickness=2
                    )
                except Exception as e:
                    logging.error(f"Inference error: {e}")
                    keypoints_dict = {}
                    output_rgb = frame_rgb
            else:
                keypoints_dict = {}
                output_rgb = frame_rgb.copy()
                
            end_time = time.time()
            elapsed = end_time - start_time
            fps = 1.0 / elapsed if elapsed > 0 else 0.0
            
            with self.app.lock:
                self.app.latest_frame_bgr = output_rgb
                self.app.inference_fps = fps
                
                # Write CSV data if recording
                if self.app.is_recording and self.app.csv_writer is not None:
                    elapsed_rec = time.time() - self.app.record_start_time
                    for p_id, kp in keypoints_dict.items():
                        row = [self.app.record_frame_count, f"{elapsed_rec:.3f}", p_id] + kp.flatten().tolist()
                        self.app.csv_writer.writerow(row)
                    self.app.record_frame_count += 1
            
            # Convert to QImage and copy to prevent memory corruption across threads
            output_rgb = np.ascontiguousarray(output_rgb)
            h, w, ch = output_rgb.shape
            bytes_per_line = ch * w
            q_img = QImage(output_rgb.data, w, h, bytes_per_line, QImage.Format_RGB888).copy()
            
            self.change_pixmap_signal.emit(q_img, fps)

    def stop(self):
        self.running = False
        self.wait()

class PoseStudioApp(QMainWindow):
    model_status_signal = Signal(str, str)
    ffmpeg_finished_signal = Signal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Pose Studio")
        self.setMinimumSize(1100, 700)
        
        self.model_status_signal.connect(self._update_model_status)
        self.ffmpeg_finished_signal.connect(self._on_ffmpeg_finished)
        
        # Application state
        self.lock = threading.Lock()
        self.model = None
        self.latest_frame_bgr = None
        self.inference_fps = 0.0
        self._updating_model_menu = False
        
        # Recording state
        self.is_recording = False
        self.ffmpeg_proc = None
        self.ffmpeg_thread = None
        self.csv_file = None
        self.csv_writer = None
        self.record_start_time = 0
        self.record_frame_count = 0
        
        logging.info("PoseStudioApp initializing UI and setting up threads...")
        
        self._setup_ui()
        self._setup_styles()
        
        # Setup background tasks
        self.change_model(0)
        
        # Open camera in main thread for macOS AVFoundation safety
        self.cap = cv2.VideoCapture(0)
        
        # Start camera thread
        self.camera_thread = CameraThread(self, self.cap)
        self.camera_thread.change_pixmap_signal.connect(self.update_image)
        # MacOS QThread defaults to tiny stack (512KB) which causes OpenBLAS to crash. 
        # Set to 16MB to allow PyTorch/Numpy heavy inference.
        self.camera_thread.setStackSize(16 * 1024 * 1024) 
        self.camera_thread.start()

        # Update recording UI timer
        self.rec_timer = QTimer(self)
        self.rec_timer.timeout.connect(self._update_rec_ui)
        self.rec_timer.start(1000)

    def _setup_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Sidebar
        self.sidebar = QFrame()
        self.sidebar.setObjectName("sidebar")
        self.sidebar.setFixedWidth(340)
        sidebar_layout = QVBoxLayout(self.sidebar)
        sidebar_layout.setContentsMargins(32, 40, 32, 40)
        sidebar_layout.setSpacing(24)
        
        # Header
        self.logo_label = QLabel("Pose Studio")
        self.logo_label.setObjectName("logo")
        self.logo_label.setAlignment(Qt.AlignLeft)
        sidebar_layout.addWidget(self.logo_label)
        
        # Primary Action
        self.record_btn = QPushButton("Start Recording")
        self.record_btn.setObjectName("record_btn")
        self.record_btn.setCursor(Qt.PointingHandCursor)
        self.record_btn.clicked.connect(self.toggle_recording)
        sidebar_layout.addWidget(self.record_btn)
        
        # Settings Card
        settings_card = QFrame()
        settings_card.setObjectName("card_container")
        settings_layout = QVBoxLayout(settings_card)
        settings_layout.setContentsMargins(16, 16, 16, 16)
        settings_layout.setSpacing(8)
        
        self.model_label = QLabel("Pose Engine")
        self.model_label.setObjectName("section_title")
        self.model_label.setAlignment(Qt.AlignLeft)
        settings_layout.addWidget(self.model_label)

        provider_label = QLabel("Provider")
        provider_label.setObjectName("field_label")
        settings_layout.addWidget(provider_label)

        self.provider_menu = QComboBox()
        self.provider_menu.setCursor(Qt.PointingHandCursor)
        self.provider_menu.addItems(PROVIDER_FILTERS)
        self.provider_menu.currentIndexChanged.connect(self._refresh_model_menu)
        settings_layout.addWidget(self.provider_menu)

        coverage_label = QLabel("Keypoints")
        coverage_label.setObjectName("field_label")
        settings_layout.addWidget(coverage_label)

        self.coverage_menu = QComboBox()
        self.coverage_menu.setCursor(Qt.PointingHandCursor)
        self.coverage_menu.addItems(COVERAGE_FILTERS)
        self.coverage_menu.currentIndexChanged.connect(self._refresh_model_menu)
        settings_layout.addWidget(self.coverage_menu)

        model_select_label = QLabel("Model")
        model_select_label.setObjectName("field_label")
        settings_layout.addWidget(model_select_label)
        
        self.model_menu = QComboBox()
        self.model_menu.setCursor(Qt.PointingHandCursor)
        self.model_menu.currentIndexChanged.connect(self.change_model)
        settings_layout.addWidget(self.model_menu)

        self.model_summary_label = QLabel("")
        self.model_summary_label.setObjectName("model_summary")
        self.model_summary_label.setAlignment(Qt.AlignLeft)
        self.model_summary_label.setWordWrap(True)
        settings_layout.addWidget(self.model_summary_label)

        self._refresh_model_menu(load_model=False)
        sidebar_layout.addWidget(settings_card)
        
        sidebar_layout.addStretch()
        
        # Status Card
        status_card = QFrame()
        status_card.setObjectName("card_container")
        status_layout = QVBoxLayout(status_card)
        status_layout.setContentsMargins(16, 16, 16, 16)
        status_layout.setSpacing(8)
        
        status_title = QLabel("Telemetry")
        status_title.setObjectName("section_title")
        status_title.setAlignment(Qt.AlignLeft)
        status_layout.addWidget(status_title)
        
        self.rec_status_label = QLabel("Not Recording")
        self.rec_status_label.setObjectName("status_text")
        self.rec_status_label.setAlignment(Qt.AlignLeft)
        status_layout.addWidget(self.rec_status_label)
        
        self.rec_info_label = QLabel("")
        self.rec_info_label.setObjectName("status_text")
        self.rec_info_label.setAlignment(Qt.AlignLeft)
        status_layout.addWidget(self.rec_info_label)
        
        self.status_label = QLabel("Starting...")
        self.status_label.setObjectName("status_text")
        self.status_label.setAlignment(Qt.AlignLeft)
        self.status_label.setWordWrap(True)
        status_layout.addWidget(self.status_label)
        
        sidebar_layout.addWidget(status_card)
        
        # Subtle Debug Toggle
        self.debug_checkbox = QCheckBox("Enable Debug Log")
        self.debug_checkbox.setObjectName("debug_checkbox")
        self.debug_checkbox.stateChanged.connect(self.toggle_debug_mode)
        sidebar_layout.addWidget(self.debug_checkbox, alignment=Qt.AlignLeft)
        
        # Main Display Area
        self.main_area = QFrame()
        self.main_area.setObjectName("main_area")
        main_layout_area = QVBoxLayout(self.main_area)
        main_layout_area.setContentsMargins(32, 32, 32, 32)
        
        self.video_container = QFrame()
        self.video_container.setObjectName("video_container")
        video_layout = QVBoxLayout(self.video_container)
        video_layout.setContentsMargins(0, 0, 0, 0)
        
        self.video_label = QLabel()
        self.video_label.setAlignment(Qt.AlignCenter)
        video_layout.addWidget(self.video_label)
        
        main_layout_area.addWidget(self.video_container)
        
        main_layout.addWidget(self.sidebar)
        main_layout.addWidget(self.main_area)

    def _setup_styles(self):
        self.setStyleSheet("""
            QMainWindow {
                background-color: #f5f5f7;
            }
            #sidebar {
                background-color: #ffffff;
                border-right: none;
            }
            #logo {
                font-size: 24px;
                font-weight: 700;
                color: #1d1d1f;
                letter-spacing: -0.5px;
                margin-left: 4px;
            }
            #record_btn {
                background-color: #000000;
                color: white;
                font-size: 14px;
                font-weight: 600;
                padding: 12px;
                border-radius: 8px;
                border: none;
                margin-top: 4px;
            }
            #record_btn:hover {
                background-color: #333333;
            }
            #record_btn[recording="true"] {
                background-color: #e30000;
            }
            #record_btn[recording="true"]:hover {
                background-color: #b30000;
            }
            #card_container {
                background-color: #fbfbfd;
                border-radius: 12px;
                border: 1px solid #eaeaec;
            }
            #section_title {
                color: #86868b;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 2px;
            }
            #field_label {
                color: #515154;
                font-size: 11px;
                font-weight: 600;
                margin-top: 6px;
                margin-bottom: -2px;
            }
            #status_text {
                color: #333336;
                font-size: 13px;
                font-weight: 500;
                line-height: 1.4;
            }
            #model_summary {
                color: #515154;
                background-color: #f5f5f7;
                border: 1px solid #e5e5ea;
                border-radius: 6px;
                padding: 8px 10px;
                font-size: 12px;
                line-height: 1.35;
                margin-top: 6px;
            }
            QComboBox {
                background-color: #ffffff;
                color: #1d1d1f;
                border: 1px solid #d2d2d7;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 13px;
            }
            QComboBox::drop-down {
                border: none;
            }
            #debug_checkbox {
                color: #a1a1a6;
                font-size: 12px;
                margin-left: 4px;
            }
            #debug_checkbox::indicator {
                width: 12px;
                height: 12px;
            }
            #main_area {
                background-color: #f5f5f7;
            }
            #video_container {
                background-color: #000000;
                border-radius: 20px;
            }
        """)

    @Slot(QImage, float)
    def update_image(self, q_img, fps):
        # Scale image to fit container while maintaining aspect ratio
        container_w = self.video_container.width()
        container_h = self.video_container.height()
        
        if container_w > 10 and container_h > 10:
            scaled_q_img = q_img.scaled(container_w, container_h, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.video_label.setPixmap(QPixmap.fromImage(scaled_q_img))
                
        if self.model is not None:
            self.status_label.setText(f"Running | FPS: {fps:.1f}")
            self.status_label.setStyleSheet("color: #1d1d1f; font-weight: 500;")

    def _update_rec_ui(self):
        with self.lock:
            is_rec = self.is_recording
            rec_elapsed = time.time() - self.record_start_time if is_rec else 0
            rec_frames = self.record_frame_count
            
        if is_rec:
            mins, secs = divmod(int(rec_elapsed), 60)
            self.rec_info_label.setText(f"Time: {mins:02d}:{secs:02d}\nFrames: {rec_frames}")
        else:
            self.rec_info_label.setText("")

    def toggle_debug_mode(self, state):
        if state == 2: # Qt.Checked is int 2
            logging.getLogger().setLevel(logging.DEBUG)
            logging.info("Debug mode activated via UI")
        else:
            logging.info("Debug mode deactivated via UI")
            logging.getLogger().setLevel(logging.WARNING)

    def _filtered_model_items(self):
        provider = self.provider_menu.currentText() if hasattr(self, "provider_menu") else "All providers"
        coverage = self.coverage_menu.currentText() if hasattr(self, "coverage_menu") else "Any keypoints"

        items = []
        for item in MODEL_CATALOG:
            if provider != "All providers" and item["provider"] != provider:
                continue
            if coverage != "Any keypoints" and item["coverage"] != coverage:
                continue
            items.append(item)
        return items

    def _refresh_model_menu(self, *args, load_model=True):
        if not hasattr(self, "model_menu"):
            return

        previous_label = self.model_menu.currentText()
        items = self._filtered_model_items()
        if not items:
            items = MODEL_CATALOG

        self._updating_model_menu = True
        self.model_menu.clear()
        for item in items:
            self.model_menu.addItem(item["label"], item)

        next_index = 0
        for idx, item in enumerate(items):
            if item["label"] == previous_label:
                next_index = idx
                break
        self.model_menu.setCurrentIndex(next_index)
        self._updating_model_menu = False

        self._update_model_summary()
        if load_model and self.model_menu.count() > 0:
            self.change_model(self.model_menu.currentIndex())

    def _update_model_summary(self):
        if not hasattr(self, "model_summary_label") or self.model_menu.currentIndex() < 0:
            return
        item = self.model_menu.currentData()
        if not isinstance(item, dict):
            self.model_summary_label.setText("")
            return

        summary = (
            f"{item['provider']} | {item['coverage']} | {item['keypoints']} keypoints\n"
            f"Scale: {item['scale']} | Runtime: {item['runtime']}"
        )
        self.model_summary_label.setText(summary)

    def change_model(self, index):
        if self._updating_model_menu or index < 0:
            return

        item = self.model_menu.itemData(index)
        if not isinstance(item, dict):
            return

        choice = item["label"]
        spec = dict(item["spec"])
        self._update_model_summary()

        self.status_label.setText(f"Loading {choice}...\nPlease wait.")
        self.status_label.setStyleSheet("color: #d97706; font-weight: 600;")
        threading.Thread(target=self._load_specific_model, args=(choice, spec), daemon=True).start()

    @Slot(str, str)
    def _update_model_status(self, text, color):
        self.status_label.setText(text)
        self.status_label.setStyleSheet(f"color: {color}; font-weight: 600;")

    def _load_specific_model(self, label="MMPose RTMPose-S Body+Feet", spec=None):
        spec = dict(spec or {"framework": "mmpose_rtmlib", "size": "lightweight", "pose_model": "body_with_feet", "tracking": False, "det_frequency": 1})
        logging.info("Requested model change to %s with spec %s", label, spec)
        # Temporarily disable inference during swap
        with self.lock:
            old_model = self.model
            self.model = None
            if old_model is not None:
                if hasattr(old_model, "close"):
                    old_model.close()
                del old_model

        spec["app_dir"] = os.path.dirname(os.path.abspath(__file__))

        try:
            logging.info("Starting isolated framework worker: %s", spec)
            new_model = IsolatedFrameworkModel(spec)
            with self.lock:
                self.model = new_model
            details = " / ".join(str(v) for v in (new_model.backend, new_model.device) if v)
            suffix = f" - {details}" if details else ""
            self.model_status_signal.emit(f"Model Ready ({label}{suffix})", "#059669")
        except Exception as e:
            logging.error(f"Model init error: {e}", exc_info=True)
            self.model_status_signal.emit(f"{label} Error: {e}", "#e30000")

    def _ffmpeg_writer_loop(self, proc):
        target_fps = 30.0
        start_time = time.time()
        frames_written = 0
        
        while self.is_recording and proc.poll() is None:
            elapsed = time.time() - start_time
            target_frames = int(elapsed * target_fps)
            frames_to_write = target_frames - frames_written
            
            if frames_to_write > 0:
                with self.lock:
                    frame = self.latest_frame_bgr
                    
                if frame is not None:
                    try:
                        bgr_frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                        frame_bytes = bgr_frame.tobytes()
                        for _ in range(frames_to_write):
                            if proc.stdin:
                                proc.stdin.write(frame_bytes)
                            frames_written += 1
                    except Exception as e:
                        logging.error(f"FFmpeg write error: {e}")
                        break
            time.sleep(0.01)
            
        try:
            if proc.stdin:
                proc.stdin.close()
            proc.wait(timeout=5)
            logging.info(f"FFmpeg loop finished, wrote {frames_written} frames.")
        except subprocess.TimeoutExpired:
            logging.warning("FFmpeg timeout expired, terminating.")
            proc.terminate()
            proc.wait()
        except Exception as e:
            logging.error(f"Error closing FFmpeg: {e}")
        finally:
            self.ffmpeg_finished_signal.emit()

    @Slot()
    def _on_ffmpeg_finished(self):
        self.rec_status_label.setText("Video Saved Successfully!")
        self.rec_status_label.setStyleSheet("color: #059669;")
        QTimer.singleShot(3000, lambda: self.rec_status_label.setText("Not Recording"))
        QTimer.singleShot(3000, lambda: self.rec_status_label.setStyleSheet("color: #86868b;"))

    def toggle_recording(self):
        with self.lock:
            if not self.is_recording:
                os.makedirs("output", exist_ok=True)
                timestamp = int(time.time())
                filename = f"output/recording_{timestamp}.mp4"
                csv_filename = f"output/recording_{timestamp}.csv"
                
                if self.latest_frame_bgr is not None:
                    h, w, _ = self.latest_frame_bgr.shape
                    
                    sys_os = platform.system()
                    cmd = [
                        'ffmpeg', '-y',
                        '-f', 'rawvideo',
                        '-vcodec', 'rawvideo',
                        '-s', f'{w}x{h}',
                        '-pix_fmt', 'bgr24',
                        '-r', '30',
                        '-i', '-',
                    ]
                    
                    if sys_os == 'Darwin':
                        cmd.extend(['-f', 'avfoundation', '-i', ':0', '-c:a', 'aac', '-shortest'])
                    elif sys_os == 'Linux':
                        cmd.extend(['-f', 'pulse', '-i', 'default', '-c:a', 'aac', '-shortest'])
                    elif sys_os == 'Windows':
                        try:
                            CREATE_NO_WINDOW = 0x08000000
                            result = subprocess.run(['ffmpeg', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], 
                                                    stderr=subprocess.PIPE, text=True, encoding='utf-8', creationflags=CREATE_NO_WINDOW)
                            in_audio = False
                            audio_dev = None
                            for line in result.stderr.split('\\n'):
                                if "DirectShow audio devices" in line:
                                    in_audio = True
                                elif "DirectShow video devices" in line:
                                    in_audio = False
                                elif in_audio and '"' in line:
                                    audio_dev = line.split('"')[1]
                                    break
                            if audio_dev:
                                cmd.extend(['-f', 'dshow', '-i', f'audio={audio_dev}', '-c:a', 'aac', '-shortest'])
                        except:
                            pass
                            
                    cmd.extend([
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        filename
                    ])
                    
                    logging.info(f"Starting FFmpeg with cmd: {' '.join(cmd)}")
                    self.ffmpeg_proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
                    
                    self.csv_file = open(csv_filename, 'w', newline='')
                    self.csv_writer = csv.writer(self.csv_file)
                    
                    num_kps = getattr(self.model, 'keypoint_count', None) if self.model else None
                    if num_kps is None:
                        dataset_name = getattr(self.model, 'dataset', 'wholebody') if self.model else 'wholebody'
                        num_kps = 133 if dataset_name == 'wholebody' else 17
                    
                    header = ["frame_index", "timestamp_sec", "person_id"]
                    for i in range(num_kps):
                        header.extend([f"k{i}_x", f"k{i}_y", f"k{i}_conf"])
                    self.csv_writer.writerow(header)
                    
                    self.is_recording = True
                    self.record_start_time = time.time()
                    self.record_frame_count = 0
                    
                    self.ffmpeg_thread = threading.Thread(target=self._ffmpeg_writer_loop, args=(self.ffmpeg_proc,), daemon=True)
                    self.ffmpeg_thread.start()
                    
                    self.record_btn.setText("Stop Recording")
                    self.record_btn.setProperty("recording", "true")
                    self.record_btn.style().unpolish(self.record_btn)
                    self.record_btn.style().polish(self.record_btn)
                    
                    self.rec_status_label.setText("Recording...")
                    self.rec_status_label.setStyleSheet("color: #e30000;")
            else:
                logging.info("Stopping recording process.")
                self.is_recording = False
                
                if self.csv_file is not None:
                    self.csv_file.close()
                    self.csv_file = None
                    self.csv_writer = None
                    
                self.record_btn.setText("Start Recording")
                self.record_btn.setProperty("recording", "false")
                self.record_btn.style().unpolish(self.record_btn)
                self.record_btn.style().polish(self.record_btn)
                
                self.rec_status_label.setText("Saving Video...")
                self.rec_status_label.setStyleSheet("color: #d97706;")
                self.rec_info_label.setText("")

    def closeEvent(self, event):
        self.is_recording = False
        
        if self.ffmpeg_thread is not None and self.ffmpeg_thread.is_alive():
            self.ffmpeg_thread.join(timeout=6.0)
            
        with self.lock:
            if self.csv_file is not None:
                self.csv_file.close()
            if self.model is not None and hasattr(self.model, "close"):
                self.model.close()
                
        self.camera_thread.stop()
        if hasattr(self, 'cap') and self.cap.isOpened():
            self.cap.release()
            
        event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # Modern font
    font = QFont("Helvetica Neue", 10)
    font.setStyleHint(QFont.SansSerif)
    app.setFont(font)
    
    window = PoseStudioApp()
    window.show()
    sys.exit(app.exec())
