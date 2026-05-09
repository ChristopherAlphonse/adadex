import {
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GraphEdge, GraphNode } from "../canvas/types";

type ForceParams = {
  repelStrength: number;
  repelDistanceMax: number;
  linkDistance: number;
  linkStrength: number;
  positionStrength: number;
  collisionPadding: number;
  velocityDecay: number;
  alphaDecay: number;
};

export const DEFAULT_FORCE_PARAMS: ForceParams = {
  repelStrength: -400,
  repelDistanceMax: 600,
  linkDistance: 100,
  linkStrength: 0.25,
  positionStrength: 0.04,
  collisionPadding: 50,
  velocityDecay: 0.4,
  alphaDecay: 0.0228,
};

const ALPHA_MIN = 0.001;
const ALPHA_TARGET = 0;
const REHEAT_ALPHA = 0.8;

// Reference dimensions for initial viewport fit (no longer used for clamping)
export const WORLD_W = 1400;
export const WORLD_H = 800;

type SimNode = SimulationNodeDatum & { _gn: GraphNode };
type SimLink = SimulationLinkDatum<SimNode>;

type UseForceSimulationOptions = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerX: number;
  centerY: number;
  params?: ForceParams;
};

type UseForceSimulationResult = {
  simulatedNodes: GraphNode[];
  pinNode: (id: string) => void;
  unpinNode: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  reheat: () => void;
};

