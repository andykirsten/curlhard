from pydantic import BaseModel


class ImportResult(BaseModel):
    dry_run: bool
    sessions: int
    sets: int
    exercises_created: int
    exercises_reused: int
    #: Trainings, deren Startzeit schon vorhanden ist (kein Doppelimport)
    sessions_skipped: int
    #: Zeilen ohne Wiederholungen oder mit unplausiblen Werten
    rows_skipped: int
