# Staff textbooks for Capture Hub RAG

Students never upload these files. Drop searchable PDFs or `.txt` / `.md` notes here, then map them in `manifest.json` using catalog topic ids (`e-math` / `chemistry`).

```powershell
npm run db:ingest-textbooks
```

Requires `DATABASE_DIRECT_URL` and `GEMINI_API_KEY` (Gemini embeddings). Microsoft Foundry embeddings remain a fallback if Gemini is unset. PDF binaries are gitignored so commercial textbooks stay off the repository.

Image-only scans without a text layer are OCR'd page-by-page with Gemini 3.5 Flash during ingest. Progress is cached under `.extract-cache/` so a long run can be resumed.
