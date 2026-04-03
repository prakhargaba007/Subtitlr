const links = [
  "Privacy Policy",
  "Terms of Service",
  "Status",
  "Contact Us",
  "Twitter",
  "GitHub",
];

export default function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200/50">
      <div className="flex flex-col md:flex-row justify-between items-center px-8 py-12 max-w-7xl mx-auto">
        <div className="mb-8 md:mb-0">
          <div className="text-xl font-bold text-slate-900 font-headline mb-2">
            Subtitlr
          </div>
          <p className="font-body text-sm leading-relaxed text-slate-500 max-w-xs">
            © 2024 Subtitlr AI. The Intelligent Canvas for Transcription.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 font-body text-sm">
          {links.map((link) => (
            <a
              key={link}
              href="#"
              className="text-slate-500 hover:text-indigo-500 transition-all opacity-80 hover:opacity-100"
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
