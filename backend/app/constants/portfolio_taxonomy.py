"""Fixed portfolio category taxonomy for main and sub categories."""

PORTFOLIO_TAXONOMY: dict[str, list[str]] = {
    "Design & Creative": [
        "Logo Design",
        "Brand Identity",
        "Packaging Design",
        "Social Media Design",
        "UI/UX Design",
        "Illustration",
        "Print Design",
        "Presentation Design",
        "Video Editing / Motion Graphics",
    ],
    "Web, Mobile & Software Development": [
        "Web Development",
        "React / Next.js",
        "WordPress",
        "Shopify",
        "SaaS Dashboard",
        "Backend / API",
        "Mobile App Development",
        "Landing Pages",
    ],
    "AI, Automation & Data": [
        "AI Chatbots",
        "AI Automation",
        "OpenAI / Gemini API",
        "OCR",
        "Data Extraction",
        "Python Automation",
        "Workflow Automation",
        "RAG / Vector Search",
    ],
    "Marketing & Sales": [
        "Social Media Marketing",
        "SEO",
        "Paid Ads",
        "Email Marketing",
        "Lead Generation",
        "Copywriting",
    ],
    "Business & Admin": [
        "Virtual Assistant",
        "Data Entry",
        "CRM",
        "Project Management",
        "Customer Support",
    ],
}

PORTFOLIO_SOURCE_TYPES: tuple[str, ...] = (
    "behance",
    "google_drive",
    "website",
    "pdf",
    "case_study",
    "dribbble",
    "figma",
    "manual",
)
