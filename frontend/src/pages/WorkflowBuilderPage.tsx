/*
  WorkflowBuilderPage.tsx — Workflow Builder Module

  Features:
  - Drag-and-drop node palette (6 node types)
  - React Flow canvas with node/edge deletion (Delete key or Backspace)
  - Save current workflow (POST or PUT to backend)
  - New workflow button (clears the canvas)
  - Editable workflow name
*/
import { Zap, Brain, Mail, Clock, GitBranch, Square, Save, Plus, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    ReactFlowProvider,
} from '@xyflow/react'
import type {
    NodeChange,
    EdgeChange,
    Connection,
    Edge,
    Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nanoid } from 'nanoid'
import { CustomNode } from './CustomNodes'
import './WorkflowBuilderPage.css'

/* Define the palette node types */
const PALETTE_NODES = [
    { type: 'trigger', label: 'Trigger', description: 'Starts the workflow', icon: Zap, iconName: 'Zap', color: '#10b981' },
    { type: 'ai_generate', label: 'AI Generate', description: 'Generate content with AI', icon: Brain, iconName: 'Brain', color: '#6366f1' },
    { type: 'action', label: 'Send Email', description: 'Send an outreach email', icon: Mail, iconName: 'Mail', color: '#3b82f6' },
    { type: 'wait', label: 'Wait / Delay', description: 'Add a timed delay', icon: Clock, iconName: 'Clock', color: '#f59e0b' },
    { type: 'condition', label: 'Condition', description: 'Branch based on a condition', icon: GitBranch, iconName: 'GitBranch', color: '#f97316' },
    { type: 'end', label: 'End', description: 'Terminate the workflow', icon: Square, iconName: 'Square', color: '#ef4444' },
]

const nodeTypes = { custom: CustomNode }

