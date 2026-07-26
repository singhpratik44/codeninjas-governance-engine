"""Ollama model provider for local LLM inference (zero token cost).

Enables LangGraph orchestration to run with local Ollama models instead of Claude API.
Supports streaming and non-streaming inference with configurable model selection.

To use:
1. Install Ollama: https://ollama.ai
2. Pull a model: ollama pull mistral (or llama2, neural-chat, etc.)
3. Start Ollama server: ollama serve
4. Configure this adapter with your model name and endpoint
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Optional, Generator
import time


@dataclass
class OllamaConfig:
    """Configuration for Ollama model provider."""
    base_url: str = "http://localhost:11434"  # Default Ollama endpoint
    model: str = "mistral"  # Default model (lightweight, fast)
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 40
    num_ctx: int = 2048  # Context window size
    repeat_penalty: float = 1.1
    timeout_seconds: int = 300


class OllamaClient:
    """Synchronous Ollama API client for local LLM inference."""

    def __init__(self, config: OllamaConfig = None):
        self.config = config or OllamaConfig()
        self._check_connectivity()

    def _check_connectivity(self) -> bool:
        """Verify Ollama server is running."""
        try:
            url = f"{self.config.base_url}/api/tags"
            req = urllib.request.Request(url, method='GET')
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    print(f"✓ Connected to Ollama at {self.config.base_url}")
                    return True
        except (urllib.error.URLError, Exception) as e:
            print(f"⚠ Ollama not available at {self.config.base_url}: {e}")
            print("  Start Ollama with: ollama serve")
            return False
        return False

    def generate(self, prompt: str, system: Optional[str] = None, stream: bool = False) -> str | Generator[str, None, None]:
        """Generate text using Ollama.

        Args:
            prompt: The input prompt
            system: Optional system prompt
            stream: Whether to stream response (yields tokens)

        Returns:
            str (non-streaming) or Generator[str] (streaming)
        """
        url = f"{self.config.base_url}/api/generate"

        payload = {
            "model": self.config.model,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": self.config.temperature,
                "top_p": self.config.top_p,
                "top_k": self.config.top_k,
                "repeat_penalty": self.config.repeat_penalty,
                "num_ctx": self.config.num_ctx,
            },
        }

        if system:
            payload["system"] = system

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )

            if stream:
                return self._stream_response(req)
            else:
                return self._get_full_response(req)

        except urllib.error.URLError as e:
            return f"ERROR: Failed to connect to Ollama: {e}"
        except Exception as e:
            return f"ERROR: {type(e).__name__}: {e}"

    def _get_full_response(self, req: urllib.request.Request) -> str:
        """Get complete response (non-streaming)."""
        try:
            with urllib.request.urlopen(req, timeout=self.config.timeout_seconds) as response:
                buffer = ""
                while True:
                    chunk = response.read(1024)
                    if not chunk:
                        break
                    buffer += chunk.decode('utf-8')

                # Parse the response (Ollama returns JSON lines)
                result = ""
                for line in buffer.strip().split('\n'):
                    if line:
                        data = json.loads(line)
                        if 'response' in data:
                            result += data['response']
                        if data.get('done'):
                            break

                return result

        except Exception as e:
            return f"ERROR: {e}"

    def _stream_response(self, req: urllib.request.Request) -> Generator[str, None, None]:
        """Stream response tokens as they arrive."""
        try:
            with urllib.request.urlopen(req, timeout=self.config.timeout_seconds) as response:
                while True:
                    chunk = response.read(1024)
                    if not chunk:
                        break

                    for line in chunk.decode('utf-8').split('\n'):
                        if line:
                            try:
                                data = json.loads(line)
                                if 'response' in data:
                                    yield data['response']
                                if data.get('done'):
                                    return
                            except json.JSONDecodeError:
                                pass

        except Exception as e:
            yield f"ERROR: {e}"

    def list_models(self) -> list[str]:
        """List available models on the Ollama server."""
        try:
            url = f"{self.config.base_url}/api/tags"
            req = urllib.request.Request(url, method='GET')
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode('utf-8'))
                models = [m['name'].split(':')[0] for m in data.get('models', [])]
                return list(set(models))  # Remove duplicates
        except Exception as e:
            return []


class OllamaModelAdapter:
    """Model-agnostic adapter for Ollama (mirrors ModelAdapter interface from triage_orchestration.py)."""

    # Recommended Ollama models by speed/capability trade-off
    MODELS = {
        "fast": {
            "name": "neural-chat",  # Smallest, fastest
            "tokens": 4096,
            "description": "Very fast, good for real-time decisions"
        },
        "balanced": {
            "name": "mistral",  # Medium, good quality
            "tokens": 8192,
            "description": "Fast + good quality (default)"
        },
        "quality": {
            "name": "llama2",  # Larger, better reasoning
            "tokens": 4096,
            "description": "Better quality, slower"
        },
        "reasoning": {
            "name": "orca-mini",  # Specialized for reasoning
            "tokens": 4096,
            "description": "Best for complex reasoning"
        },
    }

    def __init__(self, config: OllamaConfig = None):
        self.config = config or OllamaConfig()
        self.client = OllamaClient(self.config)

    @staticmethod
    def get_models_by_capability() -> dict:
        """Return models grouped by capability level."""
        return OllamaModelAdapter.MODELS

    def select_model(self, complexity: int, prefer_speed: bool = True) -> str:
        """Select model based on task complexity.

        Args:
            complexity: 1-10 scale (1=simple, 10=complex)
            prefer_speed: Prefer fast models over quality if True

        Returns:
            Model name to use
        """
        if complexity <= 2:
            return "neural-chat" if prefer_speed else "neural-chat"
        elif complexity <= 5:
            return "mistral"
        elif complexity <= 8:
            return "llama2" if not prefer_speed else "mistral"
        else:
            return "orca-mini" if not prefer_speed else "mistral"

    def invoke(self, prompt: str, system: Optional[str] = None, model: Optional[str] = None) -> str:
        """Invoke Ollama to generate a response.

        Args:
            prompt: The input prompt
            system: Optional system prompt
            model: Override default model

        Returns:
            Generated response
        """
        prev_model = self.config.model
        if model:
            self.config.model = model

        try:
            response = self.client.generate(prompt, system=system, stream=False)
            return response
        finally:
            self.config.model = prev_model

    def invoke_streaming(self, prompt: str, system: Optional[str] = None, model: Optional[str] = None) -> Generator[str, None, None]:
        """Stream response tokens from Ollama.

        Args:
            prompt: The input prompt
            system: Optional system prompt
            model: Override default model

        Yields:
            Response tokens
        """
        prev_model = self.config.model
        if model:
            self.config.model = model

        try:
            yield from self.client.generate(prompt, system=system, stream=True)
        finally:
            self.config.model = prev_model


# Convenience functions for direct use

def ollama_invoke(prompt: str, model: str = "mistral", system: Optional[str] = None) -> str:
    """Quick helper to invoke Ollama directly."""
    adapter = OllamaModelAdapter(OllamaConfig(model=model))
    return adapter.invoke(prompt, system=system)


def ollama_stream(prompt: str, model: str = "mistral", system: Optional[str] = None) -> Generator[str, None, None]:
    """Quick helper to stream from Ollama directly."""
    adapter = OllamaModelAdapter(OllamaConfig(model=model))
    yield from adapter.invoke_streaming(prompt, system=system)


# Example usage (for testing)
if __name__ == "__main__":
    print("Testing Ollama integration...")
    print()

    adapter = OllamaModelAdapter()

    # Show available models
    print("Available Ollama models by capability:")
    for tier, info in OllamaModelAdapter.get_models_by_capability().items():
        print(f"  {tier}: {info['name']} — {info['description']}")
    print()

    # Test simple invocation
    print("Testing simple invocation (will fail if Ollama not running):")
    prompt = "What is 2 + 2? Answer in one sentence."
    print(f"Prompt: {prompt}")
    print("Response: ", end="", flush=True)

    response = adapter.invoke(prompt, model="mistral")
    print(response)
    print()

    # Test streaming
    print("Testing streaming (will fail if Ollama not running):")
    prompt = "Explain task orchestration in healthcare in 2 sentences."
    print(f"Prompt: {prompt}")
    print("Response: ", end="", flush=True)

    for token in adapter.invoke_streaming(prompt, model="mistral"):
        print(token, end="", flush=True)
    print()
