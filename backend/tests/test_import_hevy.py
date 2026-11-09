from datetime import UTC, datetime

from sqlmodel import select

from app.models import Exercise, SessionExercise, SetLog, WorkoutSession
from app.services import import_hevy as hevy

API = "/api/v1"
HEADER = (
    "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,"
    "set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe\n"
)
# Training 1: Bankdrücken (global, mit Aufwärm- und Drop-Satz), Superset Klimmzug + Cable Fly
# Training 2: nur Bankdrücken
T1 = '"Push","7 Jan 2026, 09:30","7 Jan 2026, 10:30","",'
T2 = '"Push","9 Jan 2026, 18:00","9 Jan 2026, 19:00","",'
CSV = HEADER + "\n".join(
    [
        T1 + '"Bankdrücken",,"Sitz 4",0,warmup,40,10,,,',
        T1 + '"Bankdrücken",,"Sitz 4",1,normal,80,8,,,8',
        T1 + '"Bankdrücken",,"Sitz 4",2,failure,80,6,,,10',
        T1 + '"Bankdrücken",,"Sitz 4",3,dropset,60,10,,,',
        T1 + '"Klimmzug",1,,0,normal,0,8,,,',
        T1 + '"Cable Fly",1,,0,normal,15,12,,,',
        T1 + '"Laufband",,,0,normal,,,2.5,600,',
        T2 + '"Bankdrücken",,,0,normal,82.5,6,,,',
    ]
)


def upload(client, text, dry_run=False):
    return client.post(
        f"{API}/account/import/hevy",
        params={"dry_run": dry_run},
        files={"file": ("hevy.csv", text.encode("utf-8"), "text/csv")},
    )


def test_import_creates_sessions_sets_and_exercises(alice, catalog, db):
    r = upload(alice, CSV)
    assert r.status_code == 200
    assert r.json() == {
        "dry_run": False,
        "sessions": 2,
        "sets": 7,
        "exercises_created": 2,  # Klimmzug, Cable Fly (Bankdrücken ist global)
        "exercises_reused": 1,
        "sessions_skipped": 0,
        "rows_skipped": 1,  # Laufband: nur Distanz/Dauer
    }
    db.expire_all()
    sessions = db.exec(select(WorkoutSession).order_by(WorkoutSession.started_at)).all()
    assert [s.started_at for s in sessions] == [
        datetime(2026, 1, 7, 9, 30, tzinfo=UTC),
        datetime(2026, 1, 9, 18, 0, tzinfo=UTC),
    ]
    assert sessions[0].note == "Hevy-Import: Push" and sessions[0].finished_at is not None
    bench = next(e for e in db.exec(select(Exercise)).all() if e.name == "Bankdrücken")
    sets = db.exec(
        select(SetLog)
        .where(
            SetLog.exercise_id == bench.id, SetLog.completed_at < datetime(2026, 1, 8, tzinfo=UTC)
        )
        .order_by(SetLog.set_number)
    ).all()
    assert [(s.is_warmup, s.set_type, s.weight_kg, s.reps, s.rpe) for s in sets] == [
        (True, "normal", 40, 10, None),
        (False, "normal", 80, 8, 8),
        (False, "normal", 80, 6, 10),
        (False, "drop", 60, 10, None),
    ]
    private = {e.name: e for e in db.exec(select(Exercise)).all() if e.owner_user_id is not None}
    assert private["Klimmzug"].load_type == "bodyweight"  # nur Gewicht 0
    assert private["Cable Fly"].load_type == "weight"
    first = db.exec(
        select(SessionExercise)
        .where(SessionExercise.session_id == sessions[0].id)
        .order_by(SessionExercise.position)
    ).all()
    assert [(se.note, se.group_no) for se in first] == [
        ("Sitz 4", None),
        ("", 1),
        ("", 1),
    ]  # Klimmzug und Cable Fly bilden einen Supersatz


