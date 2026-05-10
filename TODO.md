## Jayden:

- Back burner: Make UI more file-explorer-like?
- Frontend refactors: follow [docs/REFACTOR_NOTES.md](docs/REFACTOR_NOTES.md) (React Query, controller vs feature hooks). React docs: [Your First Component](https://react.dev/learn/your-first-component), [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).
- Add recently edited / stuff like that

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
