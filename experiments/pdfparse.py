import fitz

def get_text_from_odf(path): 
    text = ""
    with fitz.open(path) as pdf: 
        for page in pdf: 
            text += page.get_text()
    return text

if __name__ == "__main__":
    pdf_path = "" #change this to correct path
    content = get_text_from_odf(pdf_path)
    print(content[:500])