import {it,expect,vi} from "vitest";
import {interpretQuestion} from "./copilot-conversation";
import type {CanonicalPresentation} from "../../features/operations/canonical-presentation";
import type {ConversationRequest} from "../../features/operations/copilot/conversation-contracts";
it.each(["Can TEM projections supply quarter-hour dispatch inputs?","How should an infrastructure efficiency label be interpreted?","How should hardware and useful throughput be compared in a benchmark?"])("distinguishes report guidance from dispatch/metric definitions: %s",async question=>{const fetcher=vi.fn();const value=await interpretQuestion({} as CanonicalPresentation,{question} as ConversationRequest,"","muse-spark-1.3",fetcher);expect(value.query?.intent).toBe("knowledge");expect(fetcher).not.toHaveBeenCalled();});


it.each(["Why is this result not proof of additional connection capacity?", "Does zero breach time prove the site is safe?"])("keeps unqualified proof questions in evidence readiness: %s", async question => {
  const fetcher = vi.fn();
  const value = await interpretQuestion({} as CanonicalPresentation, { question } as ConversationRequest, "", "muse-spark-1.3", fetcher);
  expect(value.query?.intent).toBe("readiness");
  expect(fetcher).not.toHaveBeenCalled();
});
