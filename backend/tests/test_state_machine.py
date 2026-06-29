from app.detector import HydrationStateMachine
from app.models import ActionState, DetectionSignals


def signals(hand=0, neck=0, rotation=0, mouth=0, tilt=0):
    return DetectionSignals(
        hand_bottle_proximity=hand,
        neck_hand_proximity=neck,
        wrist_rotation=rotation,
        mouth_bottle_proximity=mouth,
        bottle_tilt=tilt,
    )


def test_hydration_sequence_transitions():
    machine = HydrationStateMachine()
    hand = machine.update(signals(hand=0.95, neck=0.4), "start")
    assert hand.state == ActionState.BOTTLE_IN_HAND

    cap = machine.update(signals(hand=0.9, neck=0.95, rotation=0.9), "cap")
    assert cap.state == ActionState.CAP_OPENING

    drink = machine.update(signals(hand=0.9, mouth=0.95, tilt=0.95), "drink")
    assert drink.state == ActionState.DRINKING


def test_drinking_cannot_skip_sequence():
    machine = HydrationStateMachine()
    output = machine.update(signals(hand=0.9, mouth=0.95, tilt=0.95), "drink")
    assert output.state == ActionState.IDLE

