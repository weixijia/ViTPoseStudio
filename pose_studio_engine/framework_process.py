import multiprocessing as mp
import traceback
from typing import Any, Dict, Optional

import numpy as np


def _framework_worker(conn, spec: Dict[str, Any]):
    model = None
    try:
        from .framework_models import create_framework_model

        model = create_framework_model(spec)
        conn.send({
            "ok": True,
            "ready": True,
            "dataset": getattr(model, "dataset", None),
            "keypoint_count": getattr(model, "keypoint_count", None),
            "backend": getattr(model, "backend", None),
            "device": getattr(model, "device", None),
        })

        while True:
            message = conn.recv()
            cmd = message.get("cmd")
            if cmd == "close":
                conn.send({"ok": True, "closed": True})
                break
            if cmd == "inference":
                keypoints = model.inference(message["image"])
                drawn = model.draw(
                    show_yolo=message.get("show_yolo", False),
                    confidence_threshold=message.get("confidence_threshold", 0.3),
                    skeleton_thickness=message.get("skeleton_thickness", 2),
                )
                conn.send({"ok": True, "keypoints": keypoints, "image": drawn})
                continue
            conn.send({"ok": False, "error": f"Unknown worker command: {cmd}"})
    except Exception as exc:
        conn.send({
            "ok": False,
            "error": str(exc),
            "traceback": traceback.format_exc(),
        })
    finally:
        try:
            conn.close()
        except Exception:
            pass


class IsolatedFrameworkModel:
    """Runs one pose framework in a dedicated Python process."""

    def __init__(self, spec: Dict[str, Any], startup_timeout: float = 90.0):
        self.spec = dict(spec)
        self._last_image: Optional[np.ndarray] = None
        self._parent_conn, child_conn = mp.Pipe()
        self._proc = mp.Process(target=_framework_worker, args=(child_conn, self.spec), daemon=True)
        self._proc.start()
        child_conn.close()

        if not self._parent_conn.poll(startup_timeout):
            self.close()
            raise TimeoutError(f"Timed out starting {self.spec.get('framework')} framework worker")

        try:
            response = self._parent_conn.recv()
        except EOFError as exc:
            self.close()
            raise RuntimeError(f"{self.spec.get('framework')} framework worker failed before startup response") from exc
        if not response.get("ok"):
            self.close()
            raise RuntimeError(response.get("error", "Framework worker failed to start"))

        self.dataset = response.get("dataset") or self.spec.get("framework")
        self.keypoint_count = response.get("keypoint_count")
        self.backend = response.get("backend")
        self.device = response.get("device")

    def inference(self, img_rgb: np.ndarray):
        self._ensure_alive()
        self._parent_conn.send({
            "cmd": "inference",
            "image": img_rgb,
            "show_yolo": False,
            "confidence_threshold": 0.3,
            "skeleton_thickness": 2,
        })
        response = self._parent_conn.recv()
        if not response.get("ok"):
            raise RuntimeError(response.get("error", "Framework worker inference failed"))
        self._last_image = response["image"]
        return response["keypoints"]

    def draw(self, show_yolo=False, confidence_threshold=0.3, skeleton_thickness=2):
        if self._last_image is None:
            return np.zeros((480, 640, 3), dtype=np.uint8)
        return self._last_image

    def close(self):
        try:
            if self._proc.is_alive() and not self._parent_conn.closed:
                self._parent_conn.send({"cmd": "close"})
                if self._parent_conn.poll(2.0):
                    self._parent_conn.recv()
        except Exception:
            pass
        try:
            self._parent_conn.close()
        except Exception:
            pass
        if self._proc.is_alive():
            self._proc.terminate()
            self._proc.join(timeout=2.0)

    def _ensure_alive(self):
        if not self._proc.is_alive():
            raise RuntimeError(f"{self.spec.get('framework')} framework worker is not running")
