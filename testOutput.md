i have legit 0 clue how to test this not in the terminal lmfao gl jayden implementing ts

$ cd /Users/victorlin/ai-file-explorer && source venv/bin/activate && python -c "from semantic_index.indexer import index_documents; print('Indexing...'); count = index_documents(); print(f'✓ Indexed {count} chunks')"
Indexing...
✓ Indexed 227 chunks

$ cd /Users/victorlin/ai-file-explorer && source venv/bin/activate && python -c "from semantic_index.search import search_files; results = search_files('rhetoric', k=5); print('Query: rhetoric'); print('Results:', results)"
Query: rhetoric
Results: ['documents/test-rhetoric.txt', 'documents/Fleeing to the Mountains.pdf', 'documents/Balancing Classroom Civility.pdf', 'documents/Getting Personal About Cybersecurity.pdf']

$ cd /Users/victorlin/ai-file-explorer && source venv/bin/activate && python -c "from semantic_index.search import search_files; results = search_files('transgender community', k=3); print('Query: transgender community'); print('Results:', results)"
Query: transgender community
Results: ['documents/Covering the Transgender Community.pdf']

$ cd /Users/victorlin/ai-file-explorer && source venv/bin/activate && python -c "from semantic_index.search import search_files; results = search_files('cybersecurity', k=3); print('Query: cybersecurity'); print('Results:', results)"
Query: cybersecurity
Results: ['documents/Getting Personal About Cybersecurity.pdf']

$ cd /Users/victorlin/ai-file-explorer && source venv/bin/activate && python manage.py runserver 8000 > /tmp/django_server.log 2>&1 &
$ sleep 3 && curl -s "http://127.0.0.1:8000/api/reindex" | python -m json.tool
{
    "indexed_chunks": 227
}

$ curl -s -G "http://127.0.0.1:8000/api/search" --data-urlencode "q=transgender" --data-urlencode "k=5" | python -m json.tool
{
    "query": "transgender", 
    "results": [
        "documents/Covering the Transgender Community.pdf"
    ]
}
$ curl -s -G "http://127.0.0.1:8000/api/search" --data-urlencode "q=classroom civility" --data-urlencode "k=3" | python -m json.tool
{
    "query": "classroom civility",
    "results": [
        "documents/Balancing Classroom Civility.pdf"
    ]
}
$ curl -s "http://127.0.0.1:8000/api/search?q=missing" | python -m json.tool
{
    "query": "missing",
    "results": [
        "documents/The Toxicity in Learning.pdf",
        "documents/Cultural Contexts for Argument.pdf"
    ]
}
$ curl -s "http://127.0.0.1:8000/api/search" | python -m json.tool
{
    "error": "missing 'q' parameter"
}
$ 