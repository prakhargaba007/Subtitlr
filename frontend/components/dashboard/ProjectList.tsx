import ProjectCard, { type Project } from "./ProjectCard";

const RECENT_PROJECTS: Project[] = [
  {
    id: 1,
    name: "Keynote_Interview_Final.mp4",
    meta: "Modified 2h ago • 12:45 min",
    status: "Ready",
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAB8yi7lJltU8l7hQCgShmBz-10jYoY9rgP6MsqPIaEdNjNbv1pc75lox-NXAHixQF7ATHOe0B2yKjV4VOMl5Xa6Pp-eb0iUnbZWpaoxToQpFLnjaZwVzd53x1H0oLqx6bf67-fXCnQpa5ys_AvFtM0H3eaQmmtbdUT_rc0GaJijAoknX7iwCZJrZiUkSdd8GjA159LfE1rHtaQDMHZmRRoFj_ZGOi7Pruw4yzYzphhVxlbOrtVswJghtUS0SKAPv_BC-uYzcapdok",
  },
  {
    id: 2,
    name: "Product_Podcast_E04.wav",
    meta: "Modified 5h ago • 45:20 min",
    status: "Syncing",
    icon: "mic",
  },
  {
    id: 3,
    name: "Corporate_Brand_Manifesto.mp4",
    meta: "Modified Yesterday • 02:15 min",
    status: "Ready",
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDHgkeiJFAi2VfBQTSA_lYT9hKPZwdzu_Ldx1EEO8RJMRWNb7D1GMCXIYEuytUsTGAIoKIrQvK7-KflZuQRFxK2CQujPzDllsnNAukFqh9V7vMviyHvc73LvMNhknriD9AzokC5_zOdyLQMOKn8iH47Z8vN7uGhXILqnK7suz__RkjjABMjczUPRXlapm3jkol6kKhVqhrUlvCdCUHSb-OxRhL13fe2yfa6rkK-dz4UUzuLBYA55fFj5hRWm6fTeEWYzxW3VIuD2Xc",
  },
];

export default function ProjectList() {
  return (
    <section>
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-xl font-extrabold text-on-surface font-headline">Recent Projects</h3>
        <a
          href="#"
          className="text-sm font-bold text-primary hover:underline flex items-center gap-1 font-label"
        >
          See All
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </a>
      </div>

      <div className="space-y-3">
        {RECENT_PROJECTS.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
