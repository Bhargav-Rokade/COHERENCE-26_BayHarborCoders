/*
  WorkflowBuilderPage.tsx — Workflow Builder Module

  This page will eventually host the full drag-and-drop workflow editor
  using @xyflow/react. For now, it shows:
  - A node palette (the 6 node types users can drag)
  - A canvas placeholder with a grid background

  Key concepts:
  - The NODE_TYPES array defines all available node types.
  - Each node type has an icon, label, description, and color.
  - In a future phase, these will become actual draggable React Flow nodes.
*/
import { Zap, Brain, Mail, Clock, GitBranch, Square } from 'lucide-react'
import './WorkflowBuilderPage.css'

/*
  NODE_TYPES defines the palette of workflow nodes.
  Each type maps to a specific step in an outreach workflow.
*/
const NODE_TYPES = [
    {
        type: 'trigger',
        label: 'Trigger',
        description: 'Starts the workflow',
        icon: Zap,
        color: '#34d399', /* green */
    },
    {
        type: 'ai_generate',
        label: 'AI Generate',
        description: 'Generate content with AI',
        icon: Brain,
        color: '#a78bfa', /* purple */
    },
    {
        type: 'action',
        label: 'Send Email',
        description: 'Send an outreach email',
        icon: Mail,
        color: '#60a5fa', /* blue */
    },
    {
        type: 'wait',
        label: 'Wait / Delay',
        description: 'Add a timed delay',
        icon: Clock,
        color: '#fbbf24', /* yellow */
    },
    {
        type: 'condition',
        label: 'Condition',
        description: 'Branch based on a condition',
        icon: GitBranch,
        color: '#f97316', /* orange */
    },
    {
        type: 'end',
        label: 'End',
        description: 'Terminate the workflow',
        icon: Square,
        color: '#f87171', /* red */
    },
]

function WorkflowBuilderPage() {
    return (
        <div className="wb-page">
            {/* Page Header */}
            <div className="page-header">
                <h1>
                    <GitBranch size={28} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
                    Workflow Builder
                </h1>
                <p>
                    Design outreach workflows by connecting nodes together.
                    Drag nodes from the palette onto the canvas to get started.
                </p>
            </div>

            {/* Builder layout: palette on left, canvas on right */}
            <div className="wb-layout">
                {/* Node Palette */}
                <div className="wb-palette glass-panel">
                    <h3 className="palette-title">Node Palette</h3>
                    <p className="palette-subtitle">Drag nodes to the canvas</p>

                    <div className="palette-nodes">
                        {NODE_TYPES.map((node) => (
                            <div key={node.type} className="palette-node" draggable>
                                {/* Color accent bar on the left */}
                                <div
                                    className="node-color-bar"
                                    style={{ backgroundColor: node.color }}
                                />
                                {/* Node icon */}
                                <div className="node-icon" style={{ color: node.color }}>
                                    <node.icon size={18} />
                                </div>
                                {/* Node info */}
                                <div className="node-info">
                                    <span className="node-label">{node.label}</span>
                                    <span className="node-desc">{node.description}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Canvas Area — placeholder for React Flow */}
                <div className="wb-canvas glass-panel">
                    <div className="canvas-grid">
                        {/* Empty state message */}
                        <div className="canvas-empty">
                            <div className="canvas-empty-icon">
                                <GitBranch size={48} />
                            </div>
                            <h3>Build Your Workflow</h3>
                            <p>Drag nodes from the palette and connect them to create your outreach sequence.</p>
                            <div className="canvas-example">
                                <span className="example-step">Trigger</span>
                                <span className="example-arrow">→</span>
                                <span className="example-step">AI Generate</span>
                                <span className="example-arrow">→</span>
                                <span className="example-step">Send Email</span>
                                <span className="example-arrow">→</span>
                                <span className="example-step">Wait</span>
                                <span className="example-arrow">→</span>
                                <span className="example-step">Condition</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default WorkflowBuilderPage
