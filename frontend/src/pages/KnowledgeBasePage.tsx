/*
  KnowledgeBasePage.tsx — Company Knowledge Base Module

  This page lets users enter company information that the AI will use
  as context when generating outreach messages. For the MVP, data is
  stored in local React state.

  Key concepts for someone new to React:
  - useState: Creates a piece of state that the component "remembers"
  - onChange: Fires every time the user types in the textarea
  - The component re-renders automatically when state changes
*/
import { useState } from 'react'
import { BookOpen, Save, CheckCircle, Info } from 'lucide-react'
import './KnowledgeBasePage.css'

/* Max characters allowed in the knowledge base text */
const MAX_CHARS = 3000

/* Hint cards — remind the user what kind of info to include */
const INFO_HINTS = [
    { title: 'Company Description', example: 'What does your company do?' },
    { title: 'Product Offering', example: 'What products or services do you sell?' },
    { title: 'Target Customers', example: 'Who is your ideal customer profile?' },
    { title: 'Value Proposition', example: 'What makes you different from competitors?' },
    { title: 'Messaging Tone', example: 'Formal, casual, friendly, authoritative?' },
]

function KnowledgeBasePage() {
    /* State for the text content the user types */
    const [content, setContent] = useState('')

    /* State to show a "saved" confirmation message */
    const [isSaved, setIsSaved] = useState(false)

    /* Handle the Save button click */
    const handleSave = () => {
        // For MVP, just show a confirmation. Later this will call the backend.
        console.log('Knowledge base saved:', content)
        setIsSaved(true)
        // Hide the confirmation after 2 seconds
        setTimeout(() => setIsSaved(false), 2000)
    }

    /* Calculate how many characters remain */
    const charsRemaining = MAX_CHARS - content.length

    return (
        <div className="kb-page">
            {/* Page Header */}
            <div className="page-header">
                <h1>
                    <BookOpen size={28} style={{ verticalAlign: 'middle', marginRight: '12px' }} />
                    Company Knowledge Base
                </h1>
                <p>
                    Provide information about your company. The AI will use this context
                    to generate personalized outreach messages for your leads.
                </p>
            </div>

            {/* Main content area: split into editor and hints */}
            <div className="kb-layout">
                {/* Left side — Text Editor */}
                <div className="kb-editor glass-panel">
                    <div className="editor-header">
                        <h3>Company Information</h3>
                        <span className={`char-counter ${charsRemaining < 200 ? 'char-warning' : ''}`}>
                            {charsRemaining} characters remaining
                        </span>
                    </div>

                    <textarea
                        className="kb-textarea"
                        value={content}
                        onChange={(e) => {
                            // Only update if within character limit
                            if (e.target.value.length <= MAX_CHARS) {
                                setContent(e.target.value)
                            }
                        }}
                        placeholder="Enter your company information here...&#10;&#10;Example:&#10;We are a B2B SaaS company that provides AI-powered analytics for e-commerce businesses. Our platform helps online retailers understand customer behavior, optimize pricing, and increase conversion rates..."
                        rows={14}
                    />

                    {/* Action buttons */}
                    <div className="editor-actions">
                        <button className="btn-primary" onClick={handleSave} disabled={content.length === 0}>
                            {isSaved ? (
                                <>
                                    <CheckCircle size={16} />
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Save Knowledge Base
                                </>
                            )}
                        </button>

                        <button
                            className="btn-secondary"
                            onClick={() => setContent('')}
                            disabled={content.length === 0}
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* Right side — Info Hint Cards */}
                <div className="kb-hints">
                    <h3 className="hints-title">
                        <Info size={18} />
                        What to include
                    </h3>
                    {INFO_HINTS.map((hint) => (
                        <div key={hint.title} className="hint-card glass-panel">
                            <h4>{hint.title}</h4>
                            <p>{hint.example}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default KnowledgeBasePage
