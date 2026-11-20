import json
import os
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from google.genai import types

from app.rag import (
    BASE_DIR,
    DATA_DIR,
    collection,
    ensure_indexed,
    get_genai_client,
    ingest_pdfs,
    ingest_single_pdf,
    list_indexed_documents,
    retrieve,
)
from app.prompts import build_rag_system_prompt, build_eligibility_prompt

load_dotenv(BASE_DIR / ".env")

# Ordered fallback lists — first entry is preferred, rest are tried on 503/429/UNAVAILABLE
FAST_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"]
DEEP_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"]


def is_retryable_error(e: Exception) -> bool:
    """Return True for 503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED, and timeout errors."""
    code = getattr(e, "code", None) or getattr(e, "status_code", None)
    if code in (503, 429, "503", "429"):
        return True
    status = getattr(e, "status", None)
    if status:
        s = str(status).upper()
        if "UNAVAILABLE" in s or "RESOURCE_EXHAUSTED" in s:
            return True
    err_str = str(e).upper()
    return (
        "503" in err_str
        or "429" in err_str
        or "UNAVAILABLE" in err_str
        or "RESOURCE_EXHAUSTED" in err_str
        or "TIMED OUT" in err_str
        or "TIMEOUT" in err_str
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        ensure_indexed()
    except Exception as e:
        print(f"[Startup warning] Could not auto-index PDFs: {e}")
    yield


app = FastAPI(title="YojanaSetu API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    query: str
    language: str = "en"
    mode: str = "fast"  # "fast" | "deep"


class EligibilityRequest(BaseModel):
    age: int
    income: int
    state: str
    occupation: str
    category: str = "General"
    language: str = "en"


@app.get("/api/health")
def health():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    key_ok = bool(api_key and api_key != "your_gemini_api_key_here")
    return {
        "status": "ok" if key_ok else "missing_api_key",
        "api_key_configured": key_ok,
        "indexed_chunks": collection.count(),
        "documents": len(list_indexed_documents()),
        "default_model": FAST_MODELS[0],
    }


@app.get("/api/schemes")
def get_schemes():
    return {"documents": list_indexed_documents(), "total_chunks": collection.count()}


@app.post("/api/ingest")
def trigger_ingest():
    try:
        total = ingest_pdfs()
        return {"status": "indexed", "total_chunks": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    safe_name = Path(file.filename).name.replace(" ", "_")
    dest_path = DATA_DIR / safe_name

    with dest_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        chunks_added = ingest_single_pdf(dest_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {e}")

    return {
        "status": "uploaded_and_indexed",
        "filename": safe_name,
        "chunks_added": chunks_added,
    }


@app.post("/api/chat/stream")
def chat_stream(req: ChatRequest):
    model_list = DEEP_MODELS if req.mode == "deep" else FAST_MODELS

    def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Searching official scheme documents...'})}\n\n"
            matches = retrieve(req.query, k=4)

            context_blocks = []
            citations = []
            seen = set()
            for m in matches:
                context_blocks.append(
                    f"[Source: {m['source']}, Page {m['page']}]\n{m['text']}"
                )
                key = (m["source"], m["page"])
                if key not in seen:
                    seen.add(key)
                    citations.append(
                        {"source": m["source"], "scheme": m["scheme"], "page": m["page"]}
                    )

            yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"
            yield f"data: {json.dumps({'type': 'status', 'message': 'Drafting clear explanation...'})}\n\n"

            context_text = (
                "\n\n---\n\n".join(context_blocks)
                if context_blocks
                else "No documents indexed yet."
            )
            system_prompt = build_rag_system_prompt(req.language)
            user_prompt = f"Official Document Excerpts:\n{context_text}\n\nCitizen Question: {req.query}"

            client = get_genai_client()
            last_exc = None

            for model in model_list:
                try:
                    stream = client.models.generate_content_stream(
                        model=model,
                        contents=user_prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=system_prompt,
                            temperature=0.2,
                        ),
                    )
                    for chunk in stream:
                        if chunk.text:
                            yield f"data: {json.dumps({'type': 'token', 'text': chunk.text})}\n\n"
                    last_exc = None
                    break  # success
                except Exception as e:
                    if is_retryable_error(e):
                        last_exc = e
                        idx = model_list.index(model)
                        next_models = model_list[idx + 1:]
                        if next_models:
                            print(f"[Fallback] {model} unavailable ({e}). Trying {next_models[0]}...")
                            yield f"data: {json.dumps({'type': 'status', 'message': f'{model} unavailable. Trying {next_models[0]}...'})}\n\n"
                        continue
                    raise

            if last_exc is not None:
                raise last_exc

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/eligibility")
def check_eligibility(req: EligibilityRequest):
    try:
        search_query = (
            f"eligibility criteria income limit age occupation {req.occupation} "
            f"{req.category} {req.state} benefits documents required"
        )
        matches = retrieve(search_query, k=8)

        if not matches:
            return {
                "summary": "No scheme documents are indexed yet. Please upload or index PDFs first.",
                "matches": [],
            }

        context_text = "\n\n---\n\n".join(
            f"[Source: {m['source']}, Page {m['page']}]\n{m['text']}" for m in matches
        )
        prompt = build_eligibility_prompt(req.model_dump(), context_text, req.language)

        client = get_genai_client()
        last_exc = None
        response = None

        for model in FAST_MODELS:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json",
                    ),
                )
                last_exc = None
                break  # success
            except Exception as e:
                if is_retryable_error(e):
                    last_exc = e
                    idx = FAST_MODELS.index(model)
                    next_models = FAST_MODELS[idx + 1:]
                    if next_models:
                        print(f"[Fallback] {model} unavailable ({e}) for eligibility. Trying {next_models[0]}...")
                    continue
                raise

        if last_exc is not None:
            raise last_exc

        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eligibility evaluation failed: {e}")
