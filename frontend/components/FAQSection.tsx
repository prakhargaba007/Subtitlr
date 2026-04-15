"use client";

import { useState } from "react";

const faqs = [
  {
    q: "How accurate is the transcription?",
    a: "We achieve 98%+ accuracy across most major languages by using advanced contextual language models that process entire sentence structures rather than isolated words.",
  },
  {
    q: "What languages do you support?",
    a: "We currently support over 60 languages for transcription and dubbing including English, Spanish, French, German, Hindi, Japanese, and Korean. Auto-detection is available for seamless processing.",
  },
  {
    q: "Are my files secure and private?",
    a: "Yes. All uploads are encrypted in transit and at rest. Files and transcripts are only accessible to you and your team. We comply with strict GDPR data processing guidelines.",
  },
  {
    q: "How long does processing take?",
    a: "Transcription is generally completed in 15% of the media's duration (e.g., a 10-minute video takes about 90 seconds). Dubbing processes vary but typically complete in near real-time.",
  },
  {
    q: "What happens to my files after processing?",
    a: "By default, files are securely stored in your personal workspace for easy editing and re-export. You can delete them at any time, which permanently removes them from our servers.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="max-w-4xl mx-auto px-8 mb-40">
      <div className="text-center mb-12">
        <h2 className="font-headline text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
        <p className="text-on-surface-variant text-body-lg max-w-2xl mx-auto">
          Everything you need to know about Dubbing Studio's accuracy, privacy, and processing.
        </p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className={`border border-outline-variant/20 rounded-2xl overflow-hidden transition-colors ${isOpen ? "bg-surface-container-low" : "bg-transparent hover:bg-surface-container-lowest"}`}
            >
              <button
                type="button"
                className="w-full text-left px-6 py-5 flex items-center justify-between font-headline font-bold text-lg"
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                <span>{faq.q}</span>
                <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>
              <div
                className="px-6 text-on-surface-variant overflow-hidden transition-all duration-300"
                style={{ maxHeight: isOpen ? "200px" : "0", paddingBottom: isOpen ? "20px" : "0" }}
              >
                <p className="opacity-90 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