def test_imported_supersets_and_drop_sets_are_visible_through_the_api(alice, catalog):
    upload(alice, CSV)
    sessions = alice.get(f"{API}/sessions").json()
    detail = alice.get(f"{API}/sessions/{sessions[-1]['id']}").json()
    assert [e["group_no"] for e in detail["exercises"]] == [None, 1, 1]
    assert [s["set_type"] for s in detail["exercises"][0]["sets"]] == [
        "normal",
        "normal",
        "normal",
        "drop",
    ]


def test_dry_run_counts_but_writes_nothing(alice, catalog, db):
    r = upload(alice, CSV, dry_run=True)
    assert r.json()["dry_run"] is True and r.json()["sessions"] == 2 and r.json()["sets"] == 7
    db.expire_all()
    assert db.exec(select(WorkoutSession)).all() == []
    assert [e.name for e in db.exec(select(Exercise)).all() if e.owner_user_id is not None] == []


def test_second_import_skips_existing_trainings(alice, catalog, db):
    upload(alice, CSV)
    again = upload(alice, CSV).json()
    assert (again["sessions"], again["sets"], again["sessions_skipped"]) == (0, 0, 2)
    db.expire_all()
    assert len(db.exec(select(WorkoutSession)).all()) == 2


def test_rejects_foreign_or_broken_files(alice, monkeypatch):
    foreign = upload(alice, "a,b,c\n1,2,3\n")
    assert foreign.status_code == 422 and foreign.json()["error"]["code"] == "invalid_csv"
    binary = alice.post(
        f"{API}/account/import/hevy",
        files={"file": ("x.csv", b"\xff\xfe\x00\x01", "text/csv")},
    )
    assert binary.status_code == 422 and binary.json()["error"]["code"] == "invalid_csv"
    monkeypatch.setattr(hevy, "MAX_BYTES", 10)
    big = upload(alice, CSV)
    assert big.status_code == 422 and big.json()["error"]["code"] == "file_too_large"


def test_implausible_rows_are_skipped_not_imported(alice, catalog, db):
    text = HEADER + "\n".join(
        [
            '"A","7 Jan 2026, 09:30",,"","Bankdrücken",,,0,normal,80,5000,,,',  # zu viele Wdh.
            '"A","7 Jan 2026, 09:30",,"","Bankdrücken",,,1,normal,99999,5,,,',  # zu schwer
            '"A","kein Datum",,"","Bankdrücken",,,2,normal,80,5,,,',  # Datum unlesbar
            '"A","7 Jan 2026, 09:30",,"","",,,3,normal,80,5,,,',  # ohne Übungsnamen
            '"A","7 Jan 2026, 09:30",,"","Bankdrücken",,,4,normal,80,5,,,15',  # RPE außerhalb
        ]
    )
    r = upload(alice, text).json()
    assert (r["sets"], r["rows_skipped"]) == (1, 4)
    db.expire_all()
    assert db.exec(select(SetLog)).one().rpe is None


def test_parse_time_understands_english_german_and_iso():
    expected = datetime(2026, 3, 7, 9, 30, tzinfo=UTC)
    assert hevy.parse_time("7 Mar 2026, 09:30") == expected
    assert hevy.parse_time("7 Mär 2026, 09:30") == expected
    assert hevy.parse_time("7 Mar. 2026, 09:30") == expected
    assert hevy.parse_time("2026-03-07T09:30:00") == expected
    assert hevy.parse_time("irgendwann") is None
    assert hevy.parse_time("") is None


def test_import_only_touches_the_own_account(alice, bob, catalog):
    upload(alice, CSV)
    assert bob.get(f"{API}/sessions").json() == []
    assert len(alice.get(f"{API}/sessions").json()) == 2
    names = {e["name"] for e in bob.get(f"{API}/exercises").json()}
    assert "Cable Fly" not in names  # private Übung bleibt bei Alice
