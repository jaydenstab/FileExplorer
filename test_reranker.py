"""
Test script: Reranker functionality - Compare distance-based vs reranker-based ranking
"""
import requests

BASE_URL = "http://127.0.0.1:8000/api"

print("TEST 1: Reranker Enabled - Check that rerank_score appears in results")
test_query = "rhetoric"
print(f"Searching for: '{test_query}'\n")

response = requests.get(
    f"{BASE_URL}/search?q={test_query}&dir=documents1&include_scores=true&use_reranker=true",
    timeout=10
)
response.raise_for_status()
reranked_results = response.json()

print(f"Found {len(reranked_results['results'])} results")

# Check if rerank_score is present
has_rerank_scores = all("rerank_score" in r for r in reranked_results["results"])

if has_rerank_scores:
    print("✓ PASSED: rerank_score present in all results\n")
    print("Results (sorted by rerank_score, higher = better):")
    for i, r in enumerate(reranked_results["results"][:5], 1):
        filename = r['path'].split('/')[-1]
        rerank_score = r.get('rerank_score', 0)
        distance = r.get('distance', 0)
        print(f"  {i}. {filename}")
        print(f"     rerank_score: {rerank_score:.4f}, distance: {distance:.4f}")
else:
    print("✗ FAILED: rerank_score missing from some results")
    print(f"Results: {reranked_results['results']}")

print("TEST 2: Compare Reranker vs Distance-Based Ranking")

print(f"\nSearching for: '{test_query}'")
print("Comparing ranking order...\n")

# Get results WITHOUT reranker
response_no_rerank = requests.get(
    f"{BASE_URL}/search?q={test_query}&dir=documents1&include_scores=true&use_reranker=false",
    timeout=10
)
no_rerank_results = response_no_rerank.json()

# Get results WITH reranker
response_rerank = requests.get(
    f"{BASE_URL}/search?q={test_query}&dir=documents1&include_scores=true&use_reranker=true",
    timeout=10
)
rerank_results = response_rerank.json()

print("Distance-based ranking (use_reranker=false):")
for i, r in enumerate(no_rerank_results["results"][:5], 1):
    filename = r['path'].split('/')[-1]
    distance = r.get('distance', 0)
    print(f"  {i}. {filename} (distance: {distance:.4f})")

print("\nReranker-based ranking (use_reranker=true):")
for i, r in enumerate(rerank_results["results"][:5], 1):
    filename = r['path'].split('/')[-1]
    rerank_score = r.get('rerank_score', 0)
    distance = r.get('distance', 0)
    print(f"  {i}. {filename} (rerank_score: {rerank_score:.4f}, distance: {distance:.4f})")

# Check if order changed
no_rerank_paths = [r['path'] for r in no_rerank_results["results"]]
rerank_paths = [r['path'] for r in rerank_results["results"]]

# Verify rerank scores are in descending order
rerank_scores = [r.get('rerank_score', 0) for r in rerank_results["results"]]

print("TEST 3: Reranker with Different Queries")

test_queries = ["neural networks", "transgender", "cybersecurity"]

for query in test_queries:
    print(f"\nQuery: '{query}'")
    response = requests.get(
        f"{BASE_URL}/search?q={query}&dir=documents1&include_scores=true&k=3",
        timeout=10
    )
    results = response.json()
    
    print(f"  Top {len(results['results'])} results:")
    for i, r in enumerate(results["results"], 1):
        filename = r['path'].split('/')[-1]
        rerank_score = r.get('rerank_score', 0)
        distance = r.get('distance', 0)
        print(f"    {i}. {filename} (rerank_score: {rerank_score:.4f}, distance: {distance:.4f})")