"""LangGraph-based orchestration layer with five-plane governance enforcement.

Implements:
- Topology routing: parallel vs. sequential vs. hierarchical execution
- Five-plane governance: reasoning + network/identity/endpoint/data enforcement
- Dynamic agent instantiation: ⟨Instruction, Context, Tools, Model⟩ tuples
- Path-based audit: queryable evidence trails via Neo4j

Pattern: AdaptOrch (topology-aware orchestration) + Policies on Paths (path-based governance)
"""
from __future__ import annotations

from langgraph.graph import StateGraph, END
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Callable, Optional, Literal
from enum import Enum
import json


# ================================================================ Topology Model

class ExecutionTopology(Enum):
    """Execution topology options (AdaptOrch)."""
    SEQUENTIAL = "sequential"  # Linear chain: A → B → C
    PARALLEL = "parallel"      # Fan-out: A → {B, C, D}
    HIERARCHICAL = "hierarchical"  # Tree: A → {B → {C, D}, E}
    HYBRID = "hybrid"          # Mixed: some steps parallel, some sequential


@dataclass
class TaskDAG:
    """Task dependency graph for topology routing."""
    task_id: str
    instructions: str
    dependencies: list[str] = field(default_factory=list)  # task_ids this depends on
    can_parallelize: bool = False  # independent of siblings?
    estimated_complexity: int = 1  # 1=simple, 10=complex
    tools_required: list[str] = field(default_factory=list)

    def in_degree(self) -> int:
        """Number of predecessors."""
        return len(self.dependencies)

    def is_parallelizable_with(self, other: TaskDAG) -> bool:
        """Can this task run in parallel with another?"""
        return (
            self.can_parallelize
            and other.can_parallelize
            and other.task_id not in self.dependencies
            and self.task_id not in other.dependencies
        )


@dataclass
class TopologyDecision:
    """Output of task decomposition router."""
    topology: ExecutionTopology
    reasoning: str
    phases: list[list[str]]  # Grouped task_ids per execution phase


class TaskDecompositionRouter:
    """Routing logic: task DAG → execution topology (O(|V|+|E|))."""

    @staticmethod
    def route(tasks: dict[str, TaskDAG]) -> TopologyDecision:
        """Inspect task DAG and pick optimal topology.

        Algorithm:
        1. Count dependency depth
        2. Identify parallelizable clusters
        3. Select topology
        """
        if not tasks:
            return TopologyDecision(ExecutionTopology.SEQUENTIAL, "No tasks", [[]])

        # Build adjacency
        max_depth = 0
        parallel_opportunities = 0

        for task_id, task in tasks.items():
            depth = len(task.dependencies) + 1
            max_depth = max(max_depth, depth)

            # Count tasks that can run in parallel
            for other_id, other in tasks.items():
                if task_id != other_id and task.is_parallelizable_with(other):
                    parallel_opportunities += 1

        # Topology selection heuristic
        total_tasks = len(tasks)
        parallelizable_ratio = parallel_opportunities / max(1, total_tasks * (total_tasks - 1) / 2)

        if max_depth == 1 and parallelizable_ratio > 0.5:
            # All tasks independent → full parallelization
            topology = ExecutionTopology.PARALLEL
            phases = [[tid for tid in tasks.keys()]]
            reasoning = f"All {total_tasks} tasks independent (parallelizable_ratio={parallelizable_ratio:.2f})"

        elif max_depth <= 2 and parallelizable_ratio > 0.3:
            # Some parallelization possible
            topology = ExecutionTopology.HYBRID
            # Group into dependency levels
            phases = TaskDecompositionRouter._group_by_dependency_level(tasks)
            reasoning = f"Mixed parallelization (depth={max_depth}, ratio={parallelizable_ratio:.2f})"

        elif max_depth > 3:
            # Deep hierarchy
            topology = ExecutionTopology.HIERARCHICAL
            phases = TaskDecompositionRouter._group_by_dependency_level(tasks)
            reasoning = f"Deep dependency tree (depth={max_depth})"

        else:
            # Default to sequential
            topology = ExecutionTopology.SEQUENTIAL
            phases = [[tid] for tid in tasks.keys()]
            reasoning = "Linear execution"

        return TopologyDecision(topology, reasoning, phases)

    @staticmethod
    def _group_by_dependency_level(tasks: dict[str, TaskDAG]) -> list[list[str]]:
        """Group tasks by dependency depth for execution ordering."""
        levels = {}
        for task_id, task in tasks.items():
            depth = len(task.dependencies)
            if depth not in levels:
                levels[depth] = []
            levels[depth].append(task_id)
        return [levels[d] for d in sorted(levels.keys())]


# ================================================================ Five-Plane Governance

class EnforcementPlane(Enum):
    """Five planes of enforcement (Policies on Paths)."""
    REASONING = "reasoning"  # Intent adjudication
    NETWORK = "network"      # Network-level access
    IDENTITY = "identity"    # Principal authentication
    ENDPOINT = "endpoint"    # Agent/tool availability
    DATA = "data"            # System-of-record write authorization


