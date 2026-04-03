export default function TestimonialsSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 mb-40">
      <div className="text-center mb-16">
        <h2 className="font-headline text-3xl font-bold mb-4">What Users Say</h2>
        <div className="h-1 w-12 bg-primary mx-auto rounded-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        {/* Testimonial 1 */}
        <div className="p-10 rounded-[2rem] bg-surface-container-lowest border border-outline-variant/10 editorial-glow relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
          <p className="font-headline text-xl md:text-2xl font-medium text-on-surface mb-8 leading-relaxed italic">
            &ldquo;Saved me hours of manual work. Captions are super accurate.&rdquo;
          </p>
          <div className="font-headline">
            <span className="block font-bold text-primary">— Aarav Mehta</span>
            <span className="text-sm text-on-surface-variant uppercase tracking-wider">Content Creator</span>
          </div>
        </div>

        {/* Testimonial 2 */}
        <div className="p-10 rounded-[2rem] bg-surface-container-lowest border border-outline-variant/10 editorial-glow relative overflow-hidden group">
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/5 rounded-full blur-3xl group-hover:bg-secondary/10 transition-colors" />
          <p className="font-headline text-xl md:text-2xl font-medium text-on-surface mb-8 leading-relaxed italic">
            &ldquo;We use this for quick subtitle generation before publishing videos.&rdquo;
          </p>
          <div className="font-headline">
            <span className="block font-bold text-primary">— Priya Sharma</span>
            <span className="text-sm text-on-surface-variant uppercase tracking-wider">Marketing Team</span>
          </div>
        </div>

        {/* Testimonial 3 — full width centered */}
        <div className="md:col-span-2 max-w-2xl mx-auto w-full p-10 rounded-[2rem] bg-surface-container-lowest border border-outline-variant/10 editorial-glow relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/5 opacity-50" />
          <p className="font-headline text-xl md:text-2xl font-medium text-on-surface mb-8 leading-relaxed text-center italic">
            &ldquo;Simple, fast, and does exactly what it promises.&rdquo;
          </p>
          <div className="font-headline text-center">
            <span className="block font-bold text-primary">— Rahul Verma</span>
            <span className="text-sm text-on-surface-variant uppercase tracking-wider">Freelancer</span>
          </div>
        </div>

      </div>
    </section>
  );
}
