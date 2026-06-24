from pose_studio_engine.framework_process import IsolatedFrameworkModel


def test_unknown_framework_fails_inside_worker_process():
    try:
        IsolatedFrameworkModel({"framework": "unknown_framework"}, startup_timeout=10.0)
    except RuntimeError as exc:
        assert "Unknown pose framework" in str(exc)
    else:
        raise AssertionError("Expected unknown framework to fail in the isolated worker")
