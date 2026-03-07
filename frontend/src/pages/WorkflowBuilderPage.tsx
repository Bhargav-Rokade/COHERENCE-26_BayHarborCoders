/*
  WorkflowBuilderPage.tsx — Full Workflow Builder with:
  - 12 categorised node types (drag-and-drop palette)
  - Node config side panel (click any canvas node to configure it)
  - Save / Update workflow
  - Run Simulation (calls backend executor, shows step log)
  - Load saved workflows from backend
*/
import {
    Zap, Database, Brain, Wand2, BarChart2,
    Send, Timer, Eye, Bot, GitBranch, TrendingUp, CheckSquare,
    Save, Plus, Play, ChevronDown, ChevronRight, X, Loader,
    CheckCircle, XCircle, FolderOpen,
} from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'
import type React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
    ReactFlow, Controls, Background,
    applyNodeChanges, applyEdgeChanges, addEdge, ReactFlowProvider,
} from '@xyflow/react'
import type { NodeChange, EdgeChange, Connection, Edge, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nanoid } from 'nanoid'
import { CustomNode } from './CustomNodes'
import './WorkflowBuilderPage.css'

/* ─── Node Palette Definition ─── */
const PALETTE_CATEGORIES = [
    {
        label: 'Triggers',
        color: '#10b981',
        nodes: [
            { type: 'trigger', label: 'Trigger', description: 'Start the workflow', iconName: 'Zap', color: '#10b981' },
            { type: 'load_lead', label: 'Load Lead Context', description: 'Fetch lead from dataset', iconName: 'Database', color: '#14b8a6' },
        ],
    },
    {
        label: 'AI',
        color: '#6366f1',
        nodes: [
            { type: 'ai_compose', label: 'AI Outreach Composer', description: 'Generate outreach with AI', iconName: 'Brain', color: '#6366f1' },
            { type: 'personalize', label: 'Personalization Engine', description: 'Tailor message to lead', iconName: 'Wand2', color: '#8b5cf6' },
            { type: 'ai_analyze', label: 'AI Reply Analyzer', description: 'Analyze reply sentiment', iconName: 'BarChart2', color: '#a855f7' },
        ],
    },
    {
        label: 'Outreach',
        color: '#3b82f6',
        nodes: [
            { type: 'send_message', label: 'Outreach Sender', description: 'Send via email / LinkedIn', iconName: 'Send', color: '#3b82f6' },
            { type: 'send_email', label: 'Send Email (Gmail)', description: 'Send real email via Gmail SMTP', iconName: 'Send', color: '#3b82f6' },
            { type: 'delay', label: 'Delay / Pacing', description: 'Add human-like delay', iconName: 'Timer', color: '#f59e0b' },
            { type: 'check_reply', label: 'Response Monitor', description: 'Check if lead replied', iconName: 'Eye', color: '#0ea5e9' },
        ],
    },
    {
        label: 'Simulation',
        color: '#ec4899',
        nodes: [
            { type: 'persona_sim', label: 'Persona Simulator', description: 'Simulate lead persona reply', iconName: 'Bot', color: '#ec4899' },
        ],
    },
    {
        label: 'Logic',
        color: '#f97316',
        nodes: [
            { type: 'condition', label: 'Conditional Branch', description: 'Route on condition', iconName: 'GitBranch', color: '#f97316' },
            { type: 'lead_score', label: 'Lead Scoring', description: 'Score lead engagement', iconName: 'TrendingUp', color: '#84cc16' },
            { type: 'update_status', label: 'Update Lead Status', description: 'Set pipeline state', iconName: 'CheckSquare', color: '#ef4444' },
        ],
    },
]

