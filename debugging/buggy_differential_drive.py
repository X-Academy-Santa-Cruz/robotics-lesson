"""
A standalone, deliberately buggy copy of the differential-steering math from
the thrusters lesson's ThrusterRig.drive(). No hardware, no venv, no Pi
required - this exists purely so you can practice debugging techniques on
any laptop.

Something is wrong with it. Find it using the techniques in this lesson.
"""


def clamp(value: float) -> float:
    return max(-1.0, min(1.0, value))


def differential_drive(forward: float, turn: float):
    """Should mirror ThrusterRig.drive(): left = forward + turn,
    right = forward - turn."""
    left = forward + turn
    right = forward + turn
    return clamp(left), clamp(right)


def run_test_cases():
    cases = [
        ("straight ahead", 1.0, 0.0),
        ("spin in place", 0.0, 1.0),
        ("curve while moving forward", 0.5, 0.5),
    ]
    for label, forward, turn in cases:
        left, right = differential_drive(forward, turn)
        print(f"{label}: forward={forward}, turn={turn} -> left={left}, right={right}")


if __name__ == "__main__":
    run_test_cases()
