import random
from collections import Counter


def tally_votes(votes: dict[str, list[str]], num_morps: int, seed: int) -> list[str]:
    """Return the IDs of the num_morps most-voted players.

    Ties are broken deterministically using the provided seed.
    votes: {voter_id: [accused_id, ...]}
    """
    counts: Counter = Counter()
    for accused_list in votes.values():
        for accused_id in accused_list:
            counts[accused_id] += 1

    # Sort by vote count descending, then shuffle tied groups deterministically
    rng = random.Random(seed)
    max_votes = sorted(counts.values(), reverse=True)
    cutoff = max_votes[num_morps - 1] if len(max_votes) >= num_morps else 0

    above_cutoff = [pid for pid, c in counts.items() if c > cutoff]
    at_cutoff = [pid for pid, c in counts.items() if c == cutoff]
    rng.shuffle(at_cutoff)

    needed = num_morps - len(above_cutoff)
    return above_cutoff + at_cutoff[:needed]


def resolve_accusation(
    accused_ids: list[str],
    player_roles: dict[str, str],  # player_id -> "morp" | "safe"
) -> dict:
    """Determine the outcome of an accusation phase.

    Returns a result dict describing what must happen next.
    """
    accused_morps = [pid for pid in accused_ids if player_roles.get(pid) == "morp"]
    accused_safe = [pid for pid in accused_ids if player_roles.get(pid) == "safe"]

    return {
        "accused_morps": accused_morps,
        "accused_safe": accused_safe,
        "morp_must_guess": len(accused_morps) > 0,
        "morp_gets_to_damage": len(accused_morps) == 0,
    }