@dataclass
class CompositePrincipal:
    """Identity with delegated authority (capability attenuation).

    When Agent A delegates to Agent B, B's capabilities attenuate from A's.
    """
    agent_id: str
    parent_agent_id: Optional[str] = None  # Delegation parent
    capabilities: set[str] = field(default_factory=set)
    max_depth: int = 3  # Delegation depth limit
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def attenuate(self, child_id: str, subset: set[str]) -> CompositePrincipal:
        """Delegate to child with attenuated capabilities."""
        if self.max_depth <= 0:
            raise PermissionError(f"Agent {self.agent_id}: delegation depth exceeded")

        attenuated = self.capabilities & subset  # Intersection = attenuation
        return CompositePrincipal(
            agent_id=child_id,
            parent_agent_id=self.agent_id,
            capabilities=attenuated,
            max_depth=self.max_depth - 1,
        )

    def can_perform(self, action: str) -> bool:
        """Check if principal has capability."""
        return action in self.capabilities


@dataclass
class ExecutionPath:
    """Partial execution path for policy evaluation (Policies on Paths)."""
    task_id: str
    principal: CompositePrincipal
    proposed_action: str
    previous_steps: list[str] = field(default_factory=list)
    org_state: dict = field(default_factory=dict)  # e.g., current patient count, mode

    def path_key(self) -> str:
        """Hashable representation for caching/audit."""
        return f"{self.principal.agent_id}:{self.task_id}:{self.proposed_action}:{'→'.join(self.previous_steps[-3:])}"


class GovernanceEngine:
    """Path-based policy evaluation (reasoning + 4 enforcement planes)."""

    def __init__(self):
        self.planes: dict[EnforcementPlane, Callable[[ExecutionPath], tuple[bool, str]]] = {
            EnforcementPlane.REASONING: self._plane_reasoning,
            EnforcementPlane.NETWORK: self._plane_network,
            EnforcementPlane.IDENTITY: self._plane_identity,
            EnforcementPlane.ENDPOINT: self._plane_endpoint,
            EnforcementPlane.DATA: self._plane_data,
        }

    def evaluate(self, path: ExecutionPath) -> tuple[bool, str, list[tuple[str, str]]]:
        """Evaluate all planes. Returns (allowed, reason, plane_results).

        Each plane votes independently; all must pass.
        """
        results = []
        allowed = True
        reason = ""

        for plane in EnforcementPlane:
            plane_allowed, plane_reason = self.planes[plane](path)
            results.append((plane.value, plane_reason))
            if not plane_allowed:
                allowed = False
                reason = f"{plane.value}: {plane_reason}"
                break  # Fail-fast

        return allowed, reason, results

    def _plane_reasoning(self, path: ExecutionPath) -> tuple[bool, str]:
        """Reason about intent: is this action appropriate given history?"""
        # Example: escalation should follow triage, not precede it
        if "escalate" in path.proposed_action:
            if "triage" not in "→".join(path.previous_steps):
                return False, "Escalation requires prior triage assessment"
        return True, "Intent valid"

    def _plane_network(self, path: ExecutionPath) -> tuple[bool, str]:
        """Network access: can this principal reach required services?"""
        # Example: patient data access check
        if "patient_data" in path.proposed_action:
            if path.org_state.get("patient_isolation_mode"):
                return False, "Patient data access blocked during isolation"
        return True, "Network access granted"

    def _plane_identity(self, path: ExecutionPath) -> tuple[bool, str]:
        """Identity verification: is principal authenticated?"""
        if not path.principal.agent_id:
            return False, "Principal not authenticated"
        return True, f"Identity verified: {path.principal.agent_id}"

    def _plane_endpoint(self, path: ExecutionPath) -> tuple[bool, str]:
        """Endpoint availability: does agent/tool exist and have required capability?"""
        if not path.principal.can_perform(path.proposed_action):
            return False, f"Principal lacks capability: {path.proposed_action}"
        return True, "Endpoint available and capable"

    def _plane_data(self, path: ExecutionPath) -> tuple[bool, str]:
        """Data write authorization: can principal write to system of record?"""
        if "write" in path.proposed_action.lower():
            # Example: only tier-3 agents can commit ledger
            if "ledger" in path.proposed_action and path.principal.max_depth < 3:
                return False, "Ledger writes require full delegation depth"
        return True, "Data write authorized"


# ================================================================ Dynamic Agent Instantiation

@dataclass
class AgentSpecification:
    """Dynamic agent: ⟨Instruction, Context, Tools, Model⟩ tuple."""
    agent_id: str
    instruction: str  # Task-specific prompt
    context: dict  # Task context (patient data, history, etc.)
    tools: list[str]  # Tool IDs this agent can use
    model: str = "claude-haiku-4-5-20251001"  # Model choice (swappable)
    principal: Optional[CompositePrincipal] = None

    def instantiate(self) -> str:
        """Return formatted agent spec for execution."""
        return f"""
Agent: {self.agent_id}
Model: {self.model}
Instruction: {self.instruction}
Context: {json.dumps(self.context, indent=2)}
Available tools: {', '.join(self.tools)}
Authority: {self.principal.capabilities if self.principal else 'undefined'}
"""


# ================================================================ Model Abstraction

