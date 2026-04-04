const LINKS = [
  "Privacy Policy",
  "Terms of Service",
  "Help Center",
  "API Status",
  "Twitter",
  "GitHub",
];

export default function Footer() {
  return (
    <footer className="border-t border-outline-variant/20 py-10 bg-surface">
      <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-7xl mx-auto gap-4">
        <div className="mb-4 md:mb-0 text-center md:text-left">
          <p className="font-headline font-bold text-on-surface mb-0.5">Subtitlr</p>
          <p className="text-sm text-on-surface-variant">
            © 2026 Subtitlr AI. All rights reserved.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
