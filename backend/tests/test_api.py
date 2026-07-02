import subprocess
import time
import requests
import sys
import os

def main():
    print("Starting API server on port 8001...")
    # Inject environmental variables to the child process
    env = os.environ.copy()
    env["KMP_DUPLICATE_LIB_OK"] = "TRUE"
    env["PYTHONPATH"] = os.path.abspath("backend")
    
    python_executable = os.path.abspath("backend/venv/Scripts/python")
    backend_dir = os.path.abspath("backend")
    
    # Start server as a background process from the 'backend' directory
    proc = subprocess.Popen(
        [python_executable, "-m", "uvicorn", "app.main:app", "--port", "8001"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=backend_dir,
        env=env,
        text=True
    )
    
    # Wait up to 10 seconds for the server to spin up and warm up
    server_ready = False
    for i in range(10):
        time.sleep(1)
        try:
            resp = requests.get("http://127.0.0.1:8001/api/v1/health", timeout=1)
            if resp.status_code == 200:
                server_ready = True
                break
        except requests.exceptions.RequestException:
            pass
            
    if not server_ready:
        print("Server failed to start in 10 seconds. Printing server logs:")
        try:
            stdout, stderr = proc.communicate(timeout=2)
            print("STDOUT:")
            print(stdout)
            print("STDERR:")
            print(stderr)
        except Exception as e:
            print("Failed to read server logs:", e)
        sys.exit(1)
        
    try:
        # Check health
        print("Testing health check...")
        resp = requests.get("http://127.0.0.1:8001/api/v1/health")
        assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
        health_data = resp.json()
        assert health_data["status"] == "ok"
        assert health_data["model_ready"] is True
        print("[PASS] Health check passed:", health_data)

        # Check model info
        print("Testing model-info...")
        resp = requests.get("http://127.0.0.1:8001/api/v1/model-info")
        assert resp.status_code == 200, f"Model info failed: {resp.status_code}"
        info = resp.json()
        assert info["input_shape"] == [1, 1, 100, 200]
        assert info["output_shape"] == [1, 6, 31]
        print("[PASS] Model info passed:", info)

        # Test single prediction
        print("Testing predict...")
        with open("test_images/test-10.png", "rb") as f:
            resp = requests.post("http://127.0.0.1:8001/api/v1/predict", files={"file": ("test-10.png", f, "image/png")})
        assert resp.status_code == 200, f"Predict failed: {resp.status_code} {resp.text}"
        pred_res = resp.json()
        assert "prediction" in pred_res
        assert "confidence" in pred_res
        print("[PASS] Predict passed:", pred_res)

        # Test validation error (invalid image bytes)
        print("Testing predict with invalid image content...")
        resp = requests.post(
            "http://127.0.0.1:8001/api/v1/predict",
            files={"file": ("test-10.png", b"not-an-image-file", "image/png")}
        )
        assert resp.status_code == 400, f"Expected 400 Bad Request, got: {resp.status_code}"
        print("[PASS] Invalid image verification passed")

        # Test validation error (invalid content-type)
        print("Testing predict with invalid MIME type...")
        with open("test_images/test-10.png", "rb") as f:
            resp = requests.post(
                "http://127.0.0.1:8001/api/v1/predict",
                files={"file": ("test-10.png", f, "text/plain")}
            )
        assert resp.status_code == 400, f"Expected 400, got: {resp.status_code}"
        print("[PASS] Invalid MIME type verification passed")

        # Test batch prediction limit (max 5)
        print("Testing batch predict limit...")
        files_list = [("files", ("test-10.png", open("test_images/test-10.png", "rb"), "image/png")) for _ in range(6)]
        resp = requests.post("http://127.0.0.1:8001/api/v1/predict/batch", files=files_list)
        assert resp.status_code == 413, f"Expected 413 Payload Too Large, got: {resp.status_code}"
        print("[PASS] Batch limit enforcement passed")

        # Test content length limits (BUG-001)
        print("Testing content length limit...")
        headers = {"Content-Length": str(6 * 1024 * 1024)}
        resp = requests.post("http://127.0.0.1:8001/api/v1/predict", headers=headers, data=b"x" * (6 * 1024 * 1024))
        assert resp.status_code == 413, f"Expected 413, got: {resp.status_code}"
        print("[PASS] Content-Length middleware limit passed")

        # Test rate limiting (BUG-008)
        print("Testing rate limiting...")
        triggered_429 = False
        for i in range(15):  # Limiter: rate=2.0, capacity=5.0. 15 requests will exceed it.
            with open("test_images/test-10.png", "rb") as f:
                resp = requests.post(
                    "http://127.0.0.1:8001/api/v1/predict",
                    files={"file": ("test-10.png", f, "image/png")}
                )
            if resp.status_code == 429:
                triggered_429 = True
                print(f"Got 429 Too Many Requests at request #{i+1}")
                break
            time.sleep(0.05)
        assert triggered_429, "Expected to trigger 429 Rate Limit Exceeded"
        print("[PASS] Rate limiting verification passed")
        
        print("\nAll verification tests passed successfully!")
    except Exception as e:
        print(f"\n[FAIL] Test failed: {str(e)}")
        sys.exit(1)
    finally:
        print("Stopping API server...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    main()
