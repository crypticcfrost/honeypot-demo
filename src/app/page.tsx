"use client";

import React, { useState, useEffect } from "react";
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Node,
  Edge,
  NodeTypes
} from "reactflow";
import "reactflow/dist/style.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { motion, AnimatePresence } from "framer-motion";

type NodeData = {
  label: string;
};

interface AttackLog {
  id: string;
  timestamp: string;
  attackType: string;
  sourceIP: string;
  targetId: string;
  targetLabel: string;
}

interface SystemLog extends AttackLog {
  type: 'attack' | 'system';
  severity: 'info' | 'warning' | 'error' | 'success';
}

const initialNodes: Node<NodeData>[] = [
  { id: "1", type: "input", data: { label: "Real Server" }, position: { x: 250, y: 50 }, className: "node-server" },
  { id: "2", data: { label: "Honeypot 1" }, position: { x: 150, y: 200 }, className: "node-honeypot" },
  { id: "3", data: { label: "Honeypot 2" }, position: { x: 350, y: 200 }, className: "node-honeypot" },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", label: "Monitored Tunnel" },
  { id: "e1-3", source: "1", target: "3", label: "Monitored Tunnel" },
];

export default function HoneypotSimulation() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const [honeypotLogs, setHoneypotLogs] = useState<SystemLog[]>([]);
  const [nodeId, setNodeId] = useState(4);
  const [attackCount, setAttackCount] = useState<{ [key: string]: number }>({});
  const [flashingNodes, setFlashingNodes] = useState<string[]>([]);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(10);
  const [logCounter, setLogCounter] = useState(0);

  // Effect for simulation
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      // Get current active honeypots at the time of attack
      const currentHoneypots = nodes.filter(n => n.className?.includes('honeypot'));
      if (currentHoneypots.length === 0) return;

      // Select a random current honeypot
      const target = currentHoneypots[Math.floor(Math.random() * currentHoneypots.length)];
      handleAttack(target);
    }, 5000);

    return () => clearInterval(interval);
  }, [isRunning, nodes]); // Added nodes as dependency to ensure we always use current nodes

  // Handle flashing nodes
  useEffect(() => {
    if (flashingNodes.length > 0) {
      const timer = setTimeout(() => {
        setFlashingNodes([]);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [flashingNodes]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (pendingNodeId && countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    } else if (pendingNodeId && countdown === 0) {
      retireAndRespawn(pendingNodeId);
    }
    return () => clearTimeout(timer);
  }, [pendingNodeId, countdown]);

  const ATTACK_TYPES = ["Port Scan", "SSH Brute Force", "SQL Injection", "Malware Upload", "Lateral Movement Attempt"];

  const getRandomIP = () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join(".");

  const generateLogId = () => {
    setLogCounter(prev => prev + 1);
    return `${Date.now()}-${logCounter}`;
  };

  const addSystemLog = (message: string, severity: SystemLog['severity']) => {
    const log: SystemLog = {
      id: generateLogId(),
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      severity,
      attackType: '',
      sourceIP: '',
      targetId: '',
      targetLabel: '',
    };
    setHoneypotLogs((logs) => [{ ...log, attackType: message }, ...logs.slice(0, 49)]);
  };

  const handleAttack = (target: Node<NodeData>) => {
    const ip = getRandomIP();
    const attackType = ATTACK_TYPES[Math.floor(Math.random() * ATTACK_TYPES.length)];
    
    const log: SystemLog = {
      id: generateLogId(),
      timestamp: new Date().toLocaleTimeString(),
      type: 'attack',
      severity: 'warning',
      attackType,
      sourceIP: ip,
      targetId: target.id,
      targetLabel: target.data.label,
    };

    setHoneypotLogs((logs) => [log, ...logs.slice(0, 49)]);
    setFlashingNodes((fn) => [...new Set([...fn, target.id])]);
    
    const logMessage = `${log.timestamp} - ${log.attackType} from ${log.sourceIP} on ${target.data.label}`;
    
    toast.warn(logMessage, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });

    // Update nodes to show flashing effect
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === target.id) {
          return {
            ...node,
            className: `${node.className} flash-attack`,
          };
        }
        return node;
      })
    );

    // Reset flashing effect
    setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === target.id) {
            return {
              ...node,
              className: node.className?.replace(" flash-attack", ""),
            };
          }
          return node;
        })
      );
    }, 1000);

    // Update attack count and check threshold
    setAttackCount((prev) => {
      const updated = { ...prev };
      updated[target.id] = (updated[target.id] || 0) + 1;
      
      // Check if threshold reached
      if (updated[target.id] === 5 && !pendingNodeId) {
        setPendingNodeId(target.id);
        setCountdown(10);
      }
      
      return updated;
    });
  };

  const retireAndRespawn = (id: string) => {
    // Clear attack count for the retired honeypot
    setAttackCount((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });

    // Remove the old honeypot
    const targetNode = nodes.find(n => n.id === id);
    if (targetNode) {
      addSystemLog(`${targetNode.data.label} has been retired due to high attack volume`, 'error');
      toast.error(`${targetNode.data.label} retired.`);
    }
    
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setFlashingNodes((fn) => fn.filter((nid) => nid !== id));

    // Add new honeypot after a delay
    setTimeout(() => {
      addHoneypot();
      setPendingNodeId(null);
      setCountdown(10);
    }, 2000);
  };

  const addHoneypot = () => {
    const styles = ["node-honeypot", "node-honeypot-gen2", "node-honeypot-gen3"];
    
    // Get current honeypot numbers
    const currentNumbers = new Set(
      nodes
        .filter(n => n.className?.includes('honeypot'))
        .map(n => {
          const match = n.data.label.match(/Honeypot (\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
    );
    
    // Find the next available number
    let newNumber = 1;
    while (currentNumbers.has(newNumber)) {
      newNumber++;
    }
    
    const honeypotLabel = `Honeypot ${newNumber}`;
    
    const newNode: Node<NodeData> = {
      id: `${nodeId}`,
      data: { label: honeypotLabel },
      position: { x: Math.random() * 500 + 50, y: Math.random() * 300 + 150 },
      className: styles[Math.floor(Math.random() * styles.length)],
    };
    
    const newEdge: Edge = { 
      id: `e1-${nodeId}`, 
      source: "1", 
      target: newNode.id, 
      label: "Dynamic Tunnel",
      animated: true,
    };
    
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
    setNodeId((id) => id + 1);
    addSystemLog(`${honeypotLabel} has been deployed and is now monitoring for attacks`, 'success');
    toast.success(`${honeypotLabel} deployed.`);
  };

  const honeypotCount = nodes.filter((n) => n.className?.includes("honeypot")).length;

  const getLogStyle = (log: SystemLog) => {
    const baseStyle = "text-sm rounded p-3 mb-2 font-mono";
    switch (log.type) {
      case 'attack':
        return `${baseStyle} bg-red-900/50 border border-red-700/50 text-red-100`;
      case 'system':
        switch (log.severity) {
          case 'success':
            return `${baseStyle} bg-green-900/50 border border-green-700/50 text-green-100`;
          case 'error':
            return `${baseStyle} bg-red-900/50 border border-red-700/50 text-red-100`;
          case 'warning':
            return `${baseStyle} bg-yellow-900/50 border border-yellow-700/50 text-yellow-100`;
          default:
            return `${baseStyle} bg-blue-900/50 border border-blue-700/50 text-blue-100`;
        }
    }
  };

  const formatLogMessage = (log: SystemLog) => {
    if (log.type === 'attack') {
      return `[ATTACK] ${log.timestamp} - ${log.attackType} from ${log.sourceIP} on ${log.targetLabel}`;
    }
    return `[SYSTEM] ${log.timestamp} - ${log.attackType}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="w-full py-4 bg-gray-800 text-center">
        <h1 className="text-3xl font-bold text-white">Honeypot Network Monitor</h1>
        <div className="text-sm mt-1 text-gray-300">Honeypots Active: {honeypotCount} | Total Alerts: {honeypotLogs.length}</div>
      </header>

      <div className="flex-1 flex gap-4 p-4">
        <div className="flex-1 flex flex-col">
          <motion.div 
            className="w-full h-[600px] bg-gray-800 rounded-lg overflow-hidden" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              style={{ width: "100%", height: "100%" }}
              nodesDraggable={false}
              nodesConnectable={false}
            >
              <Background color="#444" gap={16} />
              <Controls />
            </ReactFlow>
          </motion.div>

          <motion.div className="mt-4 flex gap-4 justify-center">
            <button 
              onClick={() => {
                setIsRunning((run) => {
                  const newState = !run;
                  addSystemLog(
                    newState ? "Simulation started - Monitoring for attacks" : "Simulation stopped - System paused",
                    newState ? 'success' : 'info'
                  );
                  return newState;
                });
              }} 
              className={`py-2 px-6 rounded-lg font-semibold transition-colors ${
                isRunning ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              } text-white`}
            >
              {isRunning ? "Stop Simulation" : "Start Simulation"}
            </button>
            <button 
              onClick={addHoneypot} 
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg font-semibold transition-colors"
            >
              Add Honeypot
            </button>
          </motion.div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">System Status</h3>
              <div className="text-sm text-gray-300">
                <p>🟢 Main Server: Online</p>
                <p>🔵 Active Honeypots: {honeypotCount}</p>
                <p>⚡ Network Traffic: Active</p>
                <p>🛡️ Security Level: High</p>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">Attack Statistics</h3>
              <div className="text-sm text-gray-300">
                <p>📊 Total Attacks: {honeypotLogs.filter(log => log.type === 'attack').length}</p>
                <p>🎯 Attacks Deflected: 100%</p>
                <p>⚠️ High Risk Attacks: {honeypotLogs.filter(log => log.attackType === 'SQL Injection' || log.attackType === 'Malware Upload').length}</p>
                <p>🕒 Last Attack: {honeypotLogs.find(log => log.type === 'attack')?.timestamp || 'N/A'}</p>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">Security Metrics</h3>
              <div className="text-sm text-gray-300">
                <p>🔒 Encryption: AES-256</p>
                <p>🌐 Protocol: SSH/HTTPS</p>
                <p>📡 Monitoring: Real-time</p>
                <p>🚨 Alert Status: Active</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-96 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold text-white mb-4">System Logs</h2>
          <div className="space-y-2 h-[800px] overflow-y-auto pr-2">
            {honeypotLogs.map((log) => (
              <div
                key={log.id}
                className={getLogStyle(log)}
              >
                {formatLogMessage(log)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pendingNodeId && (
          <motion.div
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center">
              <h2 className="text-xl font-bold mb-4 text-white">⚠️ Honeypot Under Attack</h2>
              <p className="text-gray-300">Do you want to retire and deploy a new honeypot?</p>
              <p className="text-yellow-400 mt-2">Auto decision in {countdown}s</p>
              <div className="mt-6 flex gap-4 justify-center">
                <button
                  onClick={() => { retireAndRespawn(pendingNodeId); setPendingNodeId(null); }}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-semibold transition-colors"
                >
                  Deploy New
                </button>
                <button
                  onClick={() => { setPendingNodeId(null); setCountdown(10); }}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );
}