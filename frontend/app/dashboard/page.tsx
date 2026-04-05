import UploadZone from "@/components/dashboard/UploadZone";
import ProjectList from "@/components/dashboard/ProjectList";
import FadingCircle from "@/components/FadingCircle";

export default function DashboardPage() {
    return (
        <div className="relative">
            {/* Ambient glow */}
            <div
                className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none z-0"
                style={{
                    background:
                        "radial-gradient(circle, rgba(57,44,193,0.05) 0%, rgba(247,249,251,0) 70%)",
                }}
            />
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[15%] z-10">
                <FadingCircle size={560} color="var(--color-primary)" />
            </div>

            <div className="max-w-4xl mx-auto px-8 py-12 relative z-10">
                {/* Hero copy */}
                <div className="mb-12 text-center">
                    <h2 className="text-4xl lg:text-5xl font-extrabold text-on-surface tracking-tight mb-4 font-headline">
                        What are we creating today?
                    </h2>
                    <p className="text-on-surface-variant text-lg font-body">
                        Good morning, Alex. Upload your media and let&apos;s get to work.
                    </p>
                </div>

                <UploadZone />
                <ProjectList />
            </div>
        </div>
    );
}
