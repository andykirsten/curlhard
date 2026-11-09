"""Progressions-Vorschlag (doppelte Progression) aus dem letzten Training einer Übung."""

#: Ab dieser Anstrengung bleibt das Gewicht, auch wenn die Wiederholungsobergrenze erreicht ist
RPE_HOLD = 9.5


def suggest(last_sets: list[dict], reps_min: int, reps_max: int, load_type: str) -> dict | None:
    """Vorschlag für das nächste Training.

    - ``increase``: alle Sätze am Top-Gewicht haben die Obergrenze erreicht (Anstrengung unter
      ``RPE_HOLD``). ``weight_kg`` ist noch das alte Top-Gewicht, die Schrittweite addiert das
      Frontend (bei ``assisted`` heißt „mehr“ weniger Unterstützung); ``reps`` = Untergrenze.
    - ``reps``: gleiches Gewicht, eine Wiederholung mehr als der schwächste Satz (höchstens
      Obergrenze).
    - ``hold``: gleiches Gewicht und gleiche Wiederholungen, weil es schon sehr hart war.
    """
    # Drop- und Backoff-Sätze sagen nichts über die Arbeitslast
    work = [s for s in last_sets if not s["is_warmup"] and s.get("set_type", "normal") == "normal"]
    if load_type == "time" or not work:
        return None
    weights = [s["weight_kg"] for s in work]
    # Bei assisted ist weniger Unterstützung (kleineres Gewicht) die schwerere Last
    top = min(weights) if load_type == "assisted" else max(weights)
    at_top = [s for s in work if s["weight_kg"] == top]
    weakest = min(s["reps"] for s in at_top)
    rpes = [s["rpe"] for s in at_top if s["rpe"] is not None]
    if rpes and max(rpes) >= RPE_HOLD:
        return {"kind": "hold", "weight_kg": top, "reps": min(weakest, reps_max)}
    if weakest >= reps_max:
        return {"kind": "increase", "weight_kg": top, "reps": reps_min}
    return {"kind": "reps", "weight_kg": top, "reps": min(weakest + 1, reps_max)}
