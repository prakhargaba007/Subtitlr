import React from 'react'
import FeedbackFormPage from '@/components/feedback/FeedbackFormPage'

function RequestFeaturePage() {
    return (
        <>
            <FeedbackFormPage title="Request a Feature" description="Tell us what you think we should build next." submitLabel="Request Feature" successTitle="Feature Request Submitted" successDescription="Thank you for your suggestion! We'll review it and get back to you soon." />
        </>
    )
}

export default RequestFeaturePage