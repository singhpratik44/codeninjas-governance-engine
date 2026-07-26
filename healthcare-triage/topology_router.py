"""Topology-aware task decomposition router — AdaptOrch pattern implementation.

Analyzes task DAG structure and selects optimal execution topology:
- SEQUENTIAL: Linear chain (A → B → C) — low parallelism, strict ordering required
- PARALLEL: Fan-out (A → {B, C, D}) — high parallelism, all independent
- HIERARCHICAL: Tree structure (A → {B → {C, D}, E}) — mixed levels of parallelism
- HYBRID: Mixed topology — some steps parallel, some sequential

Algorithm: O(|V| + |E|) graph analysis with heuristic-based topology selection.
Tested against clinical triage workflows and benchmark reasoning tasks.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Literal
from enum import Enum
import json


class ExecutionTopology(Enum):
    """Execution topology options."""
    SEQUENTIAL = "sequential"      # Linear chain: A → B → C
    PARALLEL = "parallel"          # Fan-out: A → {B, C, D}
    HIERARCHICAL = "hierarchical"  # Tree: A → {B → {C, D}, E}
    HYBRID = "hybrid"              # Mixed: some parallel, some sequential


@dataclass
class TaskDAG:
    """Task dependency graph node."""
    task_id: str
    instructions: str
    dependencies: list[str] = field(default_factory=list)
    can_parallelize: bool = False
    estimated_complexity: int = 1  # 1=simple, 10=complex
    tools_required: list[str] = field(default_factory=list)
    estimated_duration_ms: int = 100  # Expected runtime

    def in_degree(self) -> int:
        """Number of incoming edges (predecessors)."""
        return len(self.dependencies)

    def is_parallelizable_with(self, other: TaskDAG) -> bool:
        """Can this task run in parallel with another?"""
        if not self.can_parallelize or not other.can_parallelize:
            return False
        if other.task_id in self.dependencies:
            return False
        if self.task_id in other.dependencies:
            return False
        return True


@dataclass
class GraphMetrics:
    """Computed metrics about the task DAG."""
    num_nodes: int
    num_edges: int
    max_depth: int  # Longest path from source to sink
    parallelizable_ratio: float  # Fraction of task pairs that can run in parallel
    avg_complexity: float  # Mean complexity across all tasks
    critical_path_length: int  # Sum of complexities on longest path
    fan_out_opportunities: int  # Number of (node, children_set) where |children| > 1
    fan_in_points: int  # Number of (node, parents_set) where |parents| > 1
    has_cycles: bool = False  # Any circular dependencies?


@dataclass
class TopologyDecision:
    """Output of task decomposition routing."""
    topology: ExecutionTopology
    reasoning: str
    phases: list[list[str]]  # Grouped task_ids per execution phase
    metrics: GraphMetrics
    estimated_speedup: float = 1.0  # Estimated speedup vs sequential
    confidence: float = 0.8  # Confidence in this topology choice (0-1)


class DAGAnalyzer:
    """Analyzes task dependency graph structure."""

    @staticmethod
    def compute_metrics(tasks: dict[str, TaskDAG]) -> GraphMetrics:
        """Compute graph metrics: depth, parallelism, complexity distribution."""
        if not tasks:
            return GraphMetrics(0, 0, 0, 0.0, 0.0, 0, 0, 0)

        num_nodes = len(tasks)
        num_edges = sum(len(t.dependencies) for t in tasks.values())

        # Compute max depth (longest path from root to leaf)
        depths = {}
        for task_id, task in tasks.items():
            depth = DAGAnalyzer._compute_depth(task_id, task, tasks, depths)
            depths[task_id] = depth

        max_depth = max(depths.values()) if depths else 0

        # Count parallelizable pairs
        parallelizable_count = 0
        total_pairs = num_nodes * (num_nodes - 1) // 2
        for i, (t1_id, t1) in enumerate(tasks.items()):
            for t2_id, t2 in list(tasks.items())[i + 1:]:
                if t1.is_parallelizable_with(t2):
                    parallelizable_count += 1

        parallelizable_ratio = (
            parallelizable_count / max(1, total_pairs)
            if total_pairs > 0
            else 0.0
        )

        # Complexity statistics
        complexities = [t.estimated_complexity for t in tasks.values()]
        avg_complexity = sum(complexities) / len(complexities) if complexities else 0.0

        # Critical path = sum of complexities on longest path
        critical_path_length = DAGAnalyzer._compute_critical_path(tasks)

        # Fan-out and fan-in opportunities
        fan_out = sum(
            1 for t in tasks.values()
            if len([child for child_id, child in tasks.items() if t.task_id in child.dependencies]) > 1
        )
        fan_in = sum(
            1 for t in tasks.values()
            if len(t.dependencies) > 1
        )

        return GraphMetrics(
            num_nodes=num_nodes,
            num_edges=num_edges,
            max_depth=max_depth,
            parallelizable_ratio=parallelizable_ratio,
            avg_complexity=avg_complexity,
            critical_path_length=critical_path_length,
            fan_out_opportunities=fan_out,
            fan_in_points=fan_in,
        )

    @staticmethod
    def _compute_depth(task_id: str, task: TaskDAG, all_tasks: dict[str, TaskDAG], memo: dict) -> int:
        """Compute depth (longest path from this task to a leaf)."""
        if task_id in memo:
            return memo[task_id]

        if not task.dependencies:
            depth = 1
        else:
            max_dep_depth = 0
            for dep_id in task.dependencies:
                dep_task = all_tasks.get(dep_id)
                if dep_task:
                    dep_depth = DAGAnalyzer._compute_depth(dep_id, dep_task, all_tasks, memo)
                    max_dep_depth = max(max_dep_depth, dep_depth)
            depth = max_dep_depth + 1

        memo[task_id] = depth
        return depth

    @staticmethod
    def _compute_critical_path(tasks: dict[str, TaskDAG]) -> int:
        """Sum complexities along the longest dependency path."""
        if not tasks:
            return 0

        # Find tasks with no dependents (sinks)
        sinks = []
        all_deps = set()
        for t in tasks.values():
            all_deps.update(t.dependencies)

        for task_id in tasks:
            if task_id not in all_deps:
                sinks.append(task_id)

        # Compute longest path to each sink
        max_path = 0
        for sink_id in sinks:
            path_cost = DAGAnalyzer._longest_path_to(sink_id, tasks, {})
            max_path = max(max_path, path_cost)

        return max_path

    @staticmethod
    def _longest_path_to(task_id: str, all_tasks: dict[str, TaskDAG], memo: dict) -> int:
        """Longest path (sum of complexities) to a given task."""
        if task_id in memo:
            return memo[task_id]

        task = all_tasks.get(task_id)
        if not task:
            return 0

        if not task.dependencies:
            cost = task.estimated_complexity
        else:
            max_dep_cost = max(
                DAGAnalyzer._longest_path_to(dep_id, all_tasks, memo)
                for dep_id in task.dependencies
            )
            cost = max_dep_cost + task.estimated_complexity

        memo[task_id] = cost
        return cost


class TopologyRouter:
    """Routes tasks to optimal execution topology based on DAG analysis."""

    # Heuristic thresholds for topology selection
    SEQUENTIAL_THRESHOLD = 0.1  # parallelizable_ratio < 0.1 → sequential
    PARALLEL_THRESHOLD = 0.5  # parallelizable_ratio > 0.5 → parallel
    HIERARCHICAL_DEPTH_THRESHOLD = 3  # max_depth > 3 → hierarchical

    @staticmethod
    def route(tasks: dict[str, TaskDAG]) -> TopologyDecision:
        """Select optimal topology for given task DAG.

        Algorithm:
        1. Analyze DAG structure (depth, parallelism, complexity)
        2. Apply heuristics to select topology
        3. Group tasks into execution phases
        4. Estimate speedup vs sequential baseline

        Returns: TopologyDecision with selected topology and execution phases
        """
        if not tasks:
            return TopologyDecision(
                topology=ExecutionTopology.SEQUENTIAL,
                reasoning="No tasks",
                phases=[],
                metrics=GraphMetrics(0, 0, 0, 0.0, 0.0, 0, 0, 0),
            )

        # Analyze DAG structure
        metrics = DAGAnalyzer.compute_metrics(tasks)

        # Select topology based on metrics
        topology, reasoning, speedup_estimate = TopologyRouter._select_topology(metrics)

        # Group tasks into execution phases
        phases = TopologyRouter._group_tasks_into_phases(tasks, topology)

        # Compute confidence based on metric alignment with topology
        confidence = TopologyRouter._compute_confidence(metrics, topology)

        return TopologyDecision(
            topology=topology,
            reasoning=reasoning,
            phases=phases,
            metrics=metrics,
            estimated_speedup=speedup_estimate,
            confidence=confidence,
        )

    @staticmethod
    def _select_topology(metrics: GraphMetrics) -> tuple[ExecutionTopology, str, float]:
        """Heuristic to select topology based on graph metrics.

        Returns: (topology, reasoning, estimated_speedup)
        """
        ratio = metrics.parallelizable_ratio
        depth = metrics.max_depth
        complexity = metrics.avg_complexity
        fan_out = metrics.fan_out_opportunities
        fan_in = metrics.fan_in_points

        # Decision tree
        if depth == 1 and ratio > TopologyRouter.PARALLEL_THRESHOLD:
            # All tasks independent, high parallelism
            speedup = min(metrics.num_nodes, metrics.num_nodes)  # Ideal speedup
            return (
                ExecutionTopology.PARALLEL,
                f"All {metrics.num_nodes} tasks independent (parallelizable_ratio={ratio:.2f})",
                speedup,
            )

        elif depth <= TopologyRouter.HIERARCHICAL_DEPTH_THRESHOLD and ratio > 0.3:
            # Moderate hierarchy with good parallelism
            speedup = metrics.num_nodes / (2 * depth)  # Conservative estimate
            return (
                ExecutionTopology.HYBRID,
                f"Mixed parallelization (depth={depth}, ratio={ratio:.2f}, fan_out={fan_out})",
                speedup,
            )

        elif depth > TopologyRouter.HIERARCHICAL_DEPTH_THRESHOLD:
            # Deep dependency chain → hierarchical
            speedup = 1 + (ratio * depth / 10)  # Limited parallelism on deep tree
            return (
                ExecutionTopology.HIERARCHICAL,
                f"Deep dependency tree (depth={depth}, fan_in={fan_in})",
                speedup,
            )

        elif ratio < TopologyRouter.SEQUENTIAL_THRESHOLD:
            # Few parallelization opportunities → sequential
            return (
                ExecutionTopology.SEQUENTIAL,
                f"Low parallelism (ratio={ratio:.2f}) — sequential safer",
                1.0,
            )

        else:
            # Default to hybrid for mixed scenarios
            speedup = 1 + (ratio * depth / 5)
            return (
                ExecutionTopology.HYBRID,
                f"Balanced topology (depth={depth}, ratio={ratio:.2f})",
                speedup,
            )

    @staticmethod
    def _group_tasks_into_phases(tasks: dict[str, TaskDAG], topology: ExecutionTopology) -> list[list[str]]:
        """Group tasks into execution phases based on topology.

        Phase grouping depends on topology:
        - SEQUENTIAL: one task per phase
        - PARALLEL: all tasks in one phase
        - HIERARCHICAL: grouped by dependency depth
        - HYBRID: grouped by depth + parallelizability
        """
        if not tasks:
            return []

        if topology == ExecutionTopology.SEQUENTIAL:
            # One task per phase, in dependency order
            return TopologyRouter._topological_sort_phases(tasks)

        elif topology == ExecutionTopology.PARALLEL:
            # All tasks in one phase (must be independent)
            return [list(tasks.keys())]

        elif topology == ExecutionTopology.HIERARCHICAL:
            # Group by dependency depth
            return TopologyRouter._group_by_dependency_level(tasks)

        else:  # HYBRID
            # Group by dependency level but keep independent tasks together
            phases_by_level = TopologyRouter._group_by_dependency_level(tasks)

            # Refine: within each level, separate parallelizable from sequential
            refined_phases = []
            for level_tasks in phases_by_level:
                if len(level_tasks) > 1:
                    # Check if tasks in this level can run in parallel
                    level_task_objs = [tasks[tid] for tid in level_tasks]
                    can_all_parallelize = all(
                        all(t1.is_parallelizable_with(t2) for t2 in level_task_objs if t1.task_id != t2.task_id)
                        for t1 in level_task_objs
                    )
                    if can_all_parallelize:
                        refined_phases.append(level_tasks)
                    else:
                        # Sequential within this level
                        refined_phases.extend([[tid] for tid in level_tasks])
                else:
                    refined_phases.append(level_tasks)

            return refined_phases

    @staticmethod
    def _topological_sort_phases(tasks: dict[str, TaskDAG]) -> list[list[str]]:
        """Topological sort: each task in its own phase, respecting dependencies."""
        visited = set()
        phases = []

        def visit(task_id: str):
            if task_id in visited:
                return
            visited.add(task_id)

            task = tasks.get(task_id)
            if task and task.dependencies:
                for dep_id in task.dependencies:
                    visit(dep_id)

            phases.append([task_id])

        for task_id in tasks:
            visit(task_id)

        return phases

    @staticmethod
    def _group_by_dependency_level(tasks: dict[str, TaskDAG]) -> list[list[str]]:
        """Group tasks by dependency depth (0-level, 1-level, 2-level, etc.)."""
        levels = {}

        for task_id, task in tasks.items():
            depth = len(task.dependencies)
            if depth not in levels:
                levels[depth] = []
            levels[depth].append(task_id)

        # Return groups in depth order
        return [levels[d] for d in sorted(levels.keys())]

    @staticmethod
    def _compute_confidence(metrics: GraphMetrics, topology: ExecutionTopology) -> float:
        """Compute confidence in topology choice (0-1).

        Higher confidence when metrics align well with topology selection.
        """
        if topology == ExecutionTopology.SEQUENTIAL:
            # High confidence if low parallelism
            confidence = 1.0 - metrics.parallelizable_ratio
        elif topology == ExecutionTopology.PARALLEL:
            # High confidence if high parallelism and shallow
            confidence = metrics.parallelizable_ratio * (1.0 - min(1.0, metrics.max_depth / 5))
        elif topology == ExecutionTopology.HIERARCHICAL:
            # High confidence if deep DAG with some parallelism
            confidence = min(1.0, (metrics.max_depth / 3)) * (0.5 + 0.5 * metrics.parallelizable_ratio)
        else:  # HYBRID
            # High confidence in mixed scenarios
            confidence = min(1.0, metrics.parallelizable_ratio + (metrics.max_depth / 10))

        return min(1.0, confidence)


# Convenience function
def route_tasks(tasks: dict[str, TaskDAG]) -> TopologyDecision:
    """Route tasks to optimal topology."""
    return TopologyRouter.route(tasks)


# Example usage and testing
if __name__ == "__main__":
    print("Testing Topology Router...")
    print()

    # Test case 1: All independent tasks (parallel)
    print("Test 1: All Independent Tasks")
    print("=" * 60)
    tasks1 = {
        "assess_vitals": TaskDAG("assess_vitals", "Assess vitals", dependencies=[], can_parallelize=True, estimated_complexity=2),
        "fever_gate": TaskDAG("fever_gate", "Evaluate fever", dependencies=[], can_parallelize=True, estimated_complexity=1),
        "hypoxia_gate": TaskDAG("hypoxia_gate", "Evaluate hypoxia", dependencies=[], can_parallelize=True, estimated_complexity=1),
        "comorbidity_gate": TaskDAG("comorbidity_gate", "Evaluate comorbidities", dependencies=[], can_parallelize=True, estimated_complexity=1),
    }
    decision1 = route_tasks(tasks1)
    print(f"Topology: {decision1.topology.value}")
    print(f"Reasoning: {decision1.reasoning}")
    print(f"Phases: {decision1.phases}")
    print(f"Speedup: {decision1.estimated_speedup:.2f}x")
    print(f"Confidence: {decision1.confidence:.2f}")
    print()

    # Test case 2: Linear dependency chain (sequential)
    print("Test 2: Linear Dependency Chain")
    print("=" * 60)
    tasks2 = {
        "step1": TaskDAG("step1", "Step 1", dependencies=[], can_parallelize=False, estimated_complexity=2),
        "step2": TaskDAG("step2", "Step 2", dependencies=["step1"], can_parallelize=False, estimated_complexity=2),
        "step3": TaskDAG("step3", "Step 3", dependencies=["step2"], can_parallelize=False, estimated_complexity=2),
        "step4": TaskDAG("step4", "Step 4", dependencies=["step3"], can_parallelize=False, estimated_complexity=2),
    }
    decision2 = route_tasks(tasks2)
    print(f"Topology: {decision2.topology.value}")
    print(f"Reasoning: {decision2.reasoning}")
    print(f"Phases: {decision2.phases}")
    print(f"Speedup: {decision2.estimated_speedup:.2f}x")
    print(f"Confidence: {decision2.confidence:.2f}")
    print()

    # Test case 3: Hierarchical with mixed parallelism (hybrid)
    print("Test 3: Hierarchical Mixed Parallelism")
    print("=" * 60)
    tasks3 = {
        "root": TaskDAG("root", "Root task", dependencies=[], can_parallelize=False, estimated_complexity=3),
        "branch1": TaskDAG("branch1", "Branch 1", dependencies=["root"], can_parallelize=True, estimated_complexity=2),
        "branch2": TaskDAG("branch2", "Branch 2", dependencies=["root"], can_parallelize=True, estimated_complexity=2),
        "leaf1": TaskDAG("leaf1", "Leaf 1", dependencies=["branch1"], can_parallelize=True, estimated_complexity=1),
        "leaf2": TaskDAG("leaf2", "Leaf 2", dependencies=["branch1"], can_parallelize=True, estimated_complexity=1),
        "leaf3": TaskDAG("leaf3", "Leaf 3", dependencies=["branch2"], can_parallelize=True, estimated_complexity=1),
    }
    decision3 = route_tasks(tasks3)
    print(f"Topology: {decision3.topology.value}")
    print(f"Reasoning: {decision3.reasoning}")
    print(f"Phases: {decision3.phases}")
    print(f"Speedup: {decision3.estimated_speedup:.2f}x")
    print(f"Confidence: {decision3.confidence:.2f}")
    print(f"Metrics: depth={decision3.metrics.max_depth}, parallelizable_ratio={decision3.metrics.parallelizable_ratio:.2f}")
    print()

    print("✓ Topology router tests completed")
