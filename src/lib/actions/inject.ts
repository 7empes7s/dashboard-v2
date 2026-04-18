const PIPELINE_API = "http://127.0.0.1:3200";

export interface InjectRequest {
  topic: string;
  vertical: string;
  priority?: number;
}

export interface InjectResult {
  success: boolean;
  storyId?: string;
  error?: string;
}

export interface QueueStatus {
  queueDepth: number;
  running: string | null;
}

async function injectStory(req: InjectRequest): Promise<InjectResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "add",
        topic: req.topic,
        vertical: req.vertical,
        priority: req.priority || 2,
      }),
    });
    
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }
    
    const json = await res.json();
    return { success: true, storyId: json.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function getQueueStatus(): Promise<QueueStatus> {
  try {
    const res = await fetch(`${PIPELINE_API}/queue`);
    const json = await res.json();
    return {
      queueDepth: json.queue?.length || 0,
      running: json.current?.id || null,
    };
  } catch {
    return { queueDepth: 0, running: null };
  }
}

export { injectStory, getQueueStatus };