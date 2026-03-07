/*
  DashboardPage.tsx — Visualization Dashboard Module

  Displays high-level platform statistics and recent lead activity,
  fetching actual data from the FastAPI backend.
*/
import { useState, useEffect } from 'react'
import { BarChart3, Users, GitBranch, Database, BookOpen, Activity, AlertCircle } from 'lucide-react'
import './DashboardPage.css'

interface DashboardStats {
    summary: {
        total_leads: number
        total_workflows: number
        kb_configured: boolean
        top_lead_source: string
    }
    recent_leads: Array<{
        name: string
        company: string
        industry: string
        source: string
        created_at: string
    }>
    lead_sources: Array<{
        name: string
        value: number
    }>
}

function DashboardPage() {
    const [data, setData] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Fetch real stats from the backend
        fetch('http://localhost:8000/api/v1/dashboard/stats')
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok')
                return res.json()
            })
            .then(json => {
                setData(json)
                setLoading(false)
            })
            .catch(err => {
                console.error('Failed to load dashboard data:', err)
                setError('Failed to load dashboard data. Ensure the backend is running.')
                setLoading(false)
            })
    }, [])

    if (loading) {
        return (
            <div className="dash-page" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity className="spinner" size={24} style={{ animation: 'spin 2s linear infinite' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Loading dashboard statistics...</span>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="dash-page error" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-error)' }}>
                <AlertCircle size={24} /> {error}
            </div>
        )
    }

    /* Map API summary data to UI cards */
    const STATS_CARDS = [
        { label: 'Total Leads', value: data.summary.total_leads, icon: Users, color: '#4f46e5' }, /* deep indigo */
        { label: 'Workflows', value: data.summary.total_workflows, icon: GitBranch, color: '#f59e0b' }, /* amber */
        { label: 'KB Status', value: data.summary.kb_configured ? 'Ready' : 'Pending', icon: BookOpen, color: data.summary.kb_configured ? '#10b981' : '#ef4444' }, /* green/red */
        { label: 'Top Source', value: data.summary.top_lead_source, icon: Database, color: '#0ea5e9' }, /* sky blue */
    ]

    return (
        <div className="dash-page">
            {/* Page Header */}
            <div className="page-header">
                <h1>
                    <BarChart3 size={28} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
                    Platform Overview
                </h1>
                <p>Monitor platform growth, database statistics, and recent lead activity.</p>
            </div>

            {/* ---- Summary Stat Cards ---- */}
            <div className="stat-cards">
                {STATS_CARDS.map((stat) => (
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

            {/* ---- Recent Leads Table ---- */}
            <div className="dash-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="glass-panel">
                    <h3 className="section-title">Recent Leads</h3>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Lead Name</th>
                                    <th>Company</th>
                                    <th>Industry</th>
                                    <th>Source</th>
                                    <th>Added On</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recent_leads.length > 0 ? (
                                    data.recent_leads.map((lead, index) => (
                                        <tr key={index}>
                                            <td className="lead-name">{lead.name}</td>
                                            <td>{lead.company}</td>
                                            <td>{lead.industry}</td>
                                            <td>
                                                <span className="badge badge-info">
                                                    {lead.source}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)' }}>{lead.created_at}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                            No leads have been ingested yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DashboardPage
