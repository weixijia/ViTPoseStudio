import json
import logging
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import numpy as np


class YOLOPoseWrapper:
    def __init__(self, size="n", device="cpu"):
        from ultralytics import YOLO

        model_name = f"yolov8{size}-pose.pt"
        logging.info("YOLOPoseWrapper loading %s on device %s", model_name, device)
        self.model = YOLO(model_name)
        self.model.to(device)
        self.dataset = "coco"
        self.keypoint_count = 17
        self._last_results = None

    def inference(self, img_rgb):
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        results = self.model.track(img_bgr, persist=True, verbose=False, device=self.model.device)
        self._last_results = results[0]

        keypoints_dict = {}
        if self._last_results.boxes and self._last_results.boxes.id is not None:
            ids = self._last_results.boxes.id.int().cpu().tolist()
            if self._last_results.keypoints and self._last_results.keypoints.data is not None:
                kpts_data = self._last_results.keypoints.data.cpu().numpy()
                for person_id, kpts in zip(ids, kpts_data):
                    keypoints_dict[person_id] = kpts
        return keypoints_dict

    def draw(self, show_yolo=False, confidence_threshold=0.3, skeleton_thickness=2):
        if self._last_results is None:
            return np.zeros((480, 640, 3), dtype=np.uint8)
        plotted_bgr = self._last_results.plot(
            boxes=show_yolo,
            kpt_line=True,
            labels=False,
            conf=confidence_threshold,
            line_width=skeleton_thickness,
        )
        return cv2.cvtColor(plotted_bgr, cv2.COLOR_BGR2RGB)


