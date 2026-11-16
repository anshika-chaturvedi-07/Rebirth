"""Volunteer route planning: a pickup-and-delivery routing problem.

Given a start point and N delivery tasks (each a pickup P_i and a drop-off D_i), find an open route
(no return to start) that visits every stop with P_i before D_i and minimises distance.
Food rule: a perishable task's drop-off must come straight after its pickup (no detours with food on board).

Two solvers:
  * OR-Tools (Google's routing solver) with pickup-delivery constraints and guided local search, when installed.
  * A pure-Python fallback: cheapest feasible insertion, then "relocate a task" local search.
`plan_route` runs both when possible and returns the shorter result.

Distances: straight-line (haversine) × a road-circuity factor. Real road distances (OSRM) can replace
`distance_km` later without touching the solvers.
"""

import random
from dataclasses import dataclass
from itertools import pairwise

from app.services.geo import haversine_km

ROAD_FACTOR = 1.35          # city roads are ~35% longer than straight lines
AVG_SPEED_KMH = 18          # Bengaluru traffic, two-wheeler/car average
MINUTES_PER_STOP = 6        # park, hand over, a photo for proof


@dataclass(frozen=True)
class Point:
    lat: float
    lng: float


@dataclass(frozen=True)
class Task:
    id: int
    pickup: Point
    dropoff: Point
    perishable: bool = False  # food: deliver straight away


@dataclass(frozen=True)
class Stop:
    task_id: int
    kind: str  # "pickup" | "dropoff"
    point: Point
    perishable: bool = False


def stops_for(task: Task) -> tuple[Stop, Stop]:
    return (Stop(task.id, "pickup", task.pickup, task.perishable), Stop(task.id, "dropoff", task.dropoff, task.perishable))


@dataclass
class Route:
    stops: list[Stop]
    legs_km: list[float]
    total_km: float
    minutes: int
    solver: str


