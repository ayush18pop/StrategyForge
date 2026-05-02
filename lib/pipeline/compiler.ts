export function compileWorkflow(
  selectedCandidate: any,
  userWallet: string,
  chainId: string = '11155111',  // Sepolia default
  targetNetwork?: string
): any {
  const workflow = selectedCandidate.workflow;

  // Replace placeholders
  let workflowStr = JSON.stringify(workflow)
    .replace(/USER_WALLET/g, userWallet)
    .replace(/CHAIN_ID/g, chainId);

  // Override network if researcher detected a non-mainnet target
  if (targetNetwork && targetNetwork !== 'mainnet') {
    workflowStr = workflowStr.replace(/"network"\s*:\s*"mainnet"/g, `"network":"${targetNetwork}"`);
  }

  const parsed = JSON.parse(workflowStr);

  if (!parsed.nodes) parsed.nodes = [];
  if (!parsed.edges) parsed.edges = [];

  // 1. Coerce Trigger Node
  let triggerNodeObj = parsed.nodes.find((n: any) => n.type === 'trigger' || (n.data && n.data.type === 'trigger') || n.id === 'trigger');
  
  if (!triggerNodeObj) {
    // Fallback if LLM forgot to add a trigger
    triggerNodeObj = {
      id: "trigger",
      type: "trigger",
      data: {
        type: "trigger",
        label: "Schedule Trigger",
        config: { triggerType: "Schedule", scheduleCron: "*/30 * * * *" },
        status: "idle",
      },
      position: { x: 120, y: 80 }
    };
  } else {
    // Enforce strict schema on the trigger node
    triggerNodeObj = {
      id: triggerNodeObj.id || "trigger",
      type: "trigger",
      data: {
        type: "trigger",
        label: triggerNodeObj.data?.label || "Schedule Trigger",
        config: triggerNodeObj.data?.config || { triggerType: "Schedule", scheduleCron: "*/30 * * * *" },
        status: "idle"
      },
      position: triggerNodeObj.position || { x: 120, y: 80 }
    };
  }

  // 2. Coerce Action Nodes
  const actionNodes = parsed.nodes
    .filter((n: any) => n.id !== triggerNodeObj.id)
    .map((node: any, index: number) => {
      // The LLM might have placed the actionType slug in a few different places
      const actionType = node.data?.config?.actionType || node.data?.type || node.type;
      
      const config = { ...(node.data?.config || {}) };
      config.actionType = actionType; // Force action slug into data.config.actionType

      return {
        id: node.id,
        type: "action", // Outer type must be "action"
        data: {
          type: "action", // Inner data.type must be "action"
          label: node.data?.label || node.id.replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          config,
          status: "idle"
        },
        position: node.position || { x: 120, y: 240 + (index * 160) } // Calculate valid layout if LLM forgot
      };
    });

  // 3. Coerce Edges
  const edges = parsed.edges.map((edge: any) => {
    const sourceHandle = typeof edge.sourceHandle === "string" && edge.sourceHandle.length > 0 ? edge.sourceHandle : undefined;
    
    // KeeperHub requires explicit edge IDs combining source, handle, and target
    return {
      id: `${edge.source}:${sourceHandle ?? "default"}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      ...(sourceHandle ? { sourceHandle } : {}),
    };
  });

  return {
    name: parsed.name || selectedCandidate.name || "Generated Workflow",
    description: parsed.description || selectedCandidate.description || "",
    nodes: [triggerNodeObj, ...actionNodes],
    edges
  };
}
