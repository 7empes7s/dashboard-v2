const PIPELINE_API = "http://127.0.0.1:3200";

export interface ControlResult {
  success: boolean;
  message: string;
}

async function pausePipeline(): Promise<ControlResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "pause" }),
    });
    const json = await res.json();
    return { success: res.ok, message: json.message || "Paused" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function resumePipeline(): Promise<ControlResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "resume" }),
    });
    const json = await res.json();
    return { success: res.ok, message: json.message || "Resumed" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function killStory(storyId: string): Promise<ControlResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "kill", storyId }),
    });
    const json = await res.json();
    return { success: res.ok, message: json.message || `Killed ${storyId}` };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function retryStory(storyId: string): Promise<ControlResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "retry", storyId }),
    });
    const json = await res.json();
    return { success: res.ok, message: json.message || `Retrying ${storyId}` };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

export { pausePipeline, resumePipeline, killStory, retryStory };