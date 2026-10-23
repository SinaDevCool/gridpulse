"""Bounded child execution owned by the existing job runner, not a second queue."""

import json
import multiprocessing
import time

from grid_data.api.jobs.context import JobContext

MAXIMUM_RESULT_BYTES = 32_000_000


def _calculate(connection, payload: dict) -> None:
    try:
        from capacity_backtest.application import run_facility_plan

        result = run_facility_plan(payload)
        encoded = json.dumps({"result": result}, allow_nan=False).encode()
        if len(encoded) > MAXIMUM_RESULT_BYTES:
            raise ValueError("Canonical result exceeds the qualified transport budget")
        connection.send_bytes(encoded)
    except Exception as error:
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
    process_context = multiprocessing.get_context("spawn")
    receiver, sender = process_context.Pipe(duplex=False)
    process = process_context.Process(target=_calculate, args=(sender, payload), daemon=True)
    started = False
    deadline = time.monotonic() + 630
    try:
        process.start()
        started = True
        sender.close()
        while True:
            context.checkpoint()
            if time.monotonic() >= deadline:
                raise TimeoutError("Canonical calculation exceeded the 630-second wall-clock budget")
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
