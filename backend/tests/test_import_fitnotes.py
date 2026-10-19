import sqlite3

import pytest
from sqlmodel import func, select

from app.import_fitnotes import MARKER, import_fitnotes
from app.models import Exercise, SessionExercise, SetLog, User, WorkoutSession

from .conftest import PASSWORD


def _fitnotes_file(path):
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE Category (_id INTEGER, name TEXT);
        CREATE TABLE exercise (_id INTEGER, name TEXT, category_id INTEGER,
                               exercise_type_id INTEGER, notes TEXT);
        CREATE TABLE training_log (_id INTEGER, exercise_id INTEGER, date TEXT,
                                   metric_weight REAL, reps INTEGER, duration_seconds INTEGER);
        INSERT INTO Category VALUES (1, 'Chest'), (2, 'Back');
        INSERT INTO exercise VALUES (1, 'Fitnotes Press', 1, 0, 'Notiz'),
                                    (2, 'Pull Up', 2, 0, NULL),
                                    (3, 'Hang', 2, 1, NULL),
                                    (4, 'Unbenutzt', 1, 0, NULL);
        INSERT INTO training_log VALUES
            (1, 1, '2024-01-02', 60.0, 8, 0), (2, 1, '2024-01-02', 62.5, 6, 0),
            (3, 2, '2024-01-02', 0, 10, 0), (4, 3, '2024-01-09', 0, 0, 45);
        """
    )
    con.commit()
    con.close()


def test_import_maps_sessions_sets_and_exercises(app, db, tmp_path):
    db.add(User(email="me@example.com", password_hash=PASSWORD, display_name="Me"))
    db.commit()
    path = tmp_path / "backup.fitnotes"
    _fitnotes_file(path)

    result = import_fitnotes(db, str(path), "Me@Example.com")
    db.commit()

    assert result == {
        "exercises_created": 3,
        "exercises_reused": 0,
        "exercise_notes": 1,
        "sessions": 2,
        "sets": 4,
    }
    kinds = dict(db.exec(select(Exercise.name, Exercise.load_type)).all())
    assert kinds == {"Fitnotes Press": "weight", "Pull Up": "bodyweight", "Hang": "time"}
    assert db.exec(select(func.count()).select_from(WorkoutSession)).one() == 2
    assert db.exec(select(func.count()).select_from(SessionExercise)).one() == 3
    hang = db.exec(select(SetLog).join(Exercise).where(Exercise.name == "Hang")).one()
    assert (hang.reps, hang.weight_kg) == (45, 0.0)
    press = db.exec(select(SetLog.set_number, SetLog.weight_kg).order_by(SetLog.id)).all()[:2]
    assert press == [(1, 60.0), (2, 62.5)]
    assert db.exec(select(WorkoutSession.note)).first() == MARKER


def test_second_import_is_rejected(app, db, tmp_path):
    db.add(User(email="me@example.com", password_hash=PASSWORD, display_name="Me"))
    db.commit()
    path = tmp_path / "backup.fitnotes"
    _fitnotes_file(path)
    import_fitnotes(db, str(path), "me@example.com")
    db.commit()
    with pytest.raises(SystemExit):
        import_fitnotes(db, str(path), "me@example.com")


def test_unknown_user_is_rejected(app, db, tmp_path):
    path = tmp_path / "backup.fitnotes"
    _fitnotes_file(path)
    with pytest.raises(SystemExit):
        import_fitnotes(db, str(path), "niemand@example.com")