def distance_km(a: Point, b: Point) -> float:
    return haversine_km(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR


def route_length(start: Point, stops: list[Stop]) -> float:
    pts = [start] + [s.point for s in stops]
    return sum(distance_km(a, b) for a, b in pairwise(pts))


def is_feasible(stops: list[Stop]) -> bool:
    """Every pickup before its drop-off, and perishable drop-offs immediately after their pickup."""
    picked: set[int] = set()
    prev: Stop | None = None
    for s in stops:
        if prev is not None and prev.perishable and prev.kind == "pickup":
            if not (s.task_id == prev.task_id and s.kind == "dropoff"):
                return False
        if s.kind == "pickup":
            picked.add(s.task_id)
        elif s.task_id not in picked:
            return False
        prev = s
    return not (prev is not None and prev.perishable and prev.kind == "pickup")


def _build(start: Point, stops: list[Stop], solver: str) -> Route:
    pts = [start] + [s.point for s in stops]
    legs = [round(distance_km(a, b), 2) for a, b in pairwise(pts)]
    total = round(sum(legs), 2)
    minutes = round(total / AVG_SPEED_KMH * 60 + MINUTES_PER_STOP * len(stops))
    return Route(stops, legs, total, minutes, solver)


# ---------------------------------------------------------------- heuristic
def _insert_best(start: Point, route: list[Stop], task: Task) -> list[Stop]:
    p, d = stops_for(task)
    best, best_len = route + [p, d], float("inf")  # appending at the end is always feasible
    for i in range(len(route) + 1):
        with_p = route[:i] + [p] + route[i:]
        last_j = i + 1 if task.perishable else len(with_p)  # food: drop-off right after pickup
        for j in range(i + 1, last_j + 1):
            cand = with_p[:j] + [d] + with_p[j:]
            if not is_feasible(cand):
                continue
            length = route_length(start, cand)
            if length < best_len:
                best, best_len = cand, length
    return best


EXACT_MAX_TASKS = 4  # (2n)!/2^n feasible orders: 2,520 for n = 4, so exhaustive search is instant


def _exact(start: Point, tasks: list[Task]) -> list[Stop]:
    """Depth-first search over feasible orders with pruning: the true optimum for small n."""
    best: list[Stop] = []
    best_len = float("inf")
    pending = {t.id: t for t in tasks}

    def dfs(route: list[Stop], length: float, here: Point, picked: set[int], done: set[int]) -> None:
        nonlocal best, best_len
        if length >= best_len:
            return
        if len(done) == len(tasks):
            best, best_len = list(route), length
            return
        last = route[-1] if route else None
        if last is not None and last.perishable and last.kind == "pickup":  # food on board: go straight there
            t = pending[last.task_id]
            dfs(route + [stops_for(t)[1]], length + distance_km(here, t.dropoff), t.dropoff, picked, done | {t.id})
            return
        for tid, t in pending.items():
            p, d = stops_for(t)
            if tid not in picked:
                dfs(route + [p], length + distance_km(here, t.pickup), t.pickup, picked | {tid}, done)
            elif tid not in done:
                dfs(route + [d], length + distance_km(here, t.dropoff), t.dropoff, picked, done | {tid})

    dfs([], 0.0, start, set(), set())
    return best


def _local_search(start: Point, route: list[Stop], tasks: list[Task]) -> list[Stop]:
    """Repeat two moves until neither helps: re-insert a whole task at its best place; swap neighbouring stops."""
    length = route_length(start, route)
    improved = True
    while improved:
        improved = False
        for t in tasks:
            cand = _insert_best(start, [s for s in route if s.task_id != t.id], t)
            cand_len = route_length(start, cand)
            if cand_len + 1e-9 < length:
                route, length, improved = cand, cand_len, True
        for i in range(len(route) - 1):
            cand = route[:i] + [route[i + 1], route[i]] + route[i + 2 :]
            if is_feasible(cand):
                cand_len = route_length(start, cand)
                if cand_len + 1e-9 < length:
                    route, length, improved = cand, cand_len, True
    return route


def solve_heuristic(start: Point, tasks: list[Task], restarts: int = 6) -> list[Stop]:
    if len(tasks) <= EXACT_MAX_TASKS:
        return _exact(start, tasks)
    # several insertion orders (deterministic), each polished by local search; keep the best
    orders = [
        sorted(tasks, key=lambda t: distance_km(start, t.pickup)),
        sorted(tasks, key=lambda t: -distance_km(start, t.dropoff)),
    ]
    rng = random.Random(len(tasks))
    for _ in range(restarts):
        shuffled = list(tasks)
        rng.shuffle(shuffled)
        orders.append(shuffled)
    best: list[Stop] = []
    best_len = float("inf")
    for order in orders:
        route: list[Stop] = []
        for t in order:
            route = _insert_best(start, route, t)
        route = _local_search(start, route, tasks)
        if (length := route_length(start, route)) < best_len:
            best, best_len = route, length
    return best


# ---------------------------------------------------------------- OR-Tools
def ortools_available() -> bool:
    try:
        import ortools  # noqa: F401, PLC0415
    except ImportError:
        return False
    return True


def solve_ortools(start: Point, tasks: list[Task], time_limit_s: float = 1.0) -> list[Stop] | None:
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2  # noqa: PLC0415

    # node 0 = start, then pickup/dropoff per task, last node = free "end" (open route)
    stops = [s for t in tasks for s in stops_for(t)]
    points = [start] + [s.point for s in stops]
    n = len(points) + 1
    end = n - 1

    def metres(i: int, j: int) -> int:
        if j == end or i == end:
            return 0  # finishing anywhere is free
        return int(distance_km(points[i], points[j]) * 1000)

    manager = pywrapcp.RoutingIndexManager(n, 1, [0], [end])
    routing = pywrapcp.RoutingModel(manager)
    transit = routing.RegisterTransitCallback(lambda a, b: metres(manager.IndexToNode(a), manager.IndexToNode(b)))
    routing.SetArcCostEvaluatorOfAllVehicles(transit)
    routing.AddDimension(transit, 0, 10_000_000, True, "distance")
    dist = routing.GetDimensionOrDie("distance")
    for k in range(len(tasks)):
        p_idx, d_idx = manager.NodeToIndex(1 + 2 * k), manager.NodeToIndex(2 + 2 * k)
        routing.AddPickupAndDelivery(p_idx, d_idx)
        routing.solver().Add(routing.VehicleVar(p_idx) == routing.VehicleVar(d_idx))
        routing.solver().Add(dist.CumulVar(p_idx) <= dist.CumulVar(d_idx))
        if tasks[k].perishable:  # food: the stop right after the pickup is its drop-off
            routing.solver().Add(routing.NextVar(p_idx) == d_idx)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromMilliseconds(int(time_limit_s * 1000))
    solution = routing.SolveWithParameters(params)
    if solution is None:
        return None
    order: list[Stop] = []
    idx = solution.Value(routing.NextVar(routing.Start(0)))
    while not routing.IsEnd(idx):
        node = manager.IndexToNode(idx)
        order.append(stops[node - 1])
        idx = solution.Value(routing.NextVar(idx))
    return order


def plan_route(start: Point, tasks: list[Task], use_ortools: bool = True) -> Route:
    if not tasks:
        return _build(start, [], "none")
    best = _build(start, solve_heuristic(start, tasks), "heuristic")
    if use_ortools and ortools_available():
        stops = solve_ortools(start, tasks)
        if stops and is_feasible(stops) and len(stops) == 2 * len(tasks):
            candidate = _build(start, stops, "or-tools")
            if candidate.total_km <= best.total_km + 1e-6:
                best = candidate
    return best
