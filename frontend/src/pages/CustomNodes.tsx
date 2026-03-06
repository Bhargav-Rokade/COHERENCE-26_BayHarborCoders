import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import {
    Zap, Database, Brain, Wand2, BarChart2,
    Send, Timer, Eye, Bot, GitBranch, TrendingUp,
    CheckSquare,
} from 'lucide-react'

const iconMap: Record<string, React.ElementType> = {
    // New 12-node icons
    Zap, Database, Brain, Wand2, BarChart2,
    Send, Timer, Eye, Bot, GitBranch, TrendingUp, CheckSquare,
    // Legacy icons (keep for backward compat)
    Mail: Send,
    Clock: Timer,
    Square: CheckSquare,
}

export function CustomNode({ data, selected }: NodeProps) {
    const IconComponent =
        data.iconName && typeof data.iconName === 'string'
            ? (iconMap[data.iconName as string] ?? Zap)
            : Zap

    const color = (data.color as string) || '#3b82f6'
    const nodeType = data.type as string

    const isCondition = nodeType === 'condition'
    const isTrigger = nodeType === 'trigger'
    const isEnd = nodeType === 'update_status'

    return (
        <div
            style={{
                background: 'rgba(15, 23, 42, 0.97)',
                border: `1.5px solid ${selected ? color : color + '60'}`,
                borderRadius: '12px',
                padding: '12px 16px',
                minWidth: '200px',
                maxWidth: '240px',
                boxShadow: selected
                    ? `0 0 0 2px ${color}40, 0 8px 32px rgba(0,0,0,0.4)`
                    : '0 4px 20px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#f8fafc',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'box-shadow 0.15s ease',
                position: 'relative',
            }}
        >
            {/* Left color accent bar */}
            <div style={{
                position: 'absolute',
                left: 0, top: '20%', bottom: '20%',
                width: '3px',
                background: color,
                borderRadius: '2px',
            }} />

            {/* Input handle — not on trigger */}
            {!isTrigger && (
                <Handle
                    type="target"
                    position={Position.Left}
                    style={{ background: color, width: '10px', height: '10px', border: '2px solid #0f172a' }}
                />
            )}

            {/* Icon */}
            <div style={{
                background: `${color}20`,
                color,
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}>
                <IconComponent size={18} />
            </div>

            {/* Label + description */}
            <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {data.label as string}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {data.description as string}
                </div>
            </div>

            {/* Output handle — condition gets two (true/false), end nodes get none */}
            {!isEnd && !isCondition && (
                <Handle
                    type="source"
                    position={Position.Right}
                    style={{ background: color, width: '10px', height: '10px', border: '2px solid #0f172a' }}
                />
            )}
            {isCondition && (
                <>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        style={{ left: '30%', background: '#22c55e', width: '10px', height: '10px', border: '2px solid #0f172a' }}
                    />
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        style={{ left: '70%', background: '#ef4444', width: '10px', height: '10px', border: '2px solid #0f172a' }}
                    />
                    {/* True/False labels */}
                    <div style={{
                        position: 'absolute', bottom: '-20px', left: '20%',
                        fontSize: '10px', color: '#22c55e', fontWeight: 600,
                    }}>✓ true</div>
                    <div style={{
                        position: 'absolute', bottom: '-20px', left: '60%',
                        fontSize: '10px', color: '#ef4444', fontWeight: 600,
                    }}>✗ false</div>
                </>
            )}
        </div>
    )
}
