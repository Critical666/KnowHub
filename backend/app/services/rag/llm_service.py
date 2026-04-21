from openai import AsyncOpenAI
from typing import List, Dict, AsyncGenerator


class KimiLLMService:
    def __init__(self, api_key: str, base_url: str = "https://api.moonshot.cn/v1"):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = "kimi-k2.5"
    
    async def generate_stream(self, query: str, contexts: List[Dict],
                              conversation_history: List[Dict] = None,
                              temperature: float = 0.3) -> AsyncGenerator[str, None]:
        system_prompt = "你是一个专业的企业知识库助手。基于提供的参考信息回答用户问题。"
        context_text = "\n\n".join([f"[参考{i+1}] {ctx['content'][:500]}" for i, ctx in enumerate(contexts)])
        user_message = f"""基于以下参考信息回答问题：

{context_text}

---
用户问题：{query}"""

        messages = [{"role": "system", "content": system_prompt}]
        if conversation_history:
            messages.extend(conversation_history)
        messages.append({"role": "user", "content": user_message})
        
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            stream=True
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content