import requests

BASE_URL = "http://127.0.0.1:8000/api"

# 1) Neural networks-related query (embedding-only, no reranker)
print("=== EMBEDDING-ONLY (use_reranker=false) ===")
print("Query: 'neural networks and deep learning'")

response = requests.get(
    f"{BASE_URL}/search",
    params={
        "q": "neural networks and deep learning",
        "dir": "documents1",
        "include_scores": "true",
        "use_reranker": "false",  # focus on embedding model only
        "k": "5",
    },
    timeout=10,
)
response.raise_for_status()

data = response.json()

conf_score = data.get("query_confidence_score")
conf_level = data.get("query_confidence_level")
if conf_score is not None and conf_level is not None:
    print(f"[embeddings][neural networks] query_confidence_score={conf_score:.4f}, level={conf_level}")

results = data.get("results", [])
print(f"Top {len(results)} results (use_reranker=false):")
for i, r in enumerate(results, 1):
    path = r.get("path", "<no-path>")
    filename = path.split("/")[-1]
    distance = r.get("distance", 0.0)
    print(f"  {i}. {filename} (distance: {distance:.4f})")

# 2) Rhetoric-related query (embedding-only)
print("\nQuery: 'classical rhetoric and persuasion'")

response = requests.get(
    f"{BASE_URL}/search",
    params={
        "q": "classical rhetoric and persuasion",
        "dir": "documents1",
        "include_scores": "true",
        "use_reranker": "false",  # focus on embedding model only
        "k": "5",
    },
    timeout=10,
)
response.raise_for_status()

data = response.json()

conf_score = data.get("query_confidence_score")
conf_level = data.get("query_confidence_level")
if conf_score is not None and conf_level is not None:
    print(f"[embeddings][rhetoric] query_confidence_score={conf_score:.4f}, level={conf_level}")

results = data.get("results", [])
print(f"Top {len(results)} results (use_reranker=false):")
for i, r in enumerate(results, 1):
    path = r.get("path", "<no-path>")
    filename = path.split("/")[-1]
    distance = r.get("distance", 0.0)
    print(f"  {i}. {filename} (distance: {distance:.4f})")

# Basic sanity check on distance ordering for the rhetoric query
if results:
    distances = [r.get("distance", 0.0) for r in results]
    if distances != sorted(distances):
        print("✗ FAILED: distances are not sorted in ascending order")
    else:
        print("✓ PASSED: distances sorted ascending (best match first)")

    top_path = results[0].get("path", "")
    top_filename = top_path.split("/")[-1]
    if "rhetoric" in top_filename.lower():
        print("✓ PASSED: top result contains 'rhetoric' in filename")
    else:
        print(f"✗ FAILED: top result '{top_filename}' does NOT look like rhetoric file")

print("Query: 'neural networks and deep learning'")

response = requests.get(
    f"{BASE_URL}/search",
    params={
        "q": "neural networks and deep learning",
        "dir": "documents1",
        "include_scores": "true",
        "use_reranker": "true",  # test reranker-based confidence
        "k": "5",
    },
    timeout=10,
)
response.raise_for_status()

data = response.json()

conf_score = data.get("query_confidence_score")
conf_level = data.get("query_confidence_level")
if conf_score is not None and conf_level is not None:
    print(f"[reranker][neural networks] query_confidence_score={conf_score:.4f}, level={conf_level}")
else:
    print("[reranker][neural networks] No query_confidence_* fields present")

results = data.get("results", [])
print(f"Top {len(results)} results (use_reranker=true):")
for i, r in enumerate(results, 1):
    path = r.get("path", "<no-path>")
    filename = path.split("/")[-1]
    rerank_score = r.get("rerank_score", 0.0)
    distance = r.get("distance", 0.0)
    print(f"  {i}. {filename} (rerank_score: {rerank_score:.4f}, distance: {distance:.4f})")

print("\nQuery: 'classical rhetoric and persuasion' (expecting rhetoric)")

response = requests.get(
    f"{BASE_URL}/search",
    params={
        "q": "classical rhetoric and persuasion",
        "dir": "documents1",
        "include_scores": "true",
        "use_reranker": "true",  # test reranker-based confidence
        "k": "5",
    },
    timeout=10,
)
response.raise_for_status()

data = response.json()

conf_score = data.get("query_confidence_score")
conf_level = data.get("query_confidence_level")
if conf_score is not None and conf_level is not None:
    print(f"[reranker][rhetoric] query_confidence_score={conf_score:.4f}, level={conf_level}")
else:
    print("[reranker][rhetoric] No query_confidence_* fields present")

results = data.get("results", [])
print(f"Top {len(results)} results (use_reranker=true):")
for i, r in enumerate(results, 1):
    path = r.get("path", "<no-path>")
    filename = path.split("/")[-1]
    rerank_score = r.get("rerank_score", 0.0)
    distance = r.get("distance", 0.0)
    print(f"  {i}. {filename} (rerank_score: {rerank_score:.4f}, distance: {distance:.4f})")