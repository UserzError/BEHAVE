"""trajectory.py - turns a recorded mouse path into a few standard numbers.

The poll records the pointer while someone decides: a list of [t_ms, x, y] points, where x and y are
relative to the area holding the two options (0 to 1 across its width and height, so screen size doesn't
matter). Mouse-tracking studies use paths like this to see *how* people moved towards their choice:
a straight line suggests an easy decision; a path that bends towards the other option suggests conflict.

We only look at the part of the path up to the moment they clicked their final choice (final_select_ms).
"""
import math

JITTER = 0.005  # horizontal moves smaller than this don't count as changing direction


def summarize(path, final_select_ms=None):
    """Returns {"path_length", "max_deviation", "x_flips"} (each None if there's too little movement).

    path_length    total distance travelled (in option-area widths/heights)
    max_deviation  furthest the pointer strayed from the straight line between its start and end point
    x_flips        how many times it changed left/right direction (a sign of wavering)
    """
    points = [(t, x, y) for t, x, y in (path or []) if final_select_ms is None or t <= final_select_ms]
    if len(points) < 2:
        return {"path_length": None, "max_deviation": None, "x_flips": None}

    length = sum(math.dist(a[1:], b[1:]) for a, b in zip(points, points[1:]))

    (_, x0, y0), (_, x1, y1) = points[0], points[-1]
    straight = math.dist((x0, y0), (x1, y1))
    if straight < 1e-9:  # ended where it started: measure distance from that spot instead
        deviation = max(math.dist((x0, y0), (x, y)) for _, x, y in points)
    else:  # distance of each point from the start->end line
        deviation = max(abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / straight for _, x, y in points)

    flips, direction, last_x = 0, 0, x0
    for _, x, _ in points[1:]:
        step = x - last_x
        if abs(step) < JITTER:
            continue
        new_direction = 1 if step > 0 else -1
        if direction and new_direction != direction:
            flips += 1
        direction, last_x = new_direction, x

    return {"path_length": round(length, 4), "max_deviation": round(deviation, 4), "x_flips": flips}
