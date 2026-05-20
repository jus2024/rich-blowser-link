"""AgentCore Runtime エントリーポイント

BedrockAgentCoreApp を使用して Bookmark Agent を
AgentCore Runtime 上で実行するためのエントリーポイントです。
"""

import asyncio
import threading

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from bookmark_agent.agent import create_agent
from common.logging import setup_logger

logger = setup_logger("bookmark_agent.app")

app = BedrockAgentCoreApp()

# キューの終端を示すセンチネル
_DONE = object()


@app.entrypoint
async def invoke(payload, context):
    """SSE ストリーミング対応エントリーポイント（POST /invocations）

    callback_handler でテキストチャンクを asyncio.Queue に流し、
    async generator として逐次 yield する。
    AgentCore Runtime が yield されたイベントを SSE 形式に変換する。
    """
    user_message = payload.get(
        "prompt",
        "No prompt found in input, please send a JSON payload with a 'prompt' key.",
    )
    logger.info("SSE ストリーミング呼び出しを受信しました")

    # owner_id を payload の access_token から取得
    # AgentCore Runtime が JWT 検証済みのため、エントリーポイント到達時点でトークンは正当
    owner_id = ""
    access_token = payload.get("access_token", "") if isinstance(payload, dict) else ""
    if access_token and access_token.count(".") >= 2:
        import base64
        import json as json_mod

        try:
            payload_segment = access_token.split(".")[1]
            padding = 4 - len(payload_segment) % 4
            if padding != 4:
                payload_segment += "=" * padding
            decoded = base64.urlsafe_b64decode(payload_segment)
            claims = json_mod.loads(decoded)
            owner_id = claims.get("sub", "")
        except Exception as e:
            logger.warning("JWT デコードに失敗: %s", str(e))

    logger.info("owner_id: %s", owner_id[:8] + "..." if owner_id else "")

    # Amplify の owner-based auth は "sub::sub" 形式で owner フィールドを保存する
    if owner_id and "::" not in owner_id:
        owner_id = f"{owner_id}::{owner_id}"

    logger.info("owner_id: %s", owner_id)

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def streaming_callback(**kwargs):
        """テキストチャンクをキューに送る callback_handler"""
        data = kwargs.get("data", "")
        if data:
            loop.call_soon_threadsafe(queue.put_nowait, data)

    def run_agent():
        """別スレッドでエージェントを実行し、完了時にセンチネルを送る"""
        try:
            agent = create_agent(owner_id=owner_id)
            agent(user_message, callback_handler=streaming_callback)
            loop.call_soon_threadsafe(queue.put_nowait, _DONE)
        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, e)

    thread = threading.Thread(target=run_agent, daemon=True)
    thread.start()

    try:
        while True:
            item = await queue.get()
            if item is _DONE:
                logger.info("ストリーミング完了")
                break
            if isinstance(item, Exception):
                logger.exception("エージェント実行中にエラーが発生しました")
                raise item
            yield item
    finally:
        thread.join(timeout=5)


if __name__ == "__main__":
    app.run()
