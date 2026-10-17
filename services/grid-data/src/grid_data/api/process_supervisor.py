"""Bounded subprocess execution. Parent retains the job lease and kill authority."""

from __future__ import annotations

import multiprocessing
import os
import signal
import time
from collections.abc import Callable
from dataclasses import dataclass
from threading import Event


@dataclass(frozen=True)
class ExecutionLimits:
    timeout_seconds: float = 300
    poll_seconds: float = 0.5
    terminate_grace_seconds: float = 5
    memory_limit_mb: int | None = None

    def __post_init__(self):
        if not 0 < self.timeout_seconds <= 3600:
            raise ValueError("Worker timeout must be between 0 and 3600 seconds")
        if not 0 < self.poll_seconds <= 5 or not 0 < self.terminate_grace_seconds <= 30:
            raise ValueError("Invalid supervisor polling/grace interval")
        if self.memory_limit_mb is not None and not 256 <= self.memory_limit_mb <= 65536:
            raise ValueError("Invalid calculation memory limit")


def _entry(target: Callable, args: tuple, memory_limit_mb: int | None) -> None:
    if os.name == "posix":
        os.setsid()
        if memory_limit_mb is not None:
            import resource

            maximum = memory_limit_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (maximum, maximum))
    elif memory_limit_mb is not None:
        raise RuntimeError("Configured process memory limits require a Linux deployment")
    target(*args)


def _terminate(child, *, force: bool = False) -> None:
    if os.name == "posix":
        try:
            if os.getpgid(child.pid) == child.pid:
                os.killpg(child.pid, signal.SIGKILL if force else signal.SIGTERM)
                return
        except ProcessLookupError:
            return
    child.kill() if force else child.terminate()


def supervise(
    target: Callable,
    args: tuple,
    *,
    limits: ExecutionLimits,
    checkpoint: Callable[[], None],
    stop: Event,
) -> str:
    """Return a bounded outcome; never claim the child's result is committed."""
    child = multiprocessing.get_context("spawn").Process(
        target=_entry, args=(target, args, limits.memory_limit_mb)
    )
    started = time.monotonic()
    child.start()
    try:
        while child.is_alive():
            if stop.is_set():
                return "shutdown"
            if time.monotonic() - started >= limits.timeout_seconds:
                return "timeout"
            checkpoint()  # Throws on cancellation, lease loss or unavailable persistence.
            child.join(timeout=limits.poll_seconds)
        checkpoint()
        return "exited" if child.exitcode == 0 else "crashed"
    finally:
        if child.is_alive():
            _terminate(child)
            child.join(timeout=limits.terminate_grace_seconds)
        if child.is_alive():
            _terminate(child, force=True)
            child.join(timeout=limits.terminate_grace_seconds)
        if child.is_alive():
            raise RuntimeError("Worker child could not be terminated")
        child.close()
