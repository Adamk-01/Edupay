import uuid

from app.dependencies import resolve_user_uuid


def test_resolve_user_uuid_from_token_sub():
    user_id = uuid.uuid4()
    assert resolve_user_uuid(str(user_id)) == user_id
