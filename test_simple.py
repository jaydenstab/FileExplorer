"""
Simple test script: Progress bar + Distance threshold filtering
"""
import requests # Imports to make requests to the server
import time # Imports to sleep for a bit

BASE_URL = "http://127.0.0.1:8000/api" # Base url 

print("TEST 1: Progress Bar - Start indexing and watch progress update")

# Start indexing job with slow mode so we can see progress, uisng slow_ms and documents2
try:
    response = requests.post(f"{BASE_URL}/reindex/start?dir=documents2&slow_ms=200", timeout=5) # Calls api_reindex_start() in views_reindex.py
    response.raise_for_status()
    job_id = response.json()["job_id"] # Gets job_id from response
    print(f"✓ Job started: {job_id}\n") # Prints job_id
except Exception as e: # Exception catching 
    print(f"✗ Error starting job: {e}")
    print(f"Response: {response.text if 'response' in locals() else 'No response'}")
    exit(1)

# Poll progress until complete
# Seems to work, percentages go up in time depending on current task
# Also sometimes stuck at 100 or other percents for a while (maybe stuck in loop?)
print("Watching progress update...") 
while True:
    status = requests.get(f"{BASE_URL}/reindex/status?job_id={job_id}").json() # Calls api_reindex_status() in views_reindex.py
    print(f"  {status['percent']}% complete ({status['current']}/{status['total']} files) - {status['phase']}") # Print status and phase
    
    if status["status"] == "completed": 
        print("✓ Progress bar test PASSED - indexing completed!\n")
        break
    elif status["status"] == "error":
        print(f"✗ Error: {status.get('error')}\n")
        break
    
    #time.sleep(0.3) # Sleepy time 

print("TEST 2: Distance Threshold - Filter out irrelevant results")

# Test search for something unrelated to linear algebra
test_query = "rhetoric"  # Should not match
#test_query = "linear algebra" # Uhhh this gives ~1.1 but probably because textbook is too big? Any ideas?
#test_query = "determinant" # Around 1.1 
#test_query = "matrix" # Around 1.2 
# Maybe too much inside of the textbook so unless the entire textbook talks about it it's not close? 
# I don't know a single query that would match the textbook
print(f"Searching for: '{test_query}'")

# Search WITHOUT threshold (see all results)
all_results = requests.get(f"{BASE_URL}/search?q={test_query}&dir=documents2&include_scores=true").json()
print(f"Without threshold: {len(all_results['results'])} results")
for r in all_results["results"][:5]:
    filename = r['path'].split('/')[-1]
    print(f"  {filename}: distance={r['distance']:.3f}")

# Search WITH threshold (filter out bad matches)
print(f"\nWith threshold (distance <= 0.4):")
filtered = requests.get(f"{BASE_URL}/search?q={test_query}&dir=documents2&include_scores=true&distance_threshold=0.4").json()
print(f"  {len(filtered['results'])} results")
for r in filtered["results"]:
    filename = r['path'].split('/')[-1]
    print(f"  {filename}: distance={r['distance']:.3f}")

# Check if linear algebra textbook is in results
linear_algebra_found = any("Linear Algebra" in r['path'] for r in filtered['results'])
if linear_algebra_found:
    print("\n✗ FAILED: Linear algebra textbook still appears (threshold too high)")
else:
    print("\n✓ PASSED: Linear algebra textbook filtered out correctly")

# This prints out none of the other documents in documents2
# Might be because k is too small (5?) and the huge textbook takes up all the results
# Honestly not 100% sure what k represents, but it seems to be the number of results to return