/* ─── Inner builder component (must be inside ReactFlowProvider) ─── */
function WorkflowBuilder() {
    const [nodes, setNodes] = useState<Node[]>([])
    const [edges, setEdges] = useState<Edge[]>([])
    const [workflowName, setWorkflowName] = useState('Untitled Workflow')
    const [workflowId, setWorkflowId] = useState<number | null>(null)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

    /* ── React Flow callbacks ── */
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    )
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    )
    const onConnect = useCallback(
        (params: Connection) =>
            setEdges((eds) =>
                addEdge({ ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } }, eds)
            ),
        []
    )

    /* ── Drag-and-drop from palette ── */
    const onDragStart = (event: React.DragEvent, nodeData: typeof PALETTE_NODES[0]) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData))
        event.dataTransfer.effectAllowed = 'move'
    }

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect()
        const typeData = event.dataTransfer.getData('application/reactflow')
        if (!typeData || !reactFlowBounds) return

        const parsedType = JSON.parse(typeData)
        const position = {
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top,
        }

        const newNode: Node = {
            id: nanoid(),
            type: 'custom',
            position,
            data: { ...parsedType },
        }
        setNodes((nds) => nds.concat(newNode))
    }, [])

    /* ── Save workflow to backend ── */
    const handleSave = async () => {
        setSaveStatus('saving')
        const flowDef = JSON.stringify({ nodes, edges })

        try {
            let response: Response
            if (workflowId) {
                // Update existing
                response = await fetch(`http://localhost:8000/api/v1/workflows/${workflowId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: workflowName, flow_definition: flowDef }),
                })
            } else {
                // Create new
                response = await fetch('http://localhost:8000/api/v1/workflows', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: workflowName, flow_definition: flowDef }),
                })
            }
            if (!response.ok) throw new Error('Save failed')
            const saved = await response.json()
            setWorkflowId(saved.id)
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus('idle'), 2500)
        } catch {
            setSaveStatus('error')
            setTimeout(() => setSaveStatus('idle'), 2500)
        }
    }

    /* ── New workflow (clear the canvas) ── */
    const handleNew = () => {
        setNodes([])
        setEdges([])
        setWorkflowName('Untitled Workflow')
        setWorkflowId(null)
        setSaveStatus('idle')
    }

    const saveLabel =
        saveStatus === 'saving' ? 'Saving…'
            : saveStatus === 'saved' ? '✓ Saved!'
                : saveStatus === 'error' ? '✗ Error'
                    : workflowId ? 'Update Workflow'
                        : 'Save Workflow'

    return (
        <div className="wb-page">
            {/* ── Page Header ── */}
            <div className="page-header" style={{ paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <h1 style={{ margin: 0 }}>
                        <GitBranch size={28} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
                        Workflow Builder
                    </h1>

                    {/* Editable workflow name */}
                    <input
                        className="workflow-name-input"
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        placeholder="Workflow name…"
                    />

                    {/* Toolbar buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                        <button className="btn-secondary" onClick={handleNew} title="Start a new blank workflow">
                            <Plus size={15} />
                            New
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleSave}
                            disabled={saveStatus === 'saving' || nodes.length === 0}
                            title="Save the current workflow"
                        >
                            <Save size={15} />
                            {saveLabel}
                        </button>
                    </div>
                </div>
                <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
                    Drag nodes onto the canvas and connect them.&nbsp;
                    <span style={{ opacity: 0.7 }}>Select a node or edge and press&nbsp;
                        <kbd style={{ background: '#1e293b', border: '1px solid #334155', padding: '1px 6px', borderRadius: '4px', fontSize: '12px' }}>Delete</kbd>
                        &nbsp;or&nbsp;
                        <kbd style={{ background: '#1e293b', border: '1px solid #334155', padding: '1px 6px', borderRadius: '4px', fontSize: '12px' }}>Backspace</kbd>
                        &nbsp;to remove it.
                    </span>
                </p>
            </div>

            {/* ── Builder layout ── */}
            <div className="wb-layout">
                {/* Left palette */}
                <div className="wb-palette glass-panel">
                    <h3 className="palette-title">Node Palette</h3>
                    <p className="palette-subtitle">Drag nodes to the canvas</p>

                    <div className="palette-nodes">
                        {PALETTE_NODES.map((node) => (
                            <div
                                key={node.type}
                                className="palette-node"
                                draggable
                                onDragStart={(e) => onDragStart(e, node)}
                            >
                                <div className="node-color-bar" style={{ backgroundColor: node.color }} />
                                <div className="node-icon" style={{ color: node.color }}>
                                    <node.icon size={18} />
                                </div>
                                <div className="node-info">
                                    <span className="node-label">{node.label}</span>
                                    <span className="node-desc">{node.description}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Hint about deletion */}
                    <div style={{
                        marginTop: 'auto',
                        padding: '12px',
                        background: 'rgba(239,68,68,0.07)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#94a3b8'
                    }}>
                        <Trash2 size={13} style={{ verticalAlign: 'middle', marginRight: '6px', color: '#ef4444' }} />
                        Select then <strong>Delete / Backspace</strong> to remove nodes or edges.
                    </div>
                </div>

                {/* Canvas */}
                <div className="wb-canvas glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        deleteKeyCode={['Delete', 'Backspace']}
                        fitView
                        defaultEdgeOptions={{
                            style: { stroke: '#94a3b8', strokeWidth: 2 },
                            animated: true,
                        }}
                    >
                        <Background color="#334155" gap={20} size={1} />
                        <Controls />

                        {nodes.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <div className="canvas-empty" style={{
                                    background: 'rgba(30,41,59,0.85)',
                                    border: '1px solid #334155',
                                    borderRadius: '16px',
                                    padding: '40px',
                                    display: 'none',
                                    maxWidth: '400px',
                                    textAlign: 'center',
                                    boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
                                    backdropFilter: 'blur(8px)',
                                }}>
                                    <div className="canvas-empty-icon">
                                        <GitBranch size={48} style={{ color: '#10b981' }} />
                                    </div>
                                    <h3>Build Your Workflow</h3>
                                    <p>Drag nodes from the palette and connect them to create your outreach sequence.</p>
                                </div>
                            </div>
                        )}
                    </ReactFlow>
                </div>
            </div>
        </div>
    )
}

function WorkflowBuilderPage() {
    return (
        <ReactFlowProvider>
            <WorkflowBuilder />
        </ReactFlowProvider>
    )
}

export default WorkflowBuilderPage
