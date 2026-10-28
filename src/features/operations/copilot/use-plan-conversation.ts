import { useEffect, useRef, useState } from "react";
import { createBriefRequestLifecycle } from "./request-lifecycle";
import { requestCopilot } from "./copilot-client";
import { CHAT_VERSION, conversationResponseSchema, type ConversationAnswer, type CopilotNavigation } from "./conversation-contracts";

export type ConversationTurn = { question: string; answer: ConversationAnswer };
export type PlanConversationState = { turns: ConversationTurn[]; pending: string | null; error: string | null;
  ask: (question: string) => Promise<boolean>; stop: () => void; clear: () => void; selectExperiment?: (jobId: string) => void; experimentJobId?: string };
export function usePlanConversation(jobId: string | undefined, fingerprint: string, current: boolean, context: CopilotNavigation): PlanConversationState {
  const identity = `${jobId}:${fingerprint}:${current}`;
  const latest = useRef(identity); latest.current = identity;
  const gate = useRef(createBriefRequestLifecycle());
  const [saved, setSaved] = useState<{ identity: string; turns: ConversationTurn[] }>({ identity, turns: [] });
  const experimentId = useRef<string | undefined>(undefined);
  const [attachedExperiment, setAttachedExperiment] = useState<{ identity: string; id: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const turns = saved.identity === identity && current ? saved.turns : [];
  useEffect(() => {
    experimentId.current = undefined; setAttachedExperiment(null); gate.current.sync(identity); setSaved({ identity, turns: [] }); setPending(null); setError(null);
    const lifecycle = gate.current;
    return () => lifecycle.cancel();
  }, [identity]);
  async function ask(question: string) {
    question = question.trim();
    if (!current || !jobId || !question || question.length > 1000) return false;
    const ticket = gate.current.begin(identity);
    if (!ticket) return false;
    setPending(question); setError(null);
    const accepts = () => gate.current.accepts(ticket, latest.current);
    try {
      const answer = conversationResponseSchema.parse(await requestCopilot("conversation", { version: CHAT_VERSION, jobId,
        resultFingerprint: fingerprint, experimentJobId: experimentId.current, question, history: turns.slice(-6).map(turn => turn.question),
        transcript: turns.slice(-4).map(turn => ({ question: turn.question, answer: turn.answer.blocks.join("\n\n").slice(0, 3000) })),
        previousQueries: turns.slice(-3).flatMap(turn => turn.answer.resolvedQueries ?? [turn.answer.resolvedQuery]).slice(-3), context },
      AbortSignal.any([ticket.abort.signal, AbortSignal.timeout(80_000)])));
      if (answer.receipt.jobId !== jobId || answer.receipt.resultFingerprint !== fingerprint || answer.question !== question)
        throw new Error("Answer refers to a different question or plan.");
      if (accepts()) setSaved(previous => ({ identity, turns: [...(previous.identity === identity ? previous.turns : []), { question, answer }].slice(-20) }));
      return accepts();
    } catch (reason) {
      if (accepts()) setError(reason instanceof Error ? reason.message : "Answer unavailable.");
      return false;
    } finally { if (gate.current.finish(ticket) && latest.current === identity) setPending(null); }
  }
  return { experimentJobId: attachedExperiment?.identity === identity ? attachedExperiment.id : undefined,
    selectExperiment: id => { if (experimentId.current !== id) { gate.current.cancel(); setPending(null); setSaved({identity,turns:[]}); setError(null); } experimentId.current = id; setAttachedExperiment({ identity, id }); }, turns, pending: current ? pending : null, error: current ? error : null, ask,
    stop: () => { gate.current.cancel(); setPending(null); setError("Stopped. You can retry; provider cancellation is not guaranteed."); },
    clear: () => { experimentId.current = undefined; setAttachedExperiment(null); gate.current.cancel(); setSaved({ identity, turns: [] }); setPending(null); setError(null); } };
}
