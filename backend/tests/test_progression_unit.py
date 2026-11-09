from app.services.progression import suggest


def s(reps, weight, rpe=None, warm=False):
    return {"reps": reps, "weight_kg": weight, "is_warmup": warm, "rpe": rpe}


def test_keine_historie_kein_vorschlag():
    assert suggest([], 8, 12, "weight") is None


def test_zeitübung_kein_vorschlag():
    assert suggest([s(30, 0)], 8, 12, "time") is None


def test_nur_aufwärmsätze_kein_vorschlag():
    assert suggest([s(10, 40, warm=True)], 8, 12, "weight") is None


def test_obergrenze_erreicht_erhöht():
    sets = [s(12, 80), s(12, 80), s(12, 80)]
    assert suggest(sets, 8, 12, "weight") == {"kind": "increase", "weight_kg": 80, "reps": 8}


def test_ein_satz_unter_obergrenze_steigert_wiederholungen():
    sets = [s(12, 80), s(11, 80), s(10, 80)]
    assert suggest(sets, 8, 12, "weight") == {"kind": "reps", "weight_kg": 80, "reps": 11}


def test_nur_sätze_am_top_gewicht_zählen():
    # Backoff-Satz mit weniger Gewicht darf die Erhöhung nicht verhindern
    sets = [s(12, 80), s(12, 80), s(8, 60)]
    assert suggest(sets, 8, 12, "weight")["kind"] == "increase"


def test_hohes_rpe_hält_das_gewicht():
    sets = [s(12, 80, rpe=9.5), s(12, 80, rpe=10)]
    assert suggest(sets, 8, 12, "weight") == {"kind": "hold", "weight_kg": 80, "reps": 12}


def test_rpe_unter_schwelle_erhöht_weiter():
    sets = [s(12, 80, rpe=9), s(12, 80, rpe=9)]
    assert suggest(sets, 8, 12, "weight")["kind"] == "increase"


def test_aufwärmsätze_zählen_nicht():
    sets = [s(5, 40, warm=True), s(12, 80), s(12, 80)]
    assert suggest(sets, 8, 12, "weight")["weight_kg"] == 80


def test_assisted_top_ist_kleinste_unterstützung():
    sets = [s(12, 30), s(12, 20), s(12, 20)]
    assert suggest(sets, 8, 12, "assisted") == {"kind": "increase", "weight_kg": 20, "reps": 8}
