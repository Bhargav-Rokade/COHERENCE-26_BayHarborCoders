/*
  KnowledgeBasePage.tsx — Company Knowledge Base Module (Redesigned)

  Three input modes:
    1. Text/Paragraph — paste unstructured text, AI extracts parameters
    2. Questionnaire   — answer guided questions, AI refines them
    3. File Upload     — upload PDF/DOCX/TXT, AI extracts parameters

  Structured output is displayed in editable parameter cards on the right.
  Saved structured data is used by the Workflow Builder for AI outreach.
*/
import { useState, useEffect, useRef, useCallback } from 'react'
import {
    BookOpen, Save, CheckCircle, Loader2, FileText,
    Upload, ClipboardList, Type, Sparkles, X, AlertCircle,
    Building2, Package, Target, Award, MessageCircle, Key, FileCheck
} from 'lucide-react'
import './KnowledgeBasePage.css'

const API_BASE = 'http://localhost:8000/api/v1/knowledge-base'
const MAX_CHARS = 5000

/* ---- Types ---- */
type InputMode = 'text' | 'questionnaire' | 'file'

interface StructuredData {
    company_description: string
    product_offering: string
    target_customers: string
    value_proposition: string
    messaging_tone: string
}

const EMPTY_STRUCTURED: StructuredData = {
    company_description: '',
    product_offering: '',
    target_customers: '',
    value_proposition: '',
    messaging_tone: '',
}

/* Parameter card definitions */
const PARAM_CARDS = [
    {
        key: 'company_description' as keyof StructuredData,
        label: 'Company Description',
        hint: 'What does your company do?',
        icon: Building2,
        color: 'desc',
    },
    {
        key: 'product_offering' as keyof StructuredData,
        label: 'Product Offering',
        hint: 'What products or services do you sell?',
        icon: Package,
        color: 'product',
    },
    {
        key: 'target_customers' as keyof StructuredData,
        label: 'Target Customers',
        hint: 'Who is your ideal customer profile?',
        icon: Target,
        color: 'target',
    },
    {
        key: 'value_proposition' as keyof StructuredData,
        label: 'Value Proposition',
        hint: 'What makes you different from competitors?',
        icon: Award,
        color: 'value',
    },
    {
        key: 'messaging_tone' as keyof StructuredData,
        label: 'Messaging Tone',
        hint: 'Formal, casual, friendly, authoritative?',
        icon: MessageCircle,
        color: 'tone',
    },
]

