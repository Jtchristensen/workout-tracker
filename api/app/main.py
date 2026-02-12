import os
from datetime import datetime, date

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func


db = SQLAlchemy()


def create_app() -> Flask:
    app = Flask(__name__)

    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://workout:workout@localhost:5432/workout",
    )
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    cors_origins = os.environ.get("CORS_ORIGINS", "*")
    CORS(app, resources={r"/api/*": {"origins": cors_origins.split(",")}})

    db.init_app(app)

    class Workout(db.Model):
        __tablename__ = "workouts"

        id = db.Column(db.Integer, primary_key=True)
        workout_date = db.Column(db.Date, nullable=False, index=True)
        activity = db.Column(db.String(120), nullable=False)
        duration_minutes = db.Column(db.Integer, nullable=True)
        notes = db.Column(db.Text, nullable=True)
        created_at = db.Column(db.DateTime, nullable=False, server_default=func.now())
        updated_at = db.Column(db.DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

        def to_dict(self):
            return {
                "id": self.id,
                "workout_date": self.workout_date.isoformat(),
                "activity": self.activity,
                "duration_minutes": self.duration_minutes,
                "notes": self.notes,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})

    @app.get("/api/workouts")
    def list_workouts():
        # Optional filters: from=YYYY-MM-DD, to=YYYY-MM-DD
        from_s = request.args.get("from")
        to_s = request.args.get("to")

        q = Workout.query
        if from_s:
            q = q.filter(Workout.workout_date >= date.fromisoformat(from_s))
        if to_s:
            q = q.filter(Workout.workout_date <= date.fromisoformat(to_s))

        workouts = q.order_by(Workout.workout_date.desc(), Workout.id.desc()).all()
        return jsonify([w.to_dict() for w in workouts])

    @app.post("/api/workouts")
    def create_workout():
        data = request.get_json(force=True) or {}

        workout_date = data.get("workout_date")
        activity = (data.get("activity") or "").strip()

        if not workout_date:
            return jsonify({"error": "workout_date is required (YYYY-MM-DD)"}), 400
        if not activity:
            return jsonify({"error": "activity is required"}), 400

        w = Workout(
            workout_date=date.fromisoformat(workout_date),
            activity=activity,
            duration_minutes=data.get("duration_minutes"),
            notes=data.get("notes"),
        )
        db.session.add(w)
        db.session.commit()
        return jsonify(w.to_dict()), 201

    @app.get("/api/workouts/<int:workout_id>")
    def get_workout(workout_id: int):
        w = Workout.query.get_or_404(workout_id)
        return jsonify(w.to_dict())

    @app.put("/api/workouts/<int:workout_id>")
    def update_workout(workout_id: int):
        w = Workout.query.get_or_404(workout_id)
        data = request.get_json(force=True) or {}

        if "workout_date" in data:
            w.workout_date = date.fromisoformat(data["workout_date"])
        if "activity" in data:
            w.activity = (data.get("activity") or "").strip()
        if "duration_minutes" in data:
            w.duration_minutes = data.get("duration_minutes")
        if "notes" in data:
            w.notes = data.get("notes")

        db.session.commit()
        return jsonify(w.to_dict())

    @app.delete("/api/workouts/<int:workout_id>")
    def delete_workout(workout_id: int):
        w = Workout.query.get_or_404(workout_id)
        db.session.delete(w)
        db.session.commit()
        return "", 204

    # Create tables on boot (MVP). In production you'd use Alembic migrations.
    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
