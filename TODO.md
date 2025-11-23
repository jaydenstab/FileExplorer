## Jayden:
- Implement "folder filters" feature where users can select which folders they
want to search in.
- For opening files, I would go with this approach:
    1. Frontend detects the click event
    2. Frontend sends a request to the backend with the file path
    3. Backend either:
        - Reads the file and sends it back to the frontend to display
        - Open it with the OS' default application to open it:
            https://stackoverflow.com/questions/434597/open-document-with-default-os-application-in-python-both-in-windows-and-mac-os
- Pagination on the frontend
- Back burner: Make UI more file-explorer-like?

## Victor:
- Progress bar (both a backend and frontend thing)
- Back burner: index webpages