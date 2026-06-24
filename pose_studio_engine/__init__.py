__all__ = ["VitInference"]


def __getattr__(name):
    if name == "VitInference":
        from .inference import VitInference

        return VitInference
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
