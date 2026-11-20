import os
from functools import lru_cache
from pathlib import Path
import fitz  # PyMuPDF
import chromadb
from dotenv import load_dotenv
from google import genai
from google.genai import types

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
CHROMA_DIR = BASE_DIR / "chroma_db"

EMBED_MODEL = "gemini-embedding-2"
COLLECTION_NAME = "govt_schemes"

DATA_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

_client = None


def get_genai_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key or api_key == "your_gemini_api_key_here":
            raise RuntimeError(
                "GEMINI_API_KEY is missing or still set to the placeholder in backend/.env"
            )
        _client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=30000),
        )
    return _client


chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)


@lru_cache(maxsize=128)
def get_embedding_cached(text: str) -> tuple[float, ...]:
    client = get_genai_client()
    response = client.models.embed_content(
        model=EMBED_MODEL,
        contents=text,
    )
    return tuple(response.embeddings[0].values)


def get_embedding(text: str) -> list[float]:
    return list(get_embedding_cached(text))


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    chunks = []
    start = 0
    while start < len(cleaned):
        end = start + chunk_size
        chunks.append(cleaned[start:end])
        start += chunk_size - overlap
    return chunks


def ingest_single_pdf(pdf_path: Path) -> int:
    doc = fitz.open(pdf_path)
    scheme_name = pdf_path.stem.replace("_", " ").replace("-", " ")
    chunks_added = 0

    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text")
        chunks = chunk_text(text)

        for idx, chunk in enumerate(chunks):
            chunk_id = f"{pdf_path.stem}_p{page_num}_c{idx}"
            embedding = get_embedding(chunk)
            collection.upsert(
                ids=[chunk_id],
                embeddings=[embedding],
                documents=[chunk],
                metadatas=[
                    {
                        "source": pdf_path.name,
                        "scheme": scheme_name,
                        "page": page_num,
                    }
                ],
            )
            chunks_added += 1

    doc.close()
    return chunks_added


def ingest_pdfs() -> int:
    pdf_files = list(DATA_DIR.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {DATA_DIR}. Add scheme PDFs first.")
        return 0

    total_chunks = 0
    for pdf_path in pdf_files:
        added = ingest_single_pdf(pdf_path)
        total_chunks += added
        print(f"Indexed {pdf_path.name} ({added} chunks)")

    print(f"Done! Total chunks indexed: {total_chunks}")
    return total_chunks


def ensure_indexed():
    if collection.count() == 0 and list(DATA_DIR.glob("*.pdf")):
        print("ChromaDB is empty. Auto-indexing PDFs in backend/data/...")
        ingest_pdfs()


def retrieve(query: str, k: int = 4) -> list[dict]:
    ensure_indexed()
    if collection.count() == 0:
        return []

    query_embedding = get_embedding(query)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(k, collection.count()),
    )

    matches = []
    if not results["documents"] or not results["documents"][0]:
        return matches

    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        matches.append(
            {
                "text": doc,
                "source": meta["source"],
                "scheme": meta["scheme"],
                "page": meta["page"],
            }
        )
    return matches


def list_indexed_documents() -> list[dict]:
    pdfs = sorted(DATA_DIR.glob("*.pdf"))
    docs = []
    for p in pdfs:
        docs.append(
            {
                "filename": p.name,
                "scheme": p.stem.replace("_", " ").replace("-", " "),
                "size_kb": round(p.stat().st_size / 1024, 1),
            }
        )
    return docs


if __name__ == "__main__":
    ingest_pdfs()
