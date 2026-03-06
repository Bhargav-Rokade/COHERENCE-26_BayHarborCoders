/*
  LeadsPage.tsx — Lead Intelligence Module

  4-section page:
  1. CSV/Excel upload with drag-and-drop
  2. Leads data table (searchable)
  3. Analytics metric cards (Pandas-powered via backend)
  4. AI Campaign Idea generator
*/
import { useState, useCallback, useEffect, useRef, DragEvent } from 'react'
import {
    Users, Upload, Search, Trash2, BarChart2,
    Sparkles, AlertCircle, CheckCircle, XCircle, Loader2, ChevronDown
} from 'lucide-react'
import './LeadsPage.css'

const API_BASE = 'http://localhost:8000/api/v1/leads'

// ---- Types ----
interface Lead {
    id: number
    email: string
    first_name: string | null
    last_name: string | null
    company: string | null
    job_title: string | null
    industry: string | null
    country: string | null
    lead_source: string | null
    notes: string | null
    created_at: string | null
}

interface AnalyticsItem { label: string; count: number }

interface Analytics {
    total_leads: number
    by_industry: AnalyticsItem[]
    by_country: AnalyticsItem[]
    by_job_title: AnalyticsItem[]
    by_lead_source: AnalyticsItem[]
}

// ---- Sub-components ----

function BarList({ items }: { items: AnalyticsItem[] }) {
    const max = items[0]?.count ?? 1
    return (
        <ul className="bar-list">
            {items.map((item) => (
                <li key={item.label} className="bar-item">
                    <span className="bar-label">{item.label}</span>
                    <div className="bar-track">
                        <div
                            className="bar-fill"
                            style={{ width: `${(item.count / max) * 100}%` }}
                        />
                    </div>
                    <span className="bar-count">{item.count}</span>
                </li>
            ))}
        </ul>
    )
}

