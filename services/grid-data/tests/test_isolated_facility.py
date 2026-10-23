from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from grid_data.api.jobs.context import JobCancelled, JobLeaseLost
from grid_data.api.jobs import isolated_facility


@pytest.mark.parametrize("failure", [JobCancelled("cancel"), JobLeaseLost("lease")])
def test_active_child_is_stopped_on_cancel_or_lease_loss(monkeypatch, failure):
    receiver, sender = Mock(), Mock()
    receiver.poll.return_value = False
    process = Mock()
    process.is_alive.side_effect = [True, False]
    process_context = Mock()
    process_context.Pipe.return_value = receiver, sender
    process_context.Process.return_value = process
    monkeypatch.setattr(isolated_facility.multiprocessing, "get_context", lambda method: process_context)
    context = SimpleNamespace(checkpoint=Mock(side_effect=[None, failure]))
    with pytest.raises(type(failure)):
        isolated_facility.execute_isolated_facility(context, {})
    process.start.assert_called_once()
    process.terminate.assert_called_once()
    process.join.assert_called_once_with(timeout=5)
    receiver.close.assert_called_once()


def test_cancelled_request_does_not_start_process():
    context = SimpleNamespace(checkpoint=Mock(side_effect=JobCancelled("cancel")))
    with pytest.raises(JobCancelled):
        isolated_facility.execute_isolated_facility(context, {})
