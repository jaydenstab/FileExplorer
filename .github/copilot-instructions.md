# AI File Explorer - Development Guide

## Project Overview
This is a Django-based file exploration and analysis project that combines core file management functionality with experimental AI-powered features. The project follows a modular architecture with clear separation between stable and experimental components.

## Core Architecture

### Main Components
1. `backend/` - Django project configuration and core settings
   - Uses Django 5.2.x with SQLite for development
   - Configuration split between `settings.py` and `urls.py`

2. `explorer/` - Primary Django application
   - Handles file exploration and web interface
   - Minimalist views returning basic HTTP responses
   - Extensible model layer for future data structures

3. `experiments/` - Isolated experimental features
   - `pdfparse/` - PDF text extraction using PyMuPDF
   - `imageclassify/` - Image analysis capabilities (in development)

### Data Flow
- Web requests → `backend/urls.py` → `explorer/views.py` 
- PDF processing: Files → `experiments/pdfparse` → `fitz` library → extracted text
- All file paths are handled relative to execution directory for consistency

## Development Workflow

### Environment Setup
```bash
# Activate Python virtual environment (required)
source venv/bin/activate  # or your preferred venv activation

# Install core dependencies
pip install "django>=5.2,<6.0"
pip install PyMuPDF  # for PDF processing
```

### Common Commands
```bash
# Start development server
python manage.py runserver

# Database operations
python manage.py migrate  # Apply migrations
python manage.py makemigrations explorer  # Create new migrations

# Run tests
python manage.py test explorer
```

## Key Integration Points

### PDF Processing
```python
from experiments.pdfparse import get_text_from_odf

# Always use absolute paths for PDF processing
text = get_text_from_odf("/absolute/path/to/document.pdf")
```

### Adding New Views
1. Define view in `explorer/views.py`
2. Register URL in `backend/urls.py`
3. Keep view logic minimal - delegate complex processing to appropriate modules

## Project-Specific Patterns

1. **Experimental Feature Isolation**
   - All experimental code lives in `experiments/`
   - Each feature gets its own subdirectory
   - Main application stays clean of experimental code

2. **Minimalist Views**
   - Views in `explorer/views.py` are intentionally basic
   - Complex logic belongs in models or utility modules
   - Example: `def home(request): return HttpResponse("a")`

3. **File Path Convention**
   - Use absolute paths for file operations
   - Paths are relative to execution directory
   - PDF processing requires absolute paths

## Testing
- Core application tests in `explorer/tests.py`
- Follow Django's test case patterns
- Experimental features should have isolated tests

## Architecture Decisions
1. Separate `experiments/` directory to:
   - Isolate unstable code from core functionality
   - Allow rapid prototyping without affecting main app
   - Provide clear boundary for experimental features

2. Minimalist view layer to:
   - Maintain clear separation of concerns
   - Make testing and maintenance simpler
   - Allow easy refactoring of UI/UX