## Jayden:
- Make UI to open files less intrusive: have the file preview on the side
  instead of a dialog box
- Back burner: Make UI more file-explorer-like? 
- XXX: Refactor frontend code (next meeting). Might be worth reading:
  - https://react.dev/learn/your-first-component
  - https://react.dev/learn/you-might-not-need-an-effect
- Add recently edited / stuff like that 
- Add way to rename file / folder 

## Victor:
- Confidence vs. semi-confident answers: present the user with a confidence
  score for each answer, and let them choose whether to see semi-confident
  answers or not.
- Bucket list: index webpages and images? --> add a mechanism to the backend
  that lets people filter down on what types of files are in their index
- Try multi-modal CLIP again (the example one didnt work but maybe it still works)
- Run on downloads folder and see if it works / breaks (reranker too) 
- Full-text search (finding exact matches for words in the documents) (this does
  mean maintaining a separate index) in case that it is more precise/better (?)
  for certain queries.
  - Compared to similarity search with embeddings, it's better for exact matches
    and specific phrases.