/* ─── Per-node config field definitions ─── */
const NODE_CONFIG_FIELDS: Record<string, Array<{ key: string; label: string; type: 'text' | 'select' | 'number'; options?: string[]; placeholder?: string }>> = {
    trigger: [
        { key: 'trigger_type', label: 'Trigger Type', type: 'select', options: ['manual', 'new_lead', 'test_run'] },
    ],
    // Note: load_lead uses a special lead picker UI (see config panel render logic)
    load_lead: [],
    ai_compose: [
        { key: 'goal', label: 'Goal', type: 'select', options: ['intro', 'followup', 'meeting_request', 'demo_invite'] },
        { key: 'tone', label: 'Tone', type: 'select', options: ['friendly', 'professional', 'technical', 'casual'] },
        { key: 'length', label: 'Length', type: 'select', options: ['short', 'medium', 'long'] },
    ],
    personalize: [
        { key: 'personalization_fields', label: 'Fields (comma separated)', type: 'text', placeholder: 'company, industry, role' },
    ],
    ai_analyze: [
        { key: 'analysis_type', label: 'Analysis Type', type: 'select', options: ['intent', 'sentiment', 'urgency'] },
    ],
    send_message: [
        { key: 'channel', label: 'Channel', type: 'select', options: ['email', 'linkedin', 'sms'] },
        { key: 'message_field', label: 'Message Source Field', type: 'text', placeholder: 'personalized_message' },
    ],
    send_email: [
        { key: 'recipient', label: 'Recipient Email', type: 'text', placeholder: 'Leave blank to use lead email' },
        { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Outreach Subject' },
        { key: 'message_field', label: 'Message Source Field', type: 'text', placeholder: 'personalized_message' },
    ],
    delay: [
        { key: 'delay_type', label: 'Delay Type', type: 'select', options: ['fixed', 'random'] },
        { key: 'min_seconds', label: 'Min Seconds', type: 'number', placeholder: '60' },
        { key: 'max_seconds', label: 'Max Seconds', type: 'number', placeholder: '600' },
    ],
    check_reply: [
        { key: 'check_window_hours', label: 'Check Window (hours)', type: 'number', placeholder: '48' },
    ],
    persona_sim: [
        { key: 'persona', label: 'Persona', type: 'select', options: ['skeptical_cto', 'busy_founder', 'curious_engineer'] },
    ],
    condition: [
        { key: 'condition_field', label: 'State Field', type: 'text', placeholder: 'intent' },
        { key: 'equals', label: 'Equals', type: 'text', placeholder: 'interested' },
    ],
    lead_score: [
        { key: 'reply_positive', label: 'Points: Positive Reply', type: 'number', placeholder: '20' },
        { key: 'clicked_link', label: 'Points: Clicked Link', type: 'number', placeholder: '10' },
    ],
    update_status: [
        { key: 'status', label: 'New Status', type: 'select', options: ['contacted', 'interested', 'meeting_booked', 'rejected', 'nurturing'] },
    ],
}

const nodeTypes = { custom: CustomNode }

const LOG_ICONS: Record<string, string> = {
    trigger: '⚡', load_lead: '📋', ai_compose: '🧠', personalize: '✨',
    ai_analyze: '📊', send_message: '📨', send_email: '📧', delay: '⏱', check_reply: '👁',
    persona_sim: '🤖', condition: '🔀', lead_score: '📈', update_status: '🏷',
}

/* ─── Inner builder (must be inside ReactFlowProvider) ─── */
function WorkflowBuilder() {
    const [nodes, setNodes] = useState<Node[]>([])
    const [edges, setEdges] = useState<Edge[]>([])
    const [workflowName, setWorkflowName] = useState('Untitled Workflow')
    const [workflowId, setWorkflowId] = useState<number | null>(null)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

    // Config panel
    const [selectedNode, setSelectedNode] = useState<Node | null>(null)
    const [configValues, setConfigValues] = useState<Record<string, string>>({})

    // Run simulation
    const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
    const [runLog, setRunLog] = useState<any[]>([])
    const [expandedLogItems, setExpandedLogItems] = useState<Set<number>>(new Set())
    const [showLog, setShowLog] = useState(false)

    // Leads from DB (for lead picker)
    const [dbLeads, setDbLeads] = useState<{ id: number; first_name: string; last_name: string; company: string; job_title: string; email: string }[]>([])

    // Saved workflows list
    const [savedWorkflows, setSavedWorkflows] = useState<{ id: number; name: string; updated_at: string }[]>([])
    const [showWorkflowList, setShowWorkflowList] = useState(false)

    useEffect(() => {
        fetchWorkflowList()
        fetchLeads()
    }, [])

    const fetchWorkflowList = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/v1/workflows')
            if (res.ok) setSavedWorkflows(await res.json())
        } catch { /* ignore */ }
    }

    const deleteWorkflow = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation()   // don't trigger handleLoad
        if (!confirm('Delete this workflow?')) return
        await fetch(`http://localhost:8000/api/v1/workflows/${id}`, { method: 'DELETE' })
        // If we deleted the currently loaded workflow, reset state
        if (workflowId === id) {
            setNodes([]); setEdges([]); setWorkflowName('Untitled Workflow')
            setWorkflowId(null); setRunLog([]); setShowLog(false)
        }
        fetchWorkflowList()
    }

    const fetchLeads = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/v1/leads')
            if (res.ok) setDbLeads(await res.json())
        } catch { /* ignore */ }
    }

    /* ── React Flow callbacks ── */
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []
    )
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []
    )
    const onConnect = useCallback(
        (params: Connection) =>
            setEdges((eds) =>
                addEdge({ ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds)
            ), []
    )

    /* ── Node click → open config panel ── */
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node)
        setConfigValues({ ...(node.data.config as Record<string, string> || {}) })
    }, [])

    const onPaneClick = useCallback(() => {
        setSelectedNode(null)
    }, [])

    /* ── Save config changes back to the node ── */
    const applyConfig = () => {
        if (!selectedNode) return
        setNodes((nds) =>
            nds.map((n) =>
                n.id === selectedNode.id
                    ? { ...n, data: { ...n.data, config: { ...configValues } } }
                    : n
            )
        )
    }

    /* ── Drag-and-drop from palette ── */
    const onDragStart = (event: React.DragEvent, nodeData: typeof PALETTE_CATEGORIES[0]['nodes'][0]) => {
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
            data: { ...parsedType, config: {} },
        }
        setNodes((nds) => nds.concat(newNode))
    }, [])

    /* ── Save workflow ── */
    const handleSave = async () => {
        setSaveStatus('saving')
        const flowDef = JSON.stringify({ nodes, edges })
        try {
            let response: Response
            if (workflowId) {
                response = await fetch(`http://localhost:8000/api/v1/workflows/${workflowId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: workflowName, flow_definition: flowDef }),
                })
            } else {
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
            fetchWorkflowList()
            setTimeout(() => setSaveStatus('idle'), 2500)
        } catch {
            setSaveStatus('error')
            setTimeout(() => setSaveStatus('idle'), 2500)
        }
    }

    /* ── Load a saved workflow ── */
    const handleLoad = async (id: number, name: string) => {
        const res = await fetch(`http://localhost:8000/api/v1/workflows/${id}`)
        if (!res.ok) return
        const wf = await res.json()
        const parsed = JSON.parse(wf.flow_definition)
        setNodes(parsed.nodes || [])
        setEdges(parsed.edges || [])
        setWorkflowName(name)
        setWorkflowId(id)
        setSelectedNode(null)
        setRunLog([])
        setShowWorkflowList(false)
    }

    /* ── Run simulation ── */
    const handleRun = async () => {
        if (!workflowId) return
        setRunStatus('running')
        setShowLog(true)
        setRunLog([])
        setExpandedLogItems(new Set())
        try {
            const res = await fetch(`http://localhost:8000/api/v1/workflows/${workflowId}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}), // Empty payload as API key is no longer sent from frontend
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setRunLog(data.log || [])
            setRunStatus(data.success ? 'done' : 'error')
        } catch (e) {
            setRunLog([{ node_id: 'error', node_type: 'error', label: 'Request Failed', output: {}, error: String(e) }])
            setRunStatus('error')
        }
    }

    /* ── New workflow ── */
    const handleNew = () => {
        setNodes([]); setEdges([]); setWorkflowName('Untitled Workflow')
        setWorkflowId(null); setSaveStatus('idle'); setSelectedNode(null)
        setRunLog([]); setRunStatus('idle'); setShowLog(false)
    }

    const toggleLogItem = (i: number) => {
        setExpandedLogItems((prev) => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
        })
    }

    const saveLabel =
        saveStatus === 'saving' ? 'Saving…'
            : saveStatus === 'saved' ? '✓ Saved!'
                : saveStatus === 'error' ? '✗ Error'
                    : workflowId ? 'Update' : 'Save'

    const runLabel =
        runStatus === 'running' ? 'Running…'
            : runStatus === 'done' ? 'Run Again'
                : runStatus === 'error' ? 'Retry'
                    : 'Run Simulation'

    const configFields = selectedNode
        ? NODE_CONFIG_FIELDS[selectedNode.data.type as string] || []
        : []

    return (
        <div className={`wb-page ${showLog ? 'wb-page--log-open' : ''}`}>
            {/* ── Page Header ── */}
            <div className="page-header wb-header">
                <div className="wb-header-left">
                    <h1>
                        <GitBranch size={24} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
                        Workflow Builder
                    </h1>
                    <input
                        className="workflow-name-input"
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        placeholder="Workflow name…"
                    />
                </div>

                <div className="wb-header-right">
                    {/* Load */}
                    <div className="wb-dropdown-wrap">
                        <button className="btn-secondary" onClick={() => setShowWorkflowList((v) => !v)} title="Open saved workflow">
                            <FolderOpen size={14} /> Open
                        </button>
                        {showWorkflowList && (
                            <div className="wb-dropdown">
                                {savedWorkflows.length === 0
                                    ? <div className="wb-dropdown-empty">No saved workflows</div>
                                    : savedWorkflows.map((wf) => (
                                        <div key={wf.id} className="wb-dropdown-item" onClick={() => handleLoad(wf.id, wf.name)}>
                                            <span className="wf-name">{wf.name}</span>
                                            <span className="wf-date">{wf.updated_at.slice(0, 10)}</span>
                                            <button
                                                className="wf-delete-btn"
                                                onClick={(e) => deleteWorkflow(wf.id, e)}
                                                title="Delete workflow"
                                            >✕</button>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>

                    <button className="btn-secondary" onClick={handleNew} title="New blank workflow">
                        <Plus size={14} /> New
                    </button>
                    <button className="btn-primary" onClick={handleSave}
                        disabled={saveStatus === 'saving' || nodes.length === 0}>
                        <Save size={14} /> {saveLabel}
                    </button>

                    {/* Run */}
                    <button
                        className={`btn-run ${runStatus === 'running' ? 'btn-run--running' : ''} ${runStatus === 'error' ? 'btn-run--error' : ''}`}
                        onClick={handleRun}
                        disabled={runStatus === 'running' || !workflowId}
                        title={!workflowId ? 'Save the workflow first' : 'Execute workflow'}
                    >
                        {runStatus === 'running'
                            ? <Loader size={14} className="spin" />
                            : <Play size={14} />
                        }
                        {runLabel}
                    </button>
                </div>
            </div>

            {/* ── Builder layout ── */}
            <div className="wb-layout">
                {/* Left: palette */}
                <div className="wb-palette glass-panel">
                    <h3 className="palette-title">Node Palette</h3>
                    <p className="palette-subtitle">Drag nodes to the canvas</p>

                    <div className="palette-categories">
                        {PALETTE_CATEGORIES.map((cat) => (
                            <div key={cat.label} className="palette-category">
                                <div className="palette-cat-header" style={{ borderColor: cat.color }}>
                                    <span style={{ color: cat.color }}>{cat.label}</span>
                                </div>
                                {cat.nodes.map((node) => (
                                    <div
                                        key={node.type}
                                        className="palette-node"
                                        draggable
                                        onDragStart={(e) => onDragStart(e, node)}
                                    >
                                        <div className="node-color-bar" style={{ backgroundColor: node.color }} />
                                        <div className="node-icon" style={{ color: node.color }}>
                                            {node.iconName === 'Zap' && <Zap size={15} />}
                                            {node.iconName === 'Database' && <Database size={15} />}
                                            {node.iconName === 'Brain' && <Brain size={15} />}
                                            {node.iconName === 'Wand2' && <Wand2 size={15} />}
                                            {node.iconName === 'BarChart2' && <BarChart2 size={15} />}
                                            {node.iconName === 'Send' && <Send size={15} />}
                                            {node.iconName === 'Timer' && <Timer size={15} />}
                                            {node.iconName === 'Eye' && <Eye size={15} />}
                                            {node.iconName === 'Bot' && <Bot size={15} />}
                                            {node.iconName === 'GitBranch' && <GitBranch size={15} />}
                                            {node.iconName === 'TrendingUp' && <TrendingUp size={15} />}
                                            {node.iconName === 'CheckSquare' && <CheckSquare size={15} />}
                                        </div>
                                        <div className="node-info">
                                            <span className="node-label">{node.label}</span>
                                            <span className="node-desc">{node.description}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center: Canvas */}
                <div className="wb-canvas glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        deleteKeyCode={['Delete', 'Backspace']}
                        fitView
                        defaultEdgeOptions={{ style: { stroke: '#6366f1', strokeWidth: 2 }, animated: true }}
                    >
                        <Background color="#1e293b" gap={24} size={1} />
                        <Controls />

                        {nodes.length === 0 && (
                            <div className="canvas-empty-overlay">
                                <div className="canvas-empty">
                                    <GitBranch size={40} style={{ color: '#6366f1', marginBottom: '16px' }} />
                                    <h3>Build Your Outreach Workflow</h3>
                                    <p>Drag nodes from the palette on the left and connect them to create your AI-powered outreach sequence.</p>
                                    <div className="canvas-example-flow">
                                        {['Trigger', '→', 'Load Lead', '→', 'AI Compose', '→', 'Send', '→', 'Monitor']}
                                        {['Trigger', 'Load Lead', 'AI Compose', 'Send', 'Monitor'].map((s, i) => (
                                            <span key={i} className={i % 2 === 0 ? 'example-step' : 'example-arrow'}>{i % 2 === 0 ? s : '→'}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </ReactFlow>
                </div>

                {/* Right: Config panel */}
                {selectedNode && (
                    <div className="wb-config glass-panel">
                        <div className="config-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: selectedNode.data.color as string || '#6366f1'
                                }} />
                                <h3 style={{ margin: 0, fontSize: '14px' }}>{selectedNode.data.label as string}</h3>
                            </div>
                            <button className="btn-icon-sm" onClick={() => setSelectedNode(null)}><X size={14} /></button>
                        </div>
                        <p className="config-desc">{selectedNode.data.description as string}</p>

                        {/* ── Special: Load Lead Node — shows real lead picker ── */}
                        {(selectedNode.data.type as string) === 'load_lead' ? (
                            <div className="config-fields">
                                <div className="config-field">
                                    <label className="config-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <FolderOpen size={11} /> Select Lead from DB
                                    </label>
                                    {dbLeads.length === 0 ? (
                                        <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0' }}>
                                            No leads in DB yet. Upload leads on the Leads page first.
                                        </p>
                                    ) : (
                                        <select
                                            className="config-input"
                                            value={configValues['lead_index'] || '0'}
                                            onChange={(e) => setConfigValues((v) => ({ ...v, lead_index: e.target.value }))}
                                        >
                                            {dbLeads.map((lead, idx) => (
                                                <option key={lead.id} value={String(idx)}>
                                                    {lead.first_name} {lead.last_name} — {lead.company || 'N/A'} ({lead.job_title || lead.email})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <button className="btn-primary config-apply-btn" onClick={applyConfig}>
                                    Apply Config
                                </button>
                            </div>
                        ) : configFields.length === 0 ? (
                            <p className="config-empty">No configurable settings for this node.</p>
                        ) : (
                            <div className="config-fields">
                                {configFields.map((field) => (
                                    <div key={field.key} className="config-field">
                                        <label className="config-label">{field.label}</label>
                                        {field.type === 'select' ? (
                                            <select
                                                className="config-input"
                                                value={configValues[field.key] || ''}
                                                onChange={(e) => setConfigValues((v) => ({ ...v, [field.key]: e.target.value }))}
                                            >
                                                <option value="">— Select —</option>
                                                {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                className="config-input"
                                                type={field.type}
                                                placeholder={field.placeholder || ''}
                                                value={configValues[field.key] || ''}
                                                onChange={(e) => setConfigValues((v) => ({ ...v, [field.key]: e.target.value }))}
                                            />
                                        )}
                                    </div>
                                ))}
                                <button className="btn-primary config-apply-btn" onClick={applyConfig}>
                                    Apply Config
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Run Log Panel ── */}
            {showLog && (
                <div className="run-log-panel glass-panel">
                    <div className="run-log-header" onClick={() => setShowLog((v) => !v)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {runStatus === 'running' && <Loader size={14} className="spin" style={{ color: '#6366f1' }} />}
                            {runStatus === 'done' && <CheckCircle size={14} style={{ color: '#22c55e' }} />}
                            {runStatus === 'error' && <XCircle size={14} style={{ color: '#ef4444' }} />}
                            <span className="run-log-title">
                                {runStatus === 'running' ? 'Executing workflow…' : runStatus === 'done' ? `Completed — ${runLog.length} nodes` : 'Execution Error'}
                            </span>
                        </div>
                        <ChevronDown size={14} style={{ color: '#64748b' }} />
                    </div>

                    <div className="run-log-body">
                        {runLog.length === 0 && runStatus === 'running' && (
                            <div className="run-log-wait">Calling AI nodes, please wait…</div>
                        )}
                        {runLog.map((entry, i) => (
                            <div key={i} className={`run-log-entry ${entry.error ? 'run-log-entry--error' : 'run-log-entry--ok'}`}>
                                <div className="run-log-entry-header" onClick={() => toggleLogItem(i)}>
                                    <span className="run-log-icon">{LOG_ICONS[entry.node_type] || '🔷'}</span>
                                    <span className="run-log-label">{entry.label}</span>
                                    <span className="run-log-tag">{entry.node_type}</span>
                                    {expandedLogItems.has(i)
                                        ? <ChevronDown size={12} style={{ color: '#64748b', marginLeft: 'auto' }} />
                                        : <ChevronRight size={12} style={{ color: '#64748b', marginLeft: 'auto' }} />
                                    }
                                </div>
                                {expandedLogItems.has(i) && (
                                    <div className="run-log-entry-body">
                                        {entry.error
                                            ? <pre className="run-log-error">{entry.error}</pre>
                                            : <pre className="run-log-output">{JSON.stringify(entry.output, null, 2)}</pre>
                                        }
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB B — AI Workflow Designer
// ─────────────────────────────────────────────────────────────────────────────
function AIWorkflowDesigner() {
    const [prompt, setPrompt] = useState('')
    const [nodes, setNodes] = useState<Node[]>([])
    const [edges, setEdges] = useState<Edge[]>([])
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState('')
    const [workflowName, setWorkflowName] = useState('AI Generated Workflow')
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

    const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
    const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
    const onConnect = useCallback((params: Connection) =>
        setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds)), [])

    const handleGenerate = async () => {
        if (!prompt.trim()) return
        setGenerating(true)
        setError('')
        try {
            const res = await fetch('http://localhost:8000/api/v1/workflows/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Generation failed')
            const flow = data.flow
            setNodes(flow.nodes || [])
            setEdges(flow.edges || [])
            setWorkflowName(`AI: ${prompt.slice(0, 40)}`)
        } catch (e: any) {
            setError(e.message || 'Generation failed')
        } finally {
            setGenerating(false)
        }
    }

    const handleSave = async () => {
        if (!nodes.length) return
        setSaveStatus('saving')
        try {
            const res = await fetch('http://localhost:8000/api/v1/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: workflowName, flow_definition: JSON.stringify({ nodes, edges }) }),
            })
            if (!res.ok) throw new Error()
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus('idle'), 2500)
        } catch {
            setSaveStatus('error')
            setTimeout(() => setSaveStatus('idle'), 2500)
        }
    }

    const saveLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved!' : saveStatus === 'error' ? '✗ Error' : 'Save Workflow'

    return (
        <div className="ai-designer-page">
            <div className="ai-designer-prompt-bar glass-panel">
                <div className="ai-prompt-header">
                    <Brain size={18} style={{ color: '#6366f1' }} />
                    <span className="ai-prompt-title">Describe your outreach workflow</span>
                </div>
                <div className="ai-prompt-input-row">
                    <textarea
                        className="ai-prompt-textarea"
                        rows={3}
                        placeholder="e.g. Build a 4-step re-engagement sequence for startup founders who attended our webinar but haven't booked a demo. Include a delay, a personalized follow-up, and route on their reply intent."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleGenerate() }}
                    />
                    <div className="ai-prompt-actions">
                        <button className="btn-primary" onClick={handleGenerate} disabled={generating || !prompt.trim()} style={{ minWidth: '140px' }}>
                            {generating ? <><Loader size={14} className="spin" /> Generating…</> : <><Wand2 size={14} /> Generate</>}
                        </button>
                        {nodes.length > 0 && (
                            <button className="btn-secondary" onClick={handleSave} disabled={saveStatus === 'saving'}>
                                <Save size={14} /> {saveLabel}
                            </button>
                        )}
                    </div>
                </div>
                {error && <p style={{ color: '#ef4444', fontSize: '12px', margin: '6px 0 0' }}>⚠ {error}</p>}
                <p className="ai-prompt-hint">Tip: Describe the audience, goal, and any branching logic. Press ⌘+Enter to generate.</p>
            </div>

            <div className="ai-designer-canvas glass-panel">
                {nodes.length === 0 ? (
                    <div className="canvas-empty-overlay">
                        <div className="canvas-empty">
                            <Wand2 size={40} style={{ color: '#6366f1', marginBottom: '16px' }} />
                            <h3>Your workflow will appear here</h3>
                            <p>Describe what you want above and click Generate. The AI will build the node graph for you.</p>
                        </div>
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        fitView
                        defaultEdgeOptions={{ style: { stroke: '#6366f1', strokeWidth: 2 }, animated: true }}
                    >
                        <Background color="#1e293b" gap={24} size={1} />
                        <Controls />
                    </ReactFlow>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB C — A/B Testing
// ─────────────────────────────────────────────────────────────────────────────
function ABTestingPanel() {
    const [workflows, setWorkflows] = useState<{ id: number; name: string }[]>([])
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [promptA, setPromptA] = useState('Write a warm, friendly introduction email referencing their industry challenges. Focus on how we can save them time.')
    const [promptB, setPromptB] = useState('Write an urgent, ROI-focused outreach email. Lead with a specific business result we achieved for a similar company.')
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        fetch('http://localhost:8000/api/v1/workflows')
            .then(r => r.json())
            .then(data => { setWorkflows(data); if (data.length) setSelectedId(data[0].id) })
            .catch(() => { })
    }, [])

    const handleRun = async () => {
        if (!selectedId) return
        setRunning(true)
        setError('')
        setResult(null)
        try {
            const res = await fetch(`http://localhost:8000/api/v1/workflows/${selectedId}/ab-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt_a: promptA, prompt_b: promptB }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'A/B test failed')
            setResult(data)
        } catch (e: any) {
            setError(e.message || 'A/B test failed')
        } finally {
            setRunning(false)
        }
    }

    const winnerA = result?.verdict?.toLowerCase().includes('winner: email a')
    const winnerB = result?.verdict?.toLowerCase().includes('winner: email b')

    return (
        <div className="ab-page">
            {/* Controls */}
            <div className="ab-controls glass-panel">
                <div className="ab-controls-row">
                    <div className="ab-control-group">
                        <label className="ab-label">Workflow to test</label>
                        <select
                            className="config-input"
                            value={selectedId ?? ''}
                            onChange={(e) => setSelectedId(Number(e.target.value))}
                        >
                            {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <button
                        className={`btn-run ${running ? 'btn-run--running' : ''}`}
                        onClick={handleRun}
                        disabled={running || !selectedId}
                    >
                        {running ? <><Loader size={14} className="spin" /> Running A/B…</> : <><Play size={14} /> Run A/B Test</>}
                    </button>
                </div>
                {error && <p style={{ color: '#ef4444', fontSize: '12px', margin: '8px 0 0' }}>⚠ {error}</p>}
            </div>

            {/* Prompt Editor Row */}
            <div className="ab-prompts-row">
                <div className="ab-prompt-card glass-panel ab-prompt-card--a">
                    <div className="ab-prompt-header">
                        <span className="ab-badge ab-badge--a">A</span>
                        <span>Prompt Variant A</span>
                    </div>
                    <textarea
                        className="ab-prompt-textarea"
                        rows={4}
                        value={promptA}
                        onChange={(e) => setPromptA(e.target.value)}
                        placeholder="Describe how Email A should sound…"
                    />
                    {result && (
                        <div className={`ab-message-output ${winnerA ? 'ab-message-output--winner' : ''}`}>
                            {winnerA && <div className="ab-winner-badge">🏆 Winner</div>}
                            <p className="ab-output-label">Generated Email A</p>
                            <pre className="ab-message-text">{result.message_a || '(no ai_compose node in workflow)'}</pre>
                        </div>
                    )}
                </div>

                <div className="ab-vs-divider">VS</div>

                <div className="ab-prompt-card glass-panel ab-prompt-card--b">
                    <div className="ab-prompt-header">
                        <span className="ab-badge ab-badge--b">B</span>
                        <span>Prompt Variant B</span>
                    </div>
                    <textarea
                        className="ab-prompt-textarea"
                        rows={4}
                        value={promptB}
                        onChange={(e) => setPromptB(e.target.value)}
                        placeholder="Describe how Email B should sound…"
                    />
                    {result && (
                        <div className={`ab-message-output ${winnerB ? 'ab-message-output--winner' : ''}`}>
                            {winnerB && <div className="ab-winner-badge">🏆 Winner</div>}
                            <p className="ab-output-label">Generated Email B</p>
                            <pre className="ab-message-text">{result.message_b || '(no ai_compose node in workflow)'}</pre>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Verdict */}
            {result?.verdict && (
                <div className="ab-verdict glass-panel">
                    <div className="ab-verdict-header">
                        <Brain size={16} style={{ color: '#6366f1' }} />
                        <span>AI Verdict</span>
                    </div>
                    <div className="ab-verdict-text markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.verdict}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell with 3 tabs
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'editor' | 'designer' | 'abtest'

function WorkflowBuilderPage() {
    const [activeTab, setActiveTab] = useState<Tab>('editor')

    const TABS: { id: Tab; icon: React.ReactNode; label: string; sub: string }[] = [
        { id: 'editor', icon: <GitBranch size={15} />, label: 'Workflow Editor', sub: 'Build & test visually' },
        { id: 'designer', icon: <Wand2 size={15} />, label: 'AI Workflow Designer', sub: 'Generate from a prompt' },
        { id: 'abtest', icon: <BarChart2 size={15} />, label: 'A/B Testing', sub: 'Compare prompt variants' },
    ]

    return (
        <div className="wb-tabs-shell">
            {/* Tab Navigation */}
            <div className="wb-tab-nav glass-panel">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`wb-tab-btn ${activeTab === tab.id ? 'wb-tab-btn--active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="wb-tab-icon">{tab.icon}</span>
                        <span className="wb-tab-text">
                            <span className="wb-tab-label">{tab.label}</span>
                            <span className="wb-tab-sub">{tab.sub}</span>
                        </span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="wb-tab-content">
                {activeTab === 'editor' && (
                    <ReactFlowProvider>
                        <WorkflowBuilder />
                    </ReactFlowProvider>
                )}
                {activeTab === 'designer' && (
                    <ReactFlowProvider>
                        <AIWorkflowDesigner />
                    </ReactFlowProvider>
                )}
                {activeTab === 'abtest' && <ABTestingPanel />}
            </div>
        </div>
    )
}

export default WorkflowBuilderPage
