from urllib.error import HTTPError, URLError

from grid_data.publish import SupabaseRequestError


class JobCapacityReached(RuntimeError):
    pass


def retryable_failure(error: Exception) -> bool:
    if isinstance(error, (HTTPError, SupabaseRequestError)):
        code = error.code if isinstance(error, HTTPError) else error.status_code
        return code in {408, 429} or code >= 500
    return isinstance(error, (TimeoutError, ConnectionError, URLError))