function KnowledgeBasePage() {
    // --- State ---
    const [inputMode, setInputMode] = useState<InputMode>('text')
    const [textContent, setTextContent] = useState('')
    const [structured, setStructured] = useState<StructuredData>({ ...EMPTY_STRUCTURED })
    const [questionnaire, setQuestionnaire] = useState<StructuredData>({ ...EMPTY_STRUCTURED })
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [dragOver, setDragOver] = useState(false)

    const [apiKey, setApiKey] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // --- Load existing KB data on mount ---
    useEffect(() => {
        const fetchKb = async () => {
            try {
                const res = await fetch(API_BASE)
                if (res.ok) {
                    const data = await res.json()
                    setTextContent(data.content || '')
                    if (data.structured) {
                        setStructured({
                            company_description: data.structured.company_description || '',
                            product_offering: data.structured.product_offering || '',
                            target_customers: data.structured.target_customers || '',
                            value_proposition: data.structured.value_proposition || '',
                            messaging_tone: data.structured.messaging_tone || '',
                        })
                    }
                }
            } catch (err) {
                console.error('Failed to fetch knowledge base:', err)
            } finally {
                setIsLoading(false)
            }
        }
        fetchKb()
    }, [])

    // --- Helpers ---
    const hasStructuredData = Object.values(structured).some((v) => v && v.trim() !== '')
    const filledCount = Object.values(structured).filter((v) => v && v.trim() !== '').length

    const clearError = () => setError(null)

    // --- AI Extract from Text ---
    const handleExtractFromText = async () => {
        if (!textContent.trim()) return
        if (!apiKey) { setError('Please enter your OpenAI API key above.'); return }

        setIsProcessing(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/extract-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textContent, openai_api_key: apiKey }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Extraction failed')
            if (data.structured) {
                setStructured(data.structured)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to extract data.')
        } finally {
            setIsProcessing(false)
        }
    }

    // --- AI Extract from File ---
    const handleExtractFromFile = async () => {
        if (!selectedFile) return
        if (!apiKey) { setError('Please enter your OpenAI API key above.'); return }

        setIsProcessing(true)
        setError(null)
        try {
            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('openai_api_key', apiKey)

            const res = await fetch(`${API_BASE}/extract-file`, {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'File extraction failed')
            if (data.structured) {
                setStructured(data.structured)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to extract data from file.')
        } finally {
            setIsProcessing(false)
        }
    }

    // --- AI Refine Questionnaire ---
    const handleRefineQuestionnaire = async () => {
        const hasAny = Object.values(questionnaire).some((v) => v.trim() !== '')
        if (!hasAny) { setError('Please answer at least one question.'); return }
        if (!apiKey) { setError('Please enter your OpenAI API key above.'); return }

        setIsProcessing(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/refine-questionnaire`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...questionnaire, openai_api_key: apiKey }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Refinement failed')
            if (data.structured) {
                setStructured(data.structured)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to refine answers.')
        } finally {
            setIsProcessing(false)
        }
    }

    // --- Save Structured to DB ---
    const handleSaveStructured = async () => {
        setIsSaving(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/save-structured`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(structured),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Save failed')
            setIsSaved(true)
            setTimeout(() => setIsSaved(false), 2500)
        } catch (err: any) {
            setError(err.message || 'Failed to save.')
        } finally {
            setIsSaving(false)
        }
    }

    // --- File handling ---
    const handleFileSelect = useCallback((file: File) => {
        const validExtensions = ['.pdf', '.docx', '.txt']
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
        if (!validExtensions.includes(ext)) {
            setError(`Unsupported file type "${ext}". Accepted: PDF, DOCX, TXT`)
            return
        }
        setSelectedFile(file)
        setError(null)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFileSelect(file)
    }, [handleFileSelect])

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    // --- Render ---
    if (isLoading) {
        return (
            <div className="kb-page">
                <div className="processing-overlay">
                    <Loader2 size={40} className="processing-spinner" />
                    <h3>Loading Knowledge Base...</h3>
                </div>
            </div>
        )
    }

    return (
        <div className="kb-page">
            {/* Page Header */}
            <div className="page-header">
                <h1>
                    <BookOpen size={28} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
                    Company Knowledge Base
                </h1>
                <p>
                    Provide information about your company through text, a questionnaire, or file upload.
                    AI will extract structured parameters for your outreach workflows.
                </p>
            </div>

            {/* API Key Banner */}
            <div className="api-key-banner">
                <Key size={20} className="banner-icon" />
                <span className="banner-text">
                    Enter your OpenAI API key to enable AI-powered extraction
                </span>
                <input
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
            </div>

            {/* Error Banner */}
            {error && (
                <div className="error-banner">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button className="dismiss-btn" onClick={clearError}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Input Mode Tabs */}
            <div className="input-mode-tabs">
                <button
                    className={`mode-tab ${inputMode === 'text' ? 'active' : ''}`}
                    onClick={() => setInputMode('text')}
                >
                    <Type size={16} /> Text / Paragraph
                </button>
                <button
                    className={`mode-tab ${inputMode === 'questionnaire' ? 'active' : ''}`}
                    onClick={() => setInputMode('questionnaire')}
                >
                    <ClipboardList size={16} /> Questionnaire
                </button>
                <button
                    className={`mode-tab ${inputMode === 'file' ? 'active' : ''}`}
                    onClick={() => setInputMode('file')}
                >
                    <Upload size={16} /> File Upload
                </button>
            </div>

            {/* Main Layout */}
            <div className="kb-layout">

                {/* Left — Input Section */}
                <div className="kb-input-section">
                    {isProcessing ? (
                        <div className="glass-panel">
                            <div className="processing-overlay">
                                <Sparkles size={44} className="processing-spinner" />
                                <h3>AI is analyzing your data...</h3>
                                <p>Extracting company parameters. This may take a few seconds.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ---- Text Mode ---- */}
                            {inputMode === 'text' && (
                                <div className="kb-editor glass-panel">
                                    <div className="editor-header">
                                        <h3>Paste Company Information</h3>
                                        <span className={`char-counter ${MAX_CHARS - textContent.length < 500 ? 'char-warning' : ''}`}>
                                            {MAX_CHARS - textContent.length} characters remaining
                                        </span>
                                    </div>
                                    <textarea
                                        className="kb-textarea"
                                        value={textContent}
                                        onChange={(e) => {
                                            if (e.target.value.length <= MAX_CHARS) setTextContent(e.target.value)
                                        }}
                                        placeholder={`Paste any text about your company here...\n\nExamples:\n• Company profile or about page\n• Product descriptions\n• Marketing copy\n• Investor pitch or one-pager\n\nThe AI will automatically extract structured parameters from your text.`}
                                        rows={12}
                                    />
                                    <div className="editor-actions">
                                        <button
                                            className="btn-primary"
                                            onClick={handleExtractFromText}
                                            disabled={!textContent.trim() || !apiKey}
                                        >
                                            <Sparkles size={16} /> Extract with AI
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => setTextContent('')}
                                            disabled={!textContent}
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ---- Questionnaire Mode ---- */}
                            {inputMode === 'questionnaire' && (
                                <div className="questionnaire-form">
                                    {PARAM_CARDS.map((card, idx) => (
                                        <div key={card.key} className="question-card glass-panel">
                                            <div className="question-number">{idx + 1}</div>
                                            <h4>{card.label}</h4>
                                            <p className="question-hint">{card.hint}</p>
                                            <textarea
                                                value={questionnaire[card.key]}
                                                onChange={(e) =>
                                                    setQuestionnaire((prev) => ({ ...prev, [card.key]: e.target.value }))
                                                }
                                                placeholder={`Enter your answer about ${card.label.toLowerCase()}...`}
                                                rows={3}
                                            />
                                        </div>
                                    ))}
                                    <div className="editor-actions">
                                        <button
                                            className="btn-primary"
                                            onClick={handleRefineQuestionnaire}
                                            disabled={!Object.values(questionnaire).some((v) => v.trim()) || !apiKey}
                                        >
                                            <Sparkles size={16} /> Refine with AI
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => {
                                                // Directly use the questionnaire answers without AI refinement
                                                setStructured({ ...questionnaire })
                                            }}
                                            disabled={!Object.values(questionnaire).some((v) => v.trim())}
                                        >
                                            Use as-is
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ---- File Upload Mode ---- */}
                            {inputMode === 'file' && (
                                <div>
                                    <div
                                        className={`file-upload-zone ${dragOver ? 'drag-over' : ''}`}
                                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload size={48} className="upload-icon" />
                                        <h3>Drop your file here</h3>
                                        <p>or click to browse</p>
                                        <div className="supported-types">
                                            <span className="file-type-badge">.PDF</span>
                                            <span className="file-type-badge">.DOCX</span>
                                            <span className="file-type-badge">.TXT</span>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.docx,.txt"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0]
                                                if (f) handleFileSelect(f)
                                            }}
                                        />
                                    </div>

                                    {selectedFile && (
                                        <div className="selected-file">
                                            <FileCheck size={24} className="file-icon" />
                                            <div className="file-details">
                                                <div className="file-name">{selectedFile.name}</div>
                                                <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                                            </div>
                                            <button className="remove-file" onClick={() => setSelectedFile(null)}>
                                                <X size={18} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="editor-actions" style={{ marginTop: '16px' }}>
                                        <button
                                            className="btn-primary"
                                            onClick={handleExtractFromFile}
                                            disabled={!selectedFile || !apiKey}
                                        >
                                            <Sparkles size={16} /> Extract from File
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Right — Structured Output Panel */}
                <div className="kb-structured-panel">
                    <div className="structured-header">
                        <h3>
                            <FileText size={18} />
                            Structured Parameters
                        </h3>
                        <span className="badge badge-info">{filledCount}/5 filled</span>
                    </div>

                    {PARAM_CARDS.map((card) => {
                        const Icon = card.icon
                        return (
                            <div key={card.key} className="param-card glass-panel">
                                <div className="param-card-header">
                                    <div className={`param-icon ${card.color}`}>
                                        <Icon size={16} />
                                    </div>
                                    <h4>{card.label}</h4>
                                </div>
                                <textarea
                                    value={structured[card.key]}
                                    onChange={(e) =>
                                        setStructured((prev) => ({ ...prev, [card.key]: e.target.value }))
                                    }
                                    placeholder={card.hint}
                                    rows={2}
                                />
                            </div>
                        )
                    })}

                    {/* Save Structured */}
                    <div className="save-structured-actions">
                        <button
                            className="btn-primary"
                            onClick={handleSaveStructured}
                            disabled={!hasStructuredData || isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={16} className="processing-spinner" /> Saving...
                                </>
                            ) : isSaved ? (
                                <>
                                    <CheckCircle size={16} /> Saved to Database!
                                </>
                            ) : (
                                <>
                                    <Save size={16} /> Save Knowledge Base
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KnowledgeBasePage
