from __future__ import annotations
import httpx

from .config import OLLAMA_URL, EMBED_MODEL


class Embedder:
    def __init__(self, base_url: str = OLLAMA_URL, model: str = EMBED_MODEL):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = httpx.Client(timeout=60.0)

    def embed(self, text: str) -> list[float]:
        r = self.client.post(
            f"{self.base_url}/api/embeddings",
            json={"model": self.model, "prompt": text},
        )
        r.raise_for_status()
        data = r.json()
        emb = data.get("embedding")
        if not emb:
            raise RuntimeError(f"Ollama returned no embedding: {data}")
        return emb

    def ping(self) -> bool:
        try:
            r = self.client.get(f"{self.base_url}/api/tags", timeout=2.0)
            return r.status_code == 200
        except Exception:
            return False

    def close(self) -> None:
        self.client.close()
