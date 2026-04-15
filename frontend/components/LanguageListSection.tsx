export default function LanguageListSection() {
  return (
    <section className="max-w-4xl mx-auto px-8 mb-40 text-center">
      <h2 className="font-headline text-2xl font-bold mb-4">Supported Languages</h2>
      <p className="text-on-surface-variant text-body max-w-2xl mx-auto mb-8">
        We support 60+ spoken languages and dialects. Auto-detect identifies the language instantly.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {["English (US, UK, AU)", "Spanish", "French", "German", "Hindi", "Japanese", "Korean", "Mandarin", "Portuguese", "Italian", "Arabic", "Russian", "Dutch", "Turkish", "+ 50 more"].map((lang) => (
          <span key={lang} className="px-4 py-2 bg-surface-container-low rounded-2xl text-sm font-headline font-medium text-on-surface hover:bg-surface-container transition-colors cursor-default border border-outline-variant/10">
            {lang}
          </span>
        ))}
      </div>
    </section>
  );
}
