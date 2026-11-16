def register(client, **overrides):
    body = {"role": "donor", "name": "Meera", "email": "meera@example.com", "city": "Bengaluru", "password": "password123"}
    body.update(overrides)
    return client.post("/api/auth/register", json=body)


def test_register_sets_session_and_me_works(client):
    res = register(client, phone="98450 12345")
    assert res.status_code == 201
    user = res.json()
    assert user["role"] == "donor"
    assert user["phone"] == "+919845012345"
    assert "password_hash" not in user
    assert client.get("/api/auth/me").json()["email"] == "meera@example.com"


def test_duplicate_email_is_rejected(client):
    register(client)
    res = register(client, email="MEERA@example.com")
    assert res.status_code == 409


def test_admin_role_cannot_self_register(client):
    assert register(client, role="admin").status_code == 422


def test_invalid_indian_mobile_is_rejected(client):
    assert register(client, phone="12345").status_code == 422


def test_login_with_email_or_phone_and_logout(client):
    register(client, phone="9845012345")
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401

    assert client.post("/api/auth/login", json={"identifier": "meera@example.com", "password": "password123"}).status_code == 200
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login", json={"identifier": "+91 98450 12345", "password": "password123"}).status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_wrong_password(client):
    register(client)
    res = client.post("/api/auth/login", json={"identifier": "meera@example.com", "password": "nope-nope"})
    assert res.status_code == 401