class Sapiens2ExternalWrapper:
    """Isolated adapter for the official Sapiens2 pose demo environment."""

    keypoint_count = 308
    dataset = "sapiens2_308"

    def __init__(self, size="1b"):
        self.size = size.lower()
        sapiens_root = os.environ.get("SAPIENS_ROOT")
        self.sapiens_root = Path(sapiens_root).expanduser() if sapiens_root else None
        self.checkpoint_root = Path(os.environ.get("SAPIENS_CHECKPOINT_ROOT", "~/sapiens2_host")).expanduser()
        self.python = os.environ.get("SAPIENS_PYTHON", sys.executable)
        self.device = _default_sapiens_device()
        self._last_img_rgb = None
        self._last_draw_rgb = None
        self._last_keypoints = {}

        if self.size not in {"0.4b", "0.8b", "1b", "5b"}:
            raise ValueError(f"Unsupported Sapiens2 pose size: {size}")
        if self.sapiens_root is None or not self.sapiens_root.exists():
            raise RuntimeError(
                "Sapiens2 is the default framework but is not configured. Clone "
                "https://github.com/facebookresearch/sapiens2, install it in a Python 3.12+ "
                "environment, then set SAPIENS_ROOT and optionally SAPIENS_PYTHON."
            )

        self.pose_dir = self.sapiens_root / "sapiens" / "pose"
        self.run_file = self.pose_dir / "tools" / "vis" / "vis_pose.py"
        if not self.run_file.exists():
            raise RuntimeError(f"Could not find Sapiens2 pose runner: {self.run_file}")

        self.checkpoint = self.checkpoint_root / "pose" / f"sapiens2_{self.size}_pose.safetensors"
        self.detector = self.checkpoint_root / "detector" / "detr-resnet-101-dc5"
        if not self.checkpoint.exists():
            raise RuntimeError(
                f"Missing Sapiens2 pose checkpoint: {self.checkpoint}. Download from "
                f"https://huggingface.co/facebook/sapiens2-pose-{self.size}."
            )
        if not self.detector.exists():
            raise RuntimeError(
                f"Missing Sapiens2 DETR detector: {self.detector}. Run "
                "`hf download facebook/detr-resnet-101-dc5 --local-dir "
                "${SAPIENS_CHECKPOINT_ROOT}/detector/detr-resnet-101-dc5`."
            )

        dataset = "shutterstock_goliath_3po"
        self.model_name = f"sapiens2_{self.size}"
        model = f"{self.model_name}_keypoints308_{dataset}-1024x768"
        self.config_file = self.pose_dir / "configs" / "keypoints308" / dataset / f"{model}.py"
        if not self.config_file.exists():
            raise RuntimeError(f"Could not find Sapiens2 pose config: {self.config_file}")

    def inference(self, img_rgb):
        self._last_img_rgb = img_rgb.copy()
        with tempfile.TemporaryDirectory(prefix="posestudio_sapiens2_") as tmp:
            tmpdir = Path(tmp)
            input_dir = tmpdir / "input"
            output_dir = tmpdir / "output"
            input_dir.mkdir()
            output_dir.mkdir()
            image_path = input_dir / "frame.png"
            cv2.imwrite(str(image_path), cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))

            image_list = input_dir / "image_paths.txt"
            image_list.write_text(str(image_path) + "\n", encoding="utf-8")

            cmd = [
                self.python,
                str(self.run_file),
                str(self.detector),
                str(self.config_file),
                str(self.checkpoint),
                "--device",
                self.device,
                "--input",
                str(image_list),
                "--output",
                str(output_dir),
                "--radius",
                "6",
                "--kpt-thr",
                "0.3",
                "--thickness",
                "8",
            ]
            try:
                subprocess.run(
                    cmd,
                    cwd=str(self.pose_dir),
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
            except subprocess.CalledProcessError as exc:
                stderr = (exc.stderr or "").strip()
                stdout = (exc.stdout or "").strip()
                detail = stderr or stdout or str(exc)
                raise RuntimeError(f"Sapiens2 inference failed: {detail[-2000:]}") from exc

            drawn = self._read_first_image(output_dir)
            self._last_draw_rgb = drawn if drawn is not None else img_rgb.copy()
            self._last_keypoints = self._read_first_keypoint_json(output_dir)
        return self._last_keypoints

    def draw(self, show_yolo=False, confidence_threshold=0.3, skeleton_thickness=2):
        if self._last_draw_rgb is not None:
            return self._last_draw_rgb
        if self._last_img_rgb is not None:
            return self._last_img_rgb
        return np.zeros((480, 640, 3), dtype=np.uint8)

    def _read_first_image(self, output_dir: Path) -> Optional[np.ndarray]:
        for path in output_dir.rglob("*"):
            if path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
                continue
            img_bgr = cv2.imread(str(path))
            if img_bgr is not None:
                return cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        return None

    def _read_first_keypoint_json(self, output_dir: Path) -> Dict[int, np.ndarray]:
        for path in output_dir.rglob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            return self._coerce_sapiens_json(data)
        return {}

    def _coerce_sapiens_json(self, data: Any) -> Dict[int, np.ndarray]:
        if isinstance(data, dict) and isinstance(data.get("frames"), list):
            frames = data.get("frames") or []
            instances = frames[0].get("instances", []) if frames and isinstance(frames[0], dict) else []
            return self._coerce_sapiens_instances(instances)

        people = data.get("people", data) if isinstance(data, dict) else data
        if not isinstance(people, list):
            return {}

        return self._coerce_sapiens_instances(people)

    def _coerce_sapiens_instances(self, people: Any) -> Dict[int, np.ndarray]:
        if not isinstance(people, list):
            return {}

        output = {}
        for idx, person in enumerate(people):
            if isinstance(person, dict):
                keypoints = person.get("keypoints", person.get("pose_keypoints_2d", person))
                keypoint_scores = person.get("keypoint_scores")
            else:
                keypoints = person
                keypoint_scores = None
            arr = np.asarray(keypoints, dtype=float)
            if arr.ndim == 1:
                if arr.size % 3 == 0:
                    arr = arr.reshape((-1, 3))
                elif arr.size % 2 == 0:
                    arr = arr.reshape((-1, 2))
            if arr.ndim == 2 and arr.shape[1] == 2:
                scores = np.ones(len(arr), dtype=float)
                if keypoint_scores is not None:
                    scores = np.asarray(keypoint_scores, dtype=float).reshape(-1)[: len(arr)]
                arr = np.column_stack([arr, scores])
            if arr.ndim == 2 and arr.shape[1] >= 3:
                output[idx + 1] = arr[:, :3]
        return output


def _select_torch_device():
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _default_sapiens_device() -> str:
    configured = os.environ.get("SAPIENS_DEVICE")
    if configured:
        return configured
    if platform.system() == "Darwin":
        return "mps"
    return "cuda:0"


def create_framework_model(spec: Dict[str, Any]):
    framework = spec["framework"]
    size = spec.get("size")
    curr_dir = Path(spec.get("app_dir") or Path.cwd())
    models_dir = curr_dir / "models"
    models_dir.mkdir(exist_ok=True)

    if framework == "sapiens2":
        return Sapiens2ExternalWrapper(size=size or "1b")

    if framework in {"mmpose_rtmlib", "pose2sim"}:
        from .pose2sim_rtmlib import Pose2SimRTMLibWrapper

        return Pose2SimRTMLibWrapper(
            pose_model=spec.get("pose_model", "body_with_feet"),
            mode=size or "balanced",
            det_frequency=int(spec.get("det_frequency", 4)),
            device=spec.get("device", "auto"),
            backend=spec.get("backend", "auto"),
            tracking=bool(spec.get("tracking", False)),
        )

    if framework == "yolo":
        return YOLOPoseWrapper(size=size or "n", device=_select_torch_device())

    if framework == "vitpose":
        import torch
        from . import VitInference

        device = _select_torch_device()
        model_filename = f"vitpose-{size}-wholebody.pth"
        model_path = models_dir / model_filename
        base_dir = curr_dir.parent
        old_model_path = base_dir / "vitpose-s-wholebody.pth"
        if size == "s" and not model_path.exists() and old_model_path.exists():
            try:
                shutil.move(str(old_model_path), str(model_path))
            except Exception as exc:
                logging.warning("Could not move old ViTPose model: %s", exc)

        dataset = "wholebody"
        if not model_path.exists():
            try:
                url = f"https://huggingface.co/JunkyByte/easy_ViTPose/resolve/main/torch/wholebody/{model_filename}"
                urllib.request.urlretrieve(url, str(model_path))
            except Exception:
                model_path = models_dir / "vitpose-s-coco.pth"
                dataset = "coco"
                size = "s"

        yolo_path = models_dir / "yolov8n.pt"
        for old_name in ("yolo8n.pt", "yolov8n.pt"):
            old_path = base_dir / old_name
            if not yolo_path.exists() and old_path.exists():
                shutil.move(str(old_path), str(yolo_path))

        return VitInference(
            str(model_path),
            str(yolo_path),
            model_name=size,
            yolo_size=320,
            is_video=True,
            device=device,
            dataset=dataset,
            yolo_step=1,
        )

    raise ValueError(f"Unknown pose framework: {framework}")
