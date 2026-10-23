import base64
import json
from unittest.mock import MagicMock, Mock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from grid_data.api.auth import authenticated_user, session_user
from grid_data.api.free_milp import create_free_app
from grid_data.api.models import AnalyticsJob, UserIdentity
from grid_data.api.store import SupabaseJobStore


def token(owner, role="authenticated"):
    claims=base64.urlsafe_b64encode(json.dumps({"sub":str(owner),"role":role}).encode()).decode().rstrip('=')
    return "Bearer header."+claims+".verified-by-mocked-supabase"


def verified_response(monkeypatch, owner, anonymous):
    monkeypatch.setenv('SUPABASE_URL','https://fixture.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','test-only')
    response=MagicMock()
    response.__enter__.return_value.read.return_value=json.dumps({'id':str(owner),'is_anonymous':anonymous}).encode()
    monkeypatch.setattr('grid_data.api.auth.urllib.request.urlopen',lambda *args,**kwargs:response)


def test_private_api_rejects_anonymous_even_with_valid_supabase_session(monkeypatch):
    owner=uuid4()
    verified_response(monkeypatch,owner,True)
    with pytest.raises(HTTPException) as error:
        authenticated_user(token(owner,'gridpulse_public_visitor'))
    assert error.value.status_code==403
    assert session_user(token(owner,'gridpulse_public_visitor')).is_anonymous


def test_verified_subject_must_match_provider_response(monkeypatch):
    owner=uuid4()
    verified_response(monkeypatch,owner,False)
    with pytest.raises(HTTPException) as error:
        session_user(token(uuid4()))
    assert error.value.status_code==401


def test_named_session_remains_supported(monkeypatch):
    owner=uuid4()
    verified_response(monkeypatch,owner,False)
    assert authenticated_user(token(owner)).id==owner


def test_public_factory_needs_no_captcha_but_still_blocks_listing_and_other_jobs():
    owner=uuid4()
    store=SupabaseJobStore('https://unused.invalid','unused',access_scope='public')
    store._publisher=Mock()
    store._publisher.request.return_value=[]
    app=create_free_app(store=store,executor=Mock(),enabled=True,public_access=True,
        auth=lambda:UserIdentity(id=owner,is_anonymous=True,token_role='gridpulse_public_visitor'))
    with TestClient(app) as client:
        assert client.get('/v1/jobs').status_code==404
        health=client.get('/healthz').json()
        assert health['public_access']
        assert health['submissions_enabled']
        assert client.post('/v1/jobs/rolling-facility-plan',json={}).status_code==404


def test_removing_captcha_does_not_enable_disabled_runtime():
    store=SupabaseJobStore('https://unused.invalid','unused',access_scope='public')
    app=create_free_app(store=store,executor=Mock(),enabled=False,public_access=True)
    with TestClient(app) as client:
        health=client.get('/healthz').json()
        assert not health['enabled']
        assert not health['submissions_enabled']


@pytest.mark.parametrize('anonymous,role',[(False,'authenticated'),(True,'authenticated')])
def test_public_runtime_still_requires_restricted_identity(anonymous,role):
    store=SupabaseJobStore('https://unused.invalid','unused',access_scope='public')
    app=create_free_app(store=store,executor=Mock(),enabled=True,public_access=True,
        auth=lambda:UserIdentity(id=uuid4(),is_anonymous=anonymous,token_role=role))
    with TestClient(app) as client:
        assert client.get('/v1/jobs/'+str(uuid4())).status_code==403


def test_public_store_uses_atomic_admission_and_explicit_public_claim():
    store=SupabaseJobStore('https://unused.invalid','unused',access_scope='public')
    store._publisher=Mock()
    job=AnalyticsJob(owner_id=uuid4(),job_type='facility_plan',access_scope='public')
    store._publisher.request.return_value=[job.model_dump(mode='json')]
    assert store.create(job).id==job.id
    assert store._publisher.request.call_args.args[1]=='/rpc/create_public_facility_job'
    store.claim('public-worker',job_types=('facility_plan',))
    assert store._publisher.request.call_args.args[2]['p_access_scope']=='public'
    with pytest.raises(ValueError):
        store.claim('unscoped')


def test_public_store_never_returns_private_result():
    owner=uuid4()
    store=SupabaseJobStore('https://unused.invalid','unused',access_scope='public')
    store._publisher=Mock()
    job=AnalyticsJob(owner_id=owner,job_type='facility_plan')
    store._publisher.request.return_value=[job.model_dump(mode='json')]
    assert store.get(job.id,owner) is None
    assert store.request_cancel(job.id,owner) is None
    assert 'owner_id=eq.'+str(owner) in store._publisher.request.call_args.args[1]
