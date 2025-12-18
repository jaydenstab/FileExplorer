## Jayden:
- Pagination on the frontend
- Make UI to open files less intrusive: have the file preview on the side
  instead of a dialog box
- Progress bar and in general, better feedback for the user as to what the
  backend is doing. e.g. a status bar at the bottom-left that shows what the 
  backend is working on.
- Adjustable thresholds??????????
- Display confidence scores, filter on confidence scores
- Back burner: Make UI more file-explorer-like?
- XXX: Refactor frontend code (next meeting). Might be worth reading:
  - https://react.dev/learn/your-first-component
  - https://react.dev/learn/you-might-not-need-an-effect

## Victor:
- Confidence vs. semi-confident answers: present the user with a confidence
  score for each answer, and let them choose whether to see semi-confident
  answers or not.
- Progress bar (both a backend and frontend thing)
- Bucket list: index webpages and images? --> add a mechanism to the backend
  that lets people filter down on what types of files are in their index
- Make sure there's a threshold for indexing, don't want giant files to return
  for everything
- Full-text search (finding exact matches for words in the documents) (this does
  mean maintaining a separate index) in case that it is more precise/better (?)
  for certain queries.
  - Compared to similarity search with embeddings, it's better for exact matches
    and specific phrases.
