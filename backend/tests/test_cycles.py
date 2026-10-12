"""Trainingszyklen: genau ein aktiver Zyklus, Verknüpfung mit Plänen, Session-Snapshot."""

from datetime import timedelta

from app.models import utcnow

API = "/api/v1"


def _cycle(client, **body):
    body.setdefault("start_date", "2026-10-01")
    return client.post(f"{API}/cycles", json=body)


def _active_map(client) -> dict[str, bool]:
    return {c["name"]: c["is_active"] for c in client.get(f"{API}/cycles").json()}


def test_create_and_activate_keeps_single_active(alice):
    a = _cycle(alice, name="Kraft", start_date="2026-09-01").json()
    assert a["is_active"] is True
    _cycle(alice, name="Kraftausdauer", start_date="2026-10-01")
    assert _active_map(alice) == {"Kraft": False, "Kraftausdauer": True}
    assert [c["name"] for c in alice.get(f"{API}/cycles").json()] == ["Kraftausdauer", "Kraft"]

    assert alice.post(f"{API}/cycles/{a['id']}/activate").json()["is_active"] is True
    assert _active_map(alice) == {"Kraft": True, "Kraftausdauer": False}


def test_create_without_activation(alice):
    c = _cycle(alice, name="Vorrat", activate=False).json()
    assert c["is_active"] is False


def test_linked_plan_becomes_active_with_cycle(alice):
    alice.post(f"{API}/plans", json={"name": "Plan A"})
    plan_b = alice.post(f"{API}/plans", json={"name": "Plan B"}).json()
    c = _cycle(alice, name="Block", plan_id=plan_b["id"]).json()
    assert c["plan_id"] == plan_b["id"] and c["plan_name"] == "Plan B"
    plans = {p["name"]: p["is_active"] for p in alice.get(f"{API}/plans").json()}
    assert plans == {"Plan A": False, "Plan B": True}

    other = _cycle(alice, name="Ohne Plan", activate=False).json()
    alice.post(f"{API}/cycles/{other['id']}/activate")
    assert _active_map(alice) == {"Block": False, "Ohne Plan": True}


def test_plan_of_other_user_is_rejected(alice, bob):
    foreign = bob.post(f"{API}/plans", json={"name": "Bobs Plan"}).json()
    assert _cycle(alice, name="X", plan_id=foreign["id"]).status_code == 404


def test_end_date_before_start_is_rejected(alice):
    r = _cycle(alice, name="X", start_date="2026-10-10", end_date="2026-10-01")
    assert r.status_code == 422


def test_update_and_end(alice):
    c = _cycle(alice, name="Kraft").json()
    r = alice.patch(f"{API}/cycles/{c['id']}", json={"name": "Kraft 2", "note": "Deload"})
    assert r.json()["name"] == "Kraft 2" and r.json()["note"] == "Deload"
    ended = alice.post(f"{API}/cycles/{c['id']}/end").json()
    assert ended["is_active"] is False
    assert ended["end_date"] == utcnow().date().isoformat()
    assert alice.get(f"{API}/today").json()["cycle"] is None


def test_session_gets_cycle_snapshot(alice):
    c = _cycle(alice, name="Kraftausdauer").json()
    s = alice.post(f"{API}/sessions", json={}).json()
    assert s["cycle_id"] == c["id"] and s["cycle_name"] == "Kraftausdauer"
    detail = alice.get(f"{API}/sessions/{s['id']}").json()
    assert detail["cycle_id"] == c["id"] and detail["cycle_name"] == "Kraftausdauer"
    summary = alice.get(f"{API}/sessions").json()[0]
    assert summary["cycle_name"] == "Kraftausdauer"

    alice.post(f"{API}/cycles/{c['id']}/end")
    s2 = alice.post(f"{API}/sessions", json={}).json()
    assert s2["cycle_id"] is None and s2["cycle_name"] is None


def test_list_sessions_filters_by_cycle(alice):
    a = _cycle(alice, name="A").json()
    s1 = alice.post(f"{API}/sessions", json={}).json()
    b = _cycle(alice, name="B").json()
    s2 = alice.post(f"{API}/sessions", json={}).json()
    assert [s["id"] for s in alice.get(f"{API}/sessions?cycle_id={a['id']}").json()] == [s1["id"]]
    assert [s["id"] for s in alice.get(f"{API}/sessions?cycle_id={b['id']}").json()] == [s2["id"]]
    assert len(alice.get(f"{API}/sessions").json()) == 2


def test_deleting_cycle_keeps_session_cycle_name(alice):
    c = _cycle(alice, name="Kraft").json()
    s = alice.post(f"{API}/sessions", json={}).json()
    assert alice.delete(f"{API}/cycles/{c['id']}").status_code == 204
    got = alice.get(f"{API}/sessions/{s['id']}").json()
    assert got["cycle_id"] is None and got["cycle_name"] == "Kraft"
    assert alice.get(f"{API}/cycles").json() == []


def test_today_reports_cycle_dates_without_week(alice):
    start = utcnow().date() - timedelta(days=15)
    _cycle(alice, name="Kraftausdauer", start_date=start.isoformat())
    cycle = alice.get(f"{API}/today").json()["cycle"]
    assert cycle["name"] == "Kraftausdauer"
    assert "week" not in cycle
    assert cycle["start_date"] == start.isoformat() and cycle["end_date"] is None


def test_patch_note_null_is_ignored(alice):
    c = _cycle(alice, name="Kraft", note="alt").json()
    r = alice.patch(f"{API}/cycles/{c['id']}", json={"note": None})
    assert r.status_code == 200
    assert r.json()["note"] == "alt"


def test_end_with_date_before_start_is_clamped(alice):
    c = _cycle(alice, name="Kraft", start_date="2026-10-10").json()
    r = alice.post(f"{API}/cycles/{c['id']}/end", json={"end_date": "2026-10-01"})
    assert r.status_code == 200
    assert r.json()["end_date"] == "2026-10-10"
    assert alice.patch(f"{API}/cycles/{c['id']}", json={"name": "Kraft 2"}).status_code == 200


def test_end_without_body_uses_today_but_not_before_start(alice):
    c = _cycle(alice, name="Zukunft", start_date=(utcnow().date() + timedelta(days=3)).isoformat())
    ended = alice.post(f"{API}/cycles/{c.json()['id']}/end").json()
    assert ended["end_date"] == ended["start_date"]

    c2 = _cycle(alice, name="Heute", start_date=utcnow().date().isoformat()).json()
    ended2 = alice.post(f"{API}/cycles/{c2['id']}/end").json()
    assert ended2["end_date"] == utcnow().date().isoformat()


def test_reactivating_clears_past_end_date(alice):
    c = _cycle(alice, name="Alt", start_date="2026-01-01", activate=False).json()
    r = alice.patch(f"{API}/cycles/{c['id']}", json={"end_date": "2026-02-01"})
    assert r.json()["end_date"] == "2026-02-01"
    activated = alice.post(f"{API}/cycles/{c['id']}/activate").json()
    assert activated["is_active"] is True
    assert activated["end_date"] is None


def test_reactivating_keeps_future_end_date(alice):
    future = (utcnow().date() + timedelta(days=30)).isoformat()
    c = _cycle(alice, name="Block", start_date="2026-01-01", end_date=future, activate=False)
    cid = c.json()["id"]
    assert alice.post(f"{API}/cycles/{cid}/activate").json()["end_date"] == future