// ---- Main Page ----
export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [analytics, setAnalytics] = useState<Analytics | null>(null)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [analyticsLoading, setAnalyticsLoading] = useState(false)

    // Upload state
    const [isDragging, setIsDragging] = useState(false)
    const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number; total_in_file: number } | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // AI Campaign state
    const [apiKey, setApiKey] = useState('')
    const [campaignContext, setCampaignContext] = useState('')
    const [campaignIdeas, setCampaignIdeas] = useState('')
    const [campaignLoading, setCampaignLoading] = useState(false)
    const [campaignError, setCampaignError] = useState<string | null>(null)
    const [showCampaignPanel, setShowCampaignPanel] = useState(false)

    // ---- Data fetching ----
    const fetchLeads = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(API_BASE)
            if (!res.ok) throw new Error('Failed to fetch leads')
            setLeads(await res.json())
        } catch (e: any) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchAnalytics = useCallback(async () => {
        setAnalyticsLoading(true)
        try {
            const res = await fetch(`${API_BASE}/analytics`)
            if (!res.ok) throw new Error('Failed to fetch analytics')
            setAnalytics(await res.json())
        } catch (e: any) {
            console.error(e)
        } finally {
            setAnalyticsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLeads()
        fetchAnalytics()
    }, [fetchLeads, fetchAnalytics])

    // ---- Upload handling ----
    const handleFile = useCallback(async (file: File) => {
        setUploadError(null)
        setUploadResult(null)
        const formData = new FormData()
        formData.append('file', file)
        try {
            const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Upload failed')
            setUploadResult(data)
            fetchLeads()
            fetchAnalytics()
        } catch (e: any) {
            setUploadError(e.message)
        }
    }, [fetchLeads, fetchAnalytics])

    const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }, [handleFile])

    const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true) }
    const onDragLeave = () => setIsDragging(false)

    // ---- Delete a lead ----
    const deleteLead = async (id: number) => {
        try {
            await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
            setLeads((prev) => prev.filter((l) => l.id !== id))
            fetchAnalytics()
        } catch (e) {
            console.error(e)
        }
    }

    // ---- AI Campaign Ideas ----
    const generateCampaign = async () => {
        if (!apiKey.trim()) { setCampaignError('Please enter your OpenAI API key.'); return }
        setCampaignError(null)
        setCampaignLoading(true)
        setCampaignIdeas('')
        try {
            const res = await fetch(`${API_BASE}/campaign-ideas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ openai_api_key: apiKey, context: campaignContext || null }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'AI request failed')
            setCampaignIdeas(data.campaign_ideas)
        } catch (e: any) {
            setCampaignError(e.message)
        } finally {
            setCampaignLoading(false)
        }
    }

    // ---- Filtered leads for table ----
    const filteredLeads = leads.filter((l) => {
        const q = search.toLowerCase()
        return (
            (l.email ?? '').toLowerCase().includes(q) ||
            (l.first_name ?? '').toLowerCase().includes(q) ||
            (l.last_name ?? '').toLowerCase().includes(q) ||
            (l.company ?? '').toLowerCase().includes(q) ||
            (l.job_title ?? '').toLowerCase().includes(q) ||
            (l.industry ?? '').toLowerCase().includes(q)
        )
    })

    return (
        <div className="leads-page">
            {/* ---- Page Header ---- */}
            <div className="page-header">
                <h1>
                    <Users size={28} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
                    Lead Intelligence
                </h1>
                <p>Ingest leads from CSV / Excel, analyse demographics, and generate AI-powered outreach campaigns.</p>
            </div>

            {/* ======================================
          SECTION 1 — CSV / Excel Upload
      ====================================== */}
            <section className="leads-section glass-panel">
                <h3 className="section-title">
                    <Upload size={18} style={{ marginRight: '8px' }} />
                    Ingest Leads
                </h3>
                <p className="section-hint">
                    Upload a <code>.csv</code> or <code>.xlsx</code> file. Required column: <code>email</code>. Optional:&nbsp;
                    <code>first_name</code>, <code>last_name</code>, <code>company</code>, <code>job_title</code>,&nbsp;
                    <code>industry</code>, <code>country</code>, <code>lead_source</code>, <code>notes</code>.
                </p>

                {/* Drop Zone */}
                <div
                    className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload size={36} className="drop-icon" />
                    <p className="drop-text">Drag &amp; drop your file here, or <span className="drop-link">browse</span></p>
                    <p className="drop-sub">.csv or .xlsx up to 10 MB</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        style={{ display: 'none' }}
                        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                    />
                </div>

                {/* Upload result toast */}
                {uploadResult && (
                    <div className="upload-toast toast-success">
                        <CheckCircle size={16} />
                        <span>
                            <strong>{uploadResult.inserted}</strong> leads inserted,&nbsp;
                            <strong>{uploadResult.skipped}</strong> skipped (already in DB).&nbsp;
                            Total in file: <strong>{uploadResult.total_in_file}</strong>.
                        </span>
                    </div>
                )}
                {uploadError && (
                    <div className="upload-toast toast-error">
                        <XCircle size={16} />
                        <span>{uploadError}</span>
                    </div>
                )}
            </section>

            {/* ======================================
          SECTION 2 — Leads Table
      ====================================== */}
            <section className="leads-section glass-panel">
                <div className="section-header-row">
                    <h3 className="section-title">
                        <Users size={18} style={{ marginRight: '8px' }} />
                        All Leads
                        <span className="badge badge-info" style={{ marginLeft: '10px' }}>{leads.length}</span>
                    </h3>
                    <div className="search-box">
                        <Search size={15} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search leads…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="center-loader"><Loader2 size={28} className="spin" /></div>
                ) : filteredLeads.length === 0 ? (
                    <div className="empty-state">
                        <AlertCircle size={32} />
                        <p>{search ? 'No leads match your search.' : 'No leads yet. Upload a CSV or Excel file to get started.'}</p>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="leads-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Company</th>
                                    <th>Job Title</th>
                                    <th>Industry</th>
                                    <th>Country</th>
                                    <th>Source</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLeads.map((lead) => (
                                    <tr key={lead.id}>
                                        <td className="lead-name">
                                            {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—'}
                                        </td>
                                        <td className="lead-email">{lead.email}</td>
                                        <td>{lead.company ?? '—'}</td>
                                        <td>{lead.job_title ?? '—'}</td>
                                        <td>
                                            {lead.industry
                                                ? <span className="badge badge-info">{lead.industry}</span>
                                                : '—'}
                                        </td>
                                        <td>{lead.country ?? '—'}</td>
                                        <td>
                                            {lead.lead_source
                                                ? <span className="badge badge-warning">{lead.lead_source}</span>
                                                : '—'}
                                        </td>
                                        <td>
                                            <button
                                                className="icon-btn icon-btn-danger"
                                                onClick={() => deleteLead(lead.id)}
                                                title="Delete lead"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ======================================
          SECTION 3 — Analytics
      ====================================== */}
            <section className="leads-section glass-panel">
                <h3 className="section-title">
                    <BarChart2 size={18} style={{ marginRight: '8px' }} />
                    Lead Analytics
                </h3>

                {analyticsLoading ? (
                    <div className="center-loader"><Loader2 size={28} className="spin" /></div>
                ) : !analytics || analytics.total_leads === 0 ? (
                    <div className="empty-state">
                        <BarChart2 size={32} />
                        <p>Upload leads to see demographic analytics here.</p>
                    </div>
                ) : (
                    <>
                        {/* Total count hero */}
                        <div className="analytics-hero">
                            <span className="analytics-total">{analytics.total_leads}</span>
                            <span className="analytics-total-label">Total Leads</span>
                        </div>

                        <div className="analytics-grid">
                            <div className="analytics-card">
                                <h4 className="analytics-card-title">Top Industries</h4>
                                <BarList items={analytics.by_industry} />
                            </div>
                            <div className="analytics-card">
                                <h4 className="analytics-card-title">Top Countries</h4>
                                <BarList items={analytics.by_country} />
                            </div>
                            <div className="analytics-card">
                                <h4 className="analytics-card-title">Top Job Titles</h4>
                                <BarList items={analytics.by_job_title} />
                            </div>
                            <div className="analytics-card">
                                <h4 className="analytics-card-title">Lead Sources</h4>
                                <BarList items={analytics.by_lead_source} />
                            </div>
                        </div>
                    </>
                )}
            </section>

            {/* ======================================
          SECTION 4 — AI Campaign Ideas
      ====================================== */}
            <section className="leads-section glass-panel campaign-section">
                <div
                    className="campaign-header"
                    onClick={() => setShowCampaignPanel((p) => !p)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={showCampaignPanel}
                >
                    <h3 className="section-title" style={{ marginBottom: 0 }}>
                        <Sparkles size={18} style={{ marginRight: '8px' }} />
                        AI Campaign Ideas
                    </h3>
                    <ChevronDown
                        size={20}
                        className={`chevron ${showCampaignPanel ? 'chevron-open' : ''}`}
                    />
                </div>
                <p className="section-hint" style={{ marginTop: '4px' }}>
                    Let GPT-4o analyse your leads and design a personalised cold email outreach campaign.
                </p>

                {showCampaignPanel && (
                    <div className="campaign-body">
                        <label className="field-label">OpenAI API Key</label>
                        <input
                            type="password"
                            className="text-input"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />

                        <label className="field-label" style={{ marginTop: '12px' }}>
                            Additional Context <span style={{ opacity: 0.5 }}>(optional)</span>
                        </label>
                        <textarea
                            className="text-input"
                            rows={3}
                            placeholder="e.g. We sell a B2B SaaS tool for HR teams. Focus on SMBs in the US."
                            value={campaignContext}
                            onChange={(e) => setCampaignContext(e.target.value)}
                        />

                        <button
                            className="btn-primary"
                            onClick={generateCampaign}
                            disabled={campaignLoading}
                            style={{ marginTop: '14px' }}
                        >
                            {campaignLoading
                                ? <><Loader2 size={16} className="spin" /> Generating…</>
                                : <><Sparkles size={16} /> Generate Campaign Ideas</>}
                        </button>

                        {campaignError && (
                            <div className="upload-toast toast-error" style={{ marginTop: '12px' }}>
                                <XCircle size={16} />
                                <span>{campaignError}</span>
                            </div>
                        )}

                        {campaignIdeas && (
                            <div className="campaign-output">
                                <pre className="campaign-pre">{campaignIdeas}</pre>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    )
}