export const useForceSimulation = ({
  nodes,
  edges,
  centerX,
  centerY,
  params = DEFAULT_FORCE_PARAMS,
}: UseForceSimulationOptions): UseForceSimulationResult => {
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const simNodeMapRef = useRef<Map<string, SimNode>>(new Map());
  const [snapshot, setSnapshot] = useState<GraphNode[]>(nodes);

  // Keep latest inputs in refs so the effect can read them without depending on them
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const paramsRef = useRef(params);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  paramsRef.current = params;

  // Stable topology keys — effect only fires when graph structure actually changes
  const nodeIdKey = useMemo(() => nodes.map((n) => n.id).join("\0"), [nodes]);
  const edgeKey = useMemo(() => edges.map((e) => `${e.source}\0${e.target}`).join("\0"), [edges]);

  // Content key — captures mutable node properties that should update the snapshot
  // even when topology (nodeIdKey/edgeKey) hasn't changed.
  const contentKey = useMemo(
    () =>
      nodes
        .map(
          (n) =>
            `${n.id}\t${n.hasUserPrompt ?? ""}\t${n.agentState ?? ""}\t${n.agentRuntimeState ?? ""}\t${n.waitingToolName ?? ""}\t${n.color}\t${n.label}`,
        )
        .join("\0"),
    [nodes],
  );

  useEffect(() => {
    void nodeIdKey;
    void edgeKey;

    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const p = paramsRef.current;

    if (currentNodes.length === 0) {
      simRef.current?.stop();
      simRef.current = null;
      simNodeMapRef.current.clear();
      setSnapshot([]);
      return;
    }

    const prevMap = simNodeMapRef.current;

    const simNodes: SimNode[] = currentNodes.map((gn) => {
      const prev = prevMap.get(gn.id);
      if (prev) {
        prev._gn = gn;
        return prev;
      }
      return {
        _gn: gn,
        x: gn.x,
        y: gn.y,
        vx: gn.vx,
        vy: gn.vy,
        fx: gn.pinned ? gn.x : undefined,
        fy: gn.pinned ? gn.y : undefined,
      };
    });

    const nextMap = new Map<string, SimNode>();
    for (const sn of simNodes) {
      nextMap.set(sn._gn.id, sn);
    }
    simNodeMapRef.current = nextMap;

    const simLinks: SimLink[] = currentEdges
      .map((e) => {
        const source = nextMap.get(e.source);
        const target = nextMap.get(e.target);
        if (!source || !target) return null;
        return { source, target } as SimLink;
      })
      .filter((l): l is SimLink => l !== null);

    const applyForces = (sim: Simulation<SimNode, SimLink>) => {
      sim
        .force(
          "link",
          forceLink<SimNode, SimLink>(simLinks)
            .distance((link: SimLink) => {
              const target = link.target as SimNode;
              return target._gn.type === "inactive-session"
                ? p.linkDistance * 0.35
                : p.linkDistance;
            })
            .strength((link: SimLink) => {
              const target = link.target as SimNode;
              return target._gn.type === "inactive-session" ? p.linkStrength * 1.5 : p.linkStrength;
            }),
        )
        .force(
          "charge",
          forceManyBody<SimNode>().strength(p.repelStrength).distanceMax(p.repelDistanceMax),
        )
        .force("x", forceX<SimNode>(centerX).strength(p.positionStrength))
        .force("y", forceY<SimNode>(centerY).strength(p.positionStrength))
        .force("collide", forceCollide<SimNode>(p.collisionPadding));
    };

    if (simRef.current) {
      simRef.current.nodes(simNodes);
      applyForces(simRef.current);
      simRef.current.alpha(REHEAT_ALPHA).restart();
    } else {
      const sim = forceSimulation<SimNode>(simNodes)
        .velocityDecay(p.velocityDecay)
        .alphaDecay(p.alphaDecay)
        .alphaMin(ALPHA_MIN)
        .alphaTarget(ALPHA_TARGET);

      applyForces(sim);

      sim.on("tick", () => {
        const updated: GraphNode[] = sim.nodes().map((sn) => ({
          ...sn._gn,
          x: sn.x ?? sn._gn.x,
          y: sn.y ?? sn._gn.y,
          vx: sn.vx ?? 0,
          vy: sn.vy ?? 0,
        }));
        setSnapshot(updated);
      });

      simRef.current = sim;
    }
  }, [nodeIdKey, edgeKey, centerX, centerY]);

  // Sync non-topology node property changes (e.g., hasUserPrompt, agentState,
  // color, label) into the simulation's internal nodes and produce a fresh
  // snapshot without reheating the simulation.
  useEffect(() => {
    void contentKey;

    const map = simNodeMapRef.current;
    const currentNodes = nodesRef.current;
    let changed = false;

    for (const gn of currentNodes) {
      const sn = map.get(gn.id);
      if (sn && sn._gn !== gn) {
        sn._gn = gn;
        changed = true;
      }
    }

    if (changed && simRef.current) {
      const updated: GraphNode[] = simRef.current.nodes().map((sn) => ({
        ...sn._gn,
        x: sn.x ?? sn._gn.x,
        y: sn.y ?? sn._gn.y,
        vx: sn.vx ?? 0,
        vy: sn.vy ?? 0,
      }));
      setSnapshot(updated);
    }
  }, [contentKey]);

  // Apply param changes without rebuilding the simulation
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;

    sim.velocityDecay(params.velocityDecay).alphaDecay(params.alphaDecay);

    const linkForce = sim.force("link") as ReturnType<typeof forceLink<SimNode, SimLink>> | null;
    if (linkForce) {
      linkForce
        .distance((link: SimLink) => {
          const target = link.target as SimNode;
          return target._gn.type === "inactive-session"
            ? params.linkDistance * 0.35
            : params.linkDistance;
        })
        .strength((link: SimLink) => {
          const target = link.target as SimNode;
          return target._gn.type === "inactive-session"
            ? params.linkStrength * 1.5
            : params.linkStrength;
        });
    }

    const chargeForce = sim.force("charge") as ReturnType<typeof forceManyBody<SimNode>> | null;
    if (chargeForce) {
      chargeForce.strength(params.repelStrength).distanceMax(params.repelDistanceMax);
    }

    const xForce = sim.force("x") as ReturnType<typeof forceX<SimNode>> | null;
    if (xForce) xForce.strength(params.positionStrength);

    const yForce = sim.force("y") as ReturnType<typeof forceY<SimNode>> | null;
    if (yForce) yForce.strength(params.positionStrength);

    const collideForce = sim.force("collide") as ReturnType<typeof forceCollide<SimNode>> | null;
    if (collideForce) {
      collideForce.radius(params.collisionPadding);
    }

    sim.alpha(REHEAT_ALPHA).restart();
  }, [params]);

  useEffect(() => {
    return () => {
      simRef.current?.stop();
      simRef.current = null;
    };
  }, []);

  const pinNode = useCallback((id: string) => {
    const sn = simNodeMapRef.current.get(id);
    if (sn) {
      sn.fx = sn.x;
      sn.fy = sn.y;
      sn._gn = { ...sn._gn, pinned: true };
    }
  }, []);

  const unpinNode = useCallback((id: string) => {
    const sn = simNodeMapRef.current.get(id);
    if (sn) {
      sn.fx = undefined;
      sn.fy = undefined;
      sn._gn = { ...sn._gn, pinned: false };
    }
  }, []);

  const moveNode = useCallback((id: string, x: number, y: number) => {
    const sn = simNodeMapRef.current.get(id);
    if (sn) {
      sn.fx = x;
      sn.fy = y;
      sn.x = x;
      sn.y = y;
      sn.vx = 0;
      sn.vy = 0;
    }
  }, []);

  const reheat = useCallback(() => {
    simRef.current?.alpha(REHEAT_ALPHA).restart();
  }, []);

  return { simulatedNodes: snapshot, pinNode, unpinNode, moveNode, reheat };
};
