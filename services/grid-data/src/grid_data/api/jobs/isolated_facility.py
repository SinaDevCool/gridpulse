"""Bounded child execution owned by the existing job runner, not a second queue."""

import json
import logging
import multiprocessing
import time

from grid_data.api.jobs.context import JobContext

MAXIMUM_RESULT_BYTES = 32_000_000


def _calculate(connection, payload: dict) -> None:
    try:
        from capacity_backtest.application import run_facility_plan

        if payload.get("schema_version") == "gridpulse-facility-experiment-request-v1":
            from capacity_backtest.application import run_facility_experiment

            result = run_facility_experiment(payload)
        elif payload.get("schema_version") in {
            "gridpulse-facility-accounting-request-v1",
            "gridpulse-facility-accounting-request-v2",
        }:
            from capacity_backtest.application import run_facility_accounting

            result = run_facility_accounting(payload)
        elif payload.get("schema_version") == "gridpulse-chronological-shadow-request-v1":
            from capacity_backtest.application.rolling import run_chronological_shadow

            result = run_chronological_shadow(payload)
        else:
            result = run_facility_plan(payload)
        encoded = json.dumps({"result": result}, allow_nan=False).encode()
        if len(encoded) > MAXIMUM_RESULT_BYTES:
            raise ValueError("Canonical result exceeds the qualified transport budget")
        connection.send_bytes(encoded)
    except Exception as error:
        logging.getLogger(__name__).exception("Canonical child calculation failed")
        message = f"{type(error).__name__}: {error}"[:2000]
        connection.send_bytes(json.dumps({"error": message}).encode())
    finally:
        connection.close()


def execute_isolated_facility(context: JobContext, payload: dict) -> dict:
    """Cancellation/lease loss stops task-owned solver work before publication.

    Solver time is not a wall-clock guarantee: model construction and diagnostic
    solves are also bounded here. Memory sizing remains a runtime qualification gate.
    """
    context.checkpoint()
    budget = getattr(context, "wall_clock_limit_seconds", 630)
    if not isinstance(budget, (int, float)) or not 0 < budget <= 630:
        raise ValueError("Invalid canonical wall-clock budget")
    process_context = multiprocessing.get_context("spawn")
    receiver, sender = process_context.Pipe(duplex=False)
    process = process_context.Process(target=_calculate, args=(sender, payload), daemon=True)
    started = False
    deadline = time.monotonic() + budget
    next_checkpoint = 0.0
    try:
        process.start()
        started = True
        sender.close()
        while True:
            now = time.monotonic()
            if now >= next_checkpoint:
                context.checkpoint()
                next_checkpoint = now + 1
            if now >= deadline:
                raise TimeoutError(
                    f"Canonical calculation exceeded the {budget}-second wall-clock budget"
                )
            if receiver.poll(0.1):
                try:
                    message = json.loads(receiver.recv_bytes(MAXIMUM_RESULT_BYTES))
                except EOFError as error:
                    raise RuntimeError("Canonical child exited without a result") from error
                if "error" in message:
                    raise RuntimeError(message["error"])
                context.checkpoint()
                return message["result"]
            if not process.is_alive():
                raise RuntimeError("Canonical child exited without a result")
    finally:
        sender.close()
        receiver.close()
        if started:
            if process.is_alive():
                process.terminate()
            process.join(timeout=5)
            if process.is_alive():
                process.kill()
                process.join(timeout=5)
            process.close()
