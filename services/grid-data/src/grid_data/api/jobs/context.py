from dataclasses import dataclass


@dataclass(frozen=True)
class JobContext:
    supabase_url: str
    service_role_key: str
