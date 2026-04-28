export default function FeedbackPage() {
  const title = (
    <>
      We&apos;d love your{" "}
      <span className="text-primary bg-clip-text bg-linear-to-r from-primary to-secondary">feedback</span>
    </>
  );

  return <FeedbackFormPage title={title as unknown as string} />;
}

import FeedbackFormPage from "@/components/feedback/FeedbackFormPage";
