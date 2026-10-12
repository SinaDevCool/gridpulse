from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from grid_data.api.jobs.publication import JobPublisher
from grid_data.network_study import NetworkStudyProvider


class JobCancelled(RuntimeError):
    pass


class JobLeaseLost(RuntimeError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def network_provider() -> NetworkStudyProvider:
    from grid_data.network_study import PandapowerProvider

    return PandapowerProvider()


@dataclass(frozen=True)
class JobContext:
    publisher: JobPublisher
    checkpoint: Callable[[], None] = lambda: None
    clock: Callable[[], datetime] = utc_now
    network_provider: Callable[[], NetworkStudyProvider] = network_provider
