import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Zap, Brain, Mail, Clock, GitBranch, Square } from 'lucide-react'

// Map icon names to the actual Lucide components
const iconMap: Record<string, React.ElementType> = {
    Zap,
    Brain,
    Mail,
    Clock,
    GitBranch,
    Square
}

export function CustomNode({ data }: NodeProps) {
    const IconComponent = data.iconName && typeof data.iconName === 'string'
        ? iconMap[data.iconName as string]
        : Zap

    return (
        <div style={{
            background: 'rgba(30, 41, 59, 0.95)',
            border: `1px solid ${data.color || '#3b82f6'}`,
            borderRadius: '12px',
            padding: '12px 16px',
            minWidth: '200px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#f8fafc',
            fontFamily: 'system-ui, sans-serif'
        }}>
            {/* Input handle (don't show for trigger nodes) */}
            {data.type !== 'trigger' && (
                <Handle
                    type="target"
                    position={Position.Left}
                    style={{ background: '#94a3b8', width: '8px', height: '8px' }}
                />
            )}

            <div style={{
                background: data.color ? `${data.color}20` : '#3b82f620',
                color: data.color as string || '#3b82f6',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <IconComponent size={20} />
            </div>

            <div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>
                    {data.label as string}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {data.description as string}
                </div>
            </div>

            {/* Output handle (don't show for end nodes) */}
            {data.type !== 'end' && (
                <Handle
                    type="source"
                    position={Position.Right}
                    style={{ background: '#94a3b8', width: '8px', height: '8px' }}
                />
            )}
        </div>
    )
}
