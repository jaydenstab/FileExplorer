"""
Simple test script: Progress bar + Distance threshold filtering
"""

import time

import requests

BASE_URL = "http://127.0.0.1:8000/api"

print("TEST 1: Progress Bar - Start indexing and watch progress update")

try:
    response = requests.post(f"{BASE_URL}/reindex/start?dir=documents2&slow_ms=200", timeout=5)
    response.raise_for_status()
    job_id = response.json()["job_id"]
    print(f"✓ Job started: {job_id}\n")
except Exception as e:
    print(f"✗ Error starting job: {e}")
    print(f"Response: {response.text if 'response' in locals() else 'No response'}")
    raise SystemExit(1) from e

print("Watching progress update...")
while True:
    status = requests.get(f"{BASE_URL}/reindex/status?job_id={job_id}", timeout=10).json()
    print(f"  {status['percent']}% complete ({status['current']}/{status['total']} files) - {status['phase']}")

    if status["status"] == "completed":
        print("✓ Progress bar test PASSED - indexing completed!\n")
        break
    if status["status"] == "error":
        print(f"✗ Error: {status.get('error')}\n")
        break

    time.sleep(0.3)

print("TEST 2: Distance Threshold - Filter out irrelevant results")

test_query = "rhetoric"
print(f"Searching for: '{test_query}'")

all_results = requests.get(
    f"{BASE_URL}/search?q={test_query}&dir=documents2&include_scores=true",
    timeout=10,
).json()
print(f"Without threshold: {len(all_results['results'])} results")
for r in all_results["results"][:5]:
    filename = r["path"].split("/")[-1]
    print(f"  {filename}: distance={r['distance']:.3f}")

print("\nWith threshold (distance <= 0.4):")
filtered = requests.get(
    f"{BASE_URL}/search?q={test_query}&dir=documents2&include_scores=true&distance_threshold=0.4",
    timeout=10,
).json()
print(f"  {len(filtered['results'])} results")
for r in filtered["results"]:
    filename = r["path"].split("/")[-1]
    print(f"  {filename}: distance={r['distance']:.3f}")

linear_algebra_found = any("Linear Algebra" in r["path"] for r in filtered["results"])
if linear_algebra_found:
    print("\n✗ FAILED: Linear algebra textbook still appears (threshold too high)")
else:
    print("\n✓ PASSED: Linear algebra textbook filtered out correctly")
