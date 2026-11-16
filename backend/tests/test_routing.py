import itertools
import random

import pytest

from app.services.routing import (
    Point,
    Stop,
    Task,
    is_feasible,
    stops_for,
    ortools_available,
    plan_route,
    route_length,
    solve_heuristic,
    solve_ortools,
)

START = Point(12.9716, 77.5946)  # Bengaluru centre


def random_tasks(n: int, seed: int) -> list[Task]:
    rng = random.Random(seed)
    def pt():
        return Point(START.lat + rng.uniform(-0.08, 0.08), START.lng + rng.uniform(-0.08, 0.08))
    return [Task(i + 1, pt(), pt()) for i in range(n)]


def brute_force_optimum(start: Point, tasks: list[Task]) -> float:
    stops = [s for t in tasks for s in stops_for(t)]
    best = float("inf")
    for perm in itertools.permutations(stops):
        if is_feasible(list(perm)):
            best = min(best, route_length(start, list(perm)))
    return best


def naive_length(start: Point, tasks: list[Task]) -> float:
    stops = [s for t in tasks for s in (Stop(t.id, "pickup", t.pickup), Stop(t.id, "dropoff", t.dropoff))]
    return route_length(start, stops)


def test_feasibility_rule():
    p, d = Point(0, 0), Point(0, 1)
    assert is_feasible([Stop(1, "pickup", p), Stop(1, "dropoff", d)])
    assert not is_feasible([Stop(1, "dropoff", d), Stop(1, "pickup", p)])


def test_obvious_case_batches_pickups_on_the_way():
    # Two pickups just east of the start, both drop-offs far east: the best route grabs both first.
    tasks = [
        Task(1, Point(12.9716, 77.6046), Point(12.9716, 77.7046)),
        Task(2, Point(12.9716, 77.6146), Point(12.9716, 77.7146)),
    ]
    route = plan_route(START, tasks)
    assert [s.kind for s in route.stops] == ["pickup", "pickup", "dropoff", "dropoff"]
    assert route.total_km < naive_length(START, tasks)
    assert route.minutes > 0


@pytest.mark.parametrize("seed", range(6))
def test_heuristic_is_feasible_and_near_optimal(seed):
    tasks = random_tasks(3, seed)
    stops = solve_heuristic(START, tasks)
    assert is_feasible(stops) and len(stops) == 6
    optimum = brute_force_optimum(START, tasks)
    assert route_length(START, stops) <= optimum * 1.10  # within 10% of the true optimum


@pytest.mark.skipif(not ortools_available(), reason="OR-Tools not installed")
@pytest.mark.parametrize("seed", range(6))
def test_ortools_finds_the_optimum_on_small_cases(seed):
    tasks = random_tasks(3, seed)
    stops = solve_ortools(START, tasks)
    assert stops is not None and is_feasible(stops) and len(stops) == 6
    assert route_length(START, stops) == pytest.approx(brute_force_optimum(START, tasks), rel=0.01)


@pytest.mark.parametrize("seed", range(4))
def test_heuristic_close_to_ortools_on_bigger_cases(seed):
    tasks = random_tasks(6, seed)  # beyond exhaustive search
    heur = route_length(START, solve_heuristic(START, tasks))
    if ortools_available():
        ref = route_length(START, solve_ortools(START, tasks, time_limit_s=2))
        assert heur <= ref * 1.10
    assert heur <= naive_length(START, tasks)


def test_plan_route_beats_naive_order_on_bigger_cases():
    for seed in range(5):
        tasks = random_tasks(7, seed)
        route = plan_route(START, tasks)
        assert is_feasible(route.stops) and len(route.stops) == 14
        assert route.total_km <= naive_length(START, tasks)
        assert route.solver in ("or-tools", "heuristic")


def food_first_tasks():
    # Same layout as the demo: chairs far east, biryani near the start. Distance alone would grab the chairs first.
    chairs = Task(1, Point(12.9698, 77.7500), Point(13.0031, 77.5643))
    biryani = Task(2, Point(12.9352, 77.6245), Point(12.9166, 77.6101), perishable=True)
    return [chairs, biryani]


def test_food_goes_straight_to_its_drop_off():
    p, d = stops_for(Task(9, Point(0, 0), Point(0, 1), perishable=True))
    other = Stop(5, "pickup", Point(1, 1))
    assert is_feasible([p, d, other])
    assert not is_feasible([p, other, d])  # detour with food on board
    assert not is_feasible([p])  # food left on board


@pytest.mark.parametrize("use_ortools", [False, True])
def test_every_solver_respects_the_food_rule(use_ortools):
    if use_ortools and not ortools_available():
        pytest.skip("OR-Tools not installed")
    tasks = food_first_tasks()
    route = plan_route(START, tasks, use_ortools=use_ortools)
    kinds = [(s.task_id, s.kind) for s in route.stops]
    i = kinds.index((2, "pickup"))
    assert kinds[i + 1] == (2, "dropoff")
    assert is_feasible(route.stops)
    if use_ortools:
        assert route.solver in ("or-tools", "heuristic")


@pytest.mark.skipif(not ortools_available(), reason="OR-Tools not installed")
@pytest.mark.parametrize("seed", range(4))
def test_food_rule_with_ortools_on_mixed_tasks(seed):
    tasks = [Task(t.id, t.pickup, t.dropoff, perishable=(t.id % 2 == 0)) for t in random_tasks(5, seed)]
    stops = solve_ortools(START, tasks)
    assert stops is not None and is_feasible(stops) and len(stops) == 10
    heur = solve_heuristic(START, tasks)
    assert is_feasible(heur) and len(heur) == 10


def test_empty_route():
    route = plan_route(START, [])
    assert route.stops == [] and route.total_km == 0
