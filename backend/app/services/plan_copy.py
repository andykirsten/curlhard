"""Klonen von Plänen (Trainingstage und Plan-Übungen) für Duplizieren und Übernehmen."""

from sqlmodel import Session, select

from app.models import Exercise, ExerciseSecondaryMuscle, Plan, PlanDay, PlanExercise


def clone_plan(
    db: Session,
    src: Plan,
    target_user_id: int,
    name: str,
    exercise_map: dict[int, int] | None = None,
) -> Plan:
    """Legt eine Kopie von `src` für `target_user_id` an. Der Aufrufer committet.

    `exercise_map` bildet Übungs-IDs der Quelle auf Übungs-IDs des Ziels ab; nicht
    enthaltene IDs bleiben unverändert (z. B. globale Übungen).
    """
    mapping = exercise_map or {}
    copy = Plan(user_id=target_user_id, name=name, description=src.description)
    db.add(copy)
    db.flush()
    days = db.exec(
        select(PlanDay)
        .where(PlanDay.user_id == src.user_id, PlanDay.plan_id == src.id)
        .order_by(PlanDay.position, PlanDay.id)
    ).all()
    for day in days:
        new_day = PlanDay(
            user_id=target_user_id,  # type: ignore[arg-type]
            plan_id=copy.id,  # type: ignore[arg-type]
            name=day.name,
            weekdays=list(day.weekdays),
            position=day.position,
        )
        db.add(new_day)
        db.flush()
        items = db.exec(
            select(PlanExercise)
            .where(PlanExercise.user_id == src.user_id, PlanExercise.plan_day_id == day.id)
            .order_by(PlanExercise.position, PlanExercise.id)
        ).all()
        for pe in items:
            db.add(
                PlanExercise(
                    user_id=target_user_id,  # type: ignore[arg-type]
                    plan_day_id=new_day.id,  # type: ignore[arg-type]
                    exercise_id=mapping.get(pe.exercise_id, pe.exercise_id),
                    position=pe.position,
                    target_sets=pe.target_sets,
                    target_reps_min=pe.target_reps_min,
                    target_reps_max=pe.target_reps_max,
                    target_rest_sec=pe.target_rest_sec,
                    note=pe.note,
                )
            )
    return copy


def private_exercise_map(db: Session, src: Plan, target_user_id: int) -> dict[int, int]:
    """Bildet private Übungen der Quelle auf Übungen des Ziels ab.

    Globale Übungen und eigene Übungen des Ziels bleiben unverändert. Fremde private
    Übungen werden als private Kopie des Ziels angelegt, sofern nicht schon eine Übung
    gleichen Namens existiert.
    """
    exercise_ids = set(
        db.exec(
            select(PlanExercise.exercise_id)
            .join(PlanDay, PlanDay.id == PlanExercise.plan_day_id)  # type: ignore[arg-type]
            .where(PlanDay.plan_id == src.id, PlanExercise.user_id == src.user_id)
        ).all()
    )
    mapping: dict[int, int] = {}
    for ex_id in exercise_ids:
        ex = db.get(Exercise, ex_id)
        if ex is None or ex.owner_user_id is None or ex.owner_user_id == target_user_id:
            continue
        own = db.exec(
            select(Exercise).where(
                Exercise.owner_user_id == target_user_id, Exercise.name == ex.name
            )
        ).first()
        if own is not None and not own.is_active:
            own.is_active = True
            db.add(own)
        if own is None:
            own = Exercise(
                name=ex.name,
                description=ex.description,
                owner_user_id=target_user_id,
                primary_muscle_group_id=ex.primary_muscle_group_id,
                equipment_id=ex.equipment_id,
                load_type=ex.load_type,
            )
            db.add(own)
            db.flush()
            for muscle in db.exec(
                select(ExerciseSecondaryMuscle).where(ExerciseSecondaryMuscle.exercise_id == ex.id)
            ).all():
                db.add(
                    ExerciseSecondaryMuscle(
                        exercise_id=own.id,  # type: ignore[arg-type]
                        muscle_group_id=muscle.muscle_group_id,
                    )
                )
        mapping[ex_id] = own.id  # type: ignore[assignment]
    return mapping
