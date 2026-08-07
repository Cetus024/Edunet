/* Parses the deeply-nested MCP response from MicrosoftMCPServersService.mcp_m365copilot
 * into a flat array of items that components can consume directly.
 *
 * The response goes through up to 5 layers of encoding:
 * 1. { success, data } envelope
 * 2. SSE "data: " line prefix
 * 3. JSON-RPC envelope with result.content
 * 4. CopilotChat wrapper with rawResponse
 * 5. Conversation messages with JSON in markdown fences
 */

export class McpToolError extends Error {
  readonly isRateLimited: boolean;

  constructor(message: string) {
    super(message);
    this.name = 'McpToolError';
    this.isRateLimited =
      message.includes('429') || message.toLowerCase().includes('rate limit');
  }
}

export function extractItems<T = unknown>(raw: unknown): T[] {
  // Layer 1: Unwrap { success, data } envelope if present
  let text: string;
  if (typeof raw === 'string') {
    try {
      const envelope = JSON.parse(raw);
      text = typeof envelope?.data === 'string' ? envelope.data : raw;
    } catch {
      text = raw;
    }
  } else if (raw && typeof raw === 'object' && 'data' in raw) {
    text = String((raw as Record<string, unknown>).data);
  } else {
    text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  }

  // Layer 2: Strip SSE envelope — get the line starting with "data: "
  const lines = text.split('\n');
  const dataLine = lines.find((l) => l.startsWith('data:'));
  const jsonRpcStr = dataLine ? dataLine.slice(6) : text;

  // Layer 3: Parse JSON-RPC envelope
  const rpc = JSON.parse(jsonRpcStr);

  // Check for MCP tool-level errors (e.g., 429 rate limits)
  if (rpc?.result?.isError === true) {
    const errorText = Array.isArray(rpc.result.content)
      ? rpc.result.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text?: string }) => c.text ?? '')
          .join(' ')
      : 'Unknown MCP tool error';
    throw new McpToolError(errorText);
  }

  const content = rpc?.result?.content;
  if (!Array.isArray(content)) return [];
  const textEntry = content.find((c: { type: string }) => c.type === 'text');
  if (!textEntry?.text) return [];

  // Layer 4: Parse CopilotChat wrapper (JSON.parse handles \\u0022 -> ")
  const wrapper = JSON.parse(textEntry.text);

  // Layer 5: Parse rawResponse (JSON.parse again handles \\u0022 -> ")
  let replyText = '';
  if (wrapper.rawResponse) {
    const conversation = JSON.parse(wrapper.rawResponse);
    const messages = conversation?.messages;
    if (Array.isArray(messages) && messages.length > 1) {
      replyText = messages[messages.length - 1]?.text ?? '';
    }
  }
  if (!replyText && wrapper.reply) {
    replyText = wrapper.reply;
  }
  if (!replyText) return [];

  const fenceMatch = replyText.match(/```(?:json)?\s*([\s\S]*?)\s*```/m);
  const jsonContent = fenceMatch ? fenceMatch[1] : replyText;

  const parsed = JSON.parse(jsonContent.trim());
  return Array.isArray(parsed) ? parsed : [parsed];
}