class ModelAdapter:
    """Model-agnostic adapter: swappable Claude/GPT/Gemini/open-weight."""

    PROVIDERS = {
        "claude": {"models": ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"]},
        "openai": {"models": ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"]},
        "gemini": {"models": ["gemini-2.0-pro", "gemini-1.5-pro", "gemini-1.5-flash"]},
        "open-weight": {"models": ["llama-3.1-405b", "llama-2-70b", "mistral-7b"]},
    }

    @staticmethod
    def resolve_provider(model: str) -> str:
        """Map model name to provider."""
        for provider, config in ModelAdapter.PROVIDERS.items():
            if model in config["models"]:
                return provider
        return "claude"  # Default

    @staticmethod
    def get_default_for_complexity(complexity: int, prefer_provider: str = "claude") -> str:
        """Pick model based on task complexity."""
        if complexity <= 2:
            return "claude-haiku-4-5-20251001"
        elif complexity <= 5:
            return "claude-sonnet-5"
        else:
            return "claude-opus-5"


# ================================================================ Orchestration Graph (LangGraph)

def create_triage_orchestration_graph(
    governance: GovernanceEngine,
    neo4j_store=None,
) -> StateGraph:
    """Build LangGraph state machine for triage orchestration.

    Nodes:
    - decompose: task decomposition + topology routing
    - instantiate: dynamic agent creation
    - execute: policy-gated execution
    - audit: log to Neo4j
    - complete: finish
    """

    def decompose(state: dict) -> dict:
        """Inspect task DAG, select topology."""
        tasks = state.get("tasks", {})
        router = TaskDecompositionRouter()
        decision = router.route(tasks)
        state["topology_decision"] = asdict(decision)
        return state

    def instantiate(state: dict) -> dict:
        """Create agents dynamically based on topology."""
        topology = state.get("topology_decision", {})
        phases = topology.get("phases", [[]])

        agents = []
        for phase in phases:
            for task_id in phase:
                task = state["tasks"].get(task_id)
                if not task:
                    continue

                spec = AgentSpecification(
                    agent_id=f"agent-{task_id}",
                    instruction=task.instructions,
                    context={"task_id": task_id, "complexity": task.estimated_complexity},
                    tools=task.tools_required,
                    model=ModelAdapter.get_default_for_complexity(task.estimated_complexity),
                    principal=CompositePrincipal(
                        agent_id=f"agent-{task_id}",
                        capabilities=set(task.tools_required),
                    ),
                )
                agents.append(spec)

        state["agents"] = agents
        return state

    def execute_with_governance(state: dict) -> dict:
        """Execute agents with five-plane policy enforcement."""
        agents = state.get("agents", [])
        topology = state.get("topology_decision", {})
        results = []

        for agent_spec in agents:
            # Build execution path for governance evaluation
            path = ExecutionPath(
                task_id=agent_spec.agent_id,
                principal=agent_spec.principal,
                proposed_action="execute_triage_task",
                previous_steps=state.get("execution_history", []),
                org_state=state.get("org_state", {}),
            )

            # Policy check
            allowed, reason, plane_results = governance.evaluate(path)
            if not allowed:
                results.append({"agent_id": agent_spec.agent_id, "status": "blocked", "reason": reason})
                continue

            # Simulated execution
            results.append({
                "agent_id": agent_spec.agent_id,
                "status": "executed",
                "reason": "All governance planes passed",
                "plane_results": plane_results,
            })

        state["execution_results"] = results
        state["execution_history"].append(f"executed {len(agents)} agents")
        return state

    def audit(state: dict) -> dict:
        """Log execution path to Neo4j as structured evidence."""
        if neo4j_store and neo4j_store._connected:
            # Store execution path in graph
            path_data = {
                "topology": state.get("topology_decision", {}).get("topology"),
                "agents_executed": len(state.get("execution_results", [])),
                "execution_time_ms": state.get("elapsed_ms", 0),
                "governance_decisions": state.get("execution_results", []),
            }
            # neo4j_store.store_execution_path(...) would go here
        return state

    # Build graph
    graph = StateGraph(dict)
    graph.add_node("decompose", decompose)
    graph.add_node("instantiate", instantiate)
    graph.add_node("execute", execute_with_governance)
    graph.add_node("audit", audit)
    graph.add_node("complete", lambda x: x)

    graph.set_entry_point("decompose")
    graph.add_edge("decompose", "instantiate")
    graph.add_edge("instantiate", "execute")
    graph.add_edge("execute", "audit")
    graph.add_edge("audit", "complete")
    graph.add_edge("complete", END)

    return graph.compile()


# ================================================================ Integration with Neo4j

def store_execution_path_in_neo4j(neo4j_store, execution_state: dict):
    """Persist execution path as queryable evidence in Neo4j."""
    if not neo4j_store or not neo4j_store._connected:
        return False

    try:
        # Create ExecutionPath node
        # Create agent nodes for each instantiated agent
        # Link agents with their policies + governance decisions
        # Chain evidence in hash-linked fashion
        pass
    except Exception as e:
        print(f"⚠ Error storing execution path: {e}")
        return False

    return True
