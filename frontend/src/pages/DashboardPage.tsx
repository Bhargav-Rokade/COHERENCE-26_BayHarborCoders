/*
  DashboardPage.tsx — Visualization Dashboard Module

  Displays workflow execution data in a monitoring-style layout.
  For the MVP, all data is mock/hardcoded. In a later phase,
  this will pull from the FastAPI backend.

  Key concepts:
  - MOCK_STATS: Summary statistics shown as cards at the top
  - MOCK_RUNS: Simulated workflow execution records
  - MOCK_LOGS: Simulated execution log entries
*/
import { BarChart3, Activity, CheckCircle, XCircle, Clock } from 'lucide-react'
import './DashboardPage.css'

/* Summary statistics displayed as cards */
const MOCK_STATS = [
    { label: 'Total Runs', value: '24', icon: Activity, color: '#6366f1' },
    { label: 'Active', value: '3', icon: Clock, color: '#fbbf24' },
    { label: 'Completed', value: '18', icon: CheckCircle, color: '#34d399' },
    { label: 'Failed', value: '3', icon: XCircle, color: '#f87171' },
]

/* Mock workflow run data — resembles what a real monitoring table would show */
const MOCK_RUNS = [
    { lead: 'John Smith', workflow: 'Cold Outreach', step: 'Follow-up Email', status: 'waiting' },
    { lead: 'Sarah Chen', workflow: 'Cold Outreach', step: 'AI Generate', status: 'active' },
    { lead: 'Mike Johnson', workflow: 'Re-engagement', step: 'End', status: 'completed' },
    { lead: 'Emily Davis', workflow: 'Cold Outreach', step: 'Send Email', status: 'active' },
    { lead: 'Alex Turner', workflow: 'Demo Follow-up', step: 'Condition Check', status: 'failed' },
]

/* Mock execution log entries — chronological events */
const MOCK_LOGS = [
    { time: '10:01 AM', lead: 'John Smith', event: 'Email Generated', type: 'info' },
    { time: '10:02 AM', lead: 'John Smith', event: 'Email Sent', type: 'success' },
    { time: '10:05 AM', lead: 'John Smith', event: 'Waiting (5 min delay)', type: 'info' },
    { time: '10:08 AM', lead: 'Sarah Chen', event: 'Workflow Started', type: 'info' },
    { time: '10:09 AM', lead: 'Sarah Chen', event: 'AI Generating Message...', type: 'info' },
    { time: '10:12 AM', lead: 'Mike Johnson', event: 'Workflow Completed', type: 'success' },
    { time: '10:15 AM', lead: 'Alex Turner', event: 'Condition Failed — No Reply', type: 'error' },
    { time: '10:18 AM', lead: 'Emily Davis', event: 'Email Generated', type: 'info' },
]

/*
  Helper function to pick the right CSS class for a status badge.
  Maps status strings to badge color classes defined in index.css.
*/
function getStatusBadgeClass(status: string): string {
    switch (status) {
        case 'active': return 'badge badge-info'
        case 'waiting': return 'badge badge-warning'
        case 'completed': return 'badge badge-success'
        case 'failed': return 'badge badge-error'
        default: return 'badge'
    }
}

function getLogTypeClass(type: string): string {
    switch (type) {
        case 'success': return 'log-success'
        case 'error': return 'log-error'
        default: return ''
    }
}

function DashboardPage() {
    return (
        <div className="dash-page">
            {/* Page Header */}
            <div className="page-header">
                <h1>
                    <BarChart3 size={28} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
                    Dashboard
                </h1>
                <p>Monitor workflow execution, track lead progression, and review logs.</p>
            </div>

            {/* ---- Summary Stat Cards ---- */}
            <div className="stat-cards">
                {MOCK_STATS.map((stat) => (
                    <div key={stat.label} className="stat-card glass-panel">
                        <div className="stat-icon" style={{ color: stat.color }}>
                            <stat.icon size={22} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{stat.value}</span>
                            <span className="stat-label">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ---- Two-column layout: Runs table + Logs ---- */}
            <div className="dash-grid">
                {/* Workflow Runs Table */}
                <div className="glass-panel">
                    <h3 className="section-title">Workflow Runs</h3>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Lead</th>
                                    <th>Workflow</th>
                                    <th>Current Step</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_RUNS.map((run, index) => (
                                    <tr key={index}>
                                        <td className="lead-name">{run.lead}</td>
                                        <td>{run.workflow}</td>
                                        <td>{run.step}</td>
                                        <td>
                                            <span className={getStatusBadgeClass(run.status)}>
                                                {run.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Execution Logs */}
                <div className="glass-panel">
                    <h3 className="section-title">Execution Logs</h3>
                    <div className="logs-list">
                        {MOCK_LOGS.map((log, index) => (
                            <div key={index} className={`log-entry ${getLogTypeClass(log.type)}`}>
                                <span className="log-time">{log.time}</span>
                                <span className="log-lead">{log.lead}</span>
                                <span className="log-event">{log.event}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DashboardPage
