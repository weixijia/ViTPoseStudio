import logging
import shutil
import urllib.request
from pathlib import Path
from typing import Any, Dict

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


def _select_torch_device():
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def create_framework_model(spec: Dict[str, Any]):
    framework = spec["framework"]
    size = spec.get("size")
    curr_dir = Path(spec.get("app_dir") or Path.cwd())
    models_dir = curr_dir / "models"
    models_dir.mkdir(exist_ok=True)

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
