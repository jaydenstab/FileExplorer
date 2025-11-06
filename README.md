# AI FILE EXPLORER

**problem:** files get messy, people have trouble finding what they're looking for

**solution**: a file explorer that indexes files using "ai" (expanded below). allowing for a more holistic search over files
- "indexing" involves ripping apart files and identifying what "topic" they're about, then storing that
    - pdfs, text files -> identifying the content of pdfs (some processing might be needed)
    - images -> identifying subjects, traits, "feeling" of the image
    - BUCKET LIST ITEM: can be extended beyond just files. index web pages, chats, etc.
        - more bucket list item: index gifs, videos, larger files (is it too much processing?)
    - index is stored in a way that is easily updateable and searchable (e.g. vector store + reverse index)
- "searching" involves looking at the index and finding a bunch of files

**TECHNOLOGIES**
- HTML/CSS/JS frontend
- Python - starts a localhost:* server to serve frontend, communicates with the frontend and does the indexing and search 
    - has a lot of ML libraries

**GOAL FOR THIS WEEK (DUE BY HALLOWEEN):**
- set up python to serve a small (React?) website
    - https://www.djangoproject.com/
- small experiments to see how to parse pdf / classify image files using ai
    - literally make a 50 line python file and get pdf / image classification working
- small experiments for vector database

**GITHUB**: https://github.com/jaydenstab/FileExplorer